/**
 * Real-geocoding enrichment pass for src/data/pci-stations-seed.json.
 *
 * scripts/seed-stations.ts (the PCI feed importer) has no coordinates for ~99%
 * of stations, so it falls back to a deterministic state-centroid grid and
 * mislabels the result "geocoded". This script replaces those placeholder pins
 * with real OpenStreetMap/Nominatim geocodes, records an honest precision tier
 * per station, fixes the `city`/`area` split (the importer had been reading the
 * street/landmark into `city`), and flags any pins that still collide.
 *
 * Usage:
 *   npm run geocode:stations            # enrich + overwrite the seed file
 *   npm run geocode:stations -- --dry-run   # report only, no writes
 *
 * Results are cached in scratch/geocode-cache.json so re-runs are free and the
 * script only ever needs to hit Nominatim for addresses it hasn't seen before.
 * Respects Nominatim's usage policy: <=1 request/sec, identifying User-Agent.
 */
import fs from 'fs';
import path from 'path';
import type { GasStation } from '../src/types';

const SEED_PATH = path.resolve(process.cwd(), 'src/data/pci-stations-seed.json');
const CACHE_PATH = path.resolve(process.cwd(), 'scratch/geocode-cache.json');
const BACKUP_PATH = path.resolve(process.cwd(), 'scratch/pci-stations-seed.before-geocode.json');
const REPORT_PATH = path.resolve(process.cwd(), 'scratch/geocode-report.md');

const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT =
  'CNG-Connect-station-geocoder/1.0 (+https://github.com/BenjisIdoko/CNG-connect; strictly4eternity@gmail.com)';
const REQUEST_DELAY_MS = 1100; // Nominatim policy: max 1 req/sec

const DRY_RUN = process.argv.includes('--dry-run');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

type PrecisionTier = 'source_exact' | 'rooftop' | 'street' | 'area' | 'city' | 'unlocated';

const ACCURACY_RADIUS_M: Record<PrecisionTier, number> = {
  source_exact: 15,
  rooftop: 30,
  street: 150,
  area: 700,
  city: 4000,
  unlocated: 15000,
};

interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state_district?: string;
  suburb?: string;
  neighbourhood?: string;
  quarter?: string;
  city_district?: string;
  hamlet?: string;
  road?: string;
  state?: string;
}

interface NominatimResult {
  lat: string;
  lon: string;
  place_rank: number;
  osm_type: string;
  category: string;
  type: string;
  addresstype: string;
  importance: number;
  address?: NominatimAddress;
}

interface CacheEntry {
  query: string;
  result: NominatimResult | null;
  fetchedAt: string;
}

type Cache = Record<string, CacheEntry>;

interface StationRow extends GasStation {
  locationPrecision?: PrecisionTier | 'geocoded' | 'gps_confirmed';
  accuracyRadiusM?: number;
  area?: string;
  needsPinReview?: boolean;
}

function loadJson<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normStateForQuery(state: string): string {
  if (state === 'FCT Abuja') return 'Federal Capital Territory';
  return state;
}

/**
 * Builds progressively looser search candidates for a station address, ordered
 * most- to least-specific. The full raw address (often a compound string like
 * "KU Plaza, Benin Sapele Rd, Opposite PZ Junction, Benin City") frequently
 * gets zero hits from Nominatim's free-text search, so we fall back through
 * landmark+city, then just city, before finally settling for the state.
 */
function buildQueryCandidates(address: string, landmark: string, state: string): string[] {
  const st = normStateForQuery(state);
  const segments = address.split(',').map((s) => s.trim()).filter(Boolean);
  const cityGuess = segments[segments.length - 1] || state;
  const trimmedLandmark = landmark?.trim();

  const candidates: string[] = [`${address}, Nigeria`];

  if (trimmedLandmark && trimmedLandmark !== address.trim() && trimmedLandmark !== cityGuess) {
    candidates.push(`${trimmedLandmark}, ${cityGuess}, ${st}, Nigeria`);
  }
  if (cityGuess && cityGuess !== st) {
    candidates.push(`${cityGuess}, ${st}, Nigeria`);
  }
  candidates.push(`${st}, Nigeria`);

  return [...new Set(candidates)];
}

