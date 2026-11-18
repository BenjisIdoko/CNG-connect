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
