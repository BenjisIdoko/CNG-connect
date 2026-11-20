-- Smoke test for supabase/manager-claim-verified-email.sql. It installs the migration INSIDE this
-- transaction, tests it, and rolls everything back, so nothing is changed or saved by running it.
-- The last SELECT lists one row per check; every row should be PASS.

begin;

-- ---- the migration (same text as supabase/manager-claim-verified-email.sql) ----
-- An invite to manage a station is claimed only by an account whose email address has been verified.
-- Safe to re-run.
--
-- claim_station_manager_invites() turns invites addressed to the signed-in person's email into real
-- station_managers rows. It read the email from the sign-in token without checking that the person had
-- proved they own it. Managers can now also sign in with a password, so the claim must not rely on how
-- the person signed in: it now requires auth.users.email_confirmed_at to be set. An unverified account
-- claims nothing (returns 0) and the invite stays waiting.

create or replace function claim_station_manager_invites()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;
  if not exists (
    select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null
  ) then
    return 0;
  end if;
  v_email := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  if v_email = '' then
    return 0;
  end if;

  with claimed as (
    delete from station_manager_invites where email = v_email returning station_id
  ), assigned as (
    insert into station_managers (station_id, user_id)
    select station_id, auth.uid() from claimed
    on conflict (station_id, user_id) do nothing
    returning 1
  )
  select count(*) into v_count from claimed;

  return coalesce(v_count, 0);
end;
$$;

revoke all on function claim_station_manager_invites() from public, anon;
grant execute on function claim_station_manager_invites() to authenticated;

-- ---- the checks ----
create temp table verify_results (step text, ok boolean, detail text);

do $$
declare
  v_u1 uuid;
  v_u2 uuid;
  v_e1 text;
  s1 text;
  v_n integer;
begin
  select u.id, lower(u.email) into v_u1, v_e1 from auth.users u
    join profiles p on p.id = u.id where not coalesce(p.is_admin, false) and coalesce(u.email, '') <> '' and u.email_confirmed_at is not null order by u.id limit 1;
  select u.id into v_u2 from auth.users u
    join profiles p on p.id = u.id where not coalesce(p.is_admin, false) and u.id <> v_u1 and u.email_confirmed_at is not null order by u.id limit 1;
  select id into s1 from stations order by id limit 1;
  if v_u1 is null or v_u2 is null or s1 is null then
    raise exception 'need two confirmed non-admin accounts and a station to test with';
  end if;

  delete from station_managers where user_id in (v_u1, v_u2);
  delete from station_manager_invites where email = v_e1;
  insert into station_manager_invites (station_id, email) values (s1, v_e1);

  -- (c) another confirmed person claims nothing and the invite stays
  perform set_config('request.jwt.claims', json_build_object('sub', v_u2, 'role', 'authenticated', 'email', 'someone.else@example.com')::text, true);
  v_n := claim_station_manager_invites();
  insert into verify_results values ('c: a different email claims nothing and the invite stays',
    v_n = 0 and exists (select 1 from station_manager_invites where station_id = s1 and email = v_e1), v_n::text);

  -- (b) the invited email on an UNVERIFIED account claims nothing
  update auth.users set email_confirmed_at = null where id = v_u1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated', 'email', v_e1)::text, true);
  v_n := claim_station_manager_invites();
  insert into verify_results values ('b: an unverified account claims nothing and the invite stays',
    v_n = 0 and exists (select 1 from station_manager_invites where station_id = s1 and email = v_e1)
    and not exists (select 1 from station_managers where user_id = v_u1), v_n::text);

  -- (a) once verified, the same person claims it
  update auth.users set email_confirmed_at = now() where id = v_u1;
  v_n := claim_station_manager_invites();
  insert into verify_results values ('a: a verified account claims its invite',
    v_n = 1 and exists (select 1 from station_managers where station_id = s1 and user_id = v_u1)
    and not exists (select 1 from station_manager_invites where station_id = s1 and email = v_e1), v_n::text);

  -- claiming again changes nothing
  v_n := claim_station_manager_invites();
  insert into verify_results values ('a2: claiming again returns 0', v_n = 0, v_n::text);

  perform set_config('request.jwt.claims', '', true);
end
$$;

insert into verify_results values (
  'd: anon cannot run it, signed-in users can',
  not has_function_privilege('anon', 'claim_station_manager_invites()', 'execute')
  and has_function_privilege('authenticated', 'claim_station_manager_invites()', 'execute'),
  '');

select step, case when ok then 'PASS' else 'FAIL' end as result, detail
from verify_results
order by step;

rollback;
