-- Smoke test for supabase/station-car-counts-geofence-only.sql. It installs the new function INSIDE this
-- transaction, tests it, and rolls everything back, so nothing is changed or saved by running it.
-- The last SELECT lists one row per check; every row should be PASS.

begin;

-- ---- the migration (same text as supabase/station-car-counts-geofence-only.sql) ----
create or replace function station_car_counts()
returns table (station_id text, cars integer)
language sql
security definer
stable
set search_path = public
as $$
  select p.station_id, count(*)::integer as cars
  from station_presence p
  where p.expires_at > now()
    and p.expires_at - p.last_ping_at <= interval '10 minutes'
  group by p.station_id;
$$;

-- ---- the checks ----
create temp table verify_results (step text, ok boolean, detail text);

do $$
declare
  s1 text;
  s2 text;
  v_a0 integer;
  v_b0 integer;
  v_a1 integer;
  v_b1 integer;
begin
  select id into s1 from stations order by id limit 1;
  select id into s2 from stations order by id offset 1 limit 1;
  select coalesce(max(cars), 0) into v_a0 from station_car_counts() where station_id = s1;
  select coalesce(max(cars), 0) into v_b0 from station_car_counts() where station_id = s2;

  -- A trigger stamps user_key from the caller's login, so each row is inserted "as" a made-up user.
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid())::text, true);
  insert into station_presence (id, station_id, user_key, entered_at, last_ping_at, expires_at)
    values ('verify-geo', s1, 'x', now(), now(), now() + interval '6 minutes');              -- a real car: counts
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid())::text, true);
  insert into station_presence (id, station_id, user_key, entered_at, last_ping_at, expires_at)
    values ('verify-viewer', s1, 'x', now(), now(), now() + interval '20 minutes');          -- an old page view: ignored
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid())::text, true);
  insert into station_presence (id, station_id, user_key, entered_at, last_ping_at, expires_at)
    values ('verify-expired', s1, 'x', now() - interval '1 hour', now() - interval '1 hour', now() - interval '54 minutes'); -- expired: ignored
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid())::text, true);
  insert into station_presence (id, station_id, user_key, entered_at, last_ping_at, expires_at)
    values ('verify-geo2', s2, 'x', now(), now(), now() + interval '6 minutes');             -- a real car at the other station
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid())::text, true);
  insert into station_presence (id, station_id, user_key, entered_at, last_ping_at, expires_at)
    values ('verify-edge', s2, 'x', now(), now(), now() + interval '10 minutes');            -- exactly 10 minutes: counts
  perform set_config('request.jwt.claims', '', true);

  select coalesce(max(cars), 0) into v_a1 from station_car_counts() where station_id = s1;
  select coalesce(max(cars), 0) into v_b1 from station_car_counts() where station_id = s2;

  insert into verify_results values ('a: only the real car counts, not the 20-minute page view or the expired row', v_a1 - v_a0 = 1, v_a0 || ' -> ' || v_a1);
  insert into verify_results values ('b: a record living exactly 10 minutes still counts', v_b1 - v_b0 = 2, v_b0 || ' -> ' || v_b1);
end
$$;

insert into verify_results values (
  'c: still returns only station_id and cars',
  pg_get_function_result('station_car_counts()'::regprocedure) = 'TABLE(station_id text, cars integer)',
  pg_get_function_result('station_car_counts()'::regprocedure));

insert into verify_results values (
  'd: anon and authenticated can still execute it',
  has_function_privilege('anon', 'station_car_counts()', 'execute')
  and has_function_privilege('authenticated', 'station_car_counts()', 'execute'),
  '');

select step, case when ok then 'PASS' else 'FAIL' end as result, detail
from verify_results
order by step;

rollback;
