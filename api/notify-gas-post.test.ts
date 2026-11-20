import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeStateName } from '../src/utils/permissionManager';

const getUser = vi.fn();
const sendNotification = vi.fn();
const setVapidDetails = vi.fn();
const createClient = vi.fn();
const calls: Array<[string, string, unknown[]]> = [];
const results: Record<string, any> = {};

// A chainable fake of the Supabase query builder: every method returns the same object, and awaiting it
// gives the result configured for that table and the first verb used (select / insert / update / delete).
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
vi.mock('web-push', () => ({ default: { setVapidDetails: (...a: unknown[]) => setVapidDetails(...a), sendNotification: (...a: unknown[]) => sendNotification(...a) } }));

import handler, { buildNotification, normalizeState, pickAudience, sameState, shouldNotify } from './notify-gas-post';

const NOW = Date.parse('2026-11-20T12:00:00Z');
const MIN = 60_000;

describe('buildNotification', () => {
  it('says what happened and where, with no names, and opens the station', () => {
    expect(buildNotification({ stationId: 'pci-station-65', stationName: 'NNPC Kubwa', city: 'Abuja', available: true })).toEqual({
      title: 'Gas available at NNPC Kubwa',
      body: 'A community manager says · Abuja',
      url: '/?station=pci-station-65',
      tag: 'station-pci-station-65',
    });
    expect(buildNotification({ stationId: 's1', stationName: 'NNPC Kubwa', city: '', available: false })).toMatchObject({
      title: 'Gas not available at NNPC Kubwa',
      body: 'A community manager says',
    });
  });

  it('cleans control characters and limits the name', () => {
    const n = buildNotification({ stationId: 's 1', stationName: 'A\r\nB'.padEnd(200, 'x'), city: 'Lagos', available: true });
    expect(n.title).not.toMatch(/[\r\n]/);
    expect(n.title.length).toBeLessThanOrEqual('Gas available at '.length + 80);
    expect(n.url).toBe('/?station=s%201');
  });
});

describe('state matching', () => {
  it('matches the same state however it is written, and nothing when either is missing', () => {
    expect(sameState('Abuja FCT', 'FCT')).toBe(true);
    expect(sameState('Lagos', 'lagos state')).toBe(true);
    expect(sameState('Lagos', 'Abuja FCT')).toBe(false);
    expect(sameState(undefined, 'Lagos')).toBe(false);
    expect(sameState('Lagos', null)).toBe(false);
  });

  it("is the same rule the app uses (copied here because api files cannot import from src)", () => {
    for (const s of ['Abuja FCT', 'FCT', 'Lagos State', 'Edo', 'Benin City', 'Oyo', 'Ibadan', 'Rivers', 'Port Harcourt', 'Kano', 'Ogun', 'Delta', 'Kaduna', 'Enugu', 'Ondo', 'Ekiti', 'Plateau (Jos)', '', 'Zamfara State']) {
      expect(normalizeState(s)).toBe(normalizeStateName(s));
    }
  });
});

describe('shouldNotify', () => {
  it('sends the first time', () => {
    expect(shouldNotify({ last: null, state: 'selling', now: NOW })).toEqual({ send: true });
  });

  it('waits 15 minutes between notifications for one station', () => {
    expect(shouldNotify({ last: { state: 'out', sentAt: NOW - 10 * MIN }, state: 'selling', now: NOW })).toEqual({ send: false, reason: 'recent' });
    expect(shouldNotify({ last: { state: 'out', sentAt: NOW - 16 * MIN }, state: 'selling', now: NOW })).toEqual({ send: true });
  });

  it('does not repeat the same status within 6 hours, but does after', () => {
    expect(shouldNotify({ last: { state: 'selling', sentAt: NOW - 3 * 60 * MIN }, state: 'selling', now: NOW })).toEqual({ send: false, reason: 'unchanged' });
    expect(shouldNotify({ last: { state: 'selling', sentAt: NOW - 7 * 60 * MIN }, state: 'selling', now: NOW })).toEqual({ send: true });
  });
});

