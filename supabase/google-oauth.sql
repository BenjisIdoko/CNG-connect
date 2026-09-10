-- Google sign-in support for CNG-Connect.
-- Run once in the Supabase dashboard: SQL Editor -> paste -> Run.
--
-- Dashboard steps (can't be done in SQL):
--   1. Google Cloud Console -> APIs & Services -> OAuth consent screen:
--        User type: External. App name, support email, developer email.
--        Authorized domains: cngconnect.com.ng  and  supabase.co
--        Scopes: .../auth/userinfo.email, .../auth/userinfo.profile, openid
--   2. APIs & Services -> Credentials -> Create OAuth client ID -> Web application:
--        Authorized redirect URI:
--          https://aomrrlxateneakvorzma.supabase.co/auth/v1/callback
--        Copy the Client ID + Client secret.
--   3. Supabase -> Authentication -> Providers -> Google -> enable,
--        paste Client ID + Client secret, Save.
--   4. Supabase -> Authentication -> URL Configuration -> Redirect URLs:
--        make sure https://cngconnect.com.ng/** (and www) are listed;
--        add http://localhost:3002/** if you want to test OAuth locally.

-- Prefill name + avatar from the Google profile so those users don't retype
-- them. OTP users have no metadata, so name stays '' and they still see the
-- "complete your profile" step (which is also gated on phone below).
create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, email, name, avatar)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
