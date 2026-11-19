import { describe, it, expect, vi, beforeEach } from 'vitest';

const getUser = vi.fn();
const rpc = vi.fn();
const maybeSingle = vi.fn();
const createClient = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => {
    createClient(...args);
    return {
      auth: { getUser },
      rpc,
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
    };
  },
}));

import handler from './invite-manager';

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

const post = (body: unknown, token: string | null = 'admin-token') => ({
  method: 'POST',
  headers: token ? { authorization: `Bearer ${token}` } : {},
  body,
});

const fetchMock = vi.fn();

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'anon';
  process.env.RESEND_API_KEY = 're_test';
  process.env.INVITE_FROM_EMAIL = 'CNG-Connect <no-reply@cngconnect.com.ng>';
  createClient.mockReset();
  getUser.mockReset().mockResolvedValue({ data: { user: { id: 'admin-' + Math.random() } }, error: null });
  rpc.mockReset().mockResolvedValue({ data: 'invited', error: null });
  maybeSingle.mockReset().mockResolvedValue({ data: { name: 'NNPC filling station ushafa' }, error: null });
  fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'email-1' }) });
  vi.stubGlobal('fetch', fetchMock);
});

describe('api/invite-manager', () => {
  it('rejects non-POST methods', async () => {
    const res = makeRes();
    await handler({ method: 'GET', headers: {} }, res);
    expect(res.statusCode).toBe(405);
  });

  it('rejects a request with no bearer token and sends nothing', async () => {
    const res = makeRes();
    await handler(post({ stationId: 'pci-station-65', email: 'a@b.co' }, null), res);
    expect(res.statusCode).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a bad email before touching the database or sending mail', async () => {
    const res = makeRes();
    await handler(post({ stationId: 'pci-station-65', email: 'not-an-email' }), res);
    expect(res.statusCode).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers 403 and sends no email when the caller is not the app admin', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'not authorized' } });
    const res = makeRes();
    await handler(post({ stationId: 'pci-station-65', email: 'a@b.co' }), res);
    expect(res.statusCode).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('runs the invite as the signed-in caller, lower-cases the email and sends the invite email', async () => {
    const res = makeRes();
    await handler(post({ stationId: 'pci-station-65', email: ' UxBenjis@Gmail.com ' }), res);

    expect(createClient.mock.calls[0][2]).toMatchObject({ global: { headers: { Authorization: 'Bearer admin-token' } } });
    expect(rpc).toHaveBeenCalledWith('admin_invite_station_manager', { p_station_id: 'pci-station-65', p_email: 'uxbenjis@gmail.com' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe('Bearer re_test');
    const sent = JSON.parse(init.body);
    expect(sent.to).toEqual(['uxbenjis@gmail.com']);
    expect(sent.from).toBe('CNG-Connect <no-reply@cngconnect.com.ng>');
    expect(sent.subject).toContain('NNPC filling station ushafa');
    expect(sent.text).toContain('https://cngconnect.com.ng/station-manager');

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ result: 'invited', emailed: true });
  });

  it('still saves the invite and reports emailed:false when the email service is not set up', async () => {
    delete process.env.RESEND_API_KEY;
    const res = makeRes();
    await handler(post({ stationId: 'pci-station-65', email: 'a@b.co' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ result: 'invited', emailed: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports emailed:false, without leaking the provider error, when the email service refuses', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403, json: async () => ({ message: 'domain not verified re_secret' }) });
    const res = makeRes();
    await handler(post({ stationId: 'pci-station-65', email: 'a@b.co' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ result: 'invited', emailed: false });
  });

  it('reports emailed:false when the email request throws', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const res = makeRes();
    await handler(post({ stationId: 'pci-station-65', email: 'a@b.co' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ result: 'invited', emailed: false });
  });

  it('passes "assigned" through when that email already had an account', async () => {
    rpc.mockResolvedValue({ data: 'assigned', error: null });
    const res = makeRes();
    await handler(post({ stationId: 'pci-station-65', email: 'a@b.co' }), res);
    expect(res.body).toEqual({ result: 'assigned', emailed: true });
  });

  it('limits one caller to a few invites a minute', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'same-admin' } }, error: null });
    let last = 0;
    for (let i = 0; i < 12; i++) {
      const res = makeRes();
      await handler(post({ stationId: 'pci-station-65', email: `p${i}@b.co` }), res);
      last = res.statusCode;
    }
    expect(last).toBe(429);
  });
});
