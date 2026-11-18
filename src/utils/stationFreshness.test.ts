import { describe, it, expect } from 'vitest';
import { GasStation, DriverReport, StationStatus } from '../types';
import {
  getFreshness, describeStatus, formatAgeShort, parseAgeMinutes, freshnessRank, currentStatus,
  usabilityCost, rankByUsefulness, pickBestStation, pinEmphasis, normalizeStatus,
  QUEUE_GRACE_MINUTES, REPORT_LIFETIME_MINUTES, isReportVisible, visibleReports, newestVisibleReport,
} from './stationFreshness';

const NOW = Date.parse('2026-10-12T12:00:00.000Z');
const minsAgo = (m: number) => new Date(NOW - m * 60000).toISOString();

const report = (status: StationStatus, timestamp: string): DriverReport => ({
  id: `r-${status}-${timestamp}`,
  author: 'A',
  authorAvatar: '',
  verified: false,
  timestamp,
  status,
  statusLabel: status,
  likes: 0,
});

const station = (over: Partial<GasStation> = {}): GasStation =>
  ({
    id: 's1',
    name: 'Test',
    status: 'unknown',
    statusLabel: 'No recent reports',
    lastUpdated: '',
    reports: [],
    ...over,
  }) as GasStation;

describe('getFreshness tiers', () => {
  it('fresh for 45 minutes, nothing after (a report over 45 min old is not shown at all)', () => {
    expect(getFreshness(station({ status: 'full', reports: [report('full', minsAgo(5))] }), NOW).tier).toBe('fresh');
    expect(getFreshness(station({ status: 'full', reports: [report('full', minsAgo(45))] }), NOW).tier).toBe('fresh');
    expect(getFreshness(station({ status: 'full', reports: [report('full', minsAgo(46))] }), NOW).tier).toBe('none');
  });

  it('keeps the last known status for an expired queue, but not once it is over 45 min old', () => {
    // A queue between 30 and 45 minutes with nobody there is last-known (grey)...
    const expired = getFreshness(station({ status: 'queue', reports: [report('queue', minsAgo(35))] }), NOW);
    expect(expired.tier).toBe('stale');
    expect(expired.lastKnownStatus).toBe('queue');
    expect(expired.ageText).toBe('35 min ago');
    // ...and after 45 minutes nothing is shown at all.
    const old = getFreshness(station({ status: 'queue', reports: [report('queue', minsAgo(50))] }), NOW);
    expect(old.tier).toBe('none');
    expect(old.lastKnownStatus).toBeNull();
    expect(old.ageText).toBeNull();
  });

  it('uses the newest report even if the array is not sorted', () => {
    const f = getFreshness(
      station({ status: 'queue', reports: [report('out', minsAgo(500)), report('queue', minsAgo(10)), report('full', minsAgo(900))] }),
      NOW
    );
    expect(f.lastKnownStatus).toBe('queue');
    expect(f.tier).toBe('fresh');
  });

  it('is "none" when never reported or only seeded', () => {
    expect(getFreshness(station(), NOW).tier).toBe('none');
    expect(getFreshness(station({ status: 'full', lastUpdated: 'Seeded from PCI' }), NOW).tier).toBe('none');
    expect(getFreshness(station({ reports: [report('unknown', minsAgo(5))] }), NOW).tier).toBe('none');
  });

  it('falls back to lastUpdated for stations with no report rows (local data)', () => {
    const f = getFreshness(station({ status: 'full', lastUpdated: '12 min ago' }), NOW);
    expect(f.tier).toBe('fresh');
    expect(f.lastKnownStatus).toBe('full');
  });
});

describe('retired low-pressure status', () => {
  it('reads a stored "low" as a queue and anything unknown as unknown', () => {
    expect(normalizeStatus('low')).toBe('queue');
    expect(normalizeStatus('full')).toBe('full');
    expect(normalizeStatus('queue')).toBe('queue');
    expect(normalizeStatus('out')).toBe('out');
    expect(normalizeStatus('unknown')).toBe('unknown');
    expect(normalizeStatus('bogus')).toBe('unknown');
    expect(normalizeStatus(null)).toBe('unknown');
    expect(normalizeStatus(undefined)).toBe('unknown');
  });

  it('treats an old cached low report as a queue everywhere a status is read', () => {
    const legacy = station({ reports: [report('low' as StationStatus, minsAgo(10))] });
    expect(getFreshness(legacy, NOW).lastKnownStatus).toBe('queue');
    expect(currentStatus(legacy, NOW)).toBe('queue');
    expect(describeStatus(legacy, NOW)).toBe('Queuing · 10 min ago');
    expect(usabilityCost(legacy, 2, NOW)).toBe(7);
  });
});

