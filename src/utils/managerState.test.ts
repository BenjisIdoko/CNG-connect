import { describe, expect, it } from 'vitest';
import {
  MANAGER_STATE_MINUTES,
  MANAGER_STATE_OPTIONS,
  describeManagerState,
  getManagerStatement,
} from './managerState';

const NOW = Date.parse('2026-11-19T12:00:00Z');
const minsAgo = (m: number) => new Date(NOW - m * 60000).toISOString();

describe('getManagerStatement', () => {
  it('returns the new state with its age within 360 minutes, including exactly 360', () => {
    expect(MANAGER_STATE_MINUTES).toBe(360);
    expect(getManagerStatement({ managerState: 'selling', managerStateAt: minsAgo(20) }, NOW)).toEqual({
      state: 'selling',
      ageMinutes: 20,
    });
    expect(getManagerStatement({ managerState: 'closed', managerStateAt: minsAgo(360) }, NOW)).toEqual({
      state: 'closed',
      ageMinutes: 360,
    });
  });

  it('is null at 361 minutes, with no timestamp, with an unreadable timestamp, or with no state', () => {
    expect(getManagerStatement({ managerState: 'open', managerStateAt: minsAgo(361) }, NOW)).toBeNull();
    expect(getManagerStatement({ managerState: 'open' }, NOW)).toBeNull();
    expect(getManagerStatement({ managerState: 'open', managerStateAt: 'garbage' }, NOW)).toBeNull();
    expect(getManagerStatement({ managerStateAt: minsAgo(5) }, NOW)).toBeNull();
    expect(getManagerStatement({}, NOW)).toBeNull();
  });

  it('falls back to the legacy selling flag when no new state exists (true is selling, false is closed)', () => {
    expect(getManagerStatement({ managerSelling: true, managerSellingAt: minsAgo(30) }, NOW)).toEqual({
      state: 'selling',
      ageMinutes: 30,
    });
    expect(getManagerStatement({ managerSelling: false, managerSellingAt: minsAgo(30) }, NOW)).toEqual({
      state: 'closed',
      ageMinutes: 30,
    });
  });

  it('the new state wins over the legacy flag when both exist', () => {
    const station = {
      managerState: 'open' as const,
      managerStateAt: minsAgo(10),
      managerSelling: true,
      managerSellingAt: minsAgo(200),
    };
    expect(getManagerStatement(station, NOW)).toEqual({ state: 'open', ageMinutes: 10 });
  });

  it('a legacy post older than 360 minutes is not shown either', () => {
    expect(getManagerStatement({ managerSelling: true, managerSellingAt: minsAgo(400) }, NOW)).toBeNull();
  });

  it('a timestamp a few minutes in the future gives age 0', () => {
    const future = new Date(NOW + 4 * 60000).toISOString();
    expect(getManagerStatement({ managerState: 'selling', managerStateAt: future }, NOW)?.ageMinutes).toBe(0);
  });
});

describe('describeManagerState', () => {
  it('gives the three driver sentences with the age', () => {
    expect(describeManagerState({ state: 'selling', ageMinutes: 20 })).toBe('Open for business · Gas available · updated 20 min ago');
    expect(describeManagerState({ state: 'open', ageMinutes: 60 })).toBe('Open · Waiting for gas supply · updated 1 hr ago');
    expect(describeManagerState({ state: 'closed', ageMinutes: 180 })).toBe('Closed · updated 3 hr ago');
    expect(describeManagerState({ state: 'selling', ageMinutes: 0 })).toBe('Open for business · Gas available · updated just now');
  });
});

describe('MANAGER_STATE_OPTIONS', () => {
  it('lists the three buttons a manager can press, in order', () => {
    expect(MANAGER_STATE_OPTIONS.map((o) => o.state)).toEqual(['closed', 'open', 'selling']);
    expect(MANAGER_STATE_OPTIONS.map((o) => o.label)).toEqual(['Closed', 'Open, waiting for gas', 'Open, gas available']);
  });
});
