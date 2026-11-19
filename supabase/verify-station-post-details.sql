-- Smoke test for supabase/station-post-details.sql. It installs the migration INSIDE this transaction,
-- tests it, and rolls everything back, so nothing is changed or saved by running it.
-- The last SELECT lists one row per check; every row should be PASS.

begin;

-- ---- the migration (same text as supabase/station-post-details.sql) ----
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

-- ---- the checks ----
create temp table verify_results (step text, ok boolean, detail text);

create or replace function pg_temp.expect_error(p_step text, p_sql text, p_fragment text)
returns void
language plpgsql
as $f$
declare
  v_msg text;
begin
  begin
    execute p_sql;
    insert into verify_results values (p_step, false, 'expected an error, got none');
  exception when others then
    get stacked diagnostics v_msg = message_text;
    insert into verify_results values (p_step, position(p_fragment in v_msg) > 0, v_msg);
  end;
end
$f$;

do $$
declare
  v_u1 uuid;
  s1 text;
  s2 text;
  r record;
  v_n integer;
begin
  select id into v_u1 from profiles where not coalesce(is_admin, false) order by id limit 1;
  select id into s1 from stations order by id limit 1;
  select id into s2 from stations order by id offset 1 limit 1;
  if v_u1 is null or s1 is null or s2 is null then
    raise exception 'need a non-admin profile and two stations to test with';
  end if;

  -- make v_u1 the manager of s1 only (rolled back at the end)
  delete from station_managers where user_id = v_u1;
  insert into station_managers (station_id, user_id) values (s1, v_u1);
  perform set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated', 'email', 'm@example.com')::text, true);

  -- (a) the old two-argument shape still works, positional and with named arguments
  perform manager_post_state(s1, 'open');
  select manager_state, manager_state_reason, manager_state_until into r from stations where id = s1;
  insert into verify_results values ('a: a two-argument post still works', r.manager_state = 'open' and r.manager_state_reason is null and r.manager_state_until is null, coalesce(r.manager_state, 'null'));
  perform manager_post_state(p_station_id => s1, p_state => 'closed');
  select manager_state into r from stations where id = s1;
  insert into verify_results values ('a2: named two-argument call is not ambiguous', r.manager_state = 'closed', coalesce(r.manager_state, 'null'));

  -- (b) not your station
  perform pg_temp.expect_error('b: posting for a station you do not manage is refused',
    format($q$select manager_post_state(%L, 'selling')$q$, s2), 'not authorized');
  perform pg_temp.expect_error('b2: an unknown state is refused',
    format($q$select manager_post_state(%L, 'maybe')$q$, s1), 'Invalid state');

  -- (c) reason and a future time are stored on closed
  perform manager_post_state(s1, 'closed', 'supply', now() + interval '2 hours');
  select manager_state, manager_state_reason, manager_state_until into r from stations where id = s1;
  insert into verify_results values ('c: closed keeps a reason and a future time',
    r.manager_state = 'closed' and r.manager_state_reason = 'supply' and r.manager_state_until > now() + interval '119 minutes' and r.manager_state_until < now() + interval '121 minutes',
    coalesce(r.manager_state_reason, 'null'));
  select count(*) into v_n from station_manager_posts where station_id = s1 and kind = 'state' and reason = 'supply' and until_at is not null;
  insert into verify_results values ('c2: the post log keeps them too', v_n = 1, v_n::text);

  -- (d) a past time is dropped, the reason stays
  perform manager_post_state(s1, 'open', 'power', now() - interval '5 minutes');
  select manager_state_reason, manager_state_until into r from stations where id = s1;
  insert into verify_results values ('d: a time in the past is stored as null', r.manager_state_reason = 'power' and r.manager_state_until is null, coalesce(r.manager_state_reason, 'null'));

  -- (e) more than 24 h ahead is dropped
  perform manager_post_state(s1, 'closed', 'fault', now() + interval '30 hours');
  select manager_state_reason, manager_state_until into r from stations where id = s1;
  insert into verify_results values ('e: a time 30 hours ahead is stored as null', r.manager_state_reason = 'fault' and r.manager_state_until is null, coalesce(r.manager_state_reason, 'null'));

  -- (f) an unknown reason is dropped
  perform manager_post_state(s1, 'closed', 'because', now() + interval '1 hour');
  select manager_state_reason, manager_state_until into r from stations where id = s1;
  insert into verify_results values ('f: an unknown reason is stored as null', r.manager_state_reason is null and r.manager_state_until is not null, coalesce(r.manager_state_reason, 'null'));

  -- (g) selling clears both, and the old flag follows
  perform manager_post_state(s1, 'closed', 'supply', now() + interval '2 hours');
  perform manager_post_state(s1, 'selling', 'supply', now() + interval '2 hours');
  select manager_state, manager_state_reason, manager_state_until, manager_selling into r from stations where id = s1;
  insert into verify_results values ('g: selling clears the reason and the time and sets the old flag',
    r.manager_state = 'selling' and r.manager_state_reason is null and r.manager_state_until is null and r.manager_selling is true, coalesce(r.manager_state, 'null'));
  perform manager_post_state(s1, 'closed');
  select manager_selling into r from stations where id = s1;
  insert into verify_results values ('g2: closed leaves the old flag false', r.manager_selling is false, '');

  perform set_config('request.jwt.claims', '', true);
end
$$;

insert into verify_results values (
  'h: exactly one manager_post_state, anon cannot run it, signed-in users can',
  (select count(*) from pg_proc where proname = 'manager_post_state' and pronamespace = 'public'::regnamespace) = 1
  and not has_function_privilege('anon', 'manager_post_state(text, text, text, timestamptz)', 'execute')
  and has_function_privilege('authenticated', 'manager_post_state(text, text, text, timestamptz)', 'execute'),
  '');

select step, case when ok then 'PASS' else 'FAIL' end as result, detail
from verify_results
order by step;

rollback;
