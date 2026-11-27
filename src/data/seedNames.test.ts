import { describe, expect, it } from 'vitest';
import { INITIAL_STATIONS } from './mockData';

/**
 * The app shows the bundled stations until the live list arrives (and whenever it cannot load), so a station
 * must not change name when the live list replaces them. These are the stations whose database name was
 * corrected by an admin or manager after the bundle was written, as of 2026-11-27.
 */
const DATABASE_NAMES: [id: string, name: string][] = [
  ['pci-station-81', 'Bovas Filling Station - Chika'],
  ['pci-station-80', 'Femadec Uni Abuja'],
  ['pci-station-73', 'Shafa Sabo Lugbe, Airport Road'],
  ['pci-station-75', 'Mobil Gas Station - Glory Dome'],
  ['pci-station-83', 'Portland Gas - Kubwa'],
  ['pci-station-65', 'NNPC filling station ushafa'],
  ['pci-station-60', 'NIPCO Gas Station - Kubwa'],
  ['pci-station-63', 'NNPC Retail - Zone 1'],
  ['pci-station-72', 'Mobil - Madalla, Abuja'],
  ['pci-station-74', 'NNPC Retail - CBD'],
  ['pci-station-76', 'NIPCO Gas Station - Mabushi'],
  ['pci-station-77', 'NNPC Retail - Shoprite Lugbe Road'],
  ['nnpc-nipco-airport-rd', 'NIPCO- Gosa'],
];

describe('bundled station names match the database', () => {
  it.each(DATABASE_NAMES)('%s is named "%s"', (id, name) => {
    const station = INITIAL_STATIONS.find((s) => s.id === id);
    expect(station, `${id} is in the bundled list`).toBeDefined();
    expect(station!.name).toBe(name);
  });
});
