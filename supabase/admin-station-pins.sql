-- Admin pin-editing support for CNG-Connect.
-- Run once in the Supabase dashboard: SQL Editor -> paste -> Run.
-- Then grant yourself admin:
--   update profiles set is_admin = true where email = 'strictly4eternity@gmail.com';

alter table profiles add column if not exists is_admin boolean not null default false;

-- Sets a station's pin + precision. SECURITY DEFINER so it can write the
-- location columns (anon/authenticated have no direct UPDATE grant on
-- `stations`), but it hard-checks the caller is an admin first.
create or replace function admin_set_station_pin(
  p_station_id text,
  p_lat        double precision,
  p_lng        double precision,
  p_precision  text,
  p_area       text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_radius integer;
begin
  if auth.uid() is null
     or not exists (select 1 from profiles where id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;

  if p_precision not in ('source_exact', 'rooftop', 'street', 'area', 'city') then
    raise exception 'bad precision: %', p_precision;
  end if;
  if p_lat < 4 or p_lat > 14 or p_lng < 2.5 or p_lng > 15 then
    raise exception 'coordinates outside Nigeria';
  end if;

  v_radius := case p_precision
    when 'source_exact' then 15
    when 'rooftop'      then 30
    when 'street'       then 150
    when 'area'         then 700
    else 4000
  end;

  update stations set
    lat                = p_lat,
    lng                = p_lng,
    location_precision = p_precision,
    accuracy_radius_m  = v_radius,
    area               = coalesce(nullif(trim(p_area), ''), area),
    needs_pin_review   = (p_precision = 'city'),
    data_source        = 'Admin verified',
    data_source_date   = to_char(timezone('utc', now()), 'YYYY-MM-DD')
  where id = p_station_id;

  if not found then
    raise exception 'no station %', p_station_id;
  end if;
end;
$$;

revoke all on function admin_set_station_pin(text, double precision, double precision, text, text) from anon;
grant execute on function admin_set_station_pin(text, double precision, double precision, text, text) to authenticated;
