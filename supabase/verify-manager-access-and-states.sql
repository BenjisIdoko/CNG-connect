-- Smoke test for supabase/manager-access-and-states.sql. It installs the migration INSIDE this transaction,
-- tests it, and rolls everything back, so nothing is changed or saved by running it.
-- The last SELECT lists one row per check; every row should be PASS.

begin;

-- ---- the migration (same text as supabase/manager-access-and-states.sql) ----
-- Station manager access (invite by email) and the three-state status. Safe to re-run.
--
-- 1. Invites. A station manager no longer needs a driver account in advance. The admin invites an email
--    for a station; the invite is stored. When that person signs in with an emailed code, the app calls
--    claim_station_manager_invites(), which turns invites for the signed-in (verified) email into real
--    station_managers rows. Only the admin can invite or cancel.
-- 2. Three states. stations.manager_state is 'closed', 'open' (open, waiting for gas) or 'selling' (open,
--    gas available), set only by manager_post_state(), which checks the caller manages that station.
--    The older manager_selling flag is kept in step (true only for 'selling') for phones that have not
--    updated. Nothing here touches stations.status, station_reports, points or flags.

-- ---- three-state columns ----
alter table stations add column if not exists manager_state text;
alter table stations add column if not exists manager_state_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'stations'::regclass and conname = 'stations_manager_state_values'
  ) then
    alter table stations
      add constraint stations_manager_state_values
      check (manager_state is null or manager_state in ('closed', 'open', 'selling'));
  end if;
end $$;

-- the post log learns the new kind
alter table station_manager_posts add column if not exists state text;
alter table station_manager_posts drop constraint if exists station_manager_posts_kind_check;
alter table station_manager_posts
  add constraint station_manager_posts_kind_check check (kind in ('selling', 'pressure', 'state'));

-- ---- invites ----
create table if not exists station_manager_invites (
  id uuid primary key default gen_random_uuid(),
  station_id text not null references stations(id) on delete cascade,
  email text not null,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (station_id, email)
);

alter table station_manager_invites enable row level security;

drop policy if exists "admins read manager invites" on station_manager_invites;
create policy "admins read manager invites" on station_manager_invites
  for select to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and is_admin));

-- No insert/update/delete policy on purpose: invites are written only by the functions below.

-- ---- post one of the three states ----
create or replace function manager_post_state(p_station_id text, p_state text)
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
  if p_state is null or p_state not in ('closed', 'open', 'selling') then
    raise exception 'Invalid state';
  end if;

  update stations
  set manager_state = p_state,
      manager_state_at = now(),
      manager_selling = (p_state = 'selling'),
      manager_selling_at = now()
  where id = p_station_id;

  insert into station_manager_posts (station_id, user_id, kind, state, selling)
  values (p_station_id, auth.uid(), 'state', p_state, p_state = 'selling');
end;
$$;

-- ---- the admin invites a manager by email ----
create or replace function admin_invite_station_manager(p_station_id text, p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_user_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from profiles where id = auth.uid() and is_admin
  ) then
    raise exception 'not authorized';
  end if;
  if length(v_email) < 5 or length(v_email) > 254 or position('@' in v_email) < 2 or v_email like '% %' then
    raise exception 'Invalid email';
  end if;
  if not exists (select 1 from stations where id = p_station_id) then
    raise exception 'no station %', p_station_id;
  end if;

  select id into v_user_id from profiles where lower(email) = v_email limit 1;
  if v_user_id is not null then
    insert into station_managers (station_id, user_id)
    values (p_station_id, v_user_id)
    on conflict (station_id, user_id) do nothing;
    return 'assigned';
  end if;

  insert into station_manager_invites (station_id, email, invited_by)
  values (p_station_id, v_email, auth.uid())
  on conflict (station_id, email) do nothing;
  return 'invited';
end;
$$;

-- ---- the admin cancels a pending invite ----
create or replace function admin_cancel_station_manager_invite(p_station_id text, p_email text)
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
  delete from station_manager_invites
  where station_id = p_station_id and email = lower(trim(coalesce(p_email, '')));
end;
$$;

-- ---- a signed-in person claims the invites addressed to their verified email ----
create or replace function claim_station_manager_invites()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;
  v_email := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  if v_email = '' then
    return 0;
  end if;

  with claimed as (
    delete from station_manager_invites where email = v_email returning station_id
  ), assigned as (
    insert into station_managers (station_id, user_id)
    select station_id, auth.uid() from claimed
    on conflict (station_id, user_id) do nothing
    returning 1
  )
  select count(*) into v_count from claimed;

  return coalesce(v_count, 0);
