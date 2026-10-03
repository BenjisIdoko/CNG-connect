-- Clears the Supabase linter's "Security Definer View" finding on
-- public.public_profiles. That view ran as its owner (postgres) so it could
-- keep serving the leaderboard after `profiles` was locked down to
-- self-or-admin reads (fix-public-profile-pii-exposure.sql) — intentional and
-- PII-free, but the linter flags the pattern regardless. Making the view
-- security_invoker instead would just break the leaderboard (each driver
-- would only see their own row), so the same read moves into an explicit
-- function that returns only the safe columns — no email, no phone.
--
-- Paste into Supabase dashboard -> SQL Editor -> Run. Safe to re-run.
-- Order: run this file FIRST (the new app build calls get_leaderboard and the
-- leaderboard would come back empty without it), then deploy the app, then
-- run the final DROP VIEW below once old builds have aged out — installed
-- PWAs cache the previous bundle and keep calling the view until they update.

create or replace function get_leaderboard(p_limit int default 100)
returns table (
  id uuid,
  name text,
  avatar text,
  state text,
  vehicle text,
  community_points integer,
  reports_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name, p.avatar, p.state, p.vehicle, p.community_points, p.reports_count
  from profiles p
  order by p.community_points desc nulls last
  limit least(greatest(coalesce(p_limit, 100), 1), 100);
$$;

revoke all on function get_leaderboard(int) from public;
grant execute on function get_leaderboard(int) to anon, authenticated;

-- Run this part only once the new app build has been live for a day or two
-- (leave it commented until then):
-- drop view if exists public_profiles;
