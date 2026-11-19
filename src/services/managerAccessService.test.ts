import { describe, expect, it, vi } from 'vitest';
import {
  cancelStationManagerInvite,
  claimManagerInvites,
  describeInviteOutcome,
  friendlyAccessError,
  inviteStationManager,
  isPlausibleEmail,
  postManagerState,
  sendManagerInvite,
} from './managerAccessService';

const clientReturning = (data: unknown, error: { message: string } | null = null) => ({
  rpc: vi.fn().mockResolvedValue({ data, error }),
});

describe('isPlausibleEmail', () => {
  it('accepts normal addresses and rejects blanks and obvious mistakes', () => {
    for (const ok of ['a@b.co', 'ada.obi+cng@example.com', ' Ada@Example.COM ']) expect(isPlausibleEmail(ok)).toBe(true);
    for (const bad of ['', '   ', 'no-at-sign', '@example.com', 'a@', 'a b@example.com', 'a@b', 'x'.repeat(260) + '@example.com']) {
      expect(isPlausibleEmail(bad)).toBe(false);
    }
  });
});

describe('postManagerState', () => {
  it('sends p_station_id and p_state and returns ok', async () => {
    const client = clientReturning(null);
    await expect(postManagerState(client, 'nipco-1', 'selling')).resolves.toEqual({ ok: true });
    expect(client.rpc).toHaveBeenCalledWith('manager_post_state', { p_station_id: 'nipco-1', p_state: 'selling' });
  });

  it('with no details the arguments are exactly the two the older app sends', async () => {
    const client = clientReturning(null);
    await postManagerState(client, 'nipco-1', 'closed');
    await postManagerState(client, 'nipco-1', 'closed', {});
    expect(client.rpc).toHaveBeenNthCalledWith(1, 'manager_post_state', { p_station_id: 'nipco-1', p_state: 'closed' });
    expect(client.rpc).toHaveBeenNthCalledWith(2, 'manager_post_state', { p_station_id: 'nipco-1', p_state: 'closed' });
  });

  it('sends a reason and an expected time with a closed or open post', async () => {
    const client = clientReturning(null);
    const untilIso = '2026-11-19T13:00:00.000Z';
    await postManagerState(client, 'nipco-1', 'closed', { reason: 'supply', untilIso });
    await postManagerState(client, 'nipco-1', 'open', { reason: 'fault' });
    expect(client.rpc).toHaveBeenNthCalledWith(1, 'manager_post_state', {
      p_station_id: 'nipco-1',
      p_state: 'closed',
      p_reason: 'supply',
      p_until: untilIso,
    });
    expect(client.rpc).toHaveBeenNthCalledWith(2, 'manager_post_state', { p_station_id: 'nipco-1', p_state: 'open', p_reason: 'fault' });
  });

  it('never sends details with a selling post', async () => {
    const client = clientReturning(null);
    await postManagerState(client, 'nipco-1', 'selling', { reason: 'supply', untilIso: '2026-11-19T13:00:00.000Z' });
    expect(client.rpc).toHaveBeenCalledWith('manager_post_state', { p_station_id: 'nipco-1', p_state: 'selling' });
  });

  it('rejects an unknown state without calling the database', async () => {
    const client = clientReturning(null);
    const result = await postManagerState(client, 'nipco-1', 'maybe' as never);
    expect(result.ok).toBe(false);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('turns a not-authorized error into the no-longer-a-manager message', async () => {
    const client = clientReturning(null, { message: 'not authorized' });
    const result = await postManagerState(client, 'nipco-1', 'closed');
    expect(result).toEqual({ ok: false, error: expect.stringContaining('no longer a manager') });
  });
});

describe('inviteStationManager', () => {
  it('trims and lower-cases the email and returns invited or assigned', async () => {
    const invited = clientReturning('invited');
    await expect(inviteStationManager(invited, 's1', '  Ada@Example.COM ')).resolves.toEqual({ ok: true, result: 'invited' });
    expect(invited.rpc).toHaveBeenCalledWith('admin_invite_station_manager', { p_station_id: 's1', p_email: 'ada@example.com' });

    const assigned = clientReturning('assigned');
    await expect(inviteStationManager(assigned, 's1', 'ada@example.com')).resolves.toEqual({ ok: true, result: 'assigned' });
  });

  it('refuses a blank or invalid email without calling the database', async () => {
    const client = clientReturning('invited');
    for (const bad of ['', 'nope', 'a@']) {
      const result = await inviteStationManager(client, 's1', bad);
      expect(result).toEqual({ ok: false, error: "That doesn't look like an email address" });
    }
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('refuses a missing station id', async () => {
    const client = clientReturning('invited');
    expect((await inviteStationManager(client, '', 'ada@example.com')).ok).toBe(false);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('shows plain messages for the database refusals and never the raw text', async () => {
    const denied = await inviteStationManager(clientReturning(null, { message: 'not authorized' }), 's1', 'ada@example.com');
    expect(denied).toEqual({ ok: false, error: 'Only the app admin can invite managers' });
    const odd = await inviteStationManager(clientReturning(null, { message: 'duplicate key value violates "x"' }), 's1', 'ada@example.com');
    expect(odd).toEqual({ ok: false, error: 'Could not invite, try again' });
  });

  it('survives a thrown network error', async () => {
    const client = { rpc: vi.fn().mockRejectedValue(new Error('Failed to fetch')) };
    await expect(inviteStationManager(client, 's1', 'ada@example.com')).resolves.toEqual({ ok: false, error: 'Could not invite, try again' });
  });
});

describe('cancelStationManagerInvite', () => {
  it('sends both fields with the email normalised', async () => {
    const client = clientReturning(null);
    await expect(cancelStationManagerInvite(client, 's1', ' Ada@Example.com ')).resolves.toEqual({ ok: true });
    expect(client.rpc).toHaveBeenCalledWith('admin_cancel_station_manager_invite', { p_station_id: 's1', p_email: 'ada@example.com' });
  });
});

describe('claimManagerInvites', () => {
  it('returns the number of stations claimed', async () => {
    await expect(claimManagerInvites(clientReturning(2))).resolves.toEqual({ ok: true, claimed: 2 });
    await expect(claimManagerInvites(clientReturning(0))).resolves.toEqual({ ok: true, claimed: 0 });
  });

  it('treats an unexpected answer as zero claimed', async () => {
    await expect(claimManagerInvites(clientReturning(null))).resolves.toEqual({ ok: true, claimed: 0 });
  });

  it('returns a failed result for a database error or a thrown network error', async () => {
    const failed = await claimManagerInvites(clientReturning(null, { message: 'boom' }));
    expect(failed.ok).toBe(false);
    const thrown = await claimManagerInvites({ rpc: vi.fn().mockRejectedValue(new Error('offline')) });
    expect(thrown.ok).toBe(false);
  });
});

describe('friendlyAccessError', () => {
  it('maps the known messages and hides everything else', () => {
    expect(friendlyAccessError('Invalid email')).toBe("That doesn't look like an email address");
    expect(friendlyAccessError('not authorized')).toBe('Only the app admin can invite managers');
    expect(friendlyAccessError('no station x')).toBe('That station no longer exists');
    expect(friendlyAccessError('anything else')).toBe('Could not invite, try again');
  });
});

describe('describeInviteOutcome', () => {
  it('says plainly whether the email went out', () => {
    expect(describeInviteOutcome({ result: 'invited', emailed: true })).toBe('Invite saved and emailed. They can sign in now');
    expect(describeInviteOutcome({ result: 'invited', emailed: false })).toBe(
      'Invite saved, but the email did not go out. Ask them to open /station-manager',
    );
    expect(describeInviteOutcome({ result: 'assigned', emailed: true })).toBe('Added and emailed: that email already had an account');
    expect(describeInviteOutcome({ result: 'assigned', emailed: false })).toBe(
      'Added: that email already had an account. The email did not go out',
    );
  });
});

describe('sendManagerInvite', () => {
  const reply = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });

  it('posts the station and email with the admin token and returns the result and whether it was emailed', async () => {
    const fetchFn = vi.fn().mockResolvedValue(reply({ result: 'invited', emailed: true }));
    const result = await sendManagerInvite({ accessToken: 'tok', stationId: 'pci-station-65', email: ' A@B.co ', fetchFn, client: clientReturning(null) });
    expect(result).toEqual({ ok: true, result: 'invited', emailed: true });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('/api/invite-manager');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body)).toEqual({ stationId: 'pci-station-65', email: 'a@b.co' });
  });

  it('passes the server message through when it refuses (for example not the admin)', async () => {
    const fetchFn = vi.fn().mockResolvedValue(reply({ error: 'Only the app admin can invite managers.' }, 403));
    const result = await sendManagerInvite({ accessToken: 'tok', stationId: 's', email: 'a@b.co', fetchFn, client: clientReturning(null) });
    expect(result).toEqual({ ok: false, error: 'Only the app admin can invite managers.' });
  });

  it('refuses a bad email without any request', async () => {
    const fetchFn = vi.fn();
    const client = clientReturning(null);
    const result = await sendManagerInvite({ accessToken: 'tok', stationId: 's', email: 'nope', fetchFn, client });
    expect(result.ok).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('falls back to saving the invite directly (emailed:false) when the endpoint is missing or unreachable', async () => {
    for (const fetchFn of [vi.fn().mockResolvedValue(reply({}, 404)), vi.fn().mockRejectedValue(new Error('offline'))]) {
      const client = clientReturning('invited');
      const result = await sendManagerInvite({ accessToken: 'tok', stationId: 's', email: 'a@b.co', fetchFn, client });
      expect(result).toEqual({ ok: true, result: 'invited', emailed: false });
      expect(client.rpc).toHaveBeenCalledWith('admin_invite_station_manager', { p_station_id: 's', p_email: 'a@b.co' });
    }
  });
});
