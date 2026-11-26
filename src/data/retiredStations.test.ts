import { afterEach, describe, expect, it, vi } from 'vitest';
import { INITIAL_STATIONS } from './mockData';

/**
 * "BOVAS AutoGas - Industrial Area II" (bovas-cng-aust) was the same forecourt as "Bovas Filling Station - Chika"
 * (pci-station-81), listed again with a rough city-level pin about 2.5 km away. A driver standing at the station
 * who picked it was 2.5 km from its pin, so reporting was refused. The database never had it; only the app's
 * bundled list (and copies of that list saved on phones) did.
 */
const DUPLICATE_ID = 'bovas-cng-aust';
const CACHE_KEY = 'gasfinder_stations_v10';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('the duplicate Bovas Airport Road listing', () => {
  it('is not in the bundled station list', () => {
    expect(INITIAL_STATIONS.map((s) => s.id)).not.toContain(DUPLICATE_ID);
    expect(INITIAL_STATIONS.some((s) => /Industrial Area II/i.test(s.name))).toBe(false);
  });

  it('is dropped from a list an older build saved on the phone, and the other stations stay', async () => {
    const real = INITIAL_STATIONS[0];
    const duplicate = { ...real, id: DUPLICATE_ID, name: 'BOVAS AutoGas - Industrial Area II', lat: 8.981, lng: 7.421 };
    const store = new Map<string, string>([[CACHE_KEY, JSON.stringify([real, duplicate])]]);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    });
    vi.resetModules();

    const { apiService } = await import('../services/apiService');
    const ids = (await apiService.fetchStations()).map((s) => s.id);

    expect(ids).not.toContain(DUPLICATE_ID);
    expect(ids).toContain(real.id);
  });
});