end;
$$;

-- removing a manager also cancels a pending invite for that email
create or replace function admin_remove_station_manager(p_station_id text, p_manager_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_manager_email, '')));
  v_user_id uuid;
  v_invites integer;
begin
  if auth.uid() is null or not exists (
    select 1 from profiles where id = auth.uid() and is_admin
  ) then
    raise exception 'not authorized';
  end if;

  delete from station_manager_invites where station_id = p_station_id and email = v_email;
  get diagnostics v_invites = row_count;

  select id into v_user_id from profiles where lower(email) = v_email limit 1;
  if v_user_id is null then
    if v_invites = 0 then
      raise exception 'no user found with email %', p_manager_email;
    end if;
    return;
  end if;

  delete from station_managers where station_id = p_station_id and user_id = v_user_id;
end;
$$;

revoke all on function manager_post_state(text, text) from public, anon;
revoke all on function admin_invite_station_manager(text, text) from public, anon;
revoke all on function admin_cancel_station_manager_invite(text, text) from public, anon;
revoke all on function claim_station_manager_invites() from public, anon;
grant execute on function manager_post_state(text, text) to authenticated;
grant execute on function admin_invite_station_manager(text, text) to authenticated;
grant execute on function admin_cancel_station_manager_invite(text, text) to authenticated;
grant execute on function claim_station_manager_invites() to authenticated;

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
  v_admin uuid;
  v_u1 uuid;
  v_u2 uuid;
  v_u1_email text;
  s1 text;
  s2 text;
  v_res text;
  v_n integer;
  r record;
  v_new_email constant text := 'new.manager+verify@example.com';
