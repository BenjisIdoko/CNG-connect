/**
 * One-off seeding script: pushes the bundled INITIAL_STATIONS and
 * INITIAL_POSTS (src/data/mockData.ts) into a freshly-migrated Supabase
 * project so the app has something to read/write against instead of an
 * empty `stations` table (every station_reports/station_comments/
 * station_media row has a FOREIGN KEY to stations.id — nothing else can be
 * written until stations exist).
 *
 * Requires the SERVICE ROLE key (bypasses RLS; the anon key has no INSERT
 * grant on `stations` by design — see supabase/schema.sql). Never commit
 * that key; pass it as an env var for this one-time run:
 *
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=xxx \
 *   npx tsx scripts/seed-supabase-backend.ts
 *
 * Safe to re-run: every insert is an upsert keyed by the row's existing id.
 */
import { createClient } from '@supabase/supabase-js';
import { INITIAL_STATIONS, INITIAL_POSTS } from '../src/data/mockData';
import type { GasStation, CommunityPost, CommentItem } from '../src/types';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

function flattenComments(comments: CommentItem[] | undefined, idPrefix: string): CommentItem[] {
  const flat: CommentItem[] = [];
  for (const c of comments || []) {
    flat.push(c);
    for (const reply of c.replies || []) {
      flat.push({ ...reply, content: `@${c.author} ${reply.content}`, id: reply.id || `${idPrefix}-${Date.now()}-${Math.random()}` });
    }
  }
  return flat;
}

function stationRow(s: GasStation) {
  return {
    id: s.id,
    name: s.name,
    address: s.address,
    city: s.city,
    state: s.state,
    distance: s.distance,
    drive_time: s.driveTime,
    status: s.status || 'unknown',
    status_label: s.statusLabel || 'No recent reports',
    cng_price: s.cngPrice ?? null,
    price_trend: s.priceTrend ?? null,
    pump_pressure: s.pumpPressure ?? null,
    busy_estimate: s.busyEstimate ?? null,
    last_updated: s.lastUpdated || null,
    verified_by_community: s.verifiedByCommunity ?? false,
    is_picng_accredited: s.isPiCngAccredited ?? false,
    operator: s.operator,
    phone: s.phone,
    lat: s.lat,
    lng: s.lng,
    images: s.images || [],
    station_notice: s.stationNotice,
    location_precision: s.locationPrecision || 'city',
    area: s.area,
    accuracy_radius_m: s.accuracyRadiusM,
    needs_pin_review: s.needsPinReview ?? false,
    data_source: s.dataSource,
    data_source_date: s.dataSourceDate,
    created_by: s.createdBy ?? null,
    station_type: s.stationType || 'cng',
    connector_types: s.connectorTypes || [],
    charging_speed_kw: s.chargingSpeedKw,
    price_per_kwh: s.pricePerKwh,
    total_ports: s.totalPorts,
    network: s.network,
  };
}

async function main() {
  console.log(`Seeding ${INITIAL_STATIONS.length} stations...`);
  const stationRows = INITIAL_STATIONS.map(stationRow);
  // Supabase upsert caps batch size in practice; chunk to be safe.
  const CHUNK = 50;
  for (let i = 0; i < stationRows.length; i += CHUNK) {
    const chunk = stationRows.slice(i, i + CHUNK);
    const { error } = await supabase.from('stations').upsert(chunk, { onConflict: 'id' });
    if (error) {
      console.error(`Station chunk ${i}-${i + chunk.length} failed:`, error.message);
    } else {
      console.log(`  stations ${i + 1}-${i + chunk.length} OK`);
    }
  }

  let reportCount = 0;
  let stationCommentCount = 0;
  for (const s of INITIAL_STATIONS) {
    if (s.reports && s.reports.length > 0) {
      const rows = s.reports.map((r) => ({
        id: r.id,
        station_id: s.id,
        author: r.author,
        author_avatar: r.authorAvatar,
        verified: r.verified,
        is_photo_verified: r.isPhotoVerified ?? false,
        verification_level: r.verificationLevel || 'unverified_text',
        verification_weight: r.verificationWeight ?? 0.5,
        timestamp: r.timestamp,
        status: r.status,
        status_label: r.statusLabel,
        wait_minutes: r.waitMinutes || 0,
        comment: r.comment,
        likes: r.likes,
        dislikes: r.dislikes || 0,
        photo: r.photo,
      }));
      const { error } = await supabase.from('station_reports').upsert(rows, { onConflict: 'id' });
      if (error) console.error(`station_reports for ${s.id} failed:`, error.message);
      else reportCount += rows.length;
    }

    const flatComments = flattenComments(s.stationComments, `sc-${s.id}`);
    if (flatComments.length > 0) {
      const rows = flatComments.map((c) => ({
        id: c.id,
        station_id: s.id,
        author: c.author,
        author_avatar: c.authorAvatar,
        content: c.content,
      }));
      const { error } = await supabase.from('station_comments').upsert(rows, { onConflict: 'id' });
      if (error) console.error(`station_comments for ${s.id} failed:`, error.message);
      else stationCommentCount += rows.length;
    }
  }
  console.log(`Seeded ${reportCount} station_reports, ${stationCommentCount} station_comments.`);

  console.log(`Seeding ${INITIAL_POSTS.length} community posts...`);
  const postRows = INITIAL_POSTS.map((p: CommunityPost) => ({
    id: p.id,
    author: p.author,
    author_avatar: p.authorAvatar,
    verified: p.verified,
    time_ago: p.timeAgo,
    category: p.category,
    category_label: p.categoryLabel,
    title: p.title,
    content: p.content,
    image: p.image,
    likes: p.likes || 0,
    replies_count: p.repliesCount || 0,
    is_listing: p.isListing ?? false,
    price: p.price,
    car_details: p.carDetails,
  }));
  {
    const { error } = await supabase.from('community_posts').upsert(postRows, { onConflict: 'id' });
    if (error) console.error('community_posts upsert failed:', error.message);
  }

  let postCommentCount = 0;
  for (const p of INITIAL_POSTS) {
    const flatComments = flattenComments(p.comments, `pc-${p.id}`);
    if (flatComments.length > 0) {
      const rows = flatComments.map((c) => ({
        id: c.id,
        post_id: p.id,
        author: c.author,
        author_avatar: c.authorAvatar,
        content: c.content,
      }));
      const { error } = await supabase.from('post_comments').upsert(rows, { onConflict: 'id' });
      if (error) console.error(`post_comments for ${p.id} failed:`, error.message);
      else postCommentCount += rows.length;
    }
  }
  console.log(`Seeded ${postRows.length} community_posts, ${postCommentCount} post_comments.`);
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
