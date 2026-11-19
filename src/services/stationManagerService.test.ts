import { describe, expect, it, vi } from 'vitest';
import { friendlyManagerError, postPressure } from './stationManagerService';

const clientReturning = (error: { message: string } | null) => ({
  rpc: vi.fn().mockResolvedValue({ error }),
});

describe('postPressure', () => {
  it('refuses 9, 301, 220.5 and NaN without calling the database', async () => {
    const client = clientReturning(null);
    for (const bad of [9, 301, 220.5, NaN]) {
      const result = await postPressure(client, 'nipco-1', bad);
      expect(result.ok).toBe(false);
    }
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('calls manager_post_pressure with p_bar for 220', async () => {
    const client = clientReturning(null);
    await expect(postPressure(client, 'nipco-1', 220)).resolves.toEqual({ ok: true });
    expect(client.rpc).toHaveBeenCalledWith('manager_post_pressure', { p_station_id: 'nipco-1', p_bar: 220 });
  });
});

describe('errors', () => {
  it('a "not authorized" error becomes the "no longer a manager of this station" message', async () => {
    const client = clientReturning({ message: 'not authorized' });
    const result = await postPressure(client, 'nipco-1', 220);
    expect(result).toEqual({ ok: false, error: expect.stringContaining('no longer a manager of this station') });
  });

  it('an unknown error becomes "Could not post, try again" and never shows the raw message', async () => {
    const client = clientReturning({ message: 'duplicate key value violates unique constraint "x"' });
    const result = await postPressure(client, 'nipco-1', 220);
    expect(result).toEqual({ ok: false, error: 'Could not post, try again' });
  });

  it('a thrown network error is returned as a failed result, not thrown', async () => {
    const client = { rpc: vi.fn().mockRejectedValue(new Error('Failed to fetch')) };
    await expect(postPressure(client, 'nipco-1', 220)).resolves.toEqual({
      ok: false,
      error: 'Could not post, try again',
    });
  });

  it('friendlyManagerError maps the pressure message too', () => {
    expect(friendlyManagerError('Invalid pressure')).toBe('Pressure must be a whole number from 10 to 300 bar');
  });
});
