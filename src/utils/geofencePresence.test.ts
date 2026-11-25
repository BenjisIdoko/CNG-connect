import { describe, it, expect } from 'vitest';
import {
  MAX_GPS_ACCURACY_METERS,
  PRESENCE_GEOFENCE_METERS,
  PRESENCE_PING_INTERVAL_MS,
  PRESENCE_TTL_MINUTES,
  ARRIVAL_PROMPT_METERS,
  REPORT_GEOFENCE_METERS,
  checkReportPosition,
  isAtStation,
  stationsToPing,
} from './geofencePresence';

// One degree of latitude is about 111,195 m, so moving the station north by N metres moves it N metres away.
const HERE = { lat: 9.0, lng: 7.4 };
const station = (id: string, metersNorth: number) => ({ id, lat: HERE.lat + metersNorth / 111195, lng: HERE.lng });
const NOW = 1_800_000_000_000;

describe('presence constants', () => {
  it('uses a 1 km geofence, a ping every 2 minutes, a 6 minute expiry and a 100 m accuracy limit', () => {
    expect(PRESENCE_GEOFENCE_METERS).toBe(1000);
    expect(PRESENCE_PING_INTERVAL_MS).toBe(120_000);
    expect(PRESENCE_TTL_MINUTES).toBe(6);
    expect(MAX_GPS_ACCURACY_METERS).toBe(100);
  });
});

describe('isAtStation', () => {
  it('is true at 999 m and false at 1001 m', () => {
    expect(isAtStation(HERE, station('a', 999))).toBe(true);
    expect(isAtStation(HERE, station('a', 1001))).toBe(false);
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
  it('returns a station inside 1 km that was never pinged', () => {
    expect(stationsToPing(HERE, [station('a', 100)], {}, NOW)).toEqual(['a']);
  });

  it('does not return a station pinged 60 seconds ago, but does at 121 seconds', () => {
    expect(stationsToPing(HERE, [station('a', 100)], { a: NOW - 60_000 }, NOW)).toEqual([]);
    expect(stationsToPing(HERE, [station('a', 100)], { a: NOW - 121_000 }, NOW)).toEqual(['a']);
  });

  it('returns a station 900 m away (beyond the old 500 m radius)', () => {
    expect(stationsToPing(HERE, [station('a', 900)], {}, NOW)).toEqual(['a']);
  });

  it('does not return a station 1001 m away', () => {
    expect(stationsToPing(HERE, [station('a', 1001)], {}, NOW)).toEqual([]);
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

describe('checkReportPosition (the 300 m rule for reporting: the back of a long queue counts)', () => {
  const TOO_FAR = 'Reports unlock within 300 m of the station so every status comes from someone actually there.';

  it('uses a 300 m radius', () => {
    expect(REPORT_GEOFENCE_METERS).toBe(300);
  });

  it('allows a fix 299 m away and refuses one 301 m away with the 300 m reason', () => {
    expect(checkReportPosition(HERE, station('a', 299))).toEqual({ allowed: true });
    expect(checkReportPosition(HERE, station('a', 301))).toEqual({ allowed: false, reason: TOO_FAR });
  });

  it('allows a driver exactly 300 m away (the back of a long queue), where the old 150 m rule would have refused', () => {
    expect(checkReportPosition(HERE, station('a', 300))).toEqual({ allowed: true });
  });

  it('refuses when there is no usable position', () => {
    const noFix = { allowed: false, reason: 'Turn on location to report.' };
    expect(checkReportPosition(null, station('a', 10))).toEqual(noFix);
    expect(checkReportPosition(undefined, station('a', 10))).toEqual(noFix);
    expect(checkReportPosition({ lat: Number.NaN, lng: 7.4 }, station('a', 10))).toEqual(noFix);
    expect(checkReportPosition({ lat: 9.0, lng: Number.NaN }, station('a', 10))).toEqual(noFix);
  });

  it('refuses a fix less accurate than 100 m, allows exactly 100 m and a fix with no accuracy value', () => {
    expect(checkReportPosition({ ...HERE, accuracy: 101 }, station('a', 10))).toEqual({
      allowed: false,
      reason: "Your location isn't precise enough yet. Step into the open and try again.",
    });
    expect(checkReportPosition({ ...HERE, accuracy: 100 }, station('a', 10))).toEqual({ allowed: true });
    expect(checkReportPosition(HERE, station('a', 10))).toEqual({ allowed: true });
  });

  it('refuses a station with no map position instead of guessing', () => {
    expect(checkReportPosition(HERE, { lat: Number.NaN, lng: Number.NaN })).toEqual({ allowed: false, reason: TOO_FAR });
  });
});

describe('ARRIVAL_PROMPT_METERS (when the "you have arrived, report?" nudge may appear)', () => {
  it('is 300 m, the same as the reporting distance, so the nudge only appears where a report would be accepted', () => {
    expect(ARRIVAL_PROMPT_METERS).toBe(300);
    expect(ARRIVAL_PROMPT_METERS).toBeLessThanOrEqual(REPORT_GEOFENCE_METERS);
  });
});
