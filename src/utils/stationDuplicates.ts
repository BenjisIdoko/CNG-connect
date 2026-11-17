import { normalizeSearch } from './stationSearch';

/** A candidate this close to an existing station is worth a warning. */
export const NEARBY_METERS = 300;

const MAX_HITS = 5;

// Words that say what a station is, not which one it is.
const GENERIC_WORDS = new Set(['cng', 'station', 'filling', 'gas', 'ltd', 'limited']);

export interface StationRef {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface DuplicateHit {
  id: string;
  name: string;
  distanceM: number | null;
  reason: 'same_name' | 'nearby' | 'similar_name';
}

/**
 * The key the app and the database use to decide two stations are the same: lower-case,
 * everything except a-z and 0-9 removed. Mirrors `deduplicateStations` (src/data/mockData.ts)
 * and the check inside `admin_create_station` (supabase/admin-create-station.sql).
 */
export function normalizeStationName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

export function isExactNameDuplicate(name: string, existing: { name: string }[]): boolean {
  const key = normalizeStationName(name);
  if (!key) return false;
  return existing.some((s) => normalizeStationName(s.name) === key);
}

export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

function distinctiveWords(name: string): Set<string> {
  return new Set(normalizeSearch(name).split(' ').filter((w) => w && !GENERIC_WORDS.has(w)));
}

/** Both names have at least two distinctive words and one set contains the other. */
function haveSimilarNames(a: string, b: string): boolean {
  const wa = distinctiveWords(a);
  const wb = distinctiveWords(b);
  if (wa.size < 2 || wb.size < 2) return false;
  const [small, large] = wa.size <= wb.size ? [wa, wb] : [wb, wa];
  return [...small].every((w) => large.has(w));
}

/**
 * Stations an admin should look at before adding `candidate`: the same name (case and
 * punctuation ignored), any station within NEARBY_METERS, and similar names. Same-name
 * hits come first, then nearest first; at most five. Without a position only name
 * matches are returned.
 */
export function findSimilarStations(
  candidate: { name: string; lat: number | null; lng: number | null },
  existing: StationRef[],
): DuplicateHit[] {
  const key = normalizeStationName(candidate.name);
  const hasPosition = candidate.lat !== null && candidate.lng !== null;
  const hits: DuplicateHit[] = [];

  for (const s of existing) {
    const distanceM = hasPosition
      ? haversineMeters({ lat: candidate.lat as number, lng: candidate.lng as number }, s)
      : null;
    let reason: DuplicateHit['reason'] | null = null;
    if (key && normalizeStationName(s.name) === key) reason = 'same_name';
    else if (distanceM !== null && distanceM <= NEARBY_METERS) reason = 'nearby';
    else if (haveSimilarNames(candidate.name, s.name)) reason = 'similar_name';
    if (reason) hits.push({ id: s.id, name: s.name, distanceM, reason });
  }

  const rank = (h: DuplicateHit) => (h.reason === 'same_name' ? 0 : 1);
  hits.sort((a, b) => rank(a) - rank(b) || (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity));
  return hits.slice(0, MAX_HITS);
}