describe('copy helpers', () => {
  it('parses ISO and legacy relative stamps', () => {
    expect(parseAgeMinutes(minsAgo(42), NOW)).toBe(42);
    expect(parseAgeMinutes('Just now')).toBe(0);
    expect(parseAgeMinutes('5 mins ago')).toBe(5);
    expect(parseAgeMinutes('2 hrs ago')).toBe(120);
    expect(parseAgeMinutes('3 days ago')).toBe(3 * 1440);
    expect(parseAgeMinutes('Seeded from PCI')).toBeNull();
    expect(parseAgeMinutes('')).toBeNull();
  });

  it('formats ages', () => {
    expect(formatAgeShort(0)).toBe('just now');
    expect(formatAgeShort(12)).toBe('12 min ago');
    expect(formatAgeShort(180)).toBe('3 hr ago');
    expect(formatAgeShort(1440)).toBe('1 day ago');
    expect(formatAgeShort(14 * 1440)).toBe('2 wks ago');
    expect(formatAgeShort(120 * 1440)).toBe('4 mo ago');
  });

  it('describes status honestly by age', () => {
    expect(describeStatus(station({ status: 'full', reports: [report('full', minsAgo(12))] }), NOW)).toBe('Available · 12 min ago');
    // Over 45 minutes old: nothing is shown, not even a "Last: ..." line.
    expect(describeStatus(station({ status: 'out', reports: [report('out', minsAgo(2 * 1440))] }), NOW)).toBe('No report yet');
    expect(describeStatus(station(), NOW)).toBe('No report yet');
  });

  it('ranks freshest first and never-reported last', () => {
    const a = station({ status: 'full', reports: [report('full', minsAgo(5))] });
    const b = station({ status: 'full', reports: [report('full', minsAgo(30))] });
    const c = station();
    expect([c, b, a].sort((x, y) => freshnessRank(x, NOW) - freshnessRank(y, NOW))).toEqual([a, b, c]);
  });

  it('moves a report through its life as the clock advances (what the one-minute tick relies on)', () => {
    const s = station({ status: 'full', reports: [report('full', minsAgo(25))] });
    expect(getFreshness(s, NOW).tier).toBe('fresh');
    expect(describeStatus(s, NOW)).toBe('Available · 25 min ago');
    expect(describeStatus(s, NOW + 10 * 60000)).toBe('Available · 35 min ago');
    // 21 minutes later the report is 46 minutes old, so nothing is shown.
    expect(getFreshness(s, NOW + 21 * 60000).tier).toBe('none');
    expect(currentStatus(s, NOW + 21 * 60000)).toBe('unknown');
  });

  it('only counts a report under 45 minutes old as the current status', () => {
    expect(currentStatus(station({ status: 'full', reports: [report('full', minsAgo(30))] }), NOW)).toBe('full');
    expect(currentStatus(station({ status: 'full', reports: [report('full', minsAgo(120))] }), NOW)).toBe('unknown');
    expect(currentStatus(station({ status: 'full', reports: [report('full', minsAgo(3 * 1440))] }), NOW)).toBe('unknown');
    expect(currentStatus(station(), NOW)).toBe('unknown');
  });
});

