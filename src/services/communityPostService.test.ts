import { describe, expect, it, vi } from 'vitest';
import { communityPostPositionProblem, friendlyCommunityPostError, postCommunityGas } from './communityPostService';

const station = { lat: 9.0765, lng: 7.3986 };
const clientReturning = (error: { message: string } | null = null) => ({ rpc: vi.fn().mockResolvedValue({ data: null, error }) });

describe('communityPostPositionProblem', () => {
  it('asks for location when there is no fix', () => {
    expect(communityPostPositionProblem(null, station)).toBe('Turn on location to post.');
  });

  it('is fine at the station, and says how close you must be when you are not', () => {
    expect(communityPostPositionProblem({ lat: 9.0765, lng: 7.3986, accuracy: 20 }, station)).toBeNull();
    expect(communityPostPositionProblem({ lat: 9.09, lng: 7.3986, accuracy: 20 }, station)).toBe(
      'Posting unlocks within 150 m of the station, so every update comes from someone actually there.',
    );
  });

  it('does not trust a vague fix', () => {
    expect(communityPostPositionProblem({ lat: 9.0765, lng: 7.3986, accuracy: 500 }, station)).toMatch(/precise enough/);
  });
});

describe('postCommunityGas', () => {
  const position = { lat: 9.0765, lng: 7.3986, accuracy: 15 };

  it('sends the station, the choice and where the phone is', async () => {
    const client = clientReturning();
    await expect(postCommunityGas(client, { stationId: 'pci-station-65', available: true, position })).resolves.toEqual({ ok: true });
    expect(client.rpc).toHaveBeenCalledWith('community_post_gas', { p_station_id: 'pci-station-65', p_available: true, p_lat: 9.0765, p_lng: 7.3986 });
    await postCommunityGas(client, { stationId: 'pci-station-65', available: false, position });
    expect(client.rpc).toHaveBeenLastCalledWith('community_post_gas', { p_station_id: 'pci-station-65', p_available: false, p_lat: 9.0765, p_lng: 7.3986 });
  });

  it('does not call the database without a location', async () => {
    const client = clientReturning();
    expect(await postCommunityGas(client, { stationId: 's', available: true, position: null })).toEqual({ ok: false, error: 'Turn on location to post.' });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('turns database errors into plain text', async () => {
    const result = await postCommunityGas(clientReturning({ message: 'too far from the station' }), { stationId: 's', available: true, position });
    expect(result).toEqual({ ok: false, error: 'You need to be within 150 m of the station to post.' });
  });

  it('survives a thrown error', async () => {
    const client = { rpc: vi.fn().mockRejectedValue(new Error('offline')) };
    expect(await postCommunityGas(client, { stationId: 's', available: true, position })).toEqual({ ok: false, error: 'Could not post. Try again' });
  });
});

describe('friendlyCommunityPostError', () => {
  it('maps the database messages and never echoes an unknown one', () => {
    expect(friendlyCommunityPostError('already posted')).toBe('You already posted that a moment ago.');
    expect(friendlyCommunityPostError('not authorized')).toBe("Your account can't post for stations.");
    expect(friendlyCommunityPostError('location required')).toBe('Turn on location to post.');
    expect(friendlyCommunityPostError('no station')).toBe('That station no longer exists.');
    expect(friendlyCommunityPostError('boom 500 secret')).toBe('Could not post. Try again');
  });
});
