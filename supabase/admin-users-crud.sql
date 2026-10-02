-- Lets an admin edit any driver's profile (name, phone, state, vehicle, CNG
-- kit, admin flag) and delete an account entirely, from the new Users tab.
-- Paste into Supabase dashboard -> SQL Editor -> Run. Safe to re-run.
--
-- Also run supabase/add-cng-kit-field.sql first if you haven't already —
-- the Users tab selects `cng_kit`, which errors ("column profiles.cng_kit
-- does not exist") until that migration has been applied.

-- protect_profile_admin_flag (see fix-is-admin-privilege-escalation.sql)
-- unconditionally reverts any API-originated change to is_admin, which is
-- exactly right for stopping a user from promoting themselves — but it
-- would just as silently undo an ADMIN's deliberate promotion/demotion of
-- someone else made through admin_update_profile below, since that RPC
-- still goes through the API and still shows up as auth.role() = the
-- caller's normal role. admin_update_profile sets a transaction-local flag
-- right before its own UPDATE so the trigger can tell "a verified admin,
-- via the one RPC that already checked is_admin" apart from "a client
-- writing straight to the table" — every other write path is unaffected.
create or replace function protect_profile_admin_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is not null and coalesce(current_setting('app.admin_action', true), '') <> 'true' then
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

  -- Local to this transaction only — never leaks into any other request.
  perform set_config('app.admin_action', 'true', true);

  update profiles set
    name = coalesce(nullif(trim(p_name), ''), name),
    phone = coalesce(nullif(trim(p_phone), ''), phone),
    state = coalesce(nullif(trim(p_state), ''), state),
    vehicle = coalesce(nullif(trim(p_vehicle), ''), vehicle),
    -- cng_kit's blank option ("Not installed yet") is a valid value, unlike
    -- the text fields above, so an explicit '' is allowed to stick.
    cng_kit = coalesce(p_cng_kit, cng_kit),
    is_admin = coalesce(p_is_admin, is_admin)
  where id = p_user_id;

  if not found then
    raise exception 'no profile %', p_user_id;
  end if;
end;
$$;

revoke all on function admin_update_profile(uuid, text, text, text, text, text, boolean) from anon;
grant execute on function admin_update_profile(uuid, text, text, text, text, text, boolean) to authenticated;

-- Deletes the Supabase Auth user outright (not just the profile row) —
-- profiles.id references auth.users(id) on delete cascade, so that part
-- (profile, referrals, station_managers rows) cleans up on its own. But
-- station_reports, community_posts, post_comments, station_comments, and
-- station_suggestions all reference auth.users directly with NO ACTION
-- (not CASCADE) — so without deleting those rows first, `delete from
-- auth.users` fails with a foreign-key violation for any user who has
-- ever filed a report, comment, post, or suggestion, i.e. almost anyone
-- an admin would actually want to delete. (community_posts cascades on to
-- that post's own comments/likes from other users; station_reports
-- cascades to its flags and nulls out station_media.report_id — both
-- already handled by their own FKs, no extra statements needed for those.)
-- There's no client-safe Admin API call available without a service-role
-- key, so this deletes straight from auth.users instead; the function
-- runs as its owner (postgres), which already has the privileges
-- Supabase's own dashboard uses for this.
create or replace function admin_delete_user(p_user_id uuid)
returns void
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

  if p_user_id = auth.uid() then
    raise exception 'cannot delete your own account from here';
  end if;

  delete from community_posts where user_id = p_user_id;
  delete from station_reports where user_id = p_user_id;
  delete from station_comments where user_id = p_user_id;
  delete from post_comments where user_id = p_user_id;
  delete from station_suggestions where user_id = p_user_id;

  delete from auth.users where id = p_user_id;
  if not found then
    raise exception 'no user %', p_user_id;
  end if;
end;
$$;

revoke all on function admin_delete_user(uuid) from anon;
grant execute on function admin_delete_user(uuid) to authenticated;
