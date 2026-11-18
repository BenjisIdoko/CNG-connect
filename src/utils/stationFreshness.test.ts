import { describe, it, expect } from 'vitest';
import { GasStation, DriverReport, StationStatus } from '../types';
import {
  getFreshness, describeStatus, formatAgeShort, parseAgeMinutes, freshnessRank, currentStatus,
  usabilityCost, rankByUsefulness, pickBestStation, pinEmphasis, normalizeStatus,
  QUEUE_GRACE_MINUTES, QUEUE_MAX_MINUTES, isReportVisible, visibleReports,
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
  it('fresh within the hour, recent within the day, nothing after (a report over 24 h old is not shown at all)', () => {
    expect(getFreshness(station({ status: 'full', reports: [report('full', minsAgo(5))] }), NOW).tier).toBe('fresh');
    expect(getFreshness(station({ status: 'full', reports: [report('full', minsAgo(60))] }), NOW).tier).toBe('fresh');
    expect(getFreshness(station({ status: 'full', reports: [report('full', minsAgo(61))] }), NOW).tier).toBe('recent');
    expect(getFreshness(station({ status: 'full', reports: [report('full', minsAgo(24 * 60))] }), NOW).tier).toBe('recent');
    expect(getFreshness(station({ status: 'full', reports: [report('full', minsAgo(24 * 60 + 1))] }), NOW).tier).toBe('none');
  });

  it('keeps the last known status for an expired queue, but not once it is over 24 h old', () => {
    // A queue between 30 minutes and 24 hours with nobody there is last-known (grey)...
    const expired = getFreshness(station({ status: 'queue', reports: [report('queue', minsAgo(5 * 60))] }), NOW);
    expect(expired.tier).toBe('stale');
    expect(expired.lastKnownStatus).toBe('queue');
    expect(expired.ageText).toBe('5 hr ago');
    // ...and after 24 hours nothing is shown at all.
    const old = getFreshness(station({ status: 'queue', reports: [report('queue', minsAgo(3 * 24 * 60))] }), NOW);
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
    // Over 24 hours old: nothing is shown, not even a "Last: ..." line.
    expect(describeStatus(station({ status: 'out', reports: [report('out', minsAgo(2 * 1440))] }), NOW)).toBe('No report yet');
    expect(describeStatus(station(), NOW)).toBe('No report yet');
  });

  it('ranks freshest first and never-reported last', () => {
    const a = station({ status: 'full', reports: [report('full', minsAgo(5))] });
    const b = station({ status: 'full', reports: [report('full', minsAgo(500))] });
    const c = station();
    expect([c, b, a].sort((x, y) => freshnessRank(x, NOW) - freshnessRank(y, NOW))).toEqual([a, b, c]);
  });

  it('moves a report through the tiers as the clock advances (what the one-minute tick relies on)', () => {
    const s = station({ status: 'full', reports: [report('full', minsAgo(55))] });
    expect(getFreshness(s, NOW).tier).toBe('fresh');
    expect(describeStatus(s, NOW)).toBe('Available · 55 min ago');
    expect(getFreshness(s, NOW + 6 * 60000).tier).toBe('recent');
    expect(describeStatus(s, NOW + 6 * 60000)).toBe('Available · 1 hr ago');
    // A day later the report is over 24 hours old, so nothing is shown.
    expect(getFreshness(s, NOW + 24 * 3600000).tier).toBe('none');
    expect(currentStatus(s, NOW + 24 * 3600000)).toBe('unknown');
  });

  it('only counts a report under 24h old as the current status', () => {
    expect(currentStatus(station({ status: 'full', reports: [report('full', minsAgo(120))] }), NOW)).toBe('full');
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

  it('prices a queue and an older report in kilometres', () => {
    expect(usabilityCost(live('a', 'full', 5), 2, NOW)).toBe(2);
    expect(usabilityCost(live('a', 'queue', 5), 2, NOW)).toBe(7);
    expect(usabilityCost(live('a', 'full', 120), 2, NOW)).toBe(5);
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

describe('queue statuses follow cars at the station', () => {
  const queued = (ageMin: number, cars = 0) =>
    station({ id: 'q', name: 'q', status: 'queue', activePresenceCount: cars, reports: [report('queue', minsAgo(ageMin))] });
  const km = (table: Record<string, number>) => (s: GasStation) => table[s.id] ?? null;

  it('uses a 30 minute grace and a 3 hour limit', () => {
    expect(QUEUE_GRACE_MINUTES).toBe(30);
    expect(QUEUE_MAX_MINUTES).toBe(180);
  });

  it('a queue report is current at 29 minutes with nobody there', () => {
    const s = queued(29, 0);
    expect(getFreshness(s, NOW).tier).toBe('fresh');
    expect(currentStatus(s, NOW)).toBe('queue');
  });

  it('a queue report is still current at exactly 30 minutes', () => {
    expect(currentStatus(queued(30, 0), NOW)).toBe('queue');
  });

  it('a queue report is last-known at 31 minutes with nobody there', () => {
    const s = queued(31, 0);
    expect(getFreshness(s, NOW).tier).toBe('stale');
    expect(currentStatus(s, NOW)).toBe('unknown');
    expect(describeStatus(s, NOW)).toBe('Last: Queuing · 31 min ago');
  });

  it('a queue report between 30 and 60 minutes stays fresh while a car is there', () => {
    expect(getFreshness(queued(45, 1), NOW).tier).toBe('fresh');
  });

  it('a queue report at 2 hours stays current while a car is there', () => {
    const s = queued(120, 1);
    expect(getFreshness(s, NOW).tier).toBe('recent');
    expect(currentStatus(s, NOW)).toBe('queue');
  });

  it('a queue report at 181 minutes is last-known even with cars there', () => {
    const s = queued(181, 3);
    expect(getFreshness(s, NOW).tier).toBe('stale');
    expect(currentStatus(s, NOW)).toBe('unknown');
  });

  it('Available and Out of gas keep their 24 hour window with nobody there', () => {
    for (const status of ['full', 'out'] as StationStatus[]) {
      const s = station({ status, activePresenceCount: 0, reports: [report(status, minsAgo(300))] });
      expect(getFreshness(s, NOW).tier).toBe('recent');
      expect(currentStatus(s, NOW)).toBe(status);
    }
  });

  it('a newer Available report replaces an old queue whatever the car count', () => {
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

  it('pickBestStation skips a last-known queue', () => {
    const a = { ...queued(120, 0), id: 'a', name: 'a' } as GasStation;
    const b = station({ id: 'b', name: 'b', status: 'full', reports: [report('full', minsAgo(180))] });
    expect(pickBestStation([a, b], km({ a: 1, b: 20 }), NOW)?.id).toBe('b');
  });
});

describe('nothing is shown after 24 hours', () => {
  it('a report 23 h 59 min old still counts, one 24 h 01 min old gives tier "none" and no last-known status', () => {
    const young = station({ status: 'full', reports: [report('full', minsAgo(24 * 60 - 1))] });
    expect(getFreshness(young, NOW).tier).toBe('recent');
    expect(currentStatus(young, NOW)).toBe('full');

    const old = station({ status: 'full', reports: [report('full', minsAgo(24 * 60 + 1))] });
    const f = getFreshness(old, NOW);
    expect(f.tier).toBe('none');
    expect(f.lastKnownStatus).toBeNull();
    expect(currentStatus(old, NOW)).toBe('unknown');
  });

  it('a station last reported 3 days ago reads "No report yet" with no age', () => {
    const s = station({ status: 'full', reports: [report('full', minsAgo(3 * 1440))] });
    expect(describeStatus(s, NOW)).toBe('No report yet');
    expect(getFreshness(s, NOW).ageText).toBeNull();
  });

  it('an expired queue shows grey "Last: Queuing" at 5 hours and nothing at 24 h 01 min', () => {
    const at = (mins: number) => station({ status: 'queue', activePresenceCount: 0, reports: [report('queue', minsAgo(mins))] });
    expect(describeStatus(at(300), NOW)).toBe('Last: Queuing · 5 hr ago');
    expect(describeStatus(at(24 * 60 + 1), NOW)).toBe('No report yet');
  });

  it('a station-level stamp over 24 h old (no report rows) is not shown either', () => {
    const s = station({ status: 'full', lastUpdated: minsAgo(3 * 1440), reports: [] });
    expect(getFreshness(s, NOW).tier).toBe('none');
  });

  it('isReportVisible is true just under 24 h and for "just now", false just over 24 h and for an unreadable timestamp', () => {
    expect(isReportVisible({ timestamp: minsAgo(24 * 60 - 1) }, NOW)).toBe(true);
    expect(isReportVisible({ timestamp: 'Just now' }, NOW)).toBe(true);
    expect(isReportVisible({ timestamp: minsAgo(24 * 60 + 1) }, NOW)).toBe(false);
    expect(isReportVisible({ timestamp: 'garbage' }, NOW)).toBe(false);
    expect(isReportVisible({ timestamp: '' }, NOW)).toBe(false);
  });

  it('visibleReports keeps the order and drops old and unreadable reports', () => {
    const a = report('full', minsAgo(10));
    const b = report('queue', minsAgo(24 * 60 + 5));
    const c = report('out', minsAgo(300));
    const d = report('full', 'garbage');
    expect(visibleReports([a, b, c, d], NOW)).toEqual([a, c]);
  });
});
