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
