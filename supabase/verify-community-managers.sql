-- Smoke test for supabase/community-managers.sql. It installs the migration INSIDE this transaction,
-- tests it, and rolls everything back, so nothing is changed or saved by running it.
-- The last SELECT lists one row per check; every row should be PASS.

begin;

-- ---- the migration (same text as supabase/community-managers.sql) ----
-- Community managers: ordinary driver accounts the admin marks, who can post "Gas available" or
-- "Gas not available" for the station they are standing at. Safe to re-run.
--
-- * community_managers lists the accounts with the role. Rows are written only by the admin function
--   below, so nobody can give the role to themselves; a person can read their own row, the admin reads all.
-- * community_post_gas(station, available) records the post. The caller must have the role; there is NO
--   distance rule (community managers are trusted ambassadors and may post for any station from anywhere).
--   The old lat/lng arguments are still accepted and ignored, so an app that still sends them keeps working.
--   Gas available is stored as manager_state 'selling', not available as 'out'
--   (a new allowed value). For gas available the older manager_selling flag is set to true for phones that
--   have not updated; for not available it is left EMPTY (null), because an old phone would read "false"
--   as "Closed", which is not what the post says. The same person cannot post the same state for the same
--   station twice within 2 minutes.
-- * Nothing here touches stations.status, station_reports, points or flags.

create table if not exists community_managers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table community_managers enable row level security;

drop policy if exists "read own community manager row" on community_managers;
create policy "read own community manager row" on community_managers
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "admins read community managers" on community_managers;
create policy "admins read community managers" on community_managers
  for select to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and is_admin));

-- No insert/update/delete policy on purpose: the role is written only by admin_set_community_manager().

-- the station status gains one value: 'out' (gas not available)
alter table stations drop constraint if exists stations_manager_state_values;
alter table stations
  add constraint stations_manager_state_values
  check (manager_state is null or manager_state in ('closed', 'open', 'selling', 'out'));

-- ---- the admin turns the role on or off ----
create or replace function admin_set_community_manager(p_user_id uuid, p_value boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from profiles where id = auth.uid() and is_admin
  ) then
    raise exception 'not authorized';
  end if;
  if p_value is null then
    raise exception 'Invalid choice';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'no user found';
  end if;

  if p_value then
    insert into community_managers (user_id, created_by) values (p_user_id, auth.uid())
    on conflict (user_id) do nothing;
  else
    delete from community_managers where user_id = p_user_id;
  end if;
end;
$$;

