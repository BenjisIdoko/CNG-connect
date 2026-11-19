import { describe, expect, it } from 'vitest';
import {
  LIVE_PRESSURE_MAX_AGE_MINUTES,
  PRESSURE_DEFAULT_BAR,
  describePressure,
  getPressureReading,
  isValidPressure,
  stepPressure,
} from './stationManagerSignals';

const NOW = Date.parse('2026-11-18T12:00:00Z');
const minsAgo = (m: number) => new Date(NOW - m * 60000).toISOString();

describe('isValidPressure', () => {
  it('accepts 10, 200 and 300', () => {
    for (const ok of [10, 200, 300]) expect(isValidPressure(ok)).toBe(true);
  });

  it('rejects 0, 9, 301, 220.5, NaN, null and a string', () => {
    for (const bad of [0, 9, 301, 220.5, NaN, null, undefined, '220']) expect(isValidPressure(bad)).toBe(false);
  });
});

describe('stepPressure', () => {
  it('moves by 5 and starts at 200 when there is no value', () => {
    expect(PRESSURE_DEFAULT_BAR).toBe(200);
    expect(stepPressure(null, 1)).toBe(205);
    expect(stepPressure(undefined, -1)).toBe(195);
    expect(stepPressure(222, 1)).toBe(227);
  });

  it('clamps at 10 and 300', () => {
    expect(stepPressure(300, 1)).toBe(300);
    expect(stepPressure(298, 1)).toBe(300);
    expect(stepPressure(10, -1)).toBe(10);
    expect(stepPressure(12, -1)).toBe(10);
  });
});

describe('getPressureReading', () => {
  it('returns the live reading when it is 2 hours old', () => {
    expect(getPressureReading({ livePressureBar: 220, livePressureAt: minsAgo(120), pumpPressure: 180 }, NOW)).toEqual({
      bar: 220,
      ageMinutes: 120,
      live: true,
    });
  });

  it('falls back to the static value at 13 hours and when the timestamp is missing', () => {
    expect(LIVE_PRESSURE_MAX_AGE_MINUTES).toBe(720);
    const stale = getPressureReading({ livePressureBar: 220, livePressureAt: minsAgo(13 * 60), pumpPressure: 180 }, NOW);
    expect(stale).toEqual({ bar: 180, ageMinutes: null, live: false });
    const noTime = getPressureReading({ livePressureBar: 220, pumpPressure: 180 }, NOW);
    expect(noTime).toEqual({ bar: 180, ageMinutes: null, live: false });
  });

  it('is still live at exactly 12 hours', () => {
    expect(getPressureReading({ livePressureBar: 220, livePressureAt: minsAgo(720) }, NOW)?.live).toBe(true);
  });

  it('is null when there is neither a live reading nor a static value', () => {
    expect(getPressureReading({}, NOW)).toBeNull();
    expect(getPressureReading({ pumpPressure: 0 }, NOW)).toBeNull();
  });
});

describe('describePressure', () => {
  it('gives "220 bar · updated 2 hr ago", "180 bar" for the fallback and null for none', () => {
    expect(describePressure({ livePressureBar: 220, livePressureAt: minsAgo(120) }, NOW)).toBe('220 bar · updated 2 hr ago');
    expect(describePressure({ pumpPressure: 180 }, NOW)).toBe('180 bar');
    expect(describePressure({}, NOW)).toBeNull();
  });
});
