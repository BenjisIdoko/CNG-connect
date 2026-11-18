-- Smoke test for supabase/station-manager-signals.sql. It installs the migration INSIDE this transaction,
-- tests it, and rolls everything back, so nothing is changed or saved by running it.
-- The last SELECT lists one row per check; every row should be PASS.

begin;

-- ---- the migration (same text as supabase/station-manager-signals.sql) ----
-- Station manager signals. Safe to re-run.
--
-- A station's own staff (an admin assigns them in station_managers) can tell drivers two things:
--   * "Selling now" / "Not selling"   -> stations.manager_selling + manager_selling_at
--   * the pump pressure in bar        -> stations.live_pressure_bar + live_pressure_at
-- These are NOT driver reports: nothing here touches stations.status, station_reports, points or flags.
-- Only the two functions below write the columns, and each one checks that the caller manages that
-- station. Times come from the database clock. Every post is also appended to station_manager_posts
-- so a false claim can be reviewed later.

alter table stations add column if not exists manager_selling boolean;
alter table stations add column if not exists manager_selling_at timestamptz;
alter table stations add column if not exists live_pressure_bar integer;
alter table stations add column if not exists live_pressure_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'stations'::regclass and conname = 'stations_live_pressure_bar_range'
  ) then
    alter table stations
      add constraint stations_live_pressure_bar_range
      check (live_pressure_bar is null or live_pressure_bar between 10 and 300);
  end if;
end $$;

create table if not exists station_manager_posts (
  id uuid primary key default gen_random_uuid(),
  station_id text not null references stations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('selling', 'pressure')),
  selling boolean,
  pressure_bar integer,
  created_at timestamptz not null default now()
);

create index if not exists station_manager_posts_station_idx
  on station_manager_posts (station_id, created_at desc);

alter table station_manager_posts enable row level security;

drop policy if exists "admins read manager posts" on station_manager_posts;
create policy "admins read manager posts" on station_manager_posts
  for select to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and is_admin));

-- No insert/update/delete policy on purpose: rows are written only by the functions below.

create or replace function manager_post_selling(p_station_id text, p_selling boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from station_managers where station_id = p_station_id and user_id = auth.uid()
  ) then
    raise exception 'not authorized';
  end if;
  if p_selling is null then
    raise exception 'Invalid selling status';
  end if;

  update stations
  set manager_selling = p_selling,
      manager_selling_at = now()
  where id = p_station_id;

  insert into station_manager_posts (station_id, user_id, kind, selling)
  values (p_station_id, auth.uid(), 'selling', p_selling);
end;
$$;

create or replace function manager_post_pressure(p_station_id text, p_bar integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from station_managers where station_id = p_station_id and user_id = auth.uid()
  ) then
    raise exception 'not authorized';
  end if;
  if p_bar is null or p_bar < 10 or p_bar > 300 then
    raise exception 'Invalid pressure';
  end if;

  update stations
  set live_pressure_bar = p_bar,
      live_pressure_at = now()
  where id = p_station_id;

  insert into station_manager_posts (station_id, user_id, kind, pressure_bar)
  values (p_station_id, auth.uid(), 'pressure', p_bar);
end;
$$;

revoke all on function manager_post_selling(text, boolean) from public, anon;
revoke all on function manager_post_pressure(text, integer) from public, anon;
grant execute on function manager_post_selling(text, boolean) to authenticated;
grant execute on function manager_post_pressure(text, integer) to authenticated;

-- ---- the checks ----
create temp table verify_results (step text, ok boolean, detail text);

-- Runs one statement and passes only if it raises an error containing p_fragment.
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

do $$
declare
  v_user uuid;
  s1 text;
  s2 text;
  r record;
  v_status_before text;
  v_reports_before integer;
  v_posts_before integer;
