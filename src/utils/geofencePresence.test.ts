import { describe, it, expect } from 'vitest';
import {
  MAX_GPS_ACCURACY_METERS,
  PRESENCE_GEOFENCE_METERS,
  PRESENCE_PING_INTERVAL_MS,
  PRESENCE_TTL_MINUTES,
  isAtStation,
  stationsToPing,
} from './geofencePresence';

// One degree of latitude is about 111,195 m, so moving the station north by N metres moves it N metres away.
const HERE = { lat: 9.0, lng: 7.4 };
const station = (id: string, metersNorth: number) => ({ id, lat: HERE.lat + metersNorth / 111195, lng: HERE.lng });
const NOW = 1_800_000_000_000;

describe('presence constants', () => {
  it('uses a 250 m geofence, a ping every 2 minutes, a 6 minute expiry and a 100 m accuracy limit', () => {
    expect(PRESENCE_GEOFENCE_METERS).toBe(250);
    expect(PRESENCE_PING_INTERVAL_MS).toBe(120_000);
    expect(PRESENCE_TTL_MINUTES).toBe(6);
    expect(MAX_GPS_ACCURACY_METERS).toBe(100);
  });
});

describe('isAtStation', () => {
  it('is true at 249 m and false at 251 m', () => {
    expect(isAtStation(HERE, station('a', 249))).toBe(true);
    expect(isAtStation(HERE, station('a', 251))).toBe(false);
  });

  it('is false for a station page opened from 5 km away', () => {
    expect(isAtStation(HERE, station('a', 5000))).toBe(false);
  });

  it('is false when the fix is only accurate to 150 m, true at 100 m, true with no accuracy value', () => {
    expect(isAtStation({ ...HERE, accuracy: 150 }, station('a', 10))).toBe(false);
    expect(isAtStation({ ...HERE, accuracy: 100 }, station('a', 10))).toBe(true);
    expect(isAtStation(HERE, station('a', 10))).toBe(true);
  });

  it('is false for a station with missing coordinates or a position with none', () => {
    expect(isAtStation(HERE, { lat: Number.NaN, lng: 7.4 })).toBe(false);
    expect(isAtStation({ lat: Number.NaN, lng: 7.4 }, station('a', 10))).toBe(false);
  });
});

describe('stationsToPing', () => {
  it('returns a station inside 250 m that was never pinged', () => {
    expect(stationsToPing(HERE, [station('a', 100)], {}, NOW)).toEqual(['a']);
  });

  it('does not return a station pinged 60 seconds ago, but does at 121 seconds', () => {
    expect(stationsToPing(HERE, [station('a', 100)], { a: NOW - 60_000 }, NOW)).toEqual([]);
    expect(stationsToPing(HERE, [station('a', 100)], { a: NOW - 121_000 }, NOW)).toEqual(['a']);
  });

  it('does not return a station 251 m away', () => {
    expect(stationsToPing(HERE, [station('a', 251)], {}, NOW)).toEqual([]);
  });

  it('returns nothing for a fix with accuracy 150 m, but accepts a fix with no accuracy value', () => {
    expect(stationsToPing({ ...HERE, accuracy: 150 }, [station('a', 10)], {}, NOW)).toEqual([]);
    expect(stationsToPing(HERE, [station('a', 10)], {}, NOW)).toEqual(['a']);
  });

  it('returns overlapping stations nearest first, at most two', () => {
    const stations = [station('far', 200), station('mid', 100), station('near', 20)];
    expect(stationsToPing(HERE, stations, {}, NOW)).toEqual(['near', 'mid']);
  });

  it('ignores a station with missing coordinates', () => {
    const stations = [{ id: 'bad', lat: Number.NaN, lng: Number.NaN }, station('a', 50)];
    expect(stationsToPing(HERE, stations, {}, NOW)).toEqual(['a']);
  });
});
