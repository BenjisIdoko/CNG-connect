-- Community managers can post for any station from anywhere: the 150 m rule is removed. Safe to re-run.
--
-- Replaces community_post_gas() from supabase/community-managers.sql (which now carries this same
-- definition). The signature is unchanged, so an app that still sends lat/lng works: they are accepted and
-- ignored. Still checked: the caller has the community manager role, the station exists, a choice was made,
-- and the same person cannot post the same state for the same station twice within 2 minutes. Every post is
-- still logged with who made it (station_manager_posts).

-- ---- a community manager posts the station's gas status ----
create or replace function community_post_gas(
  p_station_id text,
  p_available boolean,
  p_lat double precision default null,
  p_lng double precision default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state text;
begin
  if auth.uid() is null or not exists (select 1 from community_managers where user_id = auth.uid()) then
    raise exception 'not authorized';
  end if;
  if p_available is null then
    raise exception 'Invalid choice';
  end if;
  if not exists (select 1 from stations where id = p_station_id) then
    raise exception 'no station';
  end if;

  v_state := case when p_available then 'selling' else 'out' end;

  if exists (
    select 1 from station_manager_posts
    where station_id = p_station_id and user_id = auth.uid() and kind = 'state' and state = v_state
      and created_at > now() - interval '2 minutes'
  ) then
    raise exception 'already posted';
  end if;

  update stations
  set manager_state = v_state,
      manager_state_at = now(),
      manager_state_reason = null,
      manager_state_until = null,
      manager_selling = case when p_available then true else null end,
      manager_selling_at = case when p_available then now() else null end
  where id = p_station_id;

  insert into station_manager_posts (station_id, user_id, kind, state, selling)
  values (p_station_id, auth.uid(), 'state', v_state, p_available);
end;
$$;

revoke all on function community_post_gas(text, boolean, double precision, double precision) from public, anon;
grant execute on function community_post_gas(text, boolean, double precision, double precision) to authenticated;
