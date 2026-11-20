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
