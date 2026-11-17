-- Smoke test for admin_create_station. Run AFTER supabase/admin-create-station.sql.
-- Everything happens inside one transaction that is rolled back at the end, so nothing is
-- saved. The last SELECT lists one row per check; every row should have ok = true.
--
-- Callers are impersonated by setting the JWT claims (auth.uid() reads them). That tests the
-- function's own checks; the grants are checked separately at the bottom.

begin;

create temp table verify_results (step text, ok boolean, detail text);

-- Runs one statement and passes only if it raises an error containing p_fragment.
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
  v_admin uuid;
  v_user  uuid;
  v_id    text;
  r       record;
begin
  select id into v_admin from profiles where is_admin limit 1;
  select id into v_user from profiles where not coalesce(is_admin, false) limit 1;
  if v_admin is null then
    raise exception 'no admin profile to test with';
  end if;

  -- (a) a non-admin is refused
  if v_user is null then
    insert into verify_results values ('a: non-admin refused', true, 'skipped: no non-admin profile');
  else
    perform set_config('request.jwt.claims', json_build_object('sub', v_user)::text, true);
    perform pg_temp.expect_error(
      'a: non-admin refused',
      $q$select admin_create_station('Verify Nonadmin','1 Test Rd','Ikeja','Lagos',6.6,3.35,'rooftop')$q$,
      'not authorized');
  end if;

  -- no login at all is refused too
  perform set_config('request.jwt.claims', '', true);
  perform pg_temp.expect_error(
    'a2: signed-out caller refused',
    $q$select admin_create_station('Verify Signedout','1 Test Rd','Ikeja','Lagos',6.6,3.35,'rooftop')$q$,
    'not authorized');

  -- from here on, act as the admin
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);

  -- (b) a valid call returns an admin- id and the row has the defaults
  v_id := admin_create_station('  NIPCO Ikeja Verify ', '1 Test Rd', 'Ikeja', 'Lagos', 6.6, 3.35, 'rooftop', 'NIPCO');
  select * into r from stations where id = v_id;
  insert into verify_results values (
    'b: valid call creates a station with defaults',
    v_id like 'admin-nipco-ikeja-verify-%'
      and r.name = 'NIPCO Ikeja Verify'
      and r.status = 'unknown' and r.status_label = 'No recent reports'
      and r.is_picng_accredited = false and r.verified_by_community = false
      and r.data_source = 'Admin added'
      and r.created_by = v_admin::text
      and r.station_type = 'cng'
      and r.location_precision = 'rooftop' and r.accuracy_radius_m = 30
      and r.needs_pin_review = false,
    coalesce(v_id, 'null'));

  -- (c) positions outside Nigeria, or missing, are refused
  perform pg_temp.expect_error('c1: lat 0 / lng 0 refused',
    $q$select admin_create_station('Verify Zero','1 Test Rd','Ikeja','Lagos',0,0,'rooftop')$q$, 'outside Nigeria');
  perform pg_temp.expect_error('c2: missing position refused',
    $q$select admin_create_station('Verify Nopos','1 Test Rd','Ikeja','Lagos',null,null,'rooftop')$q$, 'outside Nigeria');

  -- (d) a blank name and an over-long name are refused
  perform pg_temp.expect_error('d1: blank name refused',
    $q$select admin_create_station('   ','1 Test Rd','Ikeja','Lagos',6.6,3.35,'rooftop')$q$, 'name is required');
  perform pg_temp.expect_error('d2: 121-character name refused',
    format($q$select admin_create_station(%L,'1 Test Rd','Ikeja','Lagos',6.6,3.35,'rooftop')$q$, repeat('a', 121)),
    'name is required');

  -- (e) the same name respelled is refused
  perform pg_temp.expect_error('e: respelled duplicate name refused',
    $q$select admin_create_station('N.I.P.C.O - ikeja verify!','2 Test Rd','Ikeja','Lagos',6.61,3.36,'rooftop')$q$,
    'already exists');

  -- (f) an unknown accuracy tier is refused
  perform pg_temp.expect_error('f: bad precision refused',
    $q$select admin_create_station('Verify Tier','1 Test Rd','Ikeja','Lagos',6.6,3.35,'exact')$q$, 'bad precision');

  -- (g) the city tier is flagged for pin review with a 4 km radius
  v_id := admin_create_station('City Tier Verify', '1 Test Rd', 'Ikeja', 'Lagos', 6.6, 3.35, 'city');
  select * into r from stations where id = v_id;
  insert into verify_results values (
    'g: city tier needs pin review',
    r.needs_pin_review = true and r.accuracy_radius_m = 4000,
    coalesce(v_id, 'null'));

  -- (h) required text fields and station type
  perform pg_temp.expect_error('h1: missing address refused',
    $q$select admin_create_station('Verify Addr','','Ikeja','Lagos',6.6,3.35,'rooftop')$q$, 'address is required');
  perform pg_temp.expect_error('h2: bad station type refused',
    $q$select admin_create_station('Verify Type','1 Test Rd','Ikeja','Lagos',6.6,3.35,'rooftop',null,'petrol')$q$, 'bad station type');
end
$$;

-- (i) only signed-in users can call it at all
insert into verify_results values (
  'i: anon cannot execute, authenticated can',
  not has_function_privilege('anon',
        'admin_create_station(text,text,text,text,double precision,double precision,text,text,text,text)', 'execute')
  and has_function_privilege('authenticated',
        'admin_create_station(text,text,text,text,double precision,double precision,text,text,text,text)', 'execute'),
  '');

select step, case when ok then 'PASS' else 'FAIL' end as result, detail
from verify_results
order by step;

rollback;
