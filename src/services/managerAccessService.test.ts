import { describe, expect, it, vi } from 'vitest';
import {
  cancelStationManagerInvite,
  claimManagerInvites,
  friendlyAccessError,
  inviteStationManager,
  isPlausibleEmail,
  postManagerState,
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
