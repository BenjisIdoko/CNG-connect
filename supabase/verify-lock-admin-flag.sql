-- Smoke test for supabase/lock-admin-flag.sql. It installs the migration INSIDE this transaction,
-- tests it, and rolls everything back, so nothing is changed or saved by running it.
-- The last SELECT lists one row per check; every row should be PASS.

begin;

-- ---- the migration (same text as supabase/lock-admin-flag.sql) ----
-- Only SQL can make (or remove) an admin. Safe to re-run.
--
-- Before: any admin could promote or demote another user, because admin_update_profile set
-- profiles.is_admin and told the guard trigger to let it through.
-- Now: profiles.is_admin never changes through the API at all. protect_profile_admin_flag puts it back
-- for every request that comes through the API (anon or authenticated), with no exception, and
-- admin_update_profile no longer touches the column. A new admin is made the way the first one was:
--   update profiles set is_admin = true where email = '...';   -- in the Supabase SQL editor
--
-- admin_update_profile keeps its signature (including p_is_admin, now ignored) so an older app build
-- that still sends it does not get an error.

create or replace function protect_profile_admin_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is not null then
    -- The request came through the API: never trust a client-supplied is_admin value.
    if tg_op = 'INSERT' then
      new.is_admin := false;
    elsif tg_op = 'UPDATE' then
      new.is_admin := old.is_admin;
    end if;
  end if;
  return new;
end;
$$;

create or replace function admin_update_profile(
  p_user_id uuid,
  p_name text default null,
  p_phone text default null,
  p_state text default null,
  p_vehicle text default null,
  p_cng_kit text default null,
  p_is_admin boolean default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from profiles where id = auth.uid() and is_admin
  ) then
    raise exception 'not authorized';
  end if;

  update profiles set
    name = coalesce(nullif(trim(p_name), ''), name),
    phone = coalesce(nullif(trim(p_phone), ''), phone),
    state = coalesce(nullif(trim(p_state), ''), state),
    vehicle = coalesce(nullif(trim(p_vehicle), ''), vehicle),
    -- cng_kit's blank option ("Not installed yet") is a valid value, so an explicit '' sticks.
    cng_kit = coalesce(p_cng_kit, cng_kit)
    -- is_admin is deliberately not set here: p_is_admin is ignored.
  where id = p_user_id;

  if not found then
    raise exception 'no profile %', p_user_id;
  end if;
end;
$$;

-- ---- the checks ----
create temp table verify_results (step text, ok boolean, detail text);

do $$
declare
  v_admin uuid;
  v_other uuid;
  r record;
begin
  select id into v_admin from profiles where is_admin limit 1;
  -- a non-admin with a valid phone (changing a name needs one: cng_require_phone)
  select id into v_other from profiles
  where not coalesce(is_admin, false)
    and regexp_replace(coalesce(phone, ''), '\D', '', 'g') ~ '^(0|234)?[789][01][0-9]{8}$'
  limit 1;
  if v_admin is null or v_other is null then
    raise exception 'need an admin and a non-admin profile to test with';
  end if;

  -- (a) an admin promoting someone else through the RPC changes nothing
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform admin_update_profile(v_other, p_is_admin => true);
  select coalesce(is_admin, false) as flag into r from profiles where id = v_other;
  insert into verify_results values ('a: admin cannot promote another user through the RPC', r.flag is false, r.flag::text);

  -- (b) an admin cannot demote themselves through the RPC either
  perform admin_update_profile(v_admin, p_is_admin => false);
  select coalesce(is_admin, false) as flag into r from profiles where id = v_admin;
  insert into verify_results values ('b: admin cannot demote themselves through the RPC', r.flag is true, r.flag::text);

  -- (c) the RPC still applies the other profile fields
  perform admin_update_profile(v_other, p_name => 'Verify Name');
  select name into r from profiles where id = v_other;
  insert into verify_results values ('c: other profile edits still apply', r.name = 'Verify Name', coalesce(r.name, 'null'));

  -- (d) a user writing is_admin on their own row straight to the table is put back
  perform set_config('request.jwt.claims', json_build_object('sub', v_other, 'role', 'authenticated')::text, true);
  update profiles set is_admin = true where id = v_other;
  select coalesce(is_admin, false) as flag into r from profiles where id = v_other;
  insert into verify_results values ('d: a user cannot set is_admin on their own row', r.flag is false, r.flag::text);

  -- (e) a non-admin is still refused by the RPC
  begin
    perform admin_update_profile(v_other, p_name => 'x');
    insert into verify_results values ('e: a non-admin is refused by the RPC', false, 'expected an error');
  exception when others then
    insert into verify_results values ('e: a non-admin is refused by the RPC', position('not authorized' in sqlerrm) > 0, sqlerrm);
  end;

  -- (f) with no API login (direct SQL, as in the Supabase SQL editor) is_admin can still be set
  perform set_config('request.jwt.claims', '', true);
  update profiles set is_admin = true where id = v_other;
  select coalesce(is_admin, false) as flag into r from profiles where id = v_other;
  insert into verify_results values ('f: direct SQL can still make an admin', r.flag is true, r.flag::text);
end
$$;

select step, case when ok then 'PASS' else 'FAIL' end as result, detail
from verify_results
order by step;

rollback;