describe('which station to go to', () => {
  const live = (id: string, status: StationStatus, ageMin: number) =>
    station({ id, name: id, status, reports: [report(status, minsAgo(ageMin))] });
  const km = (table: Record<string, number>) => (s: GasStation) => table[s.id] ?? null;

  it('has no answer for a station with no report, a stale one, or one that is out of service', () => {
    expect(usabilityCost(station(), 1, NOW)).toBe(Number.POSITIVE_INFINITY);
    expect(usabilityCost(live('a', 'full', 3 * 1440), 1, NOW)).toBe(Number.POSITIVE_INFINITY);
    expect(usabilityCost(live('a', 'out', 5), 1, NOW)).toBe(Number.POSITIVE_INFINITY);
  });

  it('prices a queue in kilometres, and has no answer for a report over 45 minutes old', () => {
    expect(usabilityCost(live('a', 'full', 5), 2, NOW)).toBe(2);
    expect(usabilityCost(live('a', 'queue', 5), 2, NOW)).toBe(7);
    expect(usabilityCost(live('a', 'full', 120), 2, NOW)).toBe(Number.POSITIVE_INFINITY);
  });

  it('prefers a farther available station over a nearby queue, and a close one over a far one', () => {
    const near = live('near', 'queue', 5);
    const far = live('far', 'full', 5);
    expect(pickBestStation([near, far], km({ near: 1, far: 4 }), NOW)?.id).toBe('far');
    expect(pickBestStation([near, far], km({ near: 1, far: 9 }), NOW)?.id).toBe('near');
  });

  it('without a position, ranks by status and then by how new the report is', () => {
    const a = live('a', 'full', 40);
    const b = live('b', 'full', 10);
    const c = live('c', 'queue', 1);
    expect(rankByUsefulness([a, c, b], () => null, NOW).map((s) => s.id)).toEqual(['b', 'a', 'c']);
  });

  it('puts unreported stations last: nearest first with a position, by name without one', () => {
    const none1 = station({ id: 'z', name: 'Zed' });
    const none2 = station({ id: 'a', name: 'Alpha' });
    const one = live('x', 'full', 5);
    expect(rankByUsefulness([none1, none2, one], () => null, NOW).map((s) => s.id)).toEqual(['x', 'a', 'z']);
    expect(rankByUsefulness([none1, none2, one], km({ z: 1, a: 9, x: 50 }), NOW).map((s) => s.id)).toEqual(['x', 'z', 'a']);
  });

  it('recommends nothing when no station has a usable report', () => {
    expect(pickBestStation([station(), live('s', 'full', 3 * 1440), live('o', 'out', 5)], () => 1, NOW)).toBeNull();
    expect(pickBestStation([], () => 1, NOW)).toBeNull();
  });
});

describe('pin emphasis', () => {
  it('gets quieter as the report ages and only glows while it is fresh', () => {
    const tiers = (['fresh', 'recent', 'stale', 'none'] as const).map(pinEmphasis);
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i].size).toBeLessThanOrEqual(tiers[i - 1].size);
      expect(tiers[i].opacity).toBeLessThanOrEqual(tiers[i - 1].opacity);
      expect(tiers[i].zIndexOffset).toBeLessThan(tiers[i - 1].zIndexOffset);
    }
    expect(tiers.map((t) => t.halo)).toEqual([true, false, false, false]);
  });
});

