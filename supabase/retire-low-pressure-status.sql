-- Retire the "Low pressure" status.
--
-- Drivers now report Available (full), Queuing (queue) or Out of gas (out). Anything already
-- saved as 'low' becomes 'queue': a slow fill is still a wait. Safe to re-run.
--
-- RUN THIS AFTER the app release that stops offering "Low pressure" is live. That release
-- already reads a stored 'low' as 'queue', so nothing breaks in the gap; running this first
-- would make the old app's "Low pressure" button fail until drivers update.

-- 1. Convert existing rows --------------------------------------------------
update station_reports
   set status = 'queue',
       status_label = 'Reported Queuing'
 where status = 'low';

update stations
   set status = 'queue',
       status_label = 'Queuing'
 where status = 'low';

-- 2. Tighten the allowed values ---------------------------------------------
alter table station_reports drop constraint if exists station_reports_status_check;
alter table station_reports
  add constraint station_reports_status_check check (status in ('full', 'queue', 'out'));

alter table stations drop constraint if exists stations_status_check;
alter table stations
  add constraint stations_status_check check (status in ('full', 'queue', 'out', 'unknown'));

-- 3. Be kind to app builds that are still open on a phone --------------------
-- A phone running the previous release can still send 'low'. Read it as 'queue' instead of
-- failing the driver's report with a constraint error.
create or replace function cng_map_retired_low_status()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'low' then
    new.status := 'queue';
    new.status_label := 'Reported Queuing';
  end if;
  return new;
end;
$$;

drop trigger if exists aa_map_retired_low_status on station_reports;
create trigger aa_map_retired_low_status
  before insert or update on station_reports
  for each row execute function cng_map_retired_low_status();

-- Same security rules as supabase/security-hardening-2026-10.sql; only the status list
-- changed, plus 'low' is mapped to 'queue' so it matches the report stored above.
create or replace function report_station_status(
  p_station_id text,
  p_status text,
  p_status_label text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_status = 'low' then
    p_status := 'queue';
    p_status_label := 'Queuing';
  end if;

  if p_status not in ('full', 'queue', 'out') then
    raise exception 'Invalid status';
  end if;

  if length(coalesce(p_status_label, '')) > 80 then
    raise exception 'Status label too long';
  end if;

  if not exists (
    select 1 from station_reports r
    where r.station_id = p_station_id
      and r.user_id = auth.uid()
      and r.status = p_status
      and r.hidden = false
      and r.created_at > now() - interval '10 minutes'
  ) then
    raise exception 'No matching recent report from you for this station';
  end if;

  update stations
     set status = p_status,
         status_label = p_status_label,
         last_updated = 'Just now'
   where id = p_station_id;

  if not found then
    raise exception 'Station not found: %', p_station_id;
  end if;
end;
$$;

-- Keep the same grants the function had before (signed-in drivers only).
revoke execute on function report_station_status(text, text, text) from anon;
grant execute on function report_station_status(text, text, text) to authenticated;
