-- Full admin station editor: new schema columns (operating hours), a
-- Storage bucket for real photo uploads, and an extended
-- admin_update_station RPC covering every editable field on a station.

-- 1. New columns -------------------------------------------------------
alter table stations add column if not exists opens_at time;
alter table stations add column if not exists closes_at time;
alter table stations add column if not exists is_24_hours boolean not null default false;
alter table stations add column if not exists hours_note text;

-- 2. Storage bucket for station photos ----------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('station-photos', 'station-photos', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "station-photos public read" on storage.objects;
create policy "station-photos public read"
  on storage.objects for select
  using (bucket_id = 'station-photos');

drop policy if exists "station-photos admin write" on storage.objects;
create policy "station-photos admin write"
  on storage.objects for insert
  with check (
    bucket_id = 'station-photos'
    and auth.uid() is not null
    and exists (select 1 from profiles where id = auth.uid() and is_admin)
  );

drop policy if exists "station-photos admin update" on storage.objects;
create policy "station-photos admin update"
  on storage.objects for update
  using (
    bucket_id = 'station-photos'
    and auth.uid() is not null
    and exists (select 1 from profiles where id = auth.uid() and is_admin)
  );

drop policy if exists "station-photos admin delete" on storage.objects;
create policy "station-photos admin delete"
  on storage.objects for delete
  using (
    bucket_id = 'station-photos'
    and auth.uid() is not null
    and exists (select 1 from profiles where id = auth.uid() and is_admin)
  );

-- 3. Extended admin_update_station RPC ----------------------------------
-- Replaces the version from admin-bulk-update.sql with one covering every
-- editable field. Same "null param = leave unchanged" contract, so the
-- existing bulk-CSV path (which only ever sends a few fields per row)
-- keeps working unmodified against this new signature.

drop function if exists admin_update_station(
  text, text, text, text, text, text, text, text, double precision, double precision, text
);

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
begin
  if auth.uid() is null or not exists (
    select 1 from profiles where id = auth.uid() and is_admin
  ) then
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
    data_source = 'Admin verified',
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
