import { describe, it, expect } from 'vitest';
import { GasStation, DriverReport, StationStatus } from '../types';
import {
  getFreshness, describeStatus, formatAgeShort, parseAgeMinutes, freshnessRank, currentStatus,
  usabilityCost, rankByUsefulness, pickBestStation, pinEmphasis,
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
  it('fresh within the hour, recent within the day, stale after', () => {
    expect(getFreshness(station({ status: 'full', reports: [report('full', minsAgo(5))] }), NOW).tier).toBe('fresh');
    expect(getFreshness(station({ status: 'full', reports: [report('full', minsAgo(60))] }), NOW).tier).toBe('fresh');
    expect(getFreshness(station({ status: 'full', reports: [report('full', minsAgo(61))] }), NOW).tier).toBe('recent');
    expect(getFreshness(station({ status: 'full', reports: [report('full', minsAgo(24 * 60))] }), NOW).tier).toBe('recent');
    expect(getFreshness(station({ status: 'full', reports: [report('full', minsAgo(24 * 60 + 1))] }), NOW).tier).toBe('stale');
  });

  it('keeps the last known status when stale', () => {
    const f = getFreshness(station({ status: 'queue', reports: [report('queue', minsAgo(3 * 24 * 60))] }), NOW);
    expect(f.tier).toBe('stale');
    expect(f.lastKnownStatus).toBe('queue');
    expect(f.ageText).toBe('3 days ago');
  });

  it('uses the newest report even if the array is not sorted', () => {
    const f = getFreshness(
      station({ status: 'low', reports: [report('out', minsAgo(500)), report('low', minsAgo(10)), report('full', minsAgo(900))] }),
      NOW
    );
    expect(f.lastKnownStatus).toBe('low');
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
    expect(describeStatus(station({ status: 'out', reports: [report('out', minsAgo(2 * 1440))] }), NOW)).toBe('Last: Out of service · 2 days ago');
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
    expect(getFreshness(s, NOW + 24 * 3600000).tier).toBe('stale');
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

  it('prices a queue, low pressure and an older report in kilometres', () => {
    expect(usabilityCost(live('a', 'full', 5), 2, NOW)).toBe(2);
    expect(usabilityCost(live('a', 'queue', 5), 2, NOW)).toBe(7);
    expect(usabilityCost(live('a', 'low', 5), 2, NOW)).toBe(10);
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
