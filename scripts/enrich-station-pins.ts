/**
 * Station pin enrichment via the Google Places API (New) Text Search.
 *
 * ~63% of the stations in Supabase sit at their city centroid. Neither
 * Nominatim nor Mapbox nor OSM has branch-level coverage of Nigerian CNG
 * stations, but Google Maps does — the named chains (NIPCO, NNPC, Bovas,
 * TotalEnergies) and most of the independents are real Places with precise
 * coordinates. This script re-resolves each station against Places (biased to
 * the current city so it lands the right branch), records an honest precision
 * tier, and writes the improved pin back.
 *
 * Requires a Google Maps API key with the "Places API (New)" enabled. A
 * one-time run over ~110 stations is a few hundred requests — well inside the
 * monthly free allotment, but a billing account (card) must be attached to the
 * Google Cloud project. Restrict the key to Places API and set a budget alert.
 *
 * Usage:
 *   # dry run (default): resolve everything, write a report, touch nothing
 *   GOOGLE_MAPS_API_KEY=AIza... \
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_ANON_KEY=xxx \
 *   npx tsx scripts/enrich-station-pins.ts
 *
 *   # apply the changes (needs the service-role key)
 *   GOOGLE_MAPS_API_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx tsx scripts/enrich-station-pins.ts --commit
 *
 *   # cap the run while iterating
 *   ... --limit=10
 *
 * Responses are cached in scratch/places-cache.json so re-runs are free. A
 * before-snapshot of every row it would change is written to
 * scratch/pin-enrichment.before.json.
 */
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const COMMIT = process.argv.includes('--commit');

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_KEY = COMMIT ? SERVICE_ROLE_KEY : SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!GOOGLE_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    COMMIT
      ? 'Set GOOGLE_MAPS_API_KEY, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (required for --commit).'
      : 'Set GOOGLE_MAPS_API_KEY, SUPABASE_URL and SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY).'
  );
  process.exit(1);
}

const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

const CACHE_PATH = path.resolve(process.cwd(), 'scratch/places-cache.json');
const REPORT_PATH = path.resolve(process.cwd(), 'scratch/pin-enrichment-report.md');
const BEFORE_PATH = path.resolve(process.cwd(), 'scratch/pin-enrichment.before.json');
const PROPOSED_PATH = path.resolve(process.cwd(), 'scratch/pin-enrichment.proposed.json');

const PLACES_ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';
const FIELD_MASK =
  'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.primaryType';
const REQUEST_DELAY_MS = 120;

// Rough Nigeria bounding box — a result outside this is a bad match.
const NG_BBOX = { minLat: 4.0, maxLat: 14.0, minLng: 2.5, maxLng: 15.0 };
const BIAS_RADIUS_M = 40000; // bias to ~40km of the current (city) pin
const MAX_ACCEPT_MOVE_M = 60000; // a match further than this from the old pin is suspect

type PrecisionTier = 'source_exact' | 'rooftop' | 'street' | 'area' | 'city' | 'unlocated';

const ACCURACY_RADIUS_M: Record<PrecisionTier, number> = {
  source_exact: 15,
  rooftop: 30,
  street: 150,
  area: 700,
  city: 4000,
  unlocated: 15000,
};

interface StationRow {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  lat: number;
  lng: number;
  operator: string | null;
  station_type: string | null;
  location_precision: string | null;
}

interface Place {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  types?: string[];
  primaryType?: string;
}

interface CacheEntry {
  query: string;
  places: Place[];
  fetchedAt: string;
}
type Cache = Record<string, CacheEntry>;