describe('pickAudience', () => {
  const sub = (id: string, user: string, state: string | null, favorites: string[] = []) => ({
    id,
    user_id: user,
    endpoint: `https://push.example/${id}`,
    p256dh: 'p',
    auth: 'a',
    state,
    favorite_station_ids: favorites,
  });
  const station = { id: 's1', state: 'Abuja FCT' };

  it('takes the same state and anyone who favourited the station, never the poster', () => {
    const subs = [
      sub('a', 'u1', 'Abuja FCT'),
      sub('b', 'u2', 'Lagos'),
      sub('c', 'u3', 'Lagos', ['s1']),
      sub('d', 'poster', 'Abuja FCT'),
      sub('e', 'u5', null),
      sub('f', 'u6', 'FCT'),
    ];
    expect(pickAudience(subs, station, 'poster').map((s) => s.id)).toEqual(['a', 'c', 'f']);
  });

  it('lists each phone once', () => {
    const subs = [sub('a', 'u1', 'Abuja FCT', ['s1']), sub('a', 'u1', 'Abuja FCT', ['s1'])];
    expect(pickAudience(subs, station, 'poster')).toHaveLength(1);
  });
});

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
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
  process.env.VAPID_PUBLIC_KEY = 'pub';
  process.env.VAPID_PRIVATE_KEY = 'priv';
  process.env.VAPID_SUBJECT = 'mailto:owner@example.com';
  createClient.mockReset();
  getUser.mockReset().mockResolvedValue({ data: { user: { id: 'poster-' + Math.random() } }, error: null });
  sendNotification.mockReset().mockResolvedValue({ statusCode: 201 });
  setVapidDetails.mockReset();
  calls.length = 0;
  for (const k of Object.keys(results)) delete results[k];
  results.community_managers = { select: { data: { user_id: 'x' }, error: null } };
  results.station_manager_posts = { select: { data: { state: 'selling', created_at: new Date().toISOString() }, error: null } };
  results.stations = { select: { data: { id: 's1', name: 'NNPC Kubwa', city: 'Abuja', state: 'Abuja FCT' }, error: null } };
  results.push_notification_log = { select: { data: null, error: null }, insert: { data: { id: 'log1' }, error: null }, update: { data: null, error: null } };
  results.push_subscriptions = {
    select: {
      data: [
        { id: 'a', user_id: 'u1', endpoint: 'https://push.example/a', p256dh: 'p', auth: 'a', state: 'Abuja FCT', favorite_station_ids: [] },
        { id: 'b', user_id: 'u2', endpoint: 'https://push.example/b', p256dh: 'p', auth: 'a', state: 'Lagos', favorite_station_ids: [] },
        { id: 'c', user_id: 'u3', endpoint: 'https://push.example/c', p256dh: 'p', auth: 'a', state: 'Lagos', favorite_station_ids: ['s1'] },
      ],
      error: null,
    },
    delete: { data: null, error: null },
  };
});

