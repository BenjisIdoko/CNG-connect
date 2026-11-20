import { describe, it, expect, vi, beforeEach } from 'vitest';

const getUser = vi.fn();
const sendNotification = vi.fn();
const setVapidDetails = vi.fn();
const createClient = vi.fn();
const calls: Array<[string, string, unknown[]]> = [];
const results: Record<string, any> = {};

// A chainable fake of the Supabase query builder (awaiting it gives the configured result for the table and
// the first verb used).
function query(table: string) {
  let verb = '';
  const q: any = new Proxy(
    {},
    {
      get: (_t, prop: string) => {
        if (prop === 'then') {
          return (resolve: (v: unknown) => void) => resolve((results[table] || {})[verb || 'select'] ?? { data: null, error: null });
        }
        return (...args: unknown[]) => {
          if (!verb && ['select', 'insert', 'update', 'delete'].includes(prop)) verb = prop;
          calls.push([table, prop, args]);
          return q;
        };
      },
    },
  );
  return q;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => {
    createClient(...args);
    return { auth: { getUser }, from: (table: string) => query(table) };
  },
}));
// web-push 4 is an ES module with NAMED exports and no default export.
vi.mock('web-push', () => ({
  setVapidDetails: (...a: unknown[]) => setVapidDetails(...a),
  sendNotification: (...a: unknown[]) => sendNotification(...a),
}));

import handler, { TEST_NOTIFICATION } from './notify-test';

function makeRes() {
  const res: any = { statusCode: 0, body: undefined };
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body: unknown) => {
    res.body = body;
    return res;
  };
  return res;
}

const post = (body: unknown, token: string | null = 'user-token') => ({
  method: 'POST',
  headers: token ? { authorization: `Bearer ${token}` } : {},
  body,
});

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'anon';
  process.env.VAPID_PUBLIC_KEY = 'pub';
  process.env.VAPID_PRIVATE_KEY = 'priv';
  process.env.VAPID_SUBJECT = 'mailto:owner@example.com';
  createClient.mockReset();
  getUser.mockReset().mockResolvedValue({ data: { user: { id: 'user-' + Math.random() } }, error: null });
  sendNotification.mockReset().mockResolvedValue({ statusCode: 201 });
  setVapidDetails.mockReset();
  calls.length = 0;
  for (const k of Object.keys(results)) delete results[k];
  results.push_subscriptions = {
    select: {
      data: [
        { endpoint: 'https://push.example/phone', p256dh: 'p', auth: 'a' },
        { endpoint: 'https://push.example/tablet', p256dh: 'p', auth: 'a' },
      ],
      error: null,
    },
    delete: { data: null, error: null },
  };
});

describe('the test alert text', () => {
  it('says it is a test, names no one, and opens the app', () => {
    expect(TEST_NOTIFICATION).toEqual({
      title: 'CNG-Connect test alert',
      body: 'Alerts are working on this phone.',
      url: '/',
      tag: 'cng-test',
    });
  });
});

describe('notify-test handler', () => {
  it('only accepts POST', async () => {
    const res = makeRes();
    await handler({ method: 'GET', headers: {} }, res);
    expect(res.statusCode).toBe(405);
  });

  it('says it is not set up, quietly, when a setting is missing', async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    const res = makeRes();
    await handler(post({}), res);
    expect(res.statusCode).toBe(503);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('needs a signed-in caller', async () => {
    const res = makeRes();
    await handler(post({}, null), res);
    expect(res.statusCode).toBe(401);
    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad jwt' } });
    const res2 = makeRes();
    await handler(post({}), res2);
    expect(res2.statusCode).toBe(401);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('works as the caller (their own sign-in), never with a service key', async () => {
    await handler(post({}), makeRes());
    const [, key, options] = createClient.mock.calls[0];
    expect(key).toBe('anon');
    expect(JSON.stringify(options)).toContain('Bearer user-token');
  });

  it('sends to all of the caller\'s own phones when none is named, only their own rows', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'caller-1' } }, error: null });
    const res = makeRes();
    await handler(post({}), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ sent: 2, devices: 2, removed: 0 });
    expect(calls).toContainEqual(['push_subscriptions', 'eq', ['user_id', 'caller-1']]);
    const [, payload, options] = sendNotification.mock.calls[0];
    expect(JSON.parse(payload as string)).toEqual(TEST_NOTIFICATION);
    expect(options).toMatchObject({ TTL: 300 });
    expect(setVapidDetails).toHaveBeenCalledWith('mailto:owner@example.com', 'pub', 'priv');
  });

  it('sends only to the named phone when the app says which one this is', async () => {
    results.push_subscriptions.select = { data: [{ endpoint: 'https://push.example/phone', p256dh: 'p', auth: 'a' }], error: null };
    const res = makeRes();
    await handler(post({ endpoint: 'https://push.example/phone' }), res);
    expect(calls).toContainEqual(['push_subscriptions', 'eq', ['endpoint', 'https://push.example/phone']]);
    expect(res.body).toEqual({ sent: 1, devices: 1, removed: 0 });
  });

  it('answers "no devices" without sending when the caller has no registered phone', async () => {
    results.push_subscriptions.select = { data: [], error: null };
    const res = makeRes();
    await handler(post({}), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ sent: 0, devices: 0, removed: 0 });
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('removes a phone the push service says is gone, and never echoes a provider error', async () => {
    sendNotification.mockImplementation(async (sub: { endpoint: string }) => {
      if (sub.endpoint.endsWith('/tablet')) throw Object.assign(new Error('secret-detail from provider'), { statusCode: 410 });
      return { statusCode: 201 };
    });
    const res = makeRes();
    await handler(post({}), res);
    expect(res.body).toEqual({ sent: 1, devices: 2, removed: 1 });
    expect(JSON.stringify(res.body)).not.toContain('secret-detail');
    expect(calls.some(([t, m]) => t === 'push_subscriptions' && m === 'delete')).toBe(true);
  });

  it('reports a provider failure that is not "gone" as not sent, without deleting', async () => {
    sendNotification.mockRejectedValue(Object.assign(new Error('boom'), { statusCode: 500 }));
    const res = makeRes();
    await handler(post({}), res);
    expect(res.body).toEqual({ sent: 0, devices: 2, removed: 0 });
    expect(calls.some(([t, m]) => t === 'push_subscriptions' && m === 'delete')).toBe(false);
  });

  it('fails plainly, sending nothing, when the phones cannot be read', async () => {
    results.push_subscriptions.select = { data: null, error: { message: 'read failed' } };
    const res = makeRes();
    await handler(post({}), res);
    expect(res.statusCode).toBe(500);
    expect(sendNotification).not.toHaveBeenCalled();
    expect(JSON.stringify(res.body)).not.toContain('read failed');
  });

  it('refuses a huge or non-text phone address', async () => {
    for (const endpoint of ['x'.repeat(2500), 42, {}]) {
      const res = makeRes();
      await handler(post({ endpoint }), res);
      expect(res.statusCode).toBe(400);
    }
  });

  it('limits one caller to a few test alerts a minute', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'same-user' } }, error: null });
    const codes: number[] = [];
    for (let i = 0; i < 7; i += 1) {
      const res = makeRes();
      await handler(post({}), res);
      codes.push(res.statusCode);
    }
    expect(codes.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
    expect(codes[5]).toBe(429);
  });
});