async function geocode(query: string, cache: Cache): Promise<NominatimResult | null> {
  const key = query.toLowerCase().trim();
  if (cache[key]) return cache[key].result;

  const url = `${NOMINATIM_ENDPOINT}?format=jsonv2&addressdetails=1&countrycodes=ng&limit=1&q=${encodeURIComponent(
    query
  )}`;

  let result: NominatimResult | null = null;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (res.ok) {
      const body = (await res.json()) as NominatimResult[];
      result = body[0] || null;
    } else {
      console.warn(`[geocode] HTTP ${res.status} for "${query}"`);
    }
  } catch (err) {
    console.warn(`[geocode] request failed for "${query}":`, err instanceof Error ? err.message : err);
  }

  cache[key] = { query, result, fetchedAt: new Date().toISOString() };
  await sleep(REQUEST_DELAY_MS);
  return result;
}

/**
 * Classifies a Nominatim hit into a precision tier using `place_rank`, its own
 * documented specificity scale (2-4 country, ~8-12 state/county, ~16 city,
 * ~17-21 town/suburb, ~22-25 neighbourhood, 26-27 road, 28-30 individual
 * address/POI). Deliberately ignores `osm_type` — a city or suburb is very
 * often represented as an OSM *node* too, so "node" alone is not a rooftop
 * signal (that was the bug in an earlier version of this classifier).
 */
function classifyTier(result: NominatimResult, fromLastResortQuery: boolean): PrecisionTier {
  if (fromLastResortQuery) return 'city';

  const rank = Number(result.place_rank);
  const boundaryCategories = new Set(['boundary', 'place']);
  const isAdminBoundary = boundaryCategories.has(result.category);

  if (!isAdminBoundary && rank >= 28) return 'rooftop';
  if (rank === 26 || rank === 27) return 'street';
  if (rank >= 17 && rank <= 25) return 'area';
  return 'city';
}

function pickCity(addr: NominatimAddress | undefined, fallback: string): string {
  return addr?.city || addr?.town || addr?.village || addr?.municipality || addr?.county || addr?.state_district || fallback;
}

function pickArea(addr: NominatimAddress | undefined, fallback: string): string {
  return addr?.suburb || addr?.neighbourhood || addr?.quarter || addr?.city_district || addr?.hamlet || addr?.road || fallback;
}

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function slugToken(address: string): string {
  return (address.split(',')[0] || '').trim().split(' ').slice(0, 2).join(' ');
}

