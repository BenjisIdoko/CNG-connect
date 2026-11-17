import { describe, it, expect } from 'vitest';
import {
  NEARBY_METERS,
  findSimilarStations,
  haversineMeters,
  isExactNameDuplicate,
  normalizeStationName,
  type StationRef,
} from './stationDuplicates';
import { deduplicateStations } from '../data/mockData';
import type { GasStation } from '../types';

// One degree of latitude is about 111,195 m, so 0.00108 degrees is about 120 m north.
const BASE = { lat: 9.0, lng: 7.4 };
const north = (meters: number) => ({ lat: BASE.lat + meters / 111195, lng: BASE.lng });

const ref = (id: string, name: string, pos = BASE): StationRef => ({ id, name, lat: pos.lat, lng: pos.lng });

describe('normalizeStationName', () => {
  it('lower-cases and strips everything except a-z and 0-9', () => {
    expect(normalizeStationName('N.I.P.C.O - Ikeja!')).toBe('nipcoikeja');
    expect(normalizeStationName('  NIPCO   Ikeja ')).toBe('nipcoikeja');
    expect(normalizeStationName('Station 4A')).toBe('station4a');
  });
});

describe('name rule parity with the app', () => {
  it('uses the same key deduplicateStations uses to hide duplicate stations', () => {
    const a = { id: 'a', name: 'NIPCO - Ikeja', lat: 6.6, lng: 3.35 } as unknown as GasStation;
    const b = { id: 'b', name: 'n.i.p.c.o  IKEJA!', lat: 6.6, lng: 3.35 } as unknown as GasStation;
    expect(normalizeStationName(a.name)).toBe(normalizeStationName(b.name));
    // The app keeps only the first of two stations whose names normalise the same.
    expect(deduplicateStations([a, b]).map((s) => s.id)).toEqual(['a']);
    // ...and keeps both when the names really differ.
    const c = { id: 'c', name: 'NIPCO Lekki', lat: 6.6, lng: 3.35 } as unknown as GasStation;
    expect(deduplicateStations([a, c]).map((s) => s.id)).toEqual(['a', 'c']);
  });
});

describe('isExactNameDuplicate', () => {
  it('is true for the same name spelled differently', () => {
    expect(isExactNameDuplicate('nipco  IKEJA', [{ name: 'NIPCO - Ikeja' }])).toBe(true);
  });

  it('is false for a different name or an empty list', () => {
    expect(isExactNameDuplicate('NIPCO Lekki', [{ name: 'NIPCO - Ikeja' }])).toBe(false);
    expect(isExactNameDuplicate('NIPCO Lekki', [])).toBe(false);
  });
});

describe('haversineMeters', () => {
  it('measures whole metres between two points', () => {
    expect(haversineMeters(BASE, BASE)).toBe(0);
    const d = haversineMeters(BASE, north(120));
    expect(Number.isInteger(d)).toBe(true);
    expect(Math.abs(d - 120)).toBeLessThanOrEqual(1);
  });
});

describe('findSimilarStations', () => {
  it('uses a 300 m neighbourhood', () => {
    expect(NEARBY_METERS).toBe(300);
  });

  it('returns a nearby hit at 120 m and none at 301 m', () => {
    const existing = [ref('a', 'Totally Different Name', north(120))];
    const hits = findSimilarStations({ name: 'Brand New Place', ...BASE }, existing);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ id: 'a', reason: 'nearby' });
    expect(Math.abs((hits[0].distanceM as number) - 120)).toBeLessThanOrEqual(1);

    const far = [ref('b', 'Totally Different Name', north(301))];
    expect(findSimilarStations({ name: 'Brand New Place', ...BASE }, far)).toEqual([]);
  });

  it('flags "NIPCO CNG Ikeja" as similar to "NIPCO Ikeja" even far away', () => {
    const existing = [ref('a', 'NIPCO Ikeja', north(5000))];
    const hits = findSimilarStations({ name: 'NIPCO CNG Ikeja', ...BASE }, existing);
    expect(hits).toHaveLength(1);
    expect(hits[0].reason).toBe('similar_name');
  });

  it('does not flag "NIPCO Lekki" as similar to "NIPCO Ikeja"', () => {
    const existing = [ref('a', 'NIPCO Ikeja', north(5000))];
    expect(findSimilarStations({ name: 'NIPCO Lekki', ...BASE }, existing)).toEqual([]);
  });

  it('does not flag a one-word brand name alone', () => {
    const existing = [ref('a', 'NIPCO', north(5000))];
    expect(findSimilarStations({ name: 'NIPCO Ikeja', ...BASE }, existing)).toEqual([]);
  });

  it('returns same_name first, then by distance, capped at 5', () => {
    const existing = [
      ref('n1', 'Alpha One', north(250)),
      ref('n2', 'Alpha Two', north(50)),
      ref('n3', 'Alpha Three', north(100)),
      ref('n4', 'Alpha Four', north(150)),
      ref('n5', 'Alpha Five', north(200)),
      ref('n6', 'Alpha Six', north(280)),
      ref('same', 'N.I.P.C.O Ikeja', north(290)),
    ];
    const hits = findSimilarStations({ name: 'nipco ikeja', ...BASE }, existing);
    expect(hits).toHaveLength(5);
    expect(hits[0]).toMatchObject({ id: 'same', reason: 'same_name' });
    const rest = hits.slice(1).map((h) => h.distanceM as number);
    expect([...rest].sort((a, b) => a - b)).toEqual(rest);
  });

  it('returns only name hits, with distanceM null, when there is no position', () => {
    const existing = [
      ref('near', 'Totally Different Name', north(10)),
      ref('same', 'NIPCO - Ikeja', north(5000)),
      ref('sim', 'NIPCO CNG Ikeja Road', north(5000)),
    ];
    const hits = findSimilarStations({ name: 'nipco ikeja', lat: null, lng: null }, existing);
    expect(hits.map((h) => h.id)).toEqual(['same', 'sim']);
    expect(hits.every((h) => h.distanceM === null)).toBe(true);
  });
});
