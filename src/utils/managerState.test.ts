import { describe, expect, it } from 'vitest';
import {
  MANAGER_REASON_OPTIONS,
  MANAGER_STATE_MINUTES,
  MANAGER_STATE_OPTIONS,
  describeManagerState,
  formatWatTime,
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

describe('getManagerStatement with a reason and an expected time', () => {
  const POSTED = '2026-11-19T08:00:00Z';
  const UNTIL = '2026-11-19T10:00:00Z';
  const at = (iso: string) => Date.parse(iso);
  const closedUntil = { managerState: 'closed' as const, managerStateAt: POSTED, managerStateReason: 'supply' as const, managerStateUntil: UNTIL };

  it('shows the reason and the time before the expected time, not overdue', () => {
    expect(getManagerStatement(closedUntil, at('2026-11-19T09:00:00Z'))).toEqual({
      state: 'closed',
      ageMinutes: 60,
      reason: 'supply',
      untilMs: at(UNTIL),
      overdue: false,
    });
  });

  it('stays visible as overdue for 60 minutes after the expected time, then disappears', () => {
    expect(getManagerStatement(closedUntil, at(UNTIL))?.overdue).toBe(false);
    expect(getManagerStatement(closedUntil, at('2026-11-19T10:59:00Z'))?.overdue).toBe(true);
    expect(getManagerStatement(closedUntil, at('2026-11-19T11:00:00Z'))?.overdue).toBe(true);
    expect(getManagerStatement(closedUntil, at('2026-11-19T11:01:00Z'))).toBeNull();
  });

  it('an expected time keeps the post past the usual 6 hours', () => {
    const post = { managerState: 'closed' as const, managerStateAt: '2026-11-18T14:00:00Z', managerStateUntil: '2026-11-19T10:00:00Z' };
    expect(getManagerStatement(post, at('2026-11-19T10:30:00Z'))?.state).toBe('closed');
  });

  it('is cut off 24 hours after the post even when the expected time is later than 23 hours', () => {
    const post = { managerState: 'open' as const, managerStateAt: '2026-11-18T12:00:00Z', managerStateUntil: '2026-11-19T11:30:00Z' };
    expect(getManagerStatement(post, at('2026-11-19T11:59:00Z'))).not.toBeNull();
    expect(getManagerStatement(post, at('2026-11-19T12:01:00Z'))).toBeNull();
  });

  it('an expected time not after the post is ignored and the usual 6 hours apply', () => {
    const post = { managerState: 'closed' as const, managerStateAt: POSTED, managerStateUntil: '2026-11-19T07:00:00Z' };
    expect(getManagerStatement(post, at('2026-11-19T13:59:00Z'))).toEqual({ state: 'closed', ageMinutes: 359 });
    expect(getManagerStatement(post, at('2026-11-19T14:01:00Z'))).toBeNull();
  });

  it('an unreadable expected time is ignored', () => {
    const post = { managerState: 'closed' as const, managerStateAt: POSTED, managerStateUntil: 'soon' };
    expect(getManagerStatement(post, at('2026-11-19T09:00:00Z'))).toEqual({ state: 'closed', ageMinutes: 60 });
  });

  it('a selling post never carries a reason or a time, even if the row still holds one', () => {
    const post = { managerState: 'selling' as const, managerStateAt: POSTED, managerStateReason: 'supply' as const, managerStateUntil: UNTIL };
    expect(getManagerStatement(post, at('2026-11-19T09:00:00Z'))).toEqual({ state: 'selling', ageMinutes: 60 });
  });
});

describe('describeManagerState with a reason and an expected time', () => {
  const until = Date.parse('2026-11-19T13:00:00Z'); // 2 pm in Lagos

  it('reads reason, expected time and age for a closed station', () => {
    expect(describeManagerState({ state: 'closed', ageMinutes: 20, reason: 'supply', untilMs: until, overdue: false })).toBe(
      'Closed · Waiting for supply · expected about 2 pm · updated 20 min ago',
    );
  });

  it('says it was not confirmed once the time has passed, and no longer says "expected about"', () => {
    const text = describeManagerState({ state: 'closed', ageMinutes: 200, reason: 'supply', untilMs: until, overdue: true });
    expect(text).toContain('Was expected back 2 pm · not confirmed');
    expect(text).not.toContain('expected about');
  });

  it('names a technical fault or a power cut, and says nothing for "other"', () => {
    expect(describeManagerState({ state: 'closed', ageMinutes: 5, reason: 'fault', overdue: false })).toBe('Closed · Technical fault · updated 5 min ago');
    expect(describeManagerState({ state: 'closed', ageMinutes: 5, reason: 'power', overdue: false })).toBe('Closed · No power · updated 5 min ago');
    expect(describeManagerState({ state: 'closed', ageMinutes: 5, reason: 'other', overdue: false })).toBe('Closed · updated 5 min ago');
  });

  it('does not repeat "waiting for supply" on an open-and-waiting post', () => {
    expect(describeManagerState({ state: 'open', ageMinutes: 5, reason: 'supply', untilMs: until, overdue: false })).toBe(
      'Open · Waiting for gas supply · expected about 2 pm · updated 5 min ago',
    );
  });

  it('never prints a reason for a selling post', () => {
    expect(describeManagerState({ state: 'selling', ageMinutes: 5, reason: 'supply', overdue: false })).toBe(
      'Open for business · Gas available · updated 5 min ago',
    );
  });
});

describe('formatWatTime', () => {
  it('reads the Lagos clock, with minutes only when they are not zero', () => {
    expect(formatWatTime(Date.parse('2026-11-19T13:00:00Z'))).toBe('2 pm');
    expect(formatWatTime(Date.parse('2026-11-19T05:30:00Z'))).toBe('6:30 am');
    expect(formatWatTime(Date.parse('2026-11-19T11:00:00Z'))).toBe('12 pm');
    expect(formatWatTime(Date.parse('2026-11-18T23:00:00Z'))).toBe('12 am');
    expect(formatWatTime(Date.parse('2026-11-19T10:05:00Z'))).toBe('11:05 am');
  });
});

describe('MANAGER_REASON_OPTIONS', () => {
  it('lists the four reasons a manager can choose', () => {
    expect(MANAGER_REASON_OPTIONS.map((o) => o.reason)).toEqual(['supply', 'fault', 'power', 'other']);
    expect(MANAGER_REASON_OPTIONS.map((o) => o.label)).toEqual(['Waiting for supply', 'Technical fault', 'No power', 'Other']);
  });
});