-- ---- a community manager posts the station's gas status ----
create or replace function community_post_gas(
  p_station_id text,
  p_available boolean,
  p_lat double precision default null,
  p_lng double precision default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state text;
begin
  if auth.uid() is null or not exists (select 1 from community_managers where user_id = auth.uid()) then
    raise exception 'not authorized';
  end if;
  if p_available is null then
    raise exception 'Invalid choice';
  end if;
  if not exists (select 1 from stations where id = p_station_id) then
    raise exception 'no station';
  end if;

  v_state := case when p_available then 'selling' else 'out' end;

  if exists (
    select 1 from station_manager_posts
    where station_id = p_station_id and user_id = auth.uid() and kind = 'state' and state = v_state
      and created_at > now() - interval '2 minutes'
  ) then
    raise exception 'already posted';
  end if;

  update stations
  set manager_state = v_state,
      manager_state_at = now(),
      manager_state_reason = null,
      manager_state_until = null,
      manager_selling = case when p_available then true else null end,
      manager_selling_at = case when p_available then now() else null end
  where id = p_station_id;

  insert into station_manager_posts (station_id, user_id, kind, state, selling)
  values (p_station_id, auth.uid(), 'state', v_state, p_available);
end;
$$;

revoke all on function admin_set_community_manager(uuid, boolean) from public, anon;
revoke all on function community_post_gas(text, boolean, double precision, double precision) from public, anon;
grant execute on function admin_set_community_manager(uuid, boolean) to authenticated;
grant execute on function community_post_gas(text, boolean, double precision, double precision) to authenticated;

-- ---- the checks ----
create temp table verify_results (step text, ok boolean, detail text);

create or replace function pg_temp.expect_error(p_step text, p_sql text, p_fragment text)
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
  v_admin uuid;
  v_cm uuid;
  v_plain uuid;
  s1 text;
  s2 text;
  r record;
  v_n integer;
begin
  select id into v_admin from profiles where is_admin limit 1;
  select id into v_cm from profiles where not coalesce(is_admin, false) order by id limit 1;
  select id into v_plain from profiles where not coalesce(is_admin, false) and id <> v_cm order by id limit 1;
  select id into s1 from stations order by id limit 1;
  select id into s2 from stations order by id offset 1 limit 1;
  if v_admin is null or v_cm is null or v_plain is null or s1 is null then
    raise exception 'need an admin, two other profiles and a station to test with';
  end if;

  delete from community_managers where user_id in (v_cm, v_plain);
  insert into community_managers (user_id) values (v_cm);

  -- (a) a person without the role is refused
  perform set_config('request.jwt.claims', json_build_object('sub', v_plain, 'role', 'authenticated')::text, true);
  perform pg_temp.expect_error('a: a person without the role cannot post',
    format($q$select community_post_gas(%L, true)$q$, s1), 'not authorized');

  -- (b) a community manager posts gas available: from anywhere, with no location
  perform community_post_gas(s1, true, 6.5244, 3.3792);
  select manager_state, manager_selling, manager_state_at, manager_state_reason, manager_state_until into r from stations where id = s1;
  insert into verify_results values ('b: gas available from far away is stored as selling, with the old flag and no details',
    r.manager_state = 'selling' and r.manager_selling is true and r.manager_state_at > now() - interval '1 minute'
    and r.manager_state_reason is null and r.manager_state_until is null, coalesce(r.manager_state, 'null'));
  select count(*) into v_n from station_manager_posts where station_id = s1 and user_id = v_cm and kind = 'state' and state = 'selling';
  insert into verify_results values ('b2: the post is logged with who made it', v_n = 1, v_n::text);

  -- (c) not available with no location at all; the older lat/lng arguments are still accepted
  perform community_post_gas(s1, false);
  select manager_state, manager_selling into r from stations where id = s1;
  insert into verify_results values ('c: not available with no location is stored as out, with the old flag left empty',
    r.manager_state = 'out' and r.manager_selling is null, coalesce(r.manager_state, 'null'));
  perform community_post_gas(s2, false, 9.0, 7.0);
  insert into verify_results values ('c2: an older app that still sends a location works', true, '');

  -- (d) the same state twice within 2 minutes is refused
  perform pg_temp.expect_error('d: the same post twice within 2 minutes is refused',
    format($q$select community_post_gas(%L, false)$q$, s1), 'already posted');

  -- (e) bad input
  perform pg_temp.expect_error('e2: an unknown station is refused',
    $q$select community_post_gas('no-such-station', true)$q$, 'no station');
  perform pg_temp.expect_error('e3: no choice is refused',
    format($q$select community_post_gas(%L, null)$q$, s1), 'Invalid choice');

  -- (f) only the admin changes the role
  perform pg_temp.expect_error('f: a non-admin cannot give the role',
    format($q$select admin_set_community_manager(%L, true)$q$, v_plain), 'not authorized');
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform admin_set_community_manager(v_plain, true);
  insert into verify_results values ('f2: the admin gives the role', exists (select 1 from community_managers where user_id = v_plain), '');
  perform admin_set_community_manager(v_plain, true);
  select count(*) into v_n from community_managers where user_id = v_plain;
  insert into verify_results values ('f3: giving it twice keeps one row', v_n = 1, v_n::text);
  perform admin_set_community_manager(v_plain, false);
  insert into verify_results values ('f4: the admin takes it away', not exists (select 1 from community_managers where user_id = v_plain), '');

  -- (g) a person with the role cannot grant it, and cannot write the table directly
  perform set_config('request.jwt.claims', json_build_object('sub', v_cm, 'role', 'authenticated')::text, true);
  perform pg_temp.expect_error('g: a community manager cannot give the role either',
    format($q$select admin_set_community_manager(%L, true)$q$, v_plain), 'not authorized');

  perform set_config('request.jwt.claims', '', true);
end
$$;

insert into verify_results values (
  'h: anon cannot run either function, signed-in users can',
  not has_function_privilege('anon', 'community_post_gas(text, boolean, double precision, double precision)', 'execute')
  and not has_function_privilege('anon', 'admin_set_community_manager(uuid, boolean)', 'execute')
  and has_function_privilege('authenticated', 'community_post_gas(text, boolean, double precision, double precision)', 'execute')
  and has_function_privilege('authenticated', 'admin_set_community_manager(uuid, boolean)', 'execute'),
  '');

insert into verify_results values (
  'i: the table has row security on and no write policy',
  (select relrowsecurity from pg_class where oid = 'community_managers'::regclass)
  and not exists (select 1 from pg_policies where tablename = 'community_managers' and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')),
  '');

select step, case when ok then 'PASS' else 'FAIL' end as result, detail
from verify_results
order by step;

rollback;
