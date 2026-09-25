-- Make a valid Nigerian phone number compulsory on the server, not just in the app.
-- Paste into Supabase dashboard -> SQL Editor -> Run. Safe to re-run.
--
-- Rule: a profile that has a name (i.e. a finished profile) must have a valid Nigerian number
-- (08031234567, 8031234567, 2348031234567 or +234 803 123 4567) whenever it is created or the
-- name/phone is changed. The empty row that sign-up creates before the profile step is allowed.
--
-- Existing accounts WITHOUT a number are not broken: server-side updates that don't touch the
-- name or phone (points, report counts, ...) still work for them. They are asked for a number
-- the next time they open the app, and can't change their name or phone to something invalid.

create or replace function cng_require_phone()
returns trigger language plpgsql as $$
declare digits text;
begin
  if coalesce(trim(new.name), '') = '' then
    return new;
  end if;

  digits := regexp_replace(coalesce(new.phone, ''), '\D', '', 'g');
  if digits ~ '^(0|234)?[789][01][0-9]{8}$' then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.phone is not distinct from old.phone
     and new.name  is not distinct from old.name then
    return new;
  end if;

  raise exception 'A valid Nigerian phone number is required' using errcode = '23514', hint = 'phone_required';
end $$;

drop trigger if exists profiles_require_phone on profiles;
create trigger profiles_require_phone
  before insert or update on profiles
  for each row execute function cng_require_phone();

-- Optional: how many existing drivers still have no phone number
--   select count(*) filter (where coalesce(trim(name), '') <> '' and regexp_replace(coalesce(phone, ''), '\D', '', 'g') !~ '^(0|234)?[789][01][0-9]{8}$') as missing_phone,
--          count(*) as total
--     from profiles;
