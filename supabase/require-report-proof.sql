-- Every new report needs a photo taken at the station. Safe to re-run.
--
-- DO NOT RUN THIS UNTIL the app release that sends photo_lat / photo_lng has been live for a while and
-- installed phones have updated. Phones still on the old version send neither, and this rule would make
-- their reports fail silently. Order: (1) supabase/report-proof-columns.sql, (2) deploy the app,
-- (3) wait, (4) run this file.
--
-- The rule: for a signed-in user, a new row in station_reports must carry a photo plus the position the
-- photo was taken at, and that position must be within 800 m of the station. The database cannot see
-- the phone's GPS, only the position the app sends, so this stops casual bypasses (an old or modified
-- app, a direct call), not a determined forger.
--
-- Inserts made with no login (the SQL editor, seed scripts) are not blocked, and rows that already exist
-- are not touched.

create or replace function cng_require_report_proof()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lat double precision;
  v_lng double precision;
  v_away double precision;
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.photo is null or length(new.photo) < 100 or new.photo_lat is null or new.photo_lng is null then
    raise exception 'a photo taken at the station is required';
  end if;

  select s.lat, s.lng into v_lat, v_lng from stations s where s.id = new.station_id;
  if not found or v_lat is null or v_lng is null then
    raise exception 'a photo taken at the station is required';
  end if;

  -- great-circle (haversine) distance in metres
  v_away := 2 * 6371000 * asin(sqrt(
    power(sin(radians(new.photo_lat - v_lat) / 2), 2)
    + cos(radians(v_lat)) * cos(radians(new.photo_lat)) * power(sin(radians(new.photo_lng - v_lng) / 2), 2)
  ));
  if v_away > 800 then
    raise exception 'a photo taken at the station is required';
  end if;

  return new;
end;
$$;

drop trigger if exists require_report_proof on station_reports;
create trigger require_report_proof
  before insert on station_reports
  for each row execute function cng_require_report_proof();
