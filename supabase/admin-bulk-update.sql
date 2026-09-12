-- Bulk field update RPC used by the "Upload CSV" button in the ?admin=1 station editor.
-- Complements admin_set_station_pin (which stays as-is, used by the pin/name editor UI):
-- this one lets a CSV row patch any subset of a station's text fields + pin in one call.
-- Any param left null leaves that column unchanged, so a CSV can touch just a few cells
-- per row without clobbering the rest.

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
  p_precision text default null
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
    data_source = 'Admin verified (bulk)',
    data_source_date = to_char(timezone('utc', now()), 'YYYY-MM-DD')
  where id = p_station_id;

  if not found then
    raise exception 'no station %', p_station_id;
  end if;
end;
$$;

revoke all on function admin_update_station(
  text, text, text, text, text, text, text, text, double precision, double precision, text
) from anon;

grant execute on function admin_update_station(
  text, text, text, text, text, text, text, text, double precision, double precision, text
) to authenticated;
