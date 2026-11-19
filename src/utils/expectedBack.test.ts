import { describe, expect, it } from 'vitest';
import { resolveExpectedBack } from './expectedBack';

// 12:00 UTC is 13:00 in Lagos (WAT, UTC+1).
const NOW = Date.parse('2026-11-19T12:00:00Z');
const HOUR = 3600000;

describe('resolveExpectedBack', () => {
  it('adds whole hours to now', () => {
    expect(resolveExpectedBack({ inHours: 1 }, NOW)).toBe(new Date(NOW + HOUR).toISOString());
    expect(resolveExpectedBack({ inHours: 2 }, NOW)).toBe(new Date(NOW + 2 * HOUR).toISOString());
    expect(resolveExpectedBack({ inHours: 4 }, NOW)).toBe(new Date(NOW + 4 * HOUR).toISOString());
  });

  it('reads a clock time on the Lagos clock: later today stays today', () => {
    expect(resolveExpectedBack({ clock: '14:00' }, NOW)).toBe('2026-11-19T13:00:00.000Z');
    expect(resolveExpectedBack({ clock: '9:30' }, Date.parse('2026-11-19T05:00:00Z'))).toBe('2026-11-19T08:30:00.000Z');
  });

  it('a clock time already passed today means tomorrow, never the past', () => {
    expect(resolveExpectedBack({ clock: '12:00' }, NOW)).toBe('2026-11-20T11:00:00.000Z');
    expect(resolveExpectedBack({ clock: '06:00' }, NOW)).toBe('2026-11-20T05:00:00.000Z');
  });

  it('the current minute counts as passed', () => {
    expect(resolveExpectedBack({ clock: '13:00' }, NOW)).toBe('2026-11-20T12:00:00.000Z');
  });

  it('is always after now and at most 24 hours ahead', () => {
    for (const clock of ['00:00', '06:00', '12:59', '13:00', '13:01', '23:59']) {
      const iso = resolveExpectedBack({ clock }, NOW) as string;
      const ms = Date.parse(iso);
      expect(ms).toBeGreaterThan(NOW);
      expect(ms).toBeLessThanOrEqual(NOW + 24 * HOUR);
    }
  });

  it('uses the Lagos date, not the UTC date, near midnight', () => {
    // 23:30 UTC on the 19th is 00:30 on the 20th in Lagos; 01:00 Lagos is 00:00 UTC on the 20th.
    expect(resolveExpectedBack({ clock: '01:00' }, Date.parse('2026-11-19T23:30:00Z'))).toBe('2026-11-20T00:00:00.000Z');
  });

  it('gives null for anything that is not a clock time', () => {
    for (const clock of ['', 'abc', '25:00', '12:60', '1230', '12:5', ' ']) {
      expect(resolveExpectedBack({ clock }, NOW)).toBeNull();
    }
  });
});
