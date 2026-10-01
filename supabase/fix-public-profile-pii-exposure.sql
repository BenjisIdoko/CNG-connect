-- SECURITY FIX: `profiles` has been readable by literally anyone (even
-- unauthenticated clients) since the original schema — "Allow public read
-- profiles" is USING (true), with no auth check at all. That means every
-- driver's email and phone number is scrapeable today via a plain REST call
-- with only the public anon key:
--
--   GET {SUPABASE_URL}/rest/v1/profiles?select=name,email,phone
--
-- The only legitimate PUBLIC read of other drivers' profiles is the
-- leaderboard (src/services/apiService.ts fetchLeaderboard), which only
-- ever needs name/avatar/state/vehicle/points/reports — never email or
-- phone. Everything else that reads someone else's profile (the admin
-- Users tab, the station-manager-assignment lookup in
-- FullStationEditorModal) is already gated behind `isAdmin` client-side and
-- will keep working here via the `cng_is_admin()` check below. A driver's
-- own profile (including their own email/phone) is unaffected — they still
-- read/write their own row via `auth.uid() = id`, same as before.
--
-- Paste into Supabase dashboard -> SQL Editor -> Run. Safe to re-run.
-- Requires supabase/moderation.sql to already be applied (defines
-- cng_is_admin()) — this app already depends on that for other admin
-- features, so it should already be in place.

drop policy if exists "Allow public read profiles" on profiles;
create policy "Allow self or admin read profiles" on profiles
  for select using (auth.uid() = id or cng_is_admin());

-- Safe, genuinely-public subset of a profile for the leaderboard and any
-- other driver-facing "who else is doing this" UI — no email, no phone.
-- Runs with the view owner's privileges (Postgres views are
-- security-invoker=false by default), so it's unaffected by the tighter
-- policy above and stays readable by anon/authenticated regardless.
create or replace view public_profiles as
  select id, name, avatar, state, vehicle, community_points, reports_count, reputation_score
  from profiles;

grant select on public_profiles to anon, authenticated;
