-- Station manager posts can say why and until when. Safe to re-run.
--
-- A manager's "Closed" or "Open, waiting for gas" post may carry a reason (supply, fault, power, other)
-- and an expected-back time. Both are optional, so the older two-argument call
-- manager_post_state(station, state) keeps working. Posting "selling" clears both. The expected time must
-- be in the future and at most 24 hours ahead, otherwise it is stored as null. Nothing here touches
-- stations.status, station_reports, points or flags.

-- ---- columns ----
alter table stations add column if not exists manager_state_reason text;
alter table stations add column if not exists manager_state_until timestamptz;
alter table station_manager_posts add column if not exists reason text;
alter table station_manager_posts add column if not exists until_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'stations'::regclass and conname = 'stations_manager_state_reason_values'
  ) then
    alter table stations
      add constraint stations_manager_state_reason_values
      check (manager_state_reason is null or manager_state_reason in ('supply', 'fault', 'power', 'other'));
  end if;
end $$;

-- ---- post a state, optionally with a reason and an expected-back time ----
-- The old two-argument function is dropped first: leaving it next to the new one would make a call with
-- named arguments p_station_id and p_state ambiguous.
drop function if exists manager_post_state(text, text);

create or replace function manager_post_state(
  p_station_id text,
  p_state text,
  p_reason text default null,
  p_until timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text;
  v_until timestamptz;
begin
  if auth.uid() is null or not exists (
    select 1 from station_managers where station_id = p_station_id and user_id = auth.uid()
  ) then
    raise exception 'not authorized';
  end if;
  if p_state is null or p_state not in ('closed', 'open', 'selling') then
    raise exception 'Invalid state';
  end if;

  -- details only make sense while the station is not selling
  if p_state in ('closed', 'open') then
    v_reason := case when p_reason in ('supply', 'fault', 'power', 'other') then p_reason else null end;
    v_until := case when p_until > now() and p_until <= now() + interval '24 hours' then p_until else null end;
  end if;

  update stations
  set manager_state = p_state,
      manager_state_at = now(),
      manager_state_reason = v_reason,
      manager_state_until = v_until,
      manager_selling = (p_state = 'selling'),
      manager_selling_at = now()
  where id = p_station_id;

  insert into station_manager_posts (station_id, user_id, kind, state, selling, reason, until_at)
  values (p_station_id, auth.uid(), 'state', p_state, p_state = 'selling', v_reason, v_until);
end;
$$;

revoke all on function manager_post_state(text, text, text, timestamptz) from public, anon;
grant execute on function manager_post_state(text, text, text, timestamptz) to authenticated;
