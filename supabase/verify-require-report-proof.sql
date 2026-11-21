-- Smoke test for supabase/require-report-proof.sql. It installs the rule INSIDE this transaction, tests
-- it, and rolls everything back, so the rule is NOT enabled by running this and nothing is saved.
-- The last SELECT lists one row per check; every row should be PASS.

begin;

-- ---- the migration (same text as supabase/require-report-proof.sql) ----
create or replace function cng_require_report_proof()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lat double precision;
  v_lng double precision;
  v_away double precision;
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.photo is null or length(new.photo) < 100 or new.photo_lat is null or new.photo_lng is null then
    raise exception 'a photo taken at the station is required';
  end if;

  select s.lat, s.lng into v_lat, v_lng from stations s where s.id = new.station_id;
  if not found or v_lat is null or v_lng is null then
    raise exception 'a photo taken at the station is required';
  end if;

  v_away := 2 * 6371000 * asin(sqrt(
    power(sin(radians(new.photo_lat - v_lat) / 2), 2)
    + cos(radians(v_lat)) * cos(radians(new.photo_lat)) * power(sin(radians(new.photo_lng - v_lng) / 2), 2)
  ));
  if v_away > 800 then
    raise exception 'a photo taken at the station is required';
  end if;

  return new;
end;
$$;

drop trigger if exists require_report_proof on station_reports;
create trigger require_report_proof
  before insert on station_reports
  for each row execute function cng_require_report_proof();

-- ---- the checks ----
create temp table verify_results (step text, ok boolean, detail text);

-- Runs one INSERT and passes only if it raises an error containing p_fragment.
create function pg_temp.expect_error(p_step text, p_sql text, p_fragment text)
returns void
language plpgsql
as $f$
declare
  v_msg text;
begin
  begin
    execute p_sql;
    insert into verify_results values (p_step, false, 'expected an error, got none');
  exception when others then
    get stacked diagnostics v_msg = message_text;
    insert into verify_results values (p_step, position(p_fragment in v_msg) > 0, v_msg);
  end;
end
$f$;

-- Runs one INSERT and passes only if it succeeds.
create function pg_temp.expect_ok(p_step text, p_sql text)
returns void
language plpgsql
as $f$
declare
  v_msg text;
begin
  begin
    execute p_sql;
    insert into verify_results values (p_step, true, '');
  exception when others then
    get stacked diagnostics v_msg = message_text;
    insert into verify_results values (p_step, false, v_msg);
  end;
end
$f$;

do $$
declare
  v_user uuid;
  s1 text;
  s_lat double precision;
  s_lng double precision;
  v_photo text := 'data:image/jpeg;base64,' || repeat('A', 200);
  v_before integer;
  v_after integer;
  -- one degree of latitude is about 111,195 m
  lat_799 double precision;
  lat_801 double precision;
  base_cols text := 'id, station_id, author, author_avatar, verified, is_photo_verified, verification_level, verification_weight, timestamp, status, status_label';
begin
  select id into v_user from profiles limit 1;
  select id, lat, lng into s1, s_lat, s_lng from stations where lat is not null and lng is not null order by id limit 1;
  lat_799 := s_lat + 799.0 / 111195.0;
  lat_801 := s_lat + 801.0 / 111195.0;

  select count(*) into v_before from station_reports;

  -- act as a real signed-in user (the rule only applies to logged-in callers)
  perform set_config('request.jwt.claims', json_build_object('sub', v_user)::text, true);

  perform pg_temp.expect_error('a: no photo refused',
    format($q$insert into station_reports (%s, photo, photo_lat, photo_lng) values ('verify-a', %L, 'T', '', false, false, 'unverified_text', 0.5, 'now', 'full', 'x', null, %s, %s)$q$,
      base_cols, s1, s_lat, s_lng),
    'photo taken at the station');

  perform pg_temp.expect_error('b: empty photo refused',
    format($q$insert into station_reports (%s, photo, photo_lat, photo_lng) values ('verify-b', %L, 'T', '', false, false, 'unverified_text', 0.5, 'now', 'full', 'x', '', %s, %s)$q$,
      base_cols, s1, s_lat, s_lng),
    'photo taken at the station');

  perform pg_temp.expect_error('c: a too-short "photo" refused',
    format($q$insert into station_reports (%s, photo, photo_lat, photo_lng) values ('verify-c', %L, 'T', '', false, false, 'unverified_text', 0.5, 'now', 'full', 'x', 'x', %s, %s)$q$,
      base_cols, s1, s_lat, s_lng),
    'photo taken at the station');

  perform pg_temp.expect_error('d: photo with no position refused',
    format($q$insert into station_reports (%s, photo) values ('verify-d', %L, 'T', '', false, false, 'unverified_text', 0.5, 'now', 'full', 'x', %L)$q$,
      base_cols, s1, v_photo),
    'photo taken at the station');

  perform pg_temp.expect_error('e: only one coordinate refused',
    format($q$insert into station_reports (%s, photo, photo_lat) values ('verify-e', %L, 'T', '', false, false, 'unverified_text', 0.5, 'now', 'full', 'x', %L, %s)$q$,
      base_cols, s1, v_photo, s_lat),
    'photo taken at the station');

  perform pg_temp.expect_error('f: position 801 m away refused',
    format($q$insert into station_reports (%s, photo, photo_lat, photo_lng) values ('verify-f', %L, 'T', '', false, false, 'unverified_text', 0.5, 'now', 'full', 'x', %L, %s, %s)$q$,
      base_cols, s1, v_photo, lat_801, s_lng),
    'photo taken at the station');

  perform pg_temp.expect_ok('g: position 799 m away allowed',
    format($q$insert into station_reports (%s, photo, photo_lat, photo_lng) values ('verify-g', %L, 'T', '', false, false, 'unverified_text', 0.5, 'now', 'full', 'x', %L, %s, %s)$q$,
      base_cols, s1, v_photo, lat_799, s_lng));

  -- with no login at all (SQL editor, seed scripts) nothing is required
  perform set_config('request.jwt.claims', '', true);
  perform pg_temp.expect_ok('h: an insert with no login and no photo is not blocked',
    format($q$insert into station_reports (%s) values ('verify-h', %L, 'T', '', false, false, 'unverified_text', 0.5, 'now', 'full', 'x')$q$,
      base_cols, s1));

  -- only the two allowed rows were added; no existing report was touched
  select count(*) into v_after from station_reports;
  insert into verify_results values ('i: exactly the two allowed rows were added', v_after - v_before = 2, v_before || ' -> ' || v_after);
end
$$;

select step, case when ok then 'PASS' else 'FAIL' end as result, detail
from verify_results
order by step;

rollback;