begin
  select id into v_user from profiles order by id limit 1;
  select id into s1 from stations order by id limit 1;
  select id into s2 from stations order by id offset 1 limit 1;
  if v_user is null or s1 is null or s2 is null then
    raise exception 'need a profile and two stations to test with';
  end if;

  -- the user manages station 1 only (rolled back with everything else)
  insert into station_managers (station_id, user_id) values (s1, v_user) on conflict do nothing;
  select status into v_status_before from stations where id = s1;
  select count(*) into v_reports_before from station_reports where station_id = s1;
  select count(*) into v_posts_before from station_manager_posts where station_id = s1;

  perform set_config('request.jwt.claims', json_build_object('sub', v_user)::text, true);

  -- (a) a selling post for their own station sets the columns and logs one row
  perform manager_post_selling(s1, true);
  select manager_selling, manager_selling_at into r from stations where id = s1;
  insert into verify_results values (
    'a: selling post sets the columns and logs one row',
    r.manager_selling is true
      and r.manager_selling_at > now() - interval '1 minute'
      and (select count(*) from station_manager_posts where station_id = s1) = v_posts_before + 1,
    coalesce(r.manager_selling::text, 'null'));

  -- (b) a different station is refused, and so is a signed-out caller
  perform pg_temp.expect_error('b: another station is refused',
    format($q$select manager_post_selling(%L, true)$q$, s2), 'not authorized');
  perform pg_temp.expect_error('b2: pressure for another station is refused',
    format($q$select manager_post_pressure(%L, 220)$q$, s2), 'not authorized');
  perform set_config('request.jwt.claims', '', true);
  perform pg_temp.expect_error('b3: signed-out caller is refused',
    format($q$select manager_post_selling(%L, true)$q$, s1), 'not authorized');
  perform set_config('request.jwt.claims', json_build_object('sub', v_user)::text, true);

  -- (c) pressure bounds
  perform pg_temp.expect_error('c: pressure 9 is refused',
    format($q$select manager_post_pressure(%L, 9)$q$, s1), 'Invalid pressure');
  perform pg_temp.expect_error('c2: pressure 301 is refused',
    format($q$select manager_post_pressure(%L, 301)$q$, s1), 'Invalid pressure');
  perform manager_post_pressure(s1, 220);
  select live_pressure_bar, live_pressure_at, manager_selling into r from stations where id = s1;
  insert into verify_results values (
    'c3: pressure 220 is saved and leaves the selling flag alone',
    r.live_pressure_bar = 220 and r.live_pressure_at > now() - interval '1 minute' and r.manager_selling is true,
    coalesce(r.live_pressure_bar::text, 'null'));

  -- (d) the driver-facing status and reports are untouched
  insert into verify_results values (
    'd: status and reports are unchanged',
    (select status from stations where id = s1) is not distinct from v_status_before
      and (select count(*) from station_reports where station_id = s1) = v_reports_before,
    '');

  -- (e) a not-selling post replaces the flag
  perform manager_post_selling(s1, false);
  insert into verify_results values (
    'e: a newer not-selling post replaces the flag',
    (select manager_selling from stations where id = s1) is false,
    '');

  perform set_config('request.jwt.claims', '', true);
end
$$;

insert into verify_results values (
  'f: anon cannot run either function, signed-in users can',
  not has_function_privilege('anon', 'manager_post_selling(text, boolean)', 'execute')
  and not has_function_privilege('anon', 'manager_post_pressure(text, integer)', 'execute')
  and has_function_privilege('authenticated', 'manager_post_selling(text, boolean)', 'execute')
  and has_function_privilege('authenticated', 'manager_post_pressure(text, integer)', 'execute'),
  '');

insert into verify_results values (
  'g: the log table has row security on and no write policy for anyone',
  (select relrowsecurity from pg_class where oid = 'station_manager_posts'::regclass)
  and not exists (select 1 from pg_policies where tablename = 'station_manager_posts' and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')),
  '');

select step, case when ok then 'PASS' else 'FAIL' end as result, detail
from verify_results
order by step;

rollback;
