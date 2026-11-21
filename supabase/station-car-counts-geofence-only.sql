-- Count only real "car at the station" records, not old page-view ones. Safe to re-run.
--
-- Older app versions write a presence record every time a driver merely OPENS a station's page,
-- living 20 minutes. The current app writes one only while a driver's phone is within 500 m of the
-- station, living 6 minutes and refreshed every 2 minutes. Phones that have not updated yet keep
-- writing the old kind, so "N cars here" counted people looking at the page and flickered as those
-- records came and went.
--
-- A geofence record never lives more than a few minutes (6), a page-view record lives 20. So the
-- count now only includes records whose lifetime is 10 minutes or less. Same columns, same grants.

create or replace function station_car_counts()
returns table (station_id text, cars integer)
language sql
security definer
stable
set search_path = public
as $$
  select p.station_id, count(*)::integer as cars
  from station_presence p
  where p.expires_at > now()
    and p.expires_at - p.last_ping_at <= interval '10 minutes'
  group by p.station_id;
$$;
