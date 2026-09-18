-- Two additions:
-- 1. admin_delete_stations — bulk-delete stations (admin only). All
--    dependent tables (station_reports, station_media, station_comments,
--    station_presence) already have `station_id ... ON DELETE CASCADE`
--    (see schema.sql), so a plain delete on `stations` cleans those up
--    automatically — no manual cleanup needed here.
-- 2. station_managers — a lighter-weight role: a manager can edit only the
--    specific station(s) an admin has assigned them to, via the *same*
--    admin_update_station RPC used by the full admin editor (just scoped by
--    station_id instead of a blanket is_admin check).

-- 1. Bulk delete -----------------------------------------------------------

create or replace function admin_delete_stations(p_station_ids text[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  if auth.uid() is null or not exists (
    select 1 from profiles where id = auth.uid() and is_admin
  ) then
    raise exception 'not authorized';
  end if;

  if p_station_ids is null or array_length(p_station_ids, 1) is null then
    raise exception 'no station ids given';
  end if;

  delete from stations where id = any(p_station_ids);
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function admin_delete_stations(text[]) from anon;
grant execute on function admin_delete_stations(text[]) to authenticated;

-- 2. Station managers --------------------------------------------------------

create table if not exists station_managers (
  station_id text not null references stations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (station_id, user_id)
);

alter table station_managers enable row level security;

drop policy if exists "managers see own assignments" on station_managers;
create policy "managers see own assignments" on station_managers
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "admins see all assignments" on station_managers;
create policy "admins see all assignments" on station_managers
  for select to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and is_admin));

-- No direct INSERT/UPDATE/DELETE policy on purpose — assignment only
-- happens through the SECURITY DEFINER RPCs below, which enforce is_admin.

create or replace function admin_assign_station_manager(p_station_id text, p_manager_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from profiles where id = auth.uid() and is_admin
  ) then
    raise exception 'not authorized';
  end if;

  select id into v_user_id from profiles where lower(email) = lower(trim(p_manager_email));
  if v_user_id is null then
    raise exception 'no user found with email %', p_manager_email;
  end if;
  if not exists (select 1 from stations where id = p_station_id) then
    raise exception 'no station %', p_station_id;
  end if;

  insert into station_managers (station_id, user_id)
  values (p_station_id, v_user_id)
  on conflict (station_id, user_id) do nothing;
end;
$$;

revoke all on function admin_assign_station_manager(text, text) from anon;
grant execute on function admin_assign_station_manager(text, text) to authenticated;

create or replace function admin_remove_station_manager(p_station_id text, p_manager_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from profiles where id = auth.uid() and is_admin
  ) then
    raise exception 'not authorized';
  end if;

  select id into v_user_id from profiles where lower(email) = lower(trim(p_manager_email));
  if v_user_id is null then
    raise exception 'no user found with email %', p_manager_email;
  end if;

  delete from station_managers where station_id = p_station_id and user_id = v_user_id;
end;
$$;

revoke all on function admin_remove_station_manager(text, text) from anon;
grant execute on function admin_remove_station_manager(text, text) to authenticated;

-- A manager's own view of their assigned stations, with the fields the
-- lightweight manager screen needs (avoids the manager screen needing
-- broader SELECT access than "which stations am I assigned to").
create or replace function my_managed_stations()
returns setof stations
language sql
security definer
set search_path = public
stable
as $$
  select s.* from stations s
  join station_managers sm on sm.station_id = s.id
  where sm.user_id = auth.uid()
  order by s.name;
$$;

revoke all on function my_managed_stations() from anon;
grant execute on function my_managed_stations() to authenticated;

-- 3. Extend admin_update_station so an assigned manager can edit their own
--    station(s) through the exact same RPC the admin editor uses — scoped
--    by station_id instead of a blanket is_admin check.

