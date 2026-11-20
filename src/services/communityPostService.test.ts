import { describe, expect, it, vi } from 'vitest';
import { friendlyCommunityPostError, notifyGasPost, postCommunityGas } from './communityPostService';

const clientReturning = (error: { message: string } | null = null) => ({ rpc: vi.fn().mockResolvedValue({ data: null, error }) });

describe('postCommunityGas', () => {
  it('sends the station and the choice, and no location: a community manager can post from anywhere', async () => {
    const client = clientReturning();
    await expect(postCommunityGas(client, { stationId: 'pci-station-65', available: true })).resolves.toEqual({ ok: true });
    expect(client.rpc).toHaveBeenCalledWith('community_post_gas', { p_station_id: 'pci-station-65', p_available: true });
    await postCommunityGas(client, { stationId: 'pci-station-65', available: false });
    expect(client.rpc).toHaveBeenLastCalledWith('community_post_gas', { p_station_id: 'pci-station-65', p_available: false });
  });

  it('turns database errors into plain text', async () => {
    expect(await postCommunityGas(clientReturning({ message: 'already posted' }), { stationId: 's', available: true })).toEqual({
      ok: false,
      error: 'You already posted that a moment ago.',
    });
    expect(await postCommunityGas(clientReturning({ message: 'not authorized' }), { stationId: 's', available: true })).toEqual({
      ok: false,
      error: "Your account can't post for stations.",
    });
  });

  it('survives a thrown error', async () => {
    const client = { rpc: vi.fn().mockRejectedValue(new Error('offline')) };
    expect(await postCommunityGas(client, { stationId: 's', available: true })).toEqual({ ok: false, error: 'Could not post. Try again' });
  });
});

describe('friendlyCommunityPostError', () => {
  it('maps the database messages and never echoes an unknown one', () => {
    expect(friendlyCommunityPostError('already posted')).toBe('You already posted that a moment ago.');
    expect(friendlyCommunityPostError('not authorized')).toBe("Your account can't post for stations.");
    expect(friendlyCommunityPostError('no station')).toBe('That station no longer exists.');
    expect(friendlyCommunityPostError('boom 500 secret')).toBe('Could not post. Try again');
  });

  it('no longer talks about distance or location: there is no such rule for community managers', () => {
    expect(friendlyCommunityPostError('too far from the station')).toBe('Could not post. Try again');
    expect(friendlyCommunityPostError('location required')).toBe('Could not post. Try again');
  });
});

describe('notifyGasPost', () => {
  it('tells the server which station, with the caller\'s sign-in, and never sends the status itself', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true });
    await expect(notifyGasPost({ accessToken: 'tok', stationId: 's1', fetchFn })).resolves.toBe(true);
    expect(fetchFn).toHaveBeenCalledWith('/api/notify-gas-post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
      body: JSON.stringify({ stationId: 's1' }),
    });
  });

  it('is false, and silent, when the server says no or the network fails', async () => {
    expect(await notifyGasPost({ accessToken: 't', stationId: 's1', fetchFn: vi.fn().mockResolvedValue({ ok: false, status: 503 }) })).toBe(false);
    expect(await notifyGasPost({ accessToken: 't', stationId: 's1', fetchFn: vi.fn().mockRejectedValue(new Error('offline')) })).toBe(false);
  });

  it('does nothing without a sign-in token', async () => {
    const fetchFn = vi.fn();
    expect(await notifyGasPost({ accessToken: '', stationId: 's1', fetchFn })).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