async function main() {
  if (!fs.existsSync(SEED_PATH)) {
    console.error(`No seed file found at ${SEED_PATH}`);
    process.exit(1);
  }
  const originalRaw = fs.readFileSync(SEED_PATH, 'utf-8');
  const stations = JSON.parse(originalRaw) as StationRow[];
  if (stations.length === 0) {
    console.error(`No stations found at ${SEED_PATH}`);
    process.exit(1);
  }

  const cache = loadJson<Cache>(CACHE_PATH, {});
  const before = stations.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng, precision: s.locationPrecision }));

  let networkCalls = 0;
  let cacheHits = 0;
  let geocodedCount = 0;
  const tierCounts: Record<string, number> = {};

  for (const station of stations) {
    if (station.locationPrecision === 'source_exact') {
      station.accuracyRadiusM = ACCURACY_RADIUS_M.source_exact;
      tierCounts.source_exact = (tierCounts.source_exact || 0) + 1;
      continue;
    }

    if (LIMIT !== undefined && geocodedCount >= LIMIT) {
      continue; // --limit reached: leave the remaining stations untouched for this run
    }
    geocodedCount++;

    const originalLandmark = station.city; // importer had put the street/landmark here
    const candidates = buildQueryCandidates(station.address, originalLandmark, station.state);

    let hit: NominatimResult | null = null;
    let usedLastResort = false;

    for (let i = 0; i < candidates.length; i++) {
      const query = candidates[i];
      const key = query.toLowerCase().trim();
      const wasCached = Boolean(cache[key]);
      const result = await geocode(query, cache);
      if (wasCached) cacheHits++;
      else networkCalls++;

      if (result) {
        hit = result;
        usedLastResort = i === candidates.length - 1;
        break;
      }
    }

    if (hit) {
      const tier = classifyTier(hit, usedLastResort);
      station.lat = Number(parseFloat(hit.lat).toFixed(6));
      station.lng = Number(parseFloat(hit.lon).toFixed(6));
      station.city = pickCity(hit.address, station.address.split(',').pop()?.trim() || station.state);
      station.area = pickArea(hit.address, originalLandmark);
      station.locationPrecision = tier;
      station.accuracyRadiusM = ACCURACY_RADIUS_M[tier];
      station.dataSource = 'pci.gov.ng (OSM/Nominatim geocoded)';
      station.dataSourceDate = new Date().toISOString().split('T')[0];
    } else {
      // Nothing usable came back — keep the existing (placeholder-grid) pin but
      // stop calling it "geocoded"; mark it honestly as unlocated for review.
      station.area = originalLandmark;
      station.locationPrecision = 'unlocated';
      station.accuracyRadiusM = ACCURACY_RADIUS_M.unlocated;
      station.needsPinReview = true;
    }

    const tierKey = station.locationPrecision as string;
    tierCounts[tierKey] = (tierCounts[tierKey] || 0) + 1;
    console.log(`[geocode] ${station.id} "${station.name}" -> ${tierKey} (${station.lat}, ${station.lng})`);

    // Rebuild the display name from the (now-corrected) area, keeping it unique.
    if (station.operator && station.area) {
      station.name = `${station.operator} - ${station.area}`;
    }
  }

  // De-duplicate names that collided after the city/area fix (append a street token).
  const seenNames = new Map<string, number>();
  for (const station of stations) {
    const normName = station.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const count = seenNames.get(normName) || 0;
    if (count > 0) {
      const token = slugToken(station.address);
      station.name = token ? `${station.name} (${token})` : `${station.name} #${count + 1}`;
    }
    seenNames.set(normName, count + 1);
  }

  // Flag pins that still collide (<30m apart) after geocoding — real duplicates
  // or addresses too vague to disambiguate; needs a human pass.
  const collisions: Array<[string, string, number]> = [];
  for (let i = 0; i < stations.length; i++) {
    for (let j = i + 1; j < stations.length; j++) {
      const a = stations[i];
      const b = stations[j];
      const d = haversineMeters(a, b);
      if (d < 30) {
        a.needsPinReview = true;
        b.needsPinReview = true;
        collisions.push([a.name, b.name, Math.round(d)]);
      }
    }
  }

  const after = stations.map((s) => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng, precision: s.locationPrecision }));

  // --- Report ---
  const lines: string[] = [];
  lines.push('# Station geocoding report');
  lines.push('');
  lines.push(`Generated ${new Date().toISOString()}`);
  lines.push(`Stations processed: ${stations.length}`);
  lines.push(`Nominatim requests: ${networkCalls} (cache hits: ${cacheHits})`);
  lines.push('');
  lines.push('## Precision tier breakdown');
  for (const [tier, count] of Object.entries(tierCounts).sort((a, b) => b[1] - a[1])) {
    lines.push(`- **${tier}**: ${count}`);
  }
  lines.push('');
  lines.push('## Coordinate collisions (<30m) needing manual review');
  if (collisions.length === 0) {
    lines.push('None. 🎉');
  } else {
    for (const [nameA, nameB, dist] of collisions) {
      lines.push(`- "${nameA}" <-> "${nameB}" — ${dist}m apart`);
    }
  }
  lines.push('');
  lines.push('## Before → after (first 25 rows)');
  lines.push('| id | before lat,lng (precision) | after lat,lng (precision) | moved |');
  lines.push('|---|---|---|---|');
  for (let i = 0; i < Math.min(25, before.length); i++) {
    const b = before[i];
    const a = after[i];
    const moved = Math.round(haversineMeters({ lat: b.lat, lng: b.lng }, { lat: a.lat, lng: a.lng }));
    lines.push(
      `| ${a.id} | ${b.lat}, ${b.lng} (${b.precision}) | ${a.lat}, ${a.lng} (${a.precision}) | ${moved}m |`
    );
  }

  const totalMovedM = before.reduce((sum, b, i) => sum + haversineMeters({ lat: b.lat, lng: b.lng }, { lat: after[i].lat, lng: after[i].lng }), 0);
  const avgMovedM = Math.round(totalMovedM / before.length);
  lines.push('');
  lines.push(`**Average pin displacement: ${avgMovedM}m**`);

  const report = lines.join('\n') + '\n';

  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
  fs.writeFileSync(REPORT_PATH, report, 'utf-8');
  console.log(report);

  if (DRY_RUN) {
    console.log(`[geocode] --dry-run: not writing ${SEED_PATH}`);
    return;
  }

  fs.writeFileSync(BACKUP_PATH, originalRaw, 'utf-8');
  fs.writeFileSync(SEED_PATH, JSON.stringify(stations, null, 2), 'utf-8');
  console.log(`[geocode] Wrote enriched seed to ${SEED_PATH}`);
  console.log(`[geocode] Backup of prior seed at ${BACKUP_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