describe('a report lasts 45 minutes', () => {
  const queued = (ageMin: number, cars = 0) =>
    station({ id: 'q', name: 'q', status: 'queue', activePresenceCount: cars, reports: [report('queue', minsAgo(ageMin))] });
  const km = (table: Record<string, number>) => (s: GasStation) => table[s.id] ?? null;

  it('lasts 45 minutes, with a 30 minute grace for a queue', () => {
    expect(REPORT_LIFETIME_MINUTES).toBe(45);
    expect(QUEUE_GRACE_MINUTES).toBe(30);
  });

  it('a report 44 min old still counts, one 46 min old gives tier "none" and no last-known status', () => {
    const young = station({ status: 'full', reports: [report('full', minsAgo(44))] });
    expect(getFreshness(young, NOW).tier).toBe('fresh');
    expect(currentStatus(young, NOW)).toBe('full');

    const old = station({ status: 'full', reports: [report('full', minsAgo(46))] });
    const f = getFreshness(old, NOW);
    expect(f.tier).toBe('none');
    expect(f.lastKnownStatus).toBeNull();
    expect(currentStatus(old, NOW)).toBe('unknown');
  });

  it('a report exactly 45 minutes old still counts', () => {
    expect(currentStatus(station({ status: 'full', reports: [report('full', minsAgo(45))] }), NOW)).toBe('full');
  });

  it('Available and Out of gas last the full 45 minutes with nobody there', () => {
    for (const status of ['full', 'out'] as StationStatus[]) {
      const s = station({ status, activePresenceCount: 0, reports: [report(status, minsAgo(44))] });
      expect(getFreshness(s, NOW).tier).toBe('fresh');
      expect(currentStatus(s, NOW)).toBe(status);
    }
  });

  it('a station last reported an hour ago reads "No report yet" with no age', () => {
    const s = station({ status: 'full', reports: [report('full', minsAgo(60))] });
    expect(describeStatus(s, NOW)).toBe('No report yet');
    expect(getFreshness(s, NOW).ageText).toBeNull();
  });

  it('a queue is current up to 30 minutes with nobody there, and last-known from 31 to 45 minutes', () => {
    expect(currentStatus(queued(29, 0), NOW)).toBe('queue');
    expect(currentStatus(queued(30, 0), NOW)).toBe('queue');
    const s = queued(31, 0);
    expect(getFreshness(s, NOW).tier).toBe('stale');
    expect(currentStatus(s, NOW)).toBe('unknown');
    expect(describeStatus(s, NOW)).toBe('Last: Queuing · 31 min ago');
  });

  it('a queue stays current from 31 to 45 minutes while a car is there', () => {
    expect(getFreshness(queued(31, 1), NOW).tier).toBe('fresh');
    expect(currentStatus(queued(45, 1), NOW)).toBe('queue');
  });

  it('a queue is gone after 45 minutes even with cars there', () => {
    const s = queued(46, 3);
    expect(getFreshness(s, NOW).tier).toBe('none');
    expect(currentStatus(s, NOW)).toBe('unknown');
    expect(describeStatus(s, NOW)).toBe('No report yet');
  });

  it('a newer report replaces an older one whatever the car count', () => {
    const s = station({
      status: 'full',
      activePresenceCount: 0,
      reports: [report('queue', minsAgo(10)), report('full', minsAgo(1))],
    });
    expect(currentStatus(s, NOW)).toBe('full');
  });

  it('usabilityCost is Infinity for a 40 minute queue with nobody there and finite with a car', () => {
    expect(usabilityCost(queued(40, 0), 2, NOW)).toBe(Number.POSITIVE_INFINITY);
    expect(usabilityCost(queued(40, 1), 2, NOW)).toBe(7);
  });

  it('pickBestStation skips a last-known queue and a report over 45 minutes old', () => {
    const a = { ...queued(35, 0), id: 'a', name: 'a' } as GasStation;
    const b = station({ id: 'b', name: 'b', status: 'full', reports: [report('full', minsAgo(40))] });
    const c = station({ id: 'c', name: 'c', status: 'full', reports: [report('full', minsAgo(50))] });
    expect(pickBestStation([a, b, c], km({ a: 1, b: 20, c: 1 }), NOW)?.id).toBe('b');
  });

  it('a station-level stamp over 45 minutes old (no report rows) is not shown either', () => {
    const s = station({ status: 'full', lastUpdated: minsAgo(120), reports: [] });
    expect(getFreshness(s, NOW).tier).toBe('none');
  });

  it('isReportVisible is true at 44 minutes and for "just now", false at 46 minutes and for an unreadable timestamp', () => {
    expect(isReportVisible({ timestamp: minsAgo(44) }, NOW)).toBe(true);
    expect(isReportVisible({ timestamp: 'Just now' }, NOW)).toBe(true);
    expect(isReportVisible({ timestamp: minsAgo(46) }, NOW)).toBe(false);
    expect(isReportVisible({ timestamp: 'garbage' }, NOW)).toBe(false);
    expect(isReportVisible({ timestamp: '' }, NOW)).toBe(false);
  });

  it('visibleReports keeps the order and drops old and unreadable reports', () => {
    const a = report('full', minsAgo(10));
    const b = report('queue', minsAgo(50));
    const c = report('out', minsAgo(40));
    const d = report('full', 'garbage');
    expect(visibleReports([a, b, c, d], NOW)).toEqual([a, c]);
  });
});

describe('only the newest report is shown', () => {
  it('returns the newest visible report whatever the order of the list', () => {
    const older = report('queue', minsAgo(30));
    const newest = report('full', minsAgo(5));
    const middle = report('out', minsAgo(12));
    expect(newestVisibleReport([older, newest, middle], NOW)).toBe(newest);
    expect(newestVisibleReport([newest, middle, older], NOW)).toBe(newest);
  });

  it('is replaced as soon as a newer report arrives', () => {
    const first = report('queue', minsAgo(20));
    expect(newestVisibleReport([first], NOW)).toBe(first);
    const second = report('full', minsAgo(1));
    expect(newestVisibleReport([second, first], NOW)).toBe(second);
  });

  it('ignores reports over 45 minutes old and unreadable ones, and returns null when none is left', () => {
    const old = report('full', minsAgo(50));
    const bad = report('queue', 'garbage');
    expect(newestVisibleReport([old, bad], NOW)).toBeNull();
    expect(newestVisibleReport([], NOW)).toBeNull();
    const young = report('out', minsAgo(44));
    expect(newestVisibleReport([old, bad, young], NOW)).toBe(young);
  });
});
