/**
 * Station pin enrichment via Mapbox Geocoding v6.
 *
 * ~63% of the stations in Supabase are pinned at their city centroid (the
 * Nominatim pass in scripts/geocode-stations.ts could not resolve Nigerian CNG
 * addresses below city level). This script re-geocodes each station with
 * Mapbox — which has real POI coverage for the named chains (NIPCO, Bovas,
 * NNPC, TotalEnergies, Qoray, SAGLEV) — records an honest precision tier, and
 * writes the improved pins back to the `stations` table.
 *
 * Mapbox free tier: 100k permanent geocodes/month, no billing card required.
 *
 * Usage:
 *   # dry run (default): geocode everything, write a report, touch nothing
 *   MAPBOX_TOKEN=pk.xxx \
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=xxx \
 *   npx tsx scripts/enrich-station-pins.ts
 *
 *   # apply the changes to Supabase
 *   ... same env ... npx tsx scripts/enrich-station-pins.ts --commit
 *
 *   # only process N stations (useful while iterating)
 *   ... --limit=10
 *
 * Responses are cached in scratch/mapbox-cache.json so re-runs cost nothing and
 * only hit Mapbox for queries it has not seen. A full before-snapshot of every
 * row it would change is written to scratch/pin-enrichment.before.json.
 */
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!MAPBOX_TOKEN || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Set MAPBOX_TOKEN, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const COMMIT = process.argv.includes('--commit');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

const CACHE_PATH = path.resolve(process.cwd(), 'scratch/mapbox-cache.json');
const REPORT_PATH = path.resolve(process.cwd(), 'scratch/pin-enrichment-report.md');
const BEFORE_PATH = path.resolve(process.cwd(), 'scratch/pin-enrichment.before.json');
const PROPOSED_PATH = path.resolve(process.cwd(), 'scratch/pin-enrichment.proposed.json');

const MAPBOX_ENDPOINT = 'https://api.mapbox.com/search/geocode/v6/forward';
const REQUEST_DELAY_MS = 150; // Mapbox allows 600 req/min; stay well under.

// Rough Nigeria bounding box — a result outside this is a bad match.
const NG_BBOX = { minLat: 4.0, maxLat: 14.0, minLng: 2.5, maxLng: 15.0 };

type PrecisionTier = 'source_exact' | 'rooftop' | 'street' | 'area' | 'city' | 'unlocated';

const ACCURACY_RADIUS_M: Record<PrecisionTier, number> = {
  source_exact: 15,
  rooftop: 30,
  street: 150,
  area: 700,
  city: 4000,
  unlocated: 15000,
};

// Mapbox v6 feature_type -> our precision tier.
const FEATURE_TIER: Record<string, PrecisionTier> = {
  poi: 'rooftop',
  address: 'rooftop',
  street: 'street',
  block: 'street',
  neighborhood: 'area',
  locality: 'area',
  place: 'city',
  district: 'city',
  postcode: 'city',
  region: 'city',
  country: 'unlocated',
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

interface MapboxFeature {
  properties: {
    feature_type: string;
    name?: string;
    full_address?: string;
    coordinates?: { longitude: number; latitude: number };
    match_code?: { confidence?: string };
  };
  geometry?: { coordinates: [number, number] };
}

interface CacheEntry {
  query: string;
  feature: MapboxFeature | null;
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

function normStateForQuery(state: string | null): string {
  if (!state) return '';
  if (/fct|abuja/i.test(state)) return 'Federal Capital Territory';
  return state;
}

/** "NIPCO Gas Limited - Warri-Sapele Rd" -> landmark "Warri-Sapele Rd" */
function landmarkFromName(name: string): string {
  const dash = name.split(/[-–—]/).slice(1).join('-').trim();
  return dash || '';
}

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !['cng', 'gas', 'ltd', 'limited', 'station', 'the', 'and'].includes(t))
  );
}

function nameOverlap(ours: string, theirs: string): number {
  const a = tokenize(ours);
  const b = tokenize(theirs);
  if (a.size === 0 || b.size === 0) return 0;
  let hits = 0;
  for (const t of a) if (b.has(t)) hits++;
  return hits / a.size;
}