function loadJson<T>(p: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const STOPWORDS = new Set([
  'cng',
  'gas',
  'ltd',
  'limited',
  'plc',
  'nig',
  'nigeria',
  'station',
  'filling',
  'fuel',
  'energy',
  'oil',
  'retail',
  'group',
  'mega',
  'the',
  'and',
  'company',
  'autogas',
  'hub',
]);

function tokens(s: string | null | undefined): string[] {
  if (!s) return [];
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/** "NIPCO Gas Limited - Warri-Sapele Rd" -> "Warri-Sapele Rd" */
function landmark(name: string): string {
  return name.split(/[-–—]/).slice(1).join('-').trim();
}

function inNigeria(p: { lat: number; lng: number }): boolean {
  return (
    p.lat >= NG_BBOX.minLat && p.lat <= NG_BBOX.maxLat && p.lng >= NG_BBOX.minLng && p.lng <= NG_BBOX.maxLng
  );
}

function nameOverlap(ours: string, theirs: string): number {
  const a = tokens(ours);
  const b = new Set(tokens(theirs));
  if (a.length === 0 || b.size === 0) return 0;
  return a.filter((t) => b.has(t)).length / a.length;
}

interface Query {
  q: string;
  includedType?: string;
  lastResort: boolean;
}

function buildQueries(st: StationRow): Query[] {
  const isEv = st.station_type === 'ev_charging';
  const gType = isEv ? 'electric_vehicle_charging_station' : 'gas_station';
  const fuelWord = isEv ? 'EV charging station' : 'CNG station';
  const lm = landmark(st.name);
  const city = st.city || '';
  const state = st.state || '';
  const parts = (arr: (string | null | undefined)[]) => arr.filter(Boolean).join(', ');

  const out: Query[] = [];
  out.push({ q: parts([st.name, city, state, 'Nigeria']), includedType: gType, lastResort: false });
  if (st.operator) {
    out.push({
      q: parts([st.operator, fuelWord, lm || city, state, 'Nigeria']),
      includedType: gType,
      lastResort: false,
    });
  }
  if (st.address) out.push({ q: parts([st.address, 'Nigeria']), includedType: gType, lastResort: false });
  out.push({ q: parts([st.name, city, state, 'Nigeria']), lastResort: false }); // no type filter
  if (lm && city) out.push({ q: parts([lm, city, state, 'Nigeria']), lastResort: true });

  const seen = new Set<string>();
  return out.filter((c) => c.q && !seen.has(c.q + (c.includedType ?? '')) && seen.add(c.q + (c.includedType ?? '')));
}

async function placesSearch(
  query: string,
  includedType: string | undefined,
  bias: { lat: number; lng: number },
  cache: Cache
): Promise<Place[]> {
  const key = `${query}::${includedType ?? 'any'}`.toLowerCase().trim();
  if (cache[key]) return cache[key].places;

  const body: Record<string, unknown> = {
    textQuery: query,
    regionCode: 'NG',
    languageCode: 'en',
    maxResultCount: 5,
    locationBias: {
      circle: { center: { latitude: bias.lat, longitude: bias.lng }, radius: BIAS_RADIUS_M },
    },
  };
  if (includedType) body.includedType = includedType;

  let places: Place[] = [];
  try {
    const res = await fetch(PLACES_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_KEY!,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const json = (await res.json()) as { places?: Place[] };
      places = json.places ?? [];
    } else {
      const txt = await res.text();
      console.warn(`[places] HTTP ${res.status} for "${query}": ${txt.slice(0, 160)}`);
    }
  } catch (err) {
    console.warn(`[places] request failed for "${query}":`, err instanceof Error ? err.message : err);
  }

  cache[key] = { query, places, fetchedAt: new Date().toISOString() };
  await sleep(REQUEST_DELAY_MS);
  return places;
}

interface Proposal {
  id: string;
  name: string;
  before: { lat: number; lng: number; precision: string | null };
  after: { lat: number; lng: number; precision: PrecisionTier; accuracyRadiusM: number; area: string | null };
  movedM: number;
  matchedOn: string;
  placeName: string;
  placeTypes: string;
  needsPinReview: boolean;
  note: string;
}

async function main() {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);
  const { data, error } = await supabase
    .from('stations')
    .select('id,name,address,city,state,lat,lng,operator,station_type,location_precision')
    .order('name');
  if (error || !data) {
    console.error('Failed to read stations:', error?.message);
    process.exit(1);
  }
  const stations = data as StationRow[];
  console.log(`Loaded ${stations.length} stations.`);

  const cache = loadJson<Cache>(CACHE_PATH, {});
  const proposals: Proposal[] = [];
  const before: Record<string, unknown>[] = [];
  const tierCounts: Record<string, number> = {};
  let processed = 0;
  let netCalls = 0;
  let cacheHits = 0;

  for (const st of stations) {
    if (st.location_precision === 'source_exact' || st.location_precision === 'gps_confirmed') {
      tierCounts[st.location_precision] = (tierCounts[st.location_precision] || 0) + 1;
      continue;
    }
    if (LIMIT !== undefined && processed >= LIMIT) break;
    processed++;

    const oldPin = { lat: Number(st.lat), lng: Number(st.lng) };
    const isEv = st.station_type === 'ev_charging';
    const gType = isEv ? 'electric_vehicle_charging_station' : 'gas_station';
    const opName = `${st.operator ?? ''} ${st.name}`;
    const lmTokens = tokens(landmark(st.name));

    let chosen: Place | null = null;
    let matchedOn = '';
    let lastResort = false;

    for (const cand of buildQueries(st)) {
      const wasCached = Boolean(cache[`${cand.q}::${cand.includedType ?? 'any'}`.toLowerCase().trim()]);
      const places = await placesSearch(cand.q, cand.includedType, oldPin, cache);
      if (wasCached) cacheHits++;
      else netCalls++;
      if (places.length === 0) continue;

      // Rank the returned places: prefer a gas/EV type, a name that overlaps our
      // operator, a landmark-token hit in the address, and proximity to oldPin.
      const ranked = places
        .map((p) => {
          const loc = p.location ? { lat: p.location.latitude, lng: p.location.longitude } : null;
          if (!loc) return null;
          const dist = haversineMeters(oldPin, loc);
          const typeHit = (p.types ?? []).includes(gType) || p.primaryType === gType;
          const nOver = nameOverlap(opName, p.displayName?.text ?? '');
          const addrText = (p.formattedAddress ?? '').toLowerCase();
          const lmHit = lmTokens.some((t) => addrText.includes(t));
          let score = 0;
          if (typeHit) score += 60;
          score += nOver * 60;
          if (lmHit) score += 25;
          score += Math.max(0, 40 * (1 - dist / BIAS_RADIUS_M));
          return { p, loc, dist, typeHit, nOver, lmHit, score };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
        .sort((a, b) => b.score - a.score);

      if (ranked.length > 0 && ranked[0].score >= 40) {
        chosen = ranked[0].p;
        matchedOn = cand.q + (cand.includedType ? ` [${cand.includedType}]` : '');
        lastResort = cand.lastResort;
        break;
      }
    }

    let tier: PrecisionTier = 'unlocated';
    let after = oldPin;
    let area: string | null = null;
    let needsReview = false;
    let note = '';
    const placeName = chosen?.displayName?.text ?? '';
    const placeTypes = (chosen?.types ?? []).join(',');

    if (!chosen || !chosen.location) {
      needsReview = true;
      note = 'no Places match — pin left as-is';
    } else {
      const loc = { lat: chosen.location.latitude, lng: chosen.location.longitude };
      const moved = haversineMeters(oldPin, loc);
      const typeHit = (chosen.types ?? []).includes(gType) || chosen.primaryType === gType;
      const nOver = nameOverlap(opName, placeName);

      if (!inNigeria(loc) || moved > MAX_ACCEPT_MOVE_M) {
        needsReview = true;
        note = `match ${Math.round(moved / 1000)}km away / outside NG — pin left as-is`;
      } else {
        after = { lat: Number(loc.lat.toFixed(6)), lng: Number(loc.lng.toFixed(6)) };
        area = landmark(st.name) || st.city || null;
        // A typed gas/EV Place is a real forecourt: rooftop. Otherwise treat as
        // street-level and flag unless the name clearly matches.
        if (typeHit && !lastResort) {
          tier = 'rooftop';
          if (nOver < 0.2) {
            needsReview = true;
            note = `Places name "${placeName}" doesn't match operator — verify`;
          }
        } else if (lastResort) {
          tier = 'area';
          needsReview = true;
          note = 'resolved via landmark-only query — verify';
        } else {
          tier = 'street';
          needsReview = true;
          note = `non-typed Places result ("${placeName}") — verify`;
        }
      }
    }

    const movedM = Math.round(haversineMeters(oldPin, after));
    tierCounts[tier] = (tierCounts[tier] || 0) + 1;

    before.push({ id: st.id, name: st.name, lat: st.lat, lng: st.lng, location_precision: st.location_precision });
    proposals.push({
      id: st.id,
      name: st.name,
      before: { lat: oldPin.lat, lng: oldPin.lng, precision: st.location_precision },
      after: { ...after, precision: tier, accuracyRadiusM: ACCURACY_RADIUS_M[tier], area },
      movedM,
      matchedOn,
      placeName,
      placeTypes,
      needsPinReview: needsReview,
      note,
    });

    console.log(
      `[pin] ${st.id} "${st.name}" -> ${tier}${needsReview ? ' (review)' : ''}  moved ${movedM}m  ` +
        `"${placeName || '—'}"  via ${matchedOn || '(no match)'}`
    );
  }

  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  fs.writeFileSync(BEFORE_PATH, JSON.stringify(before, null, 2));
  fs.writeFileSync(PROPOSED_PATH, JSON.stringify(proposals, null, 2));

  // --- Report ---
  const reviewCount = proposals.filter((p) => p.needsPinReview).length;
  const rooftop = proposals.filter((p) => p.after.precision === 'rooftop').length;
  const improved = proposals.filter(
    (p) => p.after.precision !== 'unlocated' && p.after.precision !== 'city'
  ).length;
  const lines: string[] = [];
  lines.push('# Station pin enrichment report (Google Places)');
  lines.push('');
  lines.push(`Generated ${new Date().toISOString()}`);
  lines.push(`Mode: ${COMMIT ? 'COMMIT (writes to Supabase)' : 'dry run'}`);
  lines.push(
    `Stations processed: ${proposals.length}  (skipped verified: ${
      (tierCounts.source_exact || 0) + (tierCounts.gps_confirmed || 0)
    })`
  );
  lines.push(`Places requests: ${netCalls}  (cache hits: ${cacheHits})`);
  lines.push(`Resolved to a typed forecourt (rooftop): ${rooftop} / ${proposals.length}`);
  lines.push(`Any improvement (street or better): ${improved} / ${proposals.length}`);
  lines.push(`Flagged for manual review: ${reviewCount}`);
  lines.push('');
  lines.push('## Precision tier breakdown (after)');
  for (const [t, n] of Object.entries(tierCounts).sort((a, b) => b[1] - a[1])) lines.push(`- **${t}**: ${n}`);
  lines.push('');
  lines.push('## Flagged for review');
  const flagged = proposals.filter((p) => p.needsPinReview);
  if (flagged.length === 0) lines.push('None.');
  for (const p of flagged) lines.push(`- \`${p.id}\` **${p.name}** — ${p.note}`);
  lines.push('');
  lines.push('## All moves (sorted by distance)');
  lines.push('| id | name | tier | moved | Places match | types |');
  lines.push('|---|---|---|---|---|---|');
  for (const p of [...proposals].sort((a, b) => b.movedM - a.movedM)) {
    lines.push(
      `| ${p.id} | ${p.name} | ${p.after.precision}${p.needsPinReview ? ' ⚠' : ''} | ${p.movedM}m | ${
        p.placeName || '—'
      } | ${p.placeTypes || '—'} |`
    );
  }
  const report = lines.join('\n') + '\n';
  fs.writeFileSync(REPORT_PATH, report);
  console.log('\n' + report);
  console.log(`Report: ${REPORT_PATH}`);
  console.log(`Before-snapshot: ${BEFORE_PATH}`);
  console.log(`Proposed changes: ${PROPOSED_PATH}`);

  if (!COMMIT) {
    console.log('\nDry run — nothing written to Supabase. Re-run with --commit to apply.');
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const p of proposals) {
    const keepPin = p.movedM === 0 && p.note.includes('left as-is');
    const patch: Record<string, unknown> = {
      needs_pin_review: p.needsPinReview,
      data_source: 'Google Places',
      data_source_date: new Date().toISOString().split('T')[0],
    };
    if (!keepPin) {
      patch.lat = p.after.lat;
      patch.lng = p.after.lng;
      patch.location_precision = p.after.precision;
      patch.accuracy_radius_m = p.after.accuracyRadiusM;
      if (p.after.area) patch.area = p.after.area;
    }
    const { error: upErr } = await supabase.from('stations').update(patch).eq('id', p.id);
    if (upErr) {
      fail++;
      console.error(`  update failed for ${p.id}: ${upErr.message}`);
    } else {
      ok++;
    }
  }
  console.log(`\nSupabase updates: ${ok} ok, ${fail} failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
