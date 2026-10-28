import { describe, it, expect } from 'vitest';
import { GasStation, DriverReport, StationStatus } from '../types';
import { getFreshness, describeStatus, formatAgeShort, parseAgeMinutes, freshnessRank, currentStatus } from './stationFreshness';

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