/** Most- to least-specific Mapbox queries for a station. */
function buildQueries(st: StationRow): { q: string; lastResort: boolean }[] {
  const stateQ = normStateForQuery(st.state);
  const city = st.city || '';
  const fuelWord = st.station_type === 'ev_charging' ? 'EV charging station' : 'CNG station';
  const landmark = landmarkFromName(st.name);
  const parts = (arr: (string | null | undefined)[]) => arr.filter(Boolean).join(', ');

  const list: { q: string; lastResort: boolean }[] = [];
  list.push({ q: parts([st.name, city, stateQ, 'Nigeria']), lastResort: false });
  if (st.operator) {
    list.push({ q: parts([st.operator, fuelWord, landmark || city, stateQ, 'Nigeria']), lastResort: false });
  }
  if (st.address) list.push({ q: parts([st.address, 'Nigeria']), lastResort: false });
  if (landmark && city) list.push({ q: parts([landmark, city, stateQ, 'Nigeria']), lastResort: false });
  list.push({ q: parts([city || stateQ, stateQ, 'Nigeria']), lastResort: true });

  const seen = new Set<string>();
  return list.filter((c) => c.q && !seen.has(c.q) && seen.add(c.q));
}

async function geocode(query: string, cache: Cache): Promise<MapboxFeature | null> {
  const key = query.toLowerCase().trim();
  if (cache[key]) return cache[key].feature;

  const url =
    `${MAPBOX_ENDPOINT}?q=${encodeURIComponent(query)}` +
    `&country=ng&limit=1&types=poi,address,street,neighborhood,locality,place` +
    `&access_token=${MAPBOX_TOKEN}`;

  let feature: MapboxFeature | null = null;
  try {
    const res = await fetch(url);
    if (res.ok) {
      const body = (await res.json()) as { features?: MapboxFeature[] };
      feature = body.features?.[0] ?? null;
    } else {
      console.warn(`[mapbox] HTTP ${res.status} for "${query}"`);
    }
  } catch (err) {
    console.warn(`[mapbox] request failed for "${query}":`, err instanceof Error ? err.message : err);
  }

  cache[key] = { query, feature, fetchedAt: new Date().toISOString() };
  await sleep(REQUEST_DELAY_MS);
  return feature;
}

function coordsOf(f: MapboxFeature): { lat: number; lng: number } | null {
  const c = f.properties.coordinates;
  if (c && typeof c.latitude === 'number') return { lat: c.latitude, lng: c.longitude };
  const g = f.geometry?.coordinates;
  if (g && g.length === 2) return { lat: g[1], lng: g[0] };
  return null;
}

function inNigeria(p: { lat: number; lng: number }): boolean {
  return (
    p.lat >= NG_BBOX.minLat && p.lat <= NG_BBOX.maxLat && p.lng >= NG_BBOX.minLng && p.lng <= NG_BBOX.maxLng
  );
}

interface Proposal {
  id: string;
  name: string;
  before: { lat: number; lng: number; precision: string | null };
  after: { lat: number; lng: number; precision: PrecisionTier; accuracyRadiusM: number; area: string | null };
  movedM: number;
  matchedOn: string;
  mapboxName: string;
  needsPinReview: boolean;
  note: string;
}

