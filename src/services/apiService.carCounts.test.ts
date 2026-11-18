import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A failed refresh must not make every "N cars here" line vanish. These tests mock the Supabase
// helpers so the success and failure paths of fetchCarCounts can be exercised offline.
const restRpc = vi.fn();
const getSupabase = vi.fn();

vi.mock('./supabaseClient', () => ({
  isSupabaseConfigured: true,
  getSupabase: (...args: unknown[]) => getSupabase(...args),
  restSelect: vi.fn().mockResolvedValue(null),
  restRpc: (...args: unknown[]) => restRpc(...args),
}));

const freshApi = async () => {
  vi.resetModules();
  return (await import('./apiService')).apiService;
};

const clientThatAnswers = (result: { data: unknown; error: { message: string } | null }) => ({
  rpc: vi.fn().mockResolvedValue(result),
});

beforeEach(() => {
  restRpc.mockReset();
  getSupabase.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-18T08:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('fetchCarCounts', () => {
  it('returns the counts the database gives', async () => {
    restRpc.mockResolvedValue([{ station_id: 'a', cars: 2 }]);
    const api = await freshApi();
    await expect(api.fetchCarCounts()).resolves.toEqual({ a: 2 });
  });

  it('keeps the last good counts when a later refresh fails', async () => {
    const api = await freshApi();
    restRpc.mockResolvedValueOnce([{ station_id: 'a', cars: 2 }]);
    await api.fetchCarCounts();

    // Both routes fail: REST returns nothing and the client reports an error.
    restRpc.mockResolvedValueOnce(null);
    getSupabase.mockResolvedValue(clientThatAnswers({ data: null, error: { message: 'boom' } }));
    await expect(api.fetchCarCounts()).resolves.toEqual({ a: 2 });
  });

  it('returns no counts when a refresh fails and nothing was remembered', async () => {
    const api = await freshApi();
    restRpc.mockResolvedValue(null);
    getSupabase.mockResolvedValue(clientThatAnswers({ data: null, error: { message: 'boom' } }));
    await expect(api.fetchCarCounts()).resolves.toEqual({});
  });

  it('a successful empty answer clears the counts, because the cars really left', async () => {
    const api = await freshApi();
    restRpc.mockResolvedValueOnce([{ station_id: 'a', cars: 2 }]);
    await api.fetchCarCounts();
    restRpc.mockResolvedValueOnce([]);
    await expect(api.fetchCarCounts()).resolves.toEqual({});
  });

  it('does not keep old counts for long: after 10 minutes of failures they are dropped', async () => {
    const api = await freshApi();
    restRpc.mockResolvedValueOnce([{ station_id: 'a', cars: 2 }]);
    await api.fetchCarCounts();

    restRpc.mockResolvedValue(null);
    getSupabase.mockResolvedValue(clientThatAnswers({ data: null, error: { message: 'boom' } }));
    vi.setSystemTime(new Date('2026-11-18T08:09:00Z'));
    await expect(api.fetchCarCounts()).resolves.toEqual({ a: 2 });
    vi.setSystemTime(new Date('2026-11-18T08:11:00Z'));
    await expect(api.fetchCarCounts()).resolves.toEqual({});
  });

  it('uses the client when plain REST fails but the client works', async () => {
    const api = await freshApi();
    restRpc.mockResolvedValue(null);
    getSupabase.mockResolvedValue(clientThatAnswers({ data: [{ station_id: 'b', cars: 1 }], error: null }));
    await expect(api.fetchCarCounts()).resolves.toEqual({ b: 1 });
  });
});
