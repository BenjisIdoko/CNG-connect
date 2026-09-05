-- Reset CNG-Connect to a clean, real-testing baseline.
-- Safe to run: it only removes SEED/DUMMY activity (no real driver has used
-- the app yet) and resets station live-status columns. Station rows, the
-- schema, and real user profiles are left intact.
--
-- Run in the Supabase dashboard: SQL Editor -> paste -> Run.

begin;

-- 1. Remove all seeded community + station activity.
delete from post_likes;
delete from post_comments;
delete from community_posts;
delete from station_comments;
delete from station_media;
delete from station_reports;
delete from station_presence;
delete from station_nudges;

-- 2. Allow status = 'unknown' (older schemas only permitted full/low/queue/out,
--    which is why "no report yet" stations were seeded as 'full').
alter table stations drop constraint if exists stations_status_check;
alter table stations add constraint stations_status_check
  check (status in ('full', 'low', 'queue', 'out', 'unknown'));

-- 3. Clear every station's live status back to "no recent reports".
--    A real driver report (report_station_status RPC) will set these again.
update stations set
  status                = 'unknown',
  status_label          = 'No recent reports',
  last_updated          = null,
  pump_pressure         = null,
  cng_price             = null,
  busy_estimate         = null,
  price_trend           = null,
  distance              = null,   -- recomputed client-side from GPS
  drive_time            = null,   -- recomputed client-side from GPS
  verified_by_community = false;

commit;

-- Sanity check (optional): every row should now read 'unknown'.
-- select status, status_label, count(*) from stations group by 1, 2;
