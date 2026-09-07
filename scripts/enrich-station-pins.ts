/**
 * Station pin enrichment via OpenStreetMap (Overpass) proximity matching.
 *
 * ~63% of the stations in Supabase sit at their city centroid (Nominatim could
 * not resolve Nigerian CNG addresses below city level, and Mapbox has no
 * filling-station POI coverage for Nigeria). OSM *does* have most fuel stations
 * mapped as `amenity=fuel` nodes — just generically named ("NIPCO", "NNPC",
 * "Total") and rarely CNG-tagged. So for each station this script pulls every
 * fuel node within a few km of the current (bad) pin and picks the best match
 * by brand-name + CNG tag + distance, then writes the improved pin back.
 *
 * Free, no API key.
 *
 * Usage:
 *   # dry run (default): match everything, write a report, touch nothing
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_ANON_KEY=xxx \
 *   npx tsx scripts/enrich-station-pins.ts
 *
 *   # apply the changes to Supabase (needs the service-role key)
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx tsx scripts/enrich-station-pins.ts --commit
 *
 *   # tune the search radius / cap the run
 *   ... --radius=8000 --limit=20
 *
 * Overpass responses are cached in scratch/overpass-cache.json so re-runs are
 * free. A before-snapshot of every row it would change is written to
 * scratch/pin-enrichment.before.json.
 */
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const COMMIT = process.argv.includes('--commit');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_KEY = COMMIT ? SERVICE_ROLE_KEY : SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    COMMIT
      ? 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (required for --commit).'
      : 'Set SUPABASE_URL and SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY).'
  );
  process.exit(1);
}

const radiusArg = process.argv.find((a) => a.startsWith('--radius='));
const RADIUS_M = radiusArg ? parseInt(radiusArg.split('=')[1], 10) : 6000;
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

const FUEL_CACHE_PATH = path.resolve(process.cwd(), 'scratch/overpass-fuel-ng.json');
const REPORT_PATH = path.resolve(process.cwd(), 'scratch/pin-enrichment-report.md');
const BEFORE_PATH = path.resolve(process.cwd(), 'scratch/pin-enrichment.before.json');
const PROPOSED_PATH = path.resolve(process.cwd(), 'scratch/pin-enrichment.proposed.json');

const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
// Nigeria bounding box — one bulk query for every fuel station, matched locally.
const NG_BBOX = '4.0,2.5,14.0,15.0';

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

interface OsmEl {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

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
  'autogas',
]);

