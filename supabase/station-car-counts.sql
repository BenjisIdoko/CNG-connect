-- Cars at each station: a public count, without the public being able to read who is where.
-- Run once in the Supabase dashboard: SQL Editor -> paste -> Run. Safe to re-run.
--
-- station_presence has one row per driver per station: the app writes it automatically while a
-- signed-in driver's phone is within 250 m of a station (and it lapses a few minutes after the last
-- update). The table was publicly readable, so anyone could list which account was at which station
-- and when. Drivers only ever need the NUMBER of cars at each station, so:
--   1. station_car_counts() returns just (station_id, cars) for live rows, to anyone;
--   2. the public read policy is replaced by one that lets a signed-in user read only their own rows
--      (the app's own upsert and hasActivePresence need that, and nothing else does).

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
  group by p.station_id;
$$;

revoke all on function station_car_counts() from public;
grant execute on function station_car_counts() to anon, authenticated;

drop policy if exists "Allow public read station_presence" on station_presence;
drop policy if exists "Read own station_presence" on station_presence;
create policy "Read own station_presence" on station_presence
  for select to authenticated
  using (user_key = auth.uid()::text);