async function main() {
  const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);
  const { data, error } = await supabase
    .from('stations')
    .select('id,name,address,city,state,lat,lng,operator,station_type,location_precision')
    .order('name');
  if (error || !data) {
    console.error('Failed to read stations:', error?.message);
    process.exit(1);
  }
  const stations = data as StationRow[];
  console.log(`Loaded ${stations.length} stations from Supabase.`);

  const cache = loadJson<Cache>(CACHE_PATH, {});
  const proposals: Proposal[] = [];
  const before: Record<string, unknown>[] = [];
  const tierCounts: Record<string, number> = {};
  let processed = 0;
  let netCalls = 0;
  let cacheHits = 0;

  for (const st of stations) {
    // Never overwrite a hand-verified or GPS-confirmed pin.
    if (st.location_precision === 'source_exact' || st.location_precision === 'gps_confirmed') {
      tierCounts[st.location_precision] = (tierCounts[st.location_precision] || 0) + 1;
      continue;
    }
    if (LIMIT !== undefined && processed >= LIMIT) break;
    processed++;

    const oldPin = { lat: Number(st.lat), lng: Number(st.lng) };
    const queries = buildQueries(st);

    let feature: MapboxFeature | null = null;
    let matchedOn = '';
    let lastResort = false;
    for (const cand of queries) {
      const wasCached = Boolean(cache[cand.q.toLowerCase().trim()]);
      const f = await geocode(cand.q, cache);
      if (wasCached) cacheHits++;
      else netCalls++;
      if (f) {
        feature = f;
        matchedOn = cand.q;
        lastResort = cand.lastResort;
        break;
      }
    }

    let tier: PrecisionTier = 'unlocated';
    let after = oldPin;
    let area: string | null = null;
    let needsReview = false;
    let note = '';
    const mapboxName = feature?.properties.name ?? '';

    if (!feature) {
      needsReview = true;
      note = 'no Mapbox match — pin left as-is';
    } else {
      const c = coordsOf(feature);
      const ftype = feature.properties.feature_type;
      const baseTier = lastResort ? 'city' : FEATURE_TIER[ftype] ?? 'city';

      if (!c || !inNigeria(c)) {
        needsReview = true;
        note = `result outside Nigeria bbox — pin left as-is`;
      } else {
        after = { lat: Number(c.lat.toFixed(6)), lng: Number(c.lng.toFixed(6)) };
        tier = baseTier;
        area = feature.properties.name || landmarkFromName(st.name) || null;

        // Guard against pinning to the wrong business: a POI hit whose name
        // shares nothing with our operator/name is demoted and flagged.
        if ((ftype === 'poi' || ftype === 'address') && !lastResort) {
          const overlap = nameOverlap(`${st.operator ?? ''} ${st.name}`, mapboxName);
          if (overlap < 0.15) {
            tier = 'street';
            needsReview = true;
            note = `weak name match ("${mapboxName}") — demoted to street, review`;
          }
        }

        const conf = feature.properties.match_code?.confidence;
        if (conf === 'low' && tier === 'rooftop') tier = 'street';

        const moved = haversineMeters(oldPin, after);
        if (moved > 200_000) {
          needsReview = true;
          note = note || `moved ${Math.round(moved / 1000)}km from prior pin — review`;
        }
        if (tier === 'city') {
          needsReview = true;
          note = note || 'city-level only — no better match found';
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
      mapboxName,
      needsPinReview: needsReview,
      note,
    });

    console.log(
      `[pin] ${st.id} "${st.name}" -> ${tier}${needsReview ? ' (review)' : ''}  moved ${movedM}m  via "${matchedOn}"`
    );
  }

  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  fs.writeFileSync(BEFORE_PATH, JSON.stringify(before, null, 2));
  fs.writeFileSync(PROPOSED_PATH, JSON.stringify(proposals, null, 2));

  // --- Report ---
  const reviewCount = proposals.filter((p) => p.needsPinReview).length;
  const improved = proposals.filter(
    (p) => p.after.precision !== 'city' && p.after.precision !== 'unlocated'
  ).length;
  const lines: string[] = [];
  lines.push('# Station pin enrichment report (Mapbox v6)');
  lines.push('');
  lines.push(`Generated ${new Date().toISOString()}`);
  lines.push(`Mode: ${COMMIT ? 'COMMIT (writes to Supabase)' : 'dry run'}`);
  lines.push(`Stations processed: ${proposals.length}  (skipped verified: ${(tierCounts.source_exact || 0) + (tierCounts.gps_confirmed || 0)})`);
  lines.push(`Mapbox requests: ${netCalls}  (cache hits: ${cacheHits})`);
  lines.push(`Now street-level or better: ${improved} / ${proposals.length}`);
  lines.push(`Flagged for manual review: ${reviewCount}`);
  lines.push('');
  lines.push('## Precision tier breakdown (after)');
  for (const [t, n] of Object.entries(tierCounts).sort((a, b) => b[1] - a[1])) lines.push(`- **${t}**: ${n}`);
  lines.push('');
  lines.push('## Flagged for review');
  const flagged = proposals.filter((p) => p.needsPinReview);
  if (flagged.length === 0) lines.push('None.');
  for (const p of flagged) lines.push(`- \`${p.id}\` **${p.name}** — ${p.note} (matched "${p.mapboxName || '—'}")`);
  lines.push('');
  lines.push('## All moves (sorted by distance)');
  lines.push('| id | name | tier | moved | matched Mapbox name |');
  lines.push('|---|---|---|---|---|');
  for (const p of [...proposals].sort((a, b) => b.movedM - a.movedM)) {
    lines.push(
      `| ${p.id} | ${p.name} | ${p.after.precision}${p.needsPinReview ? ' ⚠' : ''} | ${p.movedM}m | ${p.mapboxName || '—'} |`
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

  // --- Write back ---
  let ok = 0;
  let fail = 0;
  for (const p of proposals) {
    // Leave the pin untouched when we had nothing better; only update metadata.
    const noBetterPin = p.movedM === 0 && (p.after.precision === 'unlocated' || p.note.includes('left as-is'));
    const patch: Record<string, unknown> = {
      location_precision: p.after.precision,
      accuracy_radius_m: p.after.accuracyRadiusM,
      needs_pin_review: p.needsPinReview,
      data_source: 'Mapbox Geocoding v6',
      data_source_date: new Date().toISOString().split('T')[0],
    };
    if (!noBetterPin) {
      patch.lat = p.after.lat;
      patch.lng = p.after.lng;
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
