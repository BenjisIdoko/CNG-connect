-- Retire the station manager role. Safe to re-run.
--
-- Community managers (supabase/community-managers.sql) replace station managers. The station manager page
-- and its invites are gone from the app; this switches off the database functions that only that page used,
-- so the old role cannot be used by calling the API directly either.
--
-- * Only EXECUTE is revoked from signed-in users. Nothing is dropped and no row is deleted: the tables
--   station_managers and station_manager_invites keep their rows, and station_manager_posts is still the log
--   that community posts are written to.
-- * To bring any of these back:  grant execute on function <name>(<args>) to authenticated;
-- * Not touched: admin_update_station still accepts an assigned station manager for that one station's
--   details. Removing the assignment rows (delete from station_managers) closes that; it is left for the
--   admin to decide because it deletes data.

revoke execute on function manager_post_state(text, text, text, timestamptz) from authenticated;
revoke execute on function manager_post_pressure(text, integer) from authenticated;
revoke execute on function manager_post_selling(text, boolean) from authenticated;
revoke execute on function my_managed_stations() from authenticated;
revoke execute on function claim_station_manager_invites() from authenticated;
revoke execute on function admin_invite_station_manager(text, text) from authenticated;
revoke execute on function admin_cancel_station_manager_invite(text, text) from authenticated;
revoke execute on function admin_assign_station_manager(text, text) from authenticated;
revoke execute on function admin_remove_station_manager(text, text) from authenticated;
