import { GasStation, StationStatus } from '../types';
import { isIsoTimestamp } from './timeUtils';

/**
 * How much a driver should trust a station's status, from the age of its newest
 * real report (design tokens: solid <=1h, tint 1-24h, grey >24h).
 *   fresh  — reported within the last hour
 *   recent — within the last 24 hours
 *   stale  — older than 24 hours; the status is only a "last known" hint
 *   none   — never reported (or only seeded data with no real timestamp)
 */
export type FreshnessTier = 'fresh' | 'recent' | 'stale' | 'none';

export interface Freshness {
  tier: FreshnessTier;
  ageMinutes: number | null;
  /** Status of the newest real report — still meaningful as "last known" when stale. */
  lastKnownStatus: StationStatus | null;
  ageText: string | null;
}

const FRESH_MINUTES = 60;
const RECENT_MINUTES = 24 * 60;

/** Minutes since a report time that may be an ISO stamp or legacy relative copy ("5 min ago"). */
export function parseAgeMinutes(raw: string | undefined | null, now = Date.now()): number | null {
  const value = (raw || '').trim().toLowerCase();
  if (!value) return null;
  if (isIsoTimestamp(raw)) return Math.max(0, Math.floor((now - Date.parse(raw as string)) / 60000));
  if (value === 'just now') return 0;
  const min = value.match(/(\d+)\s*min/);
  if (min) return parseInt(min[1], 10);
  const hr = value.match(/(\d+)\s*h(?:ou)?r/);
  if (hr) return parseInt(hr[1], 10) * 60;
  const day = value.match(/(\d+)\s*d(?:ay)?/);
  if (day) return parseInt(day[1], 10) * 24 * 60;
  return null;
}

export function formatAgeShort(minutes: number): string {
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 9) return `${weeks} wk${weeks === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  return `${months} mo ago`;
}

export function getFreshness(station: GasStation, now = Date.now()): Freshness {
  let best: { age: number; status: StationStatus } | null = null;

  for (const report of station.reports || []) {
    if (!report.status || report.status === 'unknown') continue;
    const age = parseAgeMinutes(report.timestamp, now);
    if (age === null) continue;
    if (!best || age < best.age) best = { age, status: report.status };
  }

  // Seeded/local stations carry no report rows — fall back to the station's own stamp.
  if (!best && station.status !== 'unknown') {
    const age = parseAgeMinutes(station.lastUpdated, now);
    if (age !== null) best = { age, status: station.status };
  }

  if (!best) return { tier: 'none', ageMinutes: null, lastKnownStatus: null, ageText: null };

  const tier: FreshnessTier = best.age <= FRESH_MINUTES ? 'fresh' : best.age <= RECENT_MINUTES ? 'recent' : 'stale';
  return { tier, ageMinutes: best.age, lastKnownStatus: best.status, ageText: formatAgeShort(best.age) };
}

export const STATUS_SHORT_LABEL: Record<StationStatus, string> = {
  full: 'Available',
  queue: 'Queuing',
  low: 'Low pressure',
  out: 'Out of service',
  unknown: 'No report yet',
};

/** One line of driver-facing copy, honest about age: "Available · 12 min ago" / "Last: Queuing · 3 days ago". */
export function describeStatus(station: GasStation, now = Date.now()): string {
  const f = getFreshness(station, now);
  if (f.tier === 'none' || !f.lastKnownStatus) return 'No report yet';
  const label = STATUS_SHORT_LABEL[f.lastKnownStatus];
  return f.tier === 'stale' ? `Last: ${label} · ${f.ageText}` : `${label} · ${f.ageText}`;
}

/** Sort key for "freshest first": newest report first, never-reported last. */
export function freshnessRank(station: GasStation, now = Date.now()): number {
  return getFreshness(station, now).ageMinutes ?? Number.POSITIVE_INFINITY;
}

/**
 * The station's status for filtering/sorting purposes: its newest report only counts as
 * "current" if it is under 24h old. A days-old "Available" must not match an "Available" filter.
 */
export function currentStatus(station: GasStation, now = Date.now()): StationStatus {
  const f = getFreshness(station, now);
  return (f.tier === 'fresh' || f.tier === 'recent') && f.lastKnownStatus ? f.lastKnownStatus : 'unknown';
}