create or replace function admin_update_station(
  p_station_id text,
  p_name text default null,
  p_address text default null,
  p_operator text default null,
  p_city text default null,
  p_state text default null,
  p_station_type text default null,
  p_area text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_precision text default null,
  p_phone text default null,
  p_cng_price double precision default null,
  p_pump_pressure integer default null,
  p_is_picng_accredited boolean default null,
  p_images jsonb default null,
  p_opens_at text default null,
  p_closes_at text default null,
  p_is_24_hours boolean default null,
  p_hours_note text default null,
  p_connector_types jsonb default null,
  p_charging_speed_kw double precision default null,
  p_price_per_kwh double precision default null,
  p_total_ports integer default null,
  p_network text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_radius integer;
  v_is_admin boolean;
  v_is_manager boolean;
begin
  select exists (select 1 from profiles where id = auth.uid() and is_admin) into v_is_admin;
  select exists (
    select 1 from station_managers where station_id = p_station_id and user_id = auth.uid()
  ) into v_is_manager;

  if auth.uid() is null or not (v_is_admin or v_is_manager) then
    raise exception 'not authorized';
  end if;

  if p_precision is not null and p_precision not in
    ('source_exact', 'rooftop', 'street', 'area', 'city')
  then
    raise exception 'bad precision: %', p_precision;
  end if;

  if p_lat is not null and (p_lat < 4 or p_lat > 14) then
    raise exception 'lat outside Nigeria: %', p_lat;
  end if;
  if p_lng is not null and (p_lng < 2.5 or p_lng > 15) then
    raise exception 'lng outside Nigeria: %', p_lng;
  end if;

  if p_precision is not null then
    v_radius := case p_precision
      when 'source_exact' then 15
      when 'rooftop' then 30
      when 'street' then 150
      when 'area' then 700
      else 4000
    end;
  end if;

  update stations set
    name = coalesce(nullif(trim(p_name), ''), name),
    address = coalesce(nullif(trim(p_address), ''), address),
    operator = coalesce(nullif(trim(p_operator), ''), operator),
    city = coalesce(nullif(trim(p_city), ''), city),
    state = coalesce(nullif(trim(p_state), ''), state),
    station_type = coalesce(nullif(trim(p_station_type), ''), station_type),
    area = coalesce(nullif(trim(p_area), ''), area),
    lat = coalesce(p_lat, lat),
    lng = coalesce(p_lng, lng),
    location_precision = coalesce(p_precision, location_precision),
    accuracy_radius_m = coalesce(v_radius, accuracy_radius_m),
    needs_pin_review = case when p_precision is not null then (p_precision = 'city') else needs_pin_review end,
    phone = coalesce(nullif(trim(p_phone), ''), phone),
    cng_price = coalesce(p_cng_price, cng_price),
    pump_pressure = coalesce(p_pump_pressure, pump_pressure),
    is_picng_accredited = coalesce(p_is_picng_accredited, is_picng_accredited),
    images = coalesce(p_images, images),
    opens_at = coalesce(p_opens_at::time, opens_at),
    closes_at = coalesce(p_closes_at::time, closes_at),
    is_24_hours = coalesce(p_is_24_hours, is_24_hours),
    hours_note = coalesce(nullif(trim(p_hours_note), ''), hours_note),
    connector_types = coalesce(p_connector_types, connector_types),
    charging_speed_kw = coalesce(p_charging_speed_kw, charging_speed_kw),
    price_per_kwh = coalesce(p_price_per_kwh, price_per_kwh),
    total_ports = coalesce(p_total_ports, total_ports),
    network = coalesce(nullif(trim(p_network), ''), network),
    data_source = case when v_is_admin then 'Admin verified' else 'Manager verified' end,
    data_source_date = to_char(timezone('utc', now()), 'YYYY-MM-DD')
  where id = p_station_id;

  if not found then
    raise exception 'no station %', p_station_id;
  end if;
end;
$$;

revoke all on function admin_update_station(
  text, text, text, text, text, text, text, text, double precision, double precision, text,
  text, double precision, integer, boolean, jsonb, text, text, boolean, text,
  jsonb, double precision, double precision, integer, text
) from anon;

grant execute on function admin_update_station(
  text, text, text, text, text, text, text, text, double precision, double precision, text,
  text, double precision, integer, boolean, jsonb, text, text, boolean, text,
  jsonb, double precision, double precision, integer, text
) to authenticated;
