-- Smoke test for supabase/retire-station-managers.sql. It runs the migration INSIDE this transaction,
-- checks the result, and rolls everything back, so nothing is changed or saved by running it.
-- The last SELECT lists one row per check; every row should be PASS.

begin;

revoke execute on function manager_post_state(text, text, text, timestamptz) from authenticated;
revoke execute on function manager_post_pressure(text, integer) from authenticated;
revoke execute on function manager_post_selling(text, boolean) from authenticated;
revoke execute on function my_managed_stations() from authenticated;
revoke execute on function claim_station_manager_invites() from authenticated;
revoke execute on function admin_invite_station_manager(text, text) from authenticated;
revoke execute on function admin_cancel_station_manager_invite(text, text) from authenticated;
revoke execute on function admin_assign_station_manager(text, text) from authenticated;
revoke execute on function admin_remove_station_manager(text, text) from authenticated;

create temp table verify_results (step text, ok boolean, detail text);

insert into verify_results
select 'a: signed-in users can no longer run ' || f, not has_function_privilege('authenticated', f, 'execute'), ''
from unnest(array[
  'manager_post_state(text, text, text, timestamptz)',
  'manager_post_pressure(text, integer)',
  'manager_post_selling(text, boolean)',
  'my_managed_stations()',
  'claim_station_manager_invites()',
  'admin_invite_station_manager(text, text)',
  'admin_cancel_station_manager_invite(text, text)',
  'admin_assign_station_manager(text, text)',
  'admin_remove_station_manager(text, text)'
]) f;

-- what must keep working
insert into verify_results values (
  'b: the community manager functions still work for signed-in users',
  has_function_privilege('authenticated', 'community_post_gas(text, boolean, double precision, double precision)', 'execute')
  and has_function_privilege('authenticated', 'admin_set_community_manager(uuid, boolean)', 'execute')
  and has_function_privilege('authenticated', 'save_push_subscription(text, text, text, text, text[])', 'execute'),
  '');

insert into verify_results values (
  'c: the tables and their rows are still there',
  to_regclass('public.station_managers') is not null and to_regclass('public.station_manager_invites') is not null and to_regclass('public.station_manager_posts') is not null,
  '');

select step, case when ok then 'PASS' else 'FAIL' end as result, detail
from verify_results
order by step;

rollback;
