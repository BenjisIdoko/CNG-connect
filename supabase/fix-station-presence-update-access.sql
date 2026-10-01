-- SECURITY FIX: "Allow update station_presence" was USING (true) — any
-- signed-in driver could UPDATE *any* row in station_presence, not just
-- their own. station_presence is also publicly SELECT-able, so a row's `id`
-- isn't a secret an attacker would need to guess: anyone can
-- GET /station_presence?station_id=eq.X to learn every active row's id,
-- then PATCH /station_presence?id=eq.<victim-id> to hijack it — reassigning
-- it to themselves (the stamp_user_key_from_auth trigger only fixes which
-- user_key gets written, not which row the UPDATE is allowed to target) or
-- corrupting another driver's live presence entry (station_id, expires_at).
--
-- The app's own write path (apiService.pingStationPresence) always upserts
-- on the (station_id, user_key) unique constraint, which only ever matches
-- the caller's own existing row — so restricting UPDATE to the owning row
-- doesn't change any legitimate behavior.
--
-- Paste into Supabase dashboard -> SQL Editor -> Run. Safe to re-run.

drop policy if exists "Allow update station_presence" on station_presence;
create policy "Allow update own station_presence" on station_presence
  for update to authenticated
  using (user_key = auth.uid()::text)
  with check (user_key = auth.uid()::text);
