-- Smoke test for suggestion review. Run AFTER supabase/admin-review-station-suggestions.sql.
-- One transaction, rolled back at the end: nothing is saved, including the test suggestions.
-- The last SELECT lists one row per check; every row should be PASS.

begin;

create temp table verify_results (step text, ok boolean, detail text);

create function pg_temp.expect_error(p_step text, p_sql text, p_fragment text)
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
  v_admin  uuid;
  v_user   uuid;
  v_id     text;
  v_before integer;
  v_status text;
begin
  select id into v_admin from profiles where is_admin limit 1;
  select id into v_user from profiles where not coalesce(is_admin, false) limit 1;
  if v_admin is null then
    raise exception 'no admin profile to test with';
  end if;

  insert into station_suggestions (id, name, address, station_type, city, state, status) values
    ('verify-sug-1', 'Verify Approve One', '1 Test Rd', 'cng', 'Ikeja', 'Lagos', 'pending'),
    ('verify-sug-2', 'Verify Reject Two',  '2 Test Rd', 'cng', 'Ikeja', 'Lagos', 'pending'),
    ('verify-sug-3', 'Verify Stay Three',  '3 Test Rd', 'cng', 'Ikeja', 'Lagos', 'pending');

  -- (e) a non-admin is refused by both functions
  if v_user is null then
    insert into verify_results values ('e: non-admin refused', true, 'skipped: no non-admin profile');
  else
    perform set_config('request.jwt.claims', json_build_object('sub', v_user)::text, true);
    perform pg_temp.expect_error('e1: non-admin cannot approve',
      $q$select admin_create_station('Verify Nonadmin','1 Test Rd','Ikeja','Lagos',6.6,3.35,'rooftop',null,'cng',null,'verify-sug-1')$q$,
      'not authorized');
    perform pg_temp.expect_error('e2: non-admin cannot reject',
      $q$select admin_reject_station_suggestion('verify-sug-1')$q$, 'not authorized');
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);
  select count(*) into v_before from stations;

  -- (a) approving creates the station and marks the suggestion approved
  v_id := admin_create_station('Verify Approve One', '1 Test Rd', 'Ikeja', 'Lagos', 6.6, 3.35, 'rooftop', null, 'cng', null, 'verify-sug-1');
  select status into v_status from station_suggestions where id = 'verify-sug-1';
  insert into verify_results values (
    'a: approve creates a station and marks the suggestion approved',
    v_status = 'approved' and exists (select 1 from stations where id = v_id) and (select count(*) from stations) = v_before + 1,
    coalesce(v_id, 'null'));

  -- (b) approving it again is refused (with a different name, so it is the suggestion check that fires)
  perform pg_temp.expect_error('b1: second approval refused',
    $q$select admin_create_station('Verify Approve One Again','1 Test Rd','Ikeja','Lagos',6.6,3.35,'rooftop',null,'cng',null,'verify-sug-1')$q$,
    'suggestion already reviewed');
  insert into verify_results values (
    'b2: no second station was created',
    (select count(*) from stations) = v_before + 1, '');

  -- (c) rejecting an approved suggestion is refused
  perform pg_temp.expect_error('c: reject after approve refused',
    $q$select admin_reject_station_suggestion('verify-sug-1')$q$, 'suggestion already reviewed');

  -- (d) rejecting a pending one works, and approving it afterwards is refused
  perform admin_reject_station_suggestion('verify-sug-2');
  select status into v_status from station_suggestions where id = 'verify-sug-2';
  insert into verify_results values ('d1: reject marks the suggestion rejected', v_status = 'rejected', coalesce(v_status, 'null'));
  perform pg_temp.expect_error('d2: approve after reject refused',
    $q$select admin_create_station('Verify Reject Two','2 Test Rd','Ikeja','Lagos',6.6,3.35,'rooftop',null,'cng',null,'verify-sug-2')$q$,
    'suggestion already reviewed');

  -- (f) an unknown suggestion id is refused by both functions
  perform pg_temp.expect_error('f1: unknown suggestion refused (approve)',
    $q$select admin_create_station('Verify Unknown','1 Test Rd','Ikeja','Lagos',6.6,3.35,'rooftop',null,'cng',null,'no-such-suggestion')$q$,
    'suggestion not found');
  perform pg_temp.expect_error('f2: unknown suggestion refused (reject)',
    $q$select admin_reject_station_suggestion('no-such-suggestion')$q$, 'suggestion not found');

  -- (g) a failed create leaves the suggestion pending
  perform pg_temp.expect_error('g1: bad position refused',
    $q$select admin_create_station('Verify Stay Three','3 Test Rd','Ikeja','Lagos',0,0,'rooftop',null,'cng',null,'verify-sug-3')$q$,
    'outside Nigeria');
  select status into v_status from station_suggestions where id = 'verify-sug-3';
  insert into verify_results values ('g2: suggestion still pending after a failed create', v_status = 'pending', coalesce(v_status, 'null'));

  -- (j) creating without a suggestion still works (phase 1 callers are unaffected)
  v_id := admin_create_station('Verify Plain Create', '4 Test Rd', 'Ikeja', 'Lagos', 6.6, 3.35, 'street');
  insert into verify_results values ('j: create without a suggestion still works', v_id like 'admin-verify-plain-create-%', coalesce(v_id, 'null'));
end
$$;

-- (h) grants, and only one admin_create_station is left
insert into verify_results values (
  'h1: anon cannot execute either function, authenticated can',
  not has_function_privilege('anon', 'admin_create_station(text,text,text,text,double precision,double precision,text,text,text,text,text)', 'execute')
  and not has_function_privilege('anon', 'admin_reject_station_suggestion(text)', 'execute')
  and has_function_privilege('authenticated', 'admin_create_station(text,text,text,text,double precision,double precision,text,text,text,text,text)', 'execute')
  and has_function_privilege('authenticated', 'admin_reject_station_suggestion(text)', 'execute'),
  '');
insert into verify_results values (
  'h2: the old 10-argument version is gone',
  to_regprocedure('admin_create_station(text,text,text,text,double precision,double precision,text,text,text,text)') is null,
  '');

select step, case when ok then 'PASS' else 'FAIL' end as result, detail
from verify_results
order by step;

rollback;
