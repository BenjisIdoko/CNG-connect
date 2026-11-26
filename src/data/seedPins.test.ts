import { describe, expect, it } from 'vitest';
import { INITIAL_STATIONS } from './mockData';
import { haversineMeters } from '../utils/stationDuplicates';

/**
 * The app shows the bundled stations until the live list arrives (and whenever it cannot load), and a driver
 * can only report within 1 km of a station's pin. The bundled pins were city-centre guesses, up to 57 km from
 * the corrected pins in the database, so a driver at the forecourt on a slow connection was told they were too far.
 *
 * These are database pins as of 2026-11-26: the stations drivers reported trouble at, and the biggest corrections.
 */
const DATABASE_PINS: [id: string, lat: number, lng: number][] = [
  ['pci-station-81', 8.993397, 7.40462], // Bovas Filling Station - Chika
  ['pci-station-80', 8.983934, 7.19569], // Femadec Uni Abuja
  ['pci-station-73', 8.95524, 7.335465], // Shafa Sabo Lugbe, Airport Road
  ['pci-station-75', 8.961793, 7.344751], // Mobil Gas Station - Glory Dome
  ['pci-station-83', 9.135533, 7.282953], // Portland Gas - Kubwa
  ['pci-station-84', 9.094446, 7.424858], // Rolling Energy - Jahi
  ['pci-station-65', 9.214111, 7.394018], // NNPC filling station ushafa
  ['pci-station-82', 7.607032, 6.257186], // Mono Energy Ltd - Lokoja
  ['nnpc-cng-deidei', 8.986545, 7.392687], // NNPC CNG Station - Dei-Dei
  ['nnpc-nipco-airport-rd', 8.939191, 7.308817], // NIPCO - Gosa
  ['bovas-cng-idimu', 6.59713, 3.28939], // BOVAS CNG Station - Idimu
];

describe('bundled station pins match the database', () => {
  it.each(DATABASE_PINS)('%s is within 25 m of its database pin', (id, lat, lng) => {
    const station = INITIAL_STATIONS.find((s) => s.id === id);
    expect(station, `${id} is in the bundled list`).toBeDefined();
    expect(haversineMeters({ lat: station!.lat, lng: station!.lng }, { lat, lng })).toBeLessThan(25);
  });
});