describe('notify-gas-post handler', () => {
  it('only accepts POST', async () => {
    const res = makeRes();
    await handler({ method: 'GET', headers: {} }, res);
    expect(res.statusCode).toBe(405);
  });

  it('says it is not set up, quietly, when a setting is missing', async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    const res = makeRes();
    await handler(post({ stationId: 's1' }), res);
    expect(res.statusCode).toBe(503);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('needs a signed-in caller', async () => {
    const res = makeRes();
    await handler(post({ stationId: 's1' }, null), res);
    expect(res.statusCode).toBe(401);
    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad jwt' } });
    const res2 = makeRes();
    await handler(post({ stationId: 's1' }), res2);
    expect(res2.statusCode).toBe(401);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('refuses anyone who is not a community manager', async () => {
    results.community_managers = { select: { data: null, error: null } };
    const res = makeRes();
    await handler(post({ stationId: 's1' }), res);
    expect(res.statusCode).toBe(403);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('sends nothing unless the caller really just posted for that station', async () => {
    results.station_manager_posts = { select: { data: null, error: null } };
    const res = makeRes();
    await handler(post({ stationId: 's1' }), res);
    expect(res.statusCode).toBe(409);
    results.station_manager_posts = { select: { data: { state: 'selling', created_at: new Date(Date.now() - 20 * MIN).toISOString() }, error: null } };
    const res2 = makeRes();
    await handler(post({ stationId: 's1' }), res2);
    expect(res2.statusCode).toBe(409);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('does not send an old post-type that is not a gas post', async () => {
    results.station_manager_posts = { select: { data: { state: 'closed', created_at: new Date().toISOString() }, error: null } };
    const res = makeRes();
    await handler(post({ stationId: 's1' }), res);
    expect(res.statusCode).toBe(409);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('skips when the station was notified a few minutes ago', async () => {
    results.push_notification_log.select = { data: { state: 'out', sent_at: new Date(Date.now() - 5 * MIN).toISOString() }, error: null };
    const res = makeRes();
    await handler(post({ stationId: 's1' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ sent: 0, skipped: 'recent' });
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('sends to the same state and to favourites, with the station tag and one hour to live', async () => {
    const res = makeRes();
    await handler(post({ stationId: 's1' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ sent: 2 });
    const endpoints = sendNotification.mock.calls.map((c) => (c[0] as { endpoint: string }).endpoint).sort();
    expect(endpoints).toEqual(['https://push.example/a', 'https://push.example/c']);
    const [, payload, options] = sendNotification.mock.calls[0];
    expect(JSON.parse(payload as string)).toEqual({
      title: 'Gas available at NNPC Kubwa',
      body: 'A community manager says · Abuja',
      url: '/?station=s1',
      tag: 'station-s1',
    });
    expect(options).toMatchObject({ TTL: 3600 });
    expect(setVapidDetails).toHaveBeenCalledWith('mailto:owner@example.com', 'pub', 'priv');
  });

  it('says "not available" for an out post', async () => {
    results.station_manager_posts = { select: { data: { state: 'out', created_at: new Date().toISOString() }, error: null } };
    const res = makeRes();
    await handler(post({ stationId: 's1' }), res);
    expect(JSON.parse(sendNotification.mock.calls[0][1] as string).title).toBe('Gas not available at NNPC Kubwa');
  });

  it('removes phones the push service says are gone, and never echoes a provider error', async () => {
    sendNotification.mockImplementation(async (sub: { endpoint: string }) => {
      if (sub.endpoint.endsWith('/a')) throw Object.assign(new Error('Received unexpected response code secret-detail'), { statusCode: 410 });
      return { statusCode: 201 };
    });
    const res = makeRes();
    await handler(post({ stationId: 's1' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ sent: 1, removed: 1 });
    expect(JSON.stringify(res.body)).not.toContain('secret-detail');
    expect(calls.some(([t, m]) => t === 'push_subscriptions' && m === 'delete')).toBe(true);
  });

  it('survives a provider failure that is not "gone"', async () => {
    sendNotification.mockRejectedValue(Object.assign(new Error('boom'), { statusCode: 500 }));
    const res = makeRes();
    await handler(post({ stationId: 's1' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ sent: 0, removed: 0 });
  });

  it('rejects a missing or huge station id', async () => {
    for (const stationId of [undefined, '', 'x'.repeat(200), 42]) {
      const res = makeRes();
      await handler(post({ stationId }), res);
      expect(res.statusCode).toBe(400);
    }
  });

  it('limits one caller to a handful of requests a minute', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'same-poster' } }, error: null });
    let last = 0;
    for (let i = 0; i < 12; i += 1) {
      const res = makeRes();
      await handler(post({ stationId: 's1' }), res);
      last = res.statusCode;
    }
    expect(last).toBe(429);
  });
});
