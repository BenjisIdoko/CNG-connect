-- Smoke test for station_car_counts and the presence policy. Run AFTER supabase/station-car-counts.sql.
-- One transaction, rolled back at the end: nothing is saved, including the seeded rows.
-- The last SELECT lists one row per check; every row should be PASS.
--
-- Real presence rows may exist at the stations used, so the test measures the count before it seeds
-- anything and checks the change.

begin;

create temp table verify_results (step text, ok boolean, detail text);

do $$
declare
  s1 text;
  s2 text;
  v_user uuid;
  v_a0 integer;
  v_b0 integer;
  v_a1 integer;
  v_b1 integer;
  v_anon_rows integer := 0;
  v_anon_counts integer := 0;
  v_others integer := 0;
  v_own integer := 0;
begin
  select id into s1 from stations order by id limit 1;
  select id into s2 from stations order by id offset 1 limit 1;
  select id into v_user from profiles limit 1;

  select coalesce(max(cars), 0) into v_a0 from station_car_counts() where station_id = s1;
  select coalesce(max(cars), 0) into v_b0 from station_car_counts() where station_id = s2;

  -- A trigger stamps user_key from the caller's login, so each seeded row is inserted "as" a different
  -- (made-up) user. The fifth row belongs to a real profile, used again in check (e).
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid())::text, true);
  insert into station_presence (id, station_id, user_key, entered_at, last_ping_at, expires_at)
    values ('verify-p1', s1, 'x', now(), now(), now() + interval '5 minutes');
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid())::text, true);
  insert into station_presence (id, station_id, user_key, entered_at, last_ping_at, expires_at)
    values ('verify-p2', s1, 'x', now(), now(), now() + interval '5 minutes');
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid())::text, true);
  insert into station_presence (id, station_id, user_key, entered_at, last_ping_at, expires_at)
    values ('verify-p3', s1, 'x', now() - interval '1 hour', now() - interval '1 hour', now() - interval '30 minutes');
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid())::text, true);
  insert into station_presence (id, station_id, user_key, entered_at, last_ping_at, expires_at)
    values ('verify-p4', s2, 'x', now(), now(), now() + interval '5 minutes');
  perform set_config('request.jwt.claims', json_build_object('sub', v_user)::text, true);
  insert into station_presence (id, station_id, user_key, entered_at, last_ping_at, expires_at)
    values ('verify-p5', s2, 'x', now(), now(), now() + interval '5 minutes');
  perform set_config('request.jwt.claims', '', true);

  -- (a) live rows are counted, the expired one is not
  select coalesce(max(cars), 0) into v_a1 from station_car_counts() where station_id = s1;
  select coalesce(max(cars), 0) into v_b1 from station_car_counts() where station_id = s2;
  insert into verify_results values ('a1: two live rows added, expired row ignored', v_a1 - v_a0 = 2, v_a0 || ' -> ' || v_a1);
  insert into verify_results values ('a2: second station counts its two live rows', v_b1 - v_b0 = 2, v_b0 || ' -> ' || v_b1);

  -- (b) the function exposes only the station and the number
  insert into verify_results values (
    'b: returns only station_id and cars',
    pg_get_function_result('station_car_counts()'::regprocedure) = 'TABLE(station_id text, cars integer)',
    pg_get_function_result('station_car_counts()'::regprocedure));

  -- (c) the old public read policy is gone, the own-rows policy is there
  insert into verify_results values (
    'c: public read policy replaced by an own-rows policy',
    not exists (select 1 from pg_policies where tablename = 'station_presence' and policyname = 'Allow public read station_presence')
    and exists (select 1 from pg_policies where tablename = 'station_presence' and policyname = 'Read own station_presence'),
    '');

  -- (d) an anonymous caller reads no presence rows but can still read the counts
  begin
    execute 'set local role anon';
    select count(*) into v_anon_rows from station_presence;
    select count(*) into v_anon_counts from station_car_counts();
  exception when others then
    v_anon_rows := 0; -- a permission error also means no rows were readable
  end;
  execute 'reset role';
  insert into verify_results values ('d1: anon sees zero presence rows', v_anon_rows = 0, v_anon_rows::text);
  insert into verify_results values ('d2: anon can still read the counts', v_anon_counts >= 2, v_anon_counts::text);

  -- (e) a signed-in user sees only their own rows
  perform set_config('request.jwt.claims', json_build_object('sub', v_user)::text, true);
  begin
    execute 'set local role authenticated';
    select count(*) filter (where user_key <> v_user::text), count(*) filter (where user_key = v_user::text)
      into v_others, v_own from station_presence;
  exception when others then
    v_others := -1;
  end;
  execute 'reset role';
  insert into verify_results values ('e1: a signed-in user sees nobody else''s rows', v_others = 0, v_others::text);
  insert into verify_results values ('e2: a signed-in user sees their own row', v_own >= 1, v_own::text);
end
$$;

-- (f) execute rights
insert into verify_results values (
  'f: anon and authenticated can execute the counts function',
  has_function_privilege('anon', 'station_car_counts()', 'execute')
  and has_function_privilege('authenticated', 'station_car_counts()', 'execute'),
  '');

select step, case when ok then 'PASS' else 'FAIL' end as result, detail
from verify_results
order by step;

rollback;