begin
  select id into v_admin from profiles where is_admin limit 1;
  select id, email into v_u1, v_u1_email from profiles where not coalesce(is_admin, false) and coalesce(email, '') <> '' order by id limit 1;
  select id into v_u2 from profiles where not coalesce(is_admin, false) and id <> v_u1 order by id limit 1;
  select id into s1 from stations order by id limit 1;
  select id into s2 from stations order by id offset 1 limit 1;
  if v_admin is null or v_u1 is null or v_u2 is null or s1 is null or s2 is null then
    raise exception 'need an admin, two other profiles and two stations to test with';
  end if;

  -- act as the admin
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'email', 'admin@example.com')::text, true);

  -- (a) inviting an email with no profile stores one invite
  v_res := admin_invite_station_manager(s1, '  ' || upper(v_new_email) || ' ');
  select count(*) into v_n from station_manager_invites where station_id = s1 and email = v_new_email;
  insert into verify_results values ('a: an unknown email is invited, stored lower-case and trimmed', v_res = 'invited' and v_n = 1, v_res || ' / ' || v_n);

  -- (b) inviting an email that already has a profile assigns at once
  v_res := admin_invite_station_manager(s2, v_u1_email);
  select count(*) into v_n from station_managers where station_id = s2 and user_id = v_u1;
  insert into verify_results values ('b: an existing account is assigned at once', v_res = 'assigned' and v_n = 1, v_res || ' / ' || v_n);

  perform pg_temp.expect_error('b2: a bad email is refused',
    format($q$select admin_invite_station_manager(%L, 'not-an-email')$q$, s1), 'Invalid email');

  -- (c) a login with a different email cannot claim it
  perform set_config('request.jwt.claims', json_build_object('sub', v_u2, 'role', 'authenticated', 'email', 'someone.else@example.com')::text, true);
  v_n := claim_station_manager_invites();
  insert into verify_results values ('c: a different email claims nothing', v_n = 0 and not exists (select 1 from station_managers where station_id = s1 and user_id = v_u2), v_n::text);

  -- (d) the matching email claims it once; a second claim is harmless
  perform set_config('request.jwt.claims', json_build_object('sub', v_u2, 'role', 'authenticated', 'email', upper(v_new_email))::text, true);
  v_n := claim_station_manager_invites();
  insert into verify_results values ('d: the invited email claims the station', v_n = 1 and exists (select 1 from station_managers where station_id = s1 and user_id = v_u2), v_n::text);
  v_n := claim_station_manager_invites();
  insert into verify_results values ('d2: claiming again returns 0 and changes nothing', v_n = 0 and (select count(*) from station_managers where station_id = s1 and user_id = v_u2) = 1, v_n::text);

  -- (e) the new manager posts each state; the columns, the old flag and the log follow
  perform manager_post_state(s1, 'selling');
  select manager_state, manager_selling, manager_state_at into r from stations where id = s1;
  insert into verify_results values ('e: selling sets the state and the old flag', r.manager_state = 'selling' and r.manager_selling is true and r.manager_state_at > now() - interval '1 minute', coalesce(r.manager_state, 'null'));
  perform manager_post_state(s1, 'open');
  select manager_state, manager_selling into r from stations where id = s1;
  insert into verify_results values ('e2: open sets the state and clears the old flag', r.manager_state = 'open' and r.manager_selling is false, coalesce(r.manager_state, 'null'));
  perform manager_post_state(s1, 'closed');
  select manager_state, manager_selling into r from stations where id = s1;
  insert into verify_results values ('e3: closed sets the state and the old flag stays false', r.manager_state = 'closed' and r.manager_selling is false, coalesce(r.manager_state, 'null'));
  select count(*) into v_n from station_manager_posts where station_id = s1 and kind = 'state' and user_id = v_u2;
  insert into verify_results values ('e4: each state post is logged', v_n = 3, v_n::text);

  -- (f) refusals: another station, and a bad state
  perform pg_temp.expect_error('f: posting for a station you do not manage is refused',
    format($q$select manager_post_state(%L, 'selling')$q$, s2), 'not authorized');
  perform pg_temp.expect_error('f2: an unknown state is refused',
    format($q$select manager_post_state(%L, 'maybe')$q$, s1), 'Invalid state');

  -- (g) a non-admin cannot invite or cancel
  perform pg_temp.expect_error('g: a non-admin cannot invite',
    format($q$select admin_invite_station_manager(%L, 'x.y@example.com')$q$, s1), 'not authorized');
  perform pg_temp.expect_error('g2: a non-admin cannot cancel an invite',
    format($q$select admin_cancel_station_manager_invite(%L, 'x.y@example.com')$q$, s1), 'not authorized');

  -- (i) the admin can cancel a pending invite, and removing a pending email also cancels it
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'email', 'admin@example.com')::text, true);
  perform admin_invite_station_manager(s1, 'cancel.me@example.com');
  perform admin_cancel_station_manager_invite(s1, 'Cancel.Me@example.com');
  select count(*) into v_n from station_manager_invites where email = 'cancel.me@example.com';
  insert into verify_results values ('i: a pending invite can be cancelled', v_n = 0, v_n::text);
  perform admin_invite_station_manager(s1, 'remove.me@example.com');
  perform admin_remove_station_manager(s1, 'remove.me@example.com');
  select count(*) into v_n from station_manager_invites where email = 'remove.me@example.com';
  insert into verify_results values ('i2: removing a pending email cancels its invite', v_n = 0, v_n::text);

  -- removing an assigned manager takes the access away at once
  perform admin_remove_station_manager(s1, (select email from profiles where id = v_u2));
  insert into verify_results values ('i3: a removed manager loses the station', not exists (select 1 from station_managers where station_id = s1 and user_id = v_u2), '');

  perform set_config('request.jwt.claims', '', true);
end
$$;

insert into verify_results values (
  'h: anon cannot run any new function, signed-in users can',
  not has_function_privilege('anon', 'manager_post_state(text, text)', 'execute')
  and not has_function_privilege('anon', 'admin_invite_station_manager(text, text)', 'execute')
  and not has_function_privilege('anon', 'admin_cancel_station_manager_invite(text, text)', 'execute')
  and not has_function_privilege('anon', 'claim_station_manager_invites()', 'execute')
  and has_function_privilege('authenticated', 'manager_post_state(text, text)', 'execute')
  and has_function_privilege('authenticated', 'admin_invite_station_manager(text, text)', 'execute')
  and has_function_privilege('authenticated', 'claim_station_manager_invites()', 'execute'),
  '');

insert into verify_results values (
  'j: the invites table has row security on and no write policy',
  (select relrowsecurity from pg_class where oid = 'station_manager_invites'::regclass)
  and not exists (select 1 from pg_policies where tablename = 'station_manager_invites' and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')),
  '');

select step, case when ok then 'PASS' else 'FAIL' end as result, detail
from verify_results
order by step;

rollback;
