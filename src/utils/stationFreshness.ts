import { GasStation, StationStatus } from '../types';
import { isIsoTimestamp } from './timeUtils';

/**
 * How much a driver should trust a station's status, from the age of its newest
 * real report (design tokens: solid <=1h, tint 1-24h, grey >24h).
 *   fresh  — reported within the last hour
 *   recent — within the last 24 hours
 *   stale  — a Queuing report past its short window (nobody there); only a "last known" hint
 *            (anything older than 24 hours is 'none': not shown at all)
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

/**
 * A queue only exists while cars are standing at the station, so a Queuing report is current for
 * a short grace period after it is filed, and after that only while a car is at the station's
 * geofence (`station.activePresenceCount`), up to a hard limit. Past that it is last-known.
 */
export const QUEUE_GRACE_MINUTES = 30;
export const QUEUE_MAX_MINUTES = 180;

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

/**
 * Reads a status string from the database, local cache or an old client. "Low pressure" was
 * retired, so a stored 'low' is read as 'queue' (a slow fill is a wait); anything unrecognised
 * is 'unknown'.
 */
export function normalizeStatus(raw: string | null | undefined): StationStatus {
  if (raw === 'full' || raw === 'queue' || raw === 'out') return raw;
  if (raw === 'low') return 'queue';
  return 'unknown';
}

/** A report counts for 24 hours; after that it is gone from every screen (the row stays stored). */
export function isReportVisible(report: { timestamp: string }, now = Date.now()): boolean {
  const age = parseAgeMinutes(report.timestamp, now);
  return age !== null && age <= RECENT_MINUTES;
}

/** The reports a station's list may show: the last 24 hours, in their original order. */
export function visibleReports<T extends { timestamp: string }>(reports: T[], now = Date.now()): T[] {
  return reports.filter((r) => isReportVisible(r, now));
}

export function getFreshness(station: GasStation, now = Date.now()): Freshness {
  let best: { age: number; status: StationStatus } | null = null;

  for (const report of station.reports || []) {
    if (!report.status || report.status === 'unknown') continue;
    const age = parseAgeMinutes(report.timestamp, now);
    if (age === null) continue;
    if (!best || age < best.age) best = { age, status: normalizeStatus(report.status) };
  }

  // Seeded/local stations carry no report rows — fall back to the station's own stamp.
  if (!best && station.status !== 'unknown') {
    const age = parseAgeMinutes(station.lastUpdated, now);
    if (age !== null) best = { age, status: normalizeStatus(station.status) };
  }

  // Nothing older than 24 hours is shown, not even as "last known".
  if (!best || best.age > RECENT_MINUTES) return { tier: 'none', ageMinutes: null, lastKnownStatus: null, ageText: null };

  let tier: FreshnessTier;
  if (best.status === 'queue') {
    const carsHere = station.activePresenceCount ?? 0;
    const current = best.age <= QUEUE_GRACE_MINUTES || (carsHere > 0 && best.age <= QUEUE_MAX_MINUTES);
    tier = !current ? 'stale' : best.age <= FRESH_MINUTES ? 'fresh' : 'recent';
  } else {
    tier = best.age <= FRESH_MINUTES ? 'fresh' : 'recent';
  }
  return { tier, ageMinutes: best.age, lastKnownStatus: best.status, ageText: formatAgeShort(best.age) };
}

export const STATUS_SHORT_LABEL: Record<StationStatus, string> = {
  full: 'Available',
  queue: 'Queuing',
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

// ---- "Which station should I go to?" -------------------------------------------------------
// A station only has an answer when it has a report under 24h old that isn't "out of service".
// Among those, a driver trades distance against how good the news is, so each shortfall is
// priced in kilometres of driving: a queue is worth about 5 km and a report older than an hour
// about 3 km of doubt.
const STATUS_COST_KM: Record<StationStatus, number> = {
  full: 0,
  queue: 5,
  out: Number.POSITIVE_INFINITY,
  unknown: Number.POSITIVE_INFINITY,
};
const RECENT_COST_KM = 3;

/** Distance-equivalent cost of going to a station; Infinity when there is no usable report. */
export function usabilityCost(station: GasStation, distanceKm: number | null, now = Date.now()): number {
  const f = getFreshness(station, now);
  if ((f.tier !== 'fresh' && f.tier !== 'recent') || !f.lastKnownStatus) return Number.POSITIVE_INFINITY;
  return (distanceKm ?? 0) + STATUS_COST_KM[f.lastKnownStatus] + (f.tier === 'recent' ? RECENT_COST_KM : 0);
}

/**
 * Stations a driver can act on first (cheapest to reach, freshest on ties), then everything with
 * no usable report: nearest first when the position is known, otherwise by name.
 * `distanceKm` returns null when we don't know where the driver is.
 */
export function rankByUsefulness(
  stations: GasStation[],
  distanceKm: (station: GasStation) => number | null,
  now = Date.now(),
): GasStation[] {
  const rows = stations.map((station) => {
    const distance = distanceKm(station);
    return { station, distance, cost: usabilityCost(station, distance, now), age: freshnessRank(station, now) };
  });
  rows.sort((a, b) => {
    const aLive = Number.isFinite(a.cost);
    const bLive = Number.isFinite(b.cost);
    if (aLive !== bLive) return aLive ? -1 : 1;
    if (aLive) return a.cost - b.cost || a.age - b.age;
    if (a.distance !== null && b.distance !== null && a.distance !== b.distance) return a.distance - b.distance;
    return a.station.name.localeCompare(b.station.name);
  });
  return rows.map((row) => row.station);
}

/** The one station worth recommending right now, or null when nobody has a usable report. */
export function pickBestStation(
  stations: GasStation[],
  distanceKm: (station: GasStation) => number | null,
  now = Date.now(),
): GasStation | null {
  const [first] = rankByUsefulness(stations, distanceKm, now);
  return first && Number.isFinite(usabilityCost(first, distanceKm(first), now)) ? first : null;
}

// ---- Map pins ------------------------------------------------------------------------------
export interface PinEmphasis {
  /** Diameter of the round pin, px. */
  size: number;
  opacity: number;
  /** Soft halo in the status colour: only for reports an hour old or less. */
  halo: boolean;
  /** Leaflet z-index offset so trustworthy pins sit above doubtful ones. */
  zIndexOffset: number;
}

/** How loudly a pin should speak: the older the report, the quieter the pin. */
export function pinEmphasis(tier: FreshnessTier): PinEmphasis {
  switch (tier) {
    case 'fresh':
      return { size: 32, opacity: 1, halo: true, zIndexOffset: 300 };
    case 'recent':
      return { size: 28, opacity: 0.8, halo: false, zIndexOffset: 200 };
    case 'stale':
      return { size: 24, opacity: 0.65, halo: false, zIndexOffset: 100 };
    default:
      return { size: 22, opacity: 0.6, halo: false, zIndexOffset: 0 };
  }
}
