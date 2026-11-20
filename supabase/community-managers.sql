-- Community managers: ordinary driver accounts the admin marks, who can post "Gas available" or
-- "Gas not available" for the station they are standing at. Safe to re-run.
--
-- * community_managers lists the accounts with the role. Rows are written only by the admin function
--   below, so nobody can give the role to themselves; a person can read their own row, the admin reads all.
-- * community_post_gas(station, available, lat, lng) records the post. The caller must have the role and
--   must be within 150 m of the station (the same distance drivers' reports use); the app checks too, but
--   this is the real check. Gas available is stored as manager_state 'selling', not available as 'out'
--   (a new allowed value); the older manager_selling columns are kept in step for phones that have not
--   updated. The same person cannot post the same state for the same station twice within 2 minutes.
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
  p_lat double precision,
  p_lng double precision
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lat double precision;
  v_lng double precision;
  v_state text;
  v_distance double precision;
begin
  if auth.uid() is null or not exists (select 1 from community_managers where user_id = auth.uid()) then
    raise exception 'not authorized';
  end if;
  if p_available is null then
    raise exception 'Invalid choice';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'location required';
  end if;

  select lat, lng into v_lat, v_lng from stations where id = p_station_id;
  if not found then
    raise exception 'no station';
  end if;

  -- great-circle distance in metres (haversine)
  v_distance := 6371000 * 2 * asin(least(1, sqrt(
    power(sin(radians(v_lat - p_lat) / 2), 2)
    + cos(radians(p_lat)) * cos(radians(v_lat)) * power(sin(radians(v_lng - p_lng) / 2), 2)
  )));
  if v_distance > 150 then
    raise exception 'too far from the station';
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
      manager_selling = p_available,
      manager_selling_at = now()
  where id = p_station_id;

  insert into station_manager_posts (station_id, user_id, kind, state, selling)
  values (p_station_id, auth.uid(), 'state', v_state, p_available);
end;
$$;

revoke all on function admin_set_community_manager(uuid, boolean) from public, anon;
revoke all on function community_post_gas(text, boolean, double precision, double precision) from public, anon;
grant execute on function admin_set_community_manager(uuid, boolean) to authenticated;
grant execute on function community_post_gas(text, boolean, double precision, double precision) to authenticated;