function tokens(s: string | null | undefined): string[] {
  if (!s) return [];
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/** "NIPCO Gas Limited - Warri-Sapele Rd" -> ["warri", "sapele", "rd"-dropped] */
function landmarkTokens(name: string): string[] {
  const after = name.split(/[-–—]/).slice(1).join(' ');
  return tokens(after).filter((t) => !['road', 'rd', 'street', 'st', 'ave', 'way', 'expressway'].includes(t));
}

function osmCoords(el: OsmEl): { lat: number; lng: number } | null {
  if (typeof el.lat === 'number' && typeof el.lon === 'number') return { lat: el.lat, lng: el.lon };
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  return null;
}

/**
 * One bulk Overpass query for every fuel station in the Nigeria bbox, cached to
 * disk. Public Overpass instances rate-limit hard, so this makes exactly one
 * network request (per fresh cache) instead of 113 `around:` queries.
 */
async function fetchAllFuelNodes(): Promise<OsmEl[]> {
  const cached = loadJson<{ fetchedAt: string; elements: OsmEl[] } | null>(FUEL_CACHE_PATH, null);
  if (cached && cached.elements.length > 0) {
    console.log(`Using cached OSM fuel set (${cached.elements.length} nodes, fetched ${cached.fetchedAt}).`);
    return cached.elements;
  }

  // Named fuel stations only — the payload for *all* amenity=fuel in Nigeria is
  // too heavy for the loaded public instances, and unnamed nodes can't be
  // brand-matched anyway.
  const query = `[out:json][timeout:120];nwr["amenity"="fuel"]["name"](${NG_BBOX});out center tags;`;
  for (let m = 0; m < OVERPASS_MIRRORS.length; m++) {
    console.log(`[overpass] fetching all NG fuel nodes via mirror ${m} (${OVERPASS_MIRRORS[m]}) ...`);
    try {
      const res = await fetch(OVERPASS_MIRRORS[m], {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (res.ok) {
        const body = (await res.json()) as { elements?: OsmEl[] };
        const elements = (body.elements ?? []).filter((e) => e.tags?.amenity === 'fuel');
        fs.mkdirSync(path.dirname(FUEL_CACHE_PATH), { recursive: true });
        fs.writeFileSync(
          FUEL_CACHE_PATH,
          JSON.stringify({ fetchedAt: new Date().toISOString(), elements }, null, 2)
        );
        console.log(`[overpass] got ${elements.length} fuel nodes; cached to ${FUEL_CACHE_PATH}`);
        return elements;
      }
      console.warn(`[overpass] HTTP ${res.status} from mirror ${m}; trying next`);
    } catch (err) {
      console.warn(`[overpass] mirror ${m} failed:`, err instanceof Error ? err.message : err);
    }
    await sleep(4000);
  }
  console.error('[overpass] every mirror failed. Try again later, or fetch the query manually:');
  console.error(`  ${query}`);
  process.exit(1);
}

interface Scored {
  el: OsmEl;
  coords: { lat: number; lng: number };
  distM: number;
  score: number;
  brandHit: boolean;
  cngHit: boolean;
  osmName: string;
}

function scoreCandidate(st: StationRow, el: OsmEl, oldPin: { lat: number; lng: number }): Scored | null {
  const coords = osmCoords(el);
  if (!coords) return null;
  const t = el.tags ?? {};
  const distM = haversineMeters(oldPin, coords);

  const opTokens = tokens(st.operator);
  const nameTok = tokens(st.name).filter((x) => !opTokens.includes(x));
  const landTok = landmarkTokens(st.name);
  const osmBrandName = `${t.name ?? ''} ${t.brand ?? ''} ${t.operator ?? ''}`.toLowerCase();
  const osmAddr = `${t['addr:street'] ?? ''} ${t['addr:suburb'] ?? ''} ${t['addr:place'] ?? ''} ${
    t['addr:city'] ?? ''
  }`.toLowerCase();

  const brandHit = opTokens.length > 0 && opTokens.some((tok) => osmBrandName.includes(tok));
  const cngHit =
    t['fuel:cng'] === 'yes' ||
    t['fuel:CNG'] === 'yes' ||
    t['fuel:compressed_natural_gas'] === 'yes' ||
    /cng/i.test(t.name ?? '');

  let score = 0;
  if (brandHit) score += 100;
  if (cngHit) score += 70;
  // landmark / neighbourhood tokens matching the OSM address or name
  const landMatches = [...landTok, ...nameTok].filter(
    (tok) => osmAddr.includes(tok) || osmBrandName.includes(tok)
  ).length;
  score += Math.min(40, landMatches * 20);
  // distance: full 60 at 0m, 0 at the search radius
  score += Math.max(0, 60 * (1 - distM / RADIUS_M));

  return {
    el,
    coords,
    distM,
    score,
    brandHit,
    cngHit,
    osmName: t.name || t.brand || t.operator || '(unnamed fuel)',
  };
}

interface Proposal {
  id: string;
  name: string;
  before: { lat: number; lng: number; precision: string | null };
  after: { lat: number; lng: number; precision: PrecisionTier; accuracyRadiusM: number; area: string | null };
  movedM: number;
  candidates: number;
  bestScore: number;
  runnerUpScore: number;
  osmName: string;
  osmMatch: string;
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
  console.log(`Loaded ${stations.length} stations. Search radius: ${RADIUS_M}m.`);

  const allFuel = await fetchAllFuelNodes();

  const proposals: Proposal[] = [];
  const before: Record<string, unknown>[] = [];
  const tierCounts: Record<string, number> = {};
  let processed = 0;

  for (const st of stations) {
    if (st.location_precision === 'source_exact' || st.location_precision === 'gps_confirmed') {
      tierCounts[st.location_precision] = (tierCounts[st.location_precision] || 0) + 1;
      continue;
    }
    if (LIMIT !== undefined && processed >= LIMIT) break;
    processed++;

    const oldPin = { lat: Number(st.lat), lng: Number(st.lng) };
    const scored = allFuel
      .map((el) => scoreCandidate(st, el, oldPin))
      .filter((s): s is Scored => s !== null && s.distM <= RADIUS_M)
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    const runnerUp = scored[1];

    let tier: PrecisionTier = 'unlocated';
    let after = oldPin;
    let area: string | null = null;
    let needsReview = false;
    let note = '';
    let osmMatch = '';

    if (!best) {
      needsReview = true;
      note = `no fuel node within ${RADIUS_M}m — pin left as-is`;
    } else {
      osmMatch = `${best.osmName}${best.cngHit ? ' [CNG]' : ''}${best.brandHit ? ' [brand]' : ''}`;
      const strong = best.brandHit || best.cngHit;
      const nearTie =
        runnerUp &&
        best.score - runnerUp.score < 20 &&
        haversineMeters(best.coords, runnerUp.coords) > 200;

      if (best.score >= 120 && strong) {
        after = { lat: Number(best.coords.lat.toFixed(6)), lng: Number(best.coords.lng.toFixed(6)) };
        tier = best.distM < 80 ? 'rooftop' : 'street';
        area =
          best.el.tags?.['addr:street'] ||
          best.el.tags?.['addr:suburb'] ||
          best.el.tags?.['addr:place'] ||
          (landmarkTokens(st.name)[0] ?? null);
        if (nearTie) {
          needsReview = true;
          note = `close 2nd candidate ("${runnerUp!.osmName}", ${Math.round(
            haversineMeters(best.coords, runnerUp!.coords)
          )}m away) — verify`;
        }
      } else if (best.score >= 70) {
        after = { lat: Number(best.coords.lat.toFixed(6)), lng: Number(best.coords.lng.toFixed(6)) };
        tier = 'area';
        area = best.el.tags?.['addr:suburb'] || best.el.tags?.['addr:place'] || null;
        needsReview = true;
        note = `weak match (score ${Math.round(best.score)}${strong ? '' : ', no brand/CNG tag'}) — verify`;
      } else {
        needsReview = true;
        note = `best candidate too weak (score ${Math.round(best.score)}) — pin left as-is`;
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
      candidates: scored.length,
      bestScore: best ? Math.round(best.score) : 0,
      runnerUpScore: runnerUp ? Math.round(runnerUp.score) : 0,
      osmName: best?.osmName ?? '',
      osmMatch,
      needsPinReview: needsReview,
      note,
    });

    console.log(
      `[pin] ${st.id} "${st.name}" -> ${tier}${needsReview ? ' (review)' : ''}  ` +
        `${scored.length} cand, best ${best ? Math.round(best.score) : 0}  moved ${movedM}m  ${osmMatch}`
    );
  }

  fs.mkdirSync(path.dirname(BEFORE_PATH), { recursive: true });
  fs.writeFileSync(BEFORE_PATH, JSON.stringify(before, null, 2));
  fs.writeFileSync(PROPOSED_PATH, JSON.stringify(proposals, null, 2));

  // --- Report ---
  const reviewCount = proposals.filter((p) => p.needsPinReview).length;
  const improved = proposals.filter(
    (p) => p.after.precision === 'rooftop' || p.after.precision === 'street' || p.after.precision === 'area'
  ).length;
  const rooftopOrStreet = proposals.filter(
    (p) => p.after.precision === 'rooftop' || p.after.precision === 'street'
  ).length;
  const lines: string[] = [];
  lines.push('# Station pin enrichment report (OSM / Overpass proximity)');
  lines.push('');
  lines.push(`Generated ${new Date().toISOString()}`);
  lines.push(`Mode: ${COMMIT ? 'COMMIT (writes to Supabase)' : 'dry run'}`);
  lines.push(`Search radius: ${RADIUS_M}m`);
  lines.push(
    `Stations processed: ${proposals.length}  (skipped verified: ${
      (tierCounts.source_exact || 0) + (tierCounts.gps_confirmed || 0)
    })`
  );
  lines.push(`OSM fuel nodes considered: ${allFuel.length}`);
  lines.push(`Moved to a real OSM fuel node (street/rooftop): ${rooftopOrStreet} / ${proposals.length}`);
  lines.push(`Any improvement (area or better): ${improved} / ${proposals.length}`);
  lines.push(`Flagged for manual review: ${reviewCount}`);
  lines.push('');
  lines.push('## Precision tier breakdown (after)');
  for (const [t, n] of Object.entries(tierCounts).sort((a, b) => b[1] - a[1])) lines.push(`- **${t}**: ${n}`);
  lines.push('');
  lines.push('## Flagged for review');
  const flagged = proposals.filter((p) => p.needsPinReview);
  if (flagged.length === 0) lines.push('None.');
  for (const p of flagged)
    lines.push(`- \`${p.id}\` **${p.name}** — ${p.note}` + (p.osmMatch ? ` (best: ${p.osmMatch})` : ''));
  lines.push('');
  lines.push('## All moves (sorted by distance)');
  lines.push('| id | name | tier | moved | best score | OSM match |');
  lines.push('|---|---|---|---|---|---|');
  for (const p of [...proposals].sort((a, b) => b.movedM - a.movedM)) {
    lines.push(
      `| ${p.id} | ${p.name} | ${p.after.precision}${p.needsPinReview ? ' ⚠' : ''} | ${p.movedM}m | ${
        p.bestScore
      }${p.runnerUpScore ? ` (2nd ${p.runnerUpScore})` : ''} | ${p.osmMatch || '—'} |`
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
    const keepPin = p.movedM === 0 && p.note.includes('left as-is');
    const patch: Record<string, unknown> = {
      needs_pin_review: p.needsPinReview,
      data_source: 'OSM proximity match',
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
