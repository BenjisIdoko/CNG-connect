-- Review driver station suggestions. Run AFTER supabase/admin-create-station.sql. Safe to re-run.
--
-- 1. admin_create_station gets one more optional argument, p_suggestion_id. When it is given, the
--    suggestion row is locked, must still be 'pending', and is marked 'approved' in the same
--    transaction that creates the station, so one suggestion can never create two stations.
--    Existing callers (named arguments, no p_suggestion_id) keep working unchanged.
-- 2. admin_reject_station_suggestion marks a pending suggestion 'rejected'.
--
-- Admins read suggestions straight from station_suggestions (it already has a public read policy).

-- The 10-argument version is replaced, not overloaded, so a call never matches two functions.
drop function if exists admin_create_station(text, text, text, text, double precision, double precision, text, text, text, text);

create or replace function admin_create_station(
  p_name          text,
  p_address       text,
  p_city          text,
  p_state         text,
  p_lat           double precision,
  p_lng           double precision,
  p_precision     text,
  p_operator      text default null,
  p_station_type  text default 'cng',
  p_area          text default null,
  p_suggestion_id text default null
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name       text := trim(coalesce(p_name, ''));
  v_address    text := trim(coalesce(p_address, ''));
  v_city       text := trim(coalesce(p_city, ''));
  v_state      text := trim(coalesce(p_state, ''));
  v_operator   text := nullif(trim(coalesce(p_operator, '')), '');
  v_area       text := nullif(trim(coalesce(p_area, '')), '');
  v_key        text;
  v_slug       text;
  v_id         text;
  v_radius     integer;
  v_sug_status text;
begin
  if auth.uid() is null or not exists (
    select 1 from profiles where id = auth.uid() and is_admin
  ) then
    raise exception 'not authorized';
  end if;

  -- Lock the suggestion first so two admins approving at once cannot both create a station.
  if p_suggestion_id is not null then
    select status into v_sug_status from station_suggestions where id = p_suggestion_id for update;
    if not found then
      raise exception 'suggestion not found';
    end if;
    if v_sug_status <> 'pending' then
      raise exception 'suggestion already reviewed';
    end if;
  end if;

  if v_name = '' or length(v_name) > 120 then
    raise exception 'name is required (120 characters at most)';
  end if;
  if v_address = '' or length(v_address) > 300 then
    raise exception 'address is required (300 characters at most)';
  end if;
  if v_city = '' or length(v_city) > 80 then
    raise exception 'city is required (80 characters at most)';
  end if;
  if v_state = '' or length(v_state) > 80 then
    raise exception 'state is required (80 characters at most)';
  end if;
  if p_station_type is null or p_station_type not in ('cng', 'ev_charging') then
    raise exception 'bad station type: %', p_station_type;
  end if;

  if p_lat is null or p_lng is null
     or p_lat < 4 or p_lat > 14 or p_lng < 2.5 or p_lng > 15 then
    raise exception 'coordinates outside Nigeria';
  end if;
  if p_precision is null or p_precision not in ('source_exact', 'rooftop', 'street', 'area', 'city') then
    raise exception 'bad precision: %', p_precision;
  end if;

  v_key := lower(regexp_replace(v_name, '[^a-zA-Z0-9]', '', 'g'));
  if v_key = '' then
    raise exception 'name must contain letters or digits';
  end if;
  if exists (
    select 1 from stations
    where lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g')) = v_key
  ) then
    raise exception 'a station with this name already exists';
  end if;

  v_radius := case p_precision
    when 'source_exact' then 15
    when 'rooftop'      then 30
    when 'street'       then 150
    when 'area'         then 700
    else 4000
  end;

  v_slug := trim(both '-' from left(regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'), 30));
  if v_slug = '' then
    v_slug := 'station';
  end if;
  v_id := 'admin-' || v_slug || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);

  insert into stations (
    id, name, address, city, state, operator, station_type, area,
    lat, lng, location_precision, accuracy_radius_m, needs_pin_review,
    data_source, data_source_date, created_by,
    status, status_label, verified_by_community, is_picng_accredited, images
  ) values (
    v_id, v_name, v_address, v_city, v_state, v_operator, p_station_type, v_area,
    p_lat, p_lng, p_precision, v_radius, (p_precision = 'city'),
    'Admin added', to_char(timezone('utc', now()), 'YYYY-MM-DD'), auth.uid()::text,
    'unknown', 'No recent reports', false, false, '[]'::jsonb
  );

  if p_suggestion_id is not null then
    update station_suggestions set status = 'approved' where id = p_suggestion_id;
  end if;

  return v_id;
end;
$$;

revoke all on function admin_create_station(text, text, text, text, double precision, double precision, text, text, text, text, text) from public, anon;
grant execute on function admin_create_station(text, text, text, text, double precision, double precision, text, text, text, text, text) to authenticated;

create or replace function admin_reject_station_suggestion(p_suggestion_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if auth.uid() is null or not exists (
    select 1 from profiles where id = auth.uid() and is_admin
  ) then
    raise exception 'not authorized';
  end if;

  select status into v_status from station_suggestions where id = p_suggestion_id for update;
  if not found then
    raise exception 'suggestion not found';
  end if;
  if v_status <> 'pending' then
    raise exception 'suggestion already reviewed';
  end if;

  update station_suggestions set status = 'rejected' where id = p_suggestion_id;
end;
$$;

revoke all on function admin_reject_station_suggestion(text) from public, anon;
grant execute on function admin_reject_station_suggestion(text) to authenticated;
