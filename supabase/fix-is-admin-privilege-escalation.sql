-- CRITICAL fix: the "Allow self update profiles" RLS policy
-- (USING (auth.uid() = id) WITH CHECK (auth.uid() = id)) is a ROW-level
-- check only — Postgres RLS does not restrict which COLUMNS an allowed
-- UPDATE can touch. is_admin was added later with no column-level
-- protection, so any signed-up user could run, from their own browser
-- console, using only the public anon key and their own session:
--
--   supabase.from('profiles').update({ is_admin: true }).eq('id', myUid)
--
-- ...and immediately gain access to every admin RPC (admin_update_station,
-- admin_set_station_pin) and the ?admin=1 editor, which only check
-- profiles.is_admin — exactly the value they just set themselves.
--
-- Fix: a trigger that unconditionally resets is_admin back to its prior
-- value whenever the write comes through the public API (PostgREST sets
-- a JWT role claim — auth.role() returns 'anon'/'authenticated' — that
-- direct SQL-editor/dashboard sessions never have, so this still allows
-- promoting an admin the way it's always been done: running SQL by hand).

create or replace function protect_profile_admin_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() is not null then
    -- Request came through the API (anon or authenticated), not a direct
    -- SQL session — never trust a client-supplied is_admin value.
    if tg_op = 'INSERT' then
      new.is_admin := false;
    elsif tg_op = 'UPDATE' then
      new.is_admin := old.is_admin;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_admin_flag_trigger on profiles;
create trigger protect_profile_admin_flag_trigger
  before insert or update on profiles
  for each row
  execute function protect_profile_admin_flag();
