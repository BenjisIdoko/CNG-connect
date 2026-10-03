-- CONSOLIDATED SECURITY HARDENING (audit of 2026-10-03)
--
-- Paste into Supabase dashboard -> SQL Editor -> Run. Safe to re-run.
-- Supersedes (do NOT also run): fix-is-admin-privilege-escalation.sql and
-- fix-points-gaming-and-author-spoofing.sql. Neither was ever applied to the
-- live database, which is what made items 1-3 exploitable. This file contains
-- the corrected versions of both. Run it as ONE script — section 9 locks
-- down function privileges and must come after the functions it names exist.
--
-- What this fixes
--   1. is_admin self-promotion (CRITICAL): the guard trigger was never attached.
--   2. Counter tampering: community_points / reports_count / reputation_score /
--      referral_code were directly writable by their owner.
--   3. Author/avatar spoofing on reports, comments and posts.
--   4. Server-validated, idempotent point awarding (award_report_points was
--      called by the app but did not exist, so every award silently failed).
--   5. update_station_pin dropped (unused, let any user move any station
--      anywhere); report_station_status now requires a matching recent report
--      from the caller and a bounded label.
--   6. station_media rows can only attach to the caller's own report.
--   7. Per-user submission rate limits + field-size limits.
--   8. SECURITY DEFINER functions: PUBLIC/anon EXECUTE revoked (the earlier
--      `revoke ... from anon` never removed the default PUBLIC grant).
--   9. cng_require_phone search_path pinned.
--
-- Not fixable in SQL (dashboard): turn on "Prevent use of leaked passwords"
-- (Auth -> Providers -> Email) and enable MFA for the admin account.

-- 1. Attach the is_admin guard ---------------------------------------------
-- The function already exists live (the newer version from admin-users-crud.sql,
-- which lets admin_update_profile through via app.admin_action). Only the
-- trigger was missing. Deliberately NOT re-creating the function here: the
-- original version in fix-is-admin-privilege-escalation.sql would overwrite it
-- and silently break admin promotion/demotion.

drop trigger if exists protect_profile_admin_flag_trigger on profiles;
create trigger protect_profile_admin_flag_trigger
  before insert or update on profiles
  for each row
  execute function protect_profile_admin_flag();

-- 2. Lock counters against direct writes -----------------------------------
-- SECURITY INVOKER on purpose: current_user is the role running the statement.
-- A direct PostgREST write runs as 'anon'/'authenticated'; the same write made
-- inside one of our SECURITY DEFINER functions (award_report_points,
-- my_referral_code, handle_new_auth_user) runs as the function owner, so those
-- are unaffected without needing any bypass flag.

create or replace function protect_profile_counters()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.community_points := 0;
      new.reports_count := 0;
      new.reputation_score := 5.0;
      new.referral_code := null;
    else
      new.community_points := old.community_points;
      new.reports_count := old.reports_count;
      new.reputation_score := old.reputation_score;
      new.referral_code := old.referral_code;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_counters_trigger on profiles;
create trigger protect_profile_counters_trigger
  before insert or update on profiles
  for each row
  execute function protect_profile_counters();

-- 3. Force author identity from the caller's own profile -------------------
-- Skips when there is no JWT (SQL editor / seed scripts) so admin-inserted
-- rows keep whatever author they were given.

create or replace function stamp_author_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_avatar text;
begin
  if auth.uid() is null then
    return new;
  end if;
  select name, avatar into v_name, v_avatar from profiles where id = auth.uid();
  new.author := coalesce(nullif(trim(v_name), ''), 'Anonymous Driver');
  new.author_avatar := coalesce(v_avatar, '');
  return new;
end;
$$;

drop trigger if exists stamp_author_station_reports on station_reports;
create trigger stamp_author_station_reports before insert on station_reports
  for each row execute function stamp_author_from_profile();

drop trigger if exists stamp_author_station_comments on station_comments;
create trigger stamp_author_station_comments before insert on station_comments
  for each row execute function stamp_author_from_profile();

drop trigger if exists stamp_author_post_comments on post_comments;
create trigger stamp_author_post_comments before insert on post_comments
  for each row execute function stamp_author_from_profile();

drop trigger if exists stamp_author_community_posts on community_posts;
create trigger stamp_author_community_posts before insert on community_posts
  for each row execute function stamp_author_from_profile();

-- 4. Server-validated, idempotent point awarding ---------------------------
-- Existing reports were already credited client-side, so they are marked as
-- awarded when the column is first created; otherwise every user could claim
-- points once more for each report they ever filed.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'station_reports' and column_name = 'points_awarded'
  ) then
    alter table station_reports add column points_awarded boolean not null default true;
    alter table station_reports alter column points_awarded set default false;
  end if;
end $$;

create or replace function award_report_points(p_report_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_is_photo_verified boolean;
  v_already_awarded boolean;
  v_points integer;
  v_new_points integer;
  v_new_reports_count integer;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  select user_id, is_photo_verified, points_awarded
    into v_user_id, v_is_photo_verified, v_already_awarded
    from station_reports
    where id = p_report_id;

  if not found then
    raise exception 'report not found';
  end if;
  if v_user_id is distinct from auth.uid() then
    raise exception 'not authorized';
  end if;
  if v_already_awarded then
    raise exception 'points already awarded for this report';
  end if;

  v_points := case when v_is_photo_verified then 100 else 50 end;

  update station_reports set points_awarded = true where id = p_report_id;

  update profiles
    set community_points = coalesce(community_points, 0) + v_points,
        reports_count = coalesce(reports_count, 0) + 1
    where id = auth.uid()
    returning community_points, reports_count into v_new_points, v_new_reports_count;

  return json_build_object(
    'points_awarded', v_points,
    'community_points', v_new_points,
    'reports_count', v_new_reports_count
  );
end;
$$;

-- 5. Station RPCs ----------------------------------------------------------
-- update_station_pin let any signed-in user move any station to any coordinates
-- on Earth and flag it community-verified. The app never calls it (admins use
-- admin_set_station_pin), so it is removed outright.
drop function if exists update_station_pin(text, double precision, double precision);

-- The app inserts the report first and then calls this to refresh the station's
-- headline status. Requiring a matching, recent, visible report from the caller
-- ties every status change to a rate-limited, moderatable row and stops a user
-- flipping stations they never reported on.
create or replace function report_station_status(
  p_station_id text,
  p_status text,
  p_status_label text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_status not in ('full', 'low', 'queue', 'out') then
    raise exception 'Invalid status';
  end if;

  if length(coalesce(p_status_label, '')) > 80 then
    raise exception 'Status label too long';
  end if;

  if not exists (
    select 1 from station_reports r
    where r.station_id = p_station_id
      and r.user_id = auth.uid()
      and r.status = p_status
      and r.hidden = false
      and r.created_at > now() - interval '10 minutes'
  ) then
    raise exception 'No matching recent report from you for this station';
  end if;

  update stations
     set status = p_status,
         status_label = p_status_label,
         last_updated = 'Just now'
   where id = p_station_id;

  if not found then
    raise exception 'Station not found: %', p_station_id;
  end if;
end;
$$;

-- 6. station_media: attach only to your own report -------------------------
-- Was WITH CHECK (true): any signed-in user could insert media against any
-- station/report with an arbitrary URL and is_verified flag.

drop policy if exists "Allow insert station_media" on station_media;
drop policy if exists "Allow insert own station_media" on station_media;
create policy "Allow insert own station_media" on station_media
  for insert to authenticated
  with check (
    report_id is not null
    and exists (
      select 1 from station_reports r
      where r.id = station_media.report_id and r.user_id = auth.uid()
    )
  );

-- 7. Rate limits + field sizes ---------------------------------------------
-- Counts the caller's own recent rows (SECURITY DEFINER so hidden/moderated rows
-- still count). Skipped when there is no JWT so admin scripts are unaffected.
-- Named zz_* so it fires after the stamp_user_id_* triggers.

create or replace function cng_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := tg_argv[0]::integer;
  v_window interval := (tg_argv[1] || ' minutes')::interval;
  v_count integer;
begin
  if auth.uid() is null then
    return new;
  end if;

  execute format(
    'select count(*) from public.%I where user_id = $1 and created_at > now() - $2',
    tg_table_name
  ) into v_count using auth.uid(), v_window;

  if v_count >= v_limit then
    raise exception 'Too many submissions — please wait a few minutes and try again.'
      using errcode = 'P0001', hint = 'rate_limited';
  end if;
  return new;
end;
$$;

drop trigger if exists zz_rate_limit_station_reports on station_reports;
create trigger zz_rate_limit_station_reports before insert on station_reports
  for each row execute function cng_rate_limit(20, 10);

drop trigger if exists zz_rate_limit_station_comments on station_comments;
create trigger zz_rate_limit_station_comments before insert on station_comments
  for each row execute function cng_rate_limit(30, 10);

drop trigger if exists zz_rate_limit_post_comments on post_comments;
create trigger zz_rate_limit_post_comments before insert on post_comments
  for each row execute function cng_rate_limit(30, 10);

drop trigger if exists zz_rate_limit_community_posts on community_posts;
create trigger zz_rate_limit_community_posts before insert on community_posts
  for each row execute function cng_rate_limit(10, 10);

drop trigger if exists zz_rate_limit_station_suggestions on station_suggestions;
create trigger zz_rate_limit_station_suggestions before insert on station_suggestions
  for each row execute function cng_rate_limit(10, 60);

-- Size caps. NOT VALID = enforced for new/updated rows without scanning (or
-- rejecting) existing data. Photos are stored inline as base64 data URLs and the
-- client compresses them to ~100-250 KB, so 4M characters is generous headroom.

alter table station_reports drop constraint if exists cng_len_station_reports;
alter table station_reports add constraint cng_len_station_reports check (
  length(coalesce(comment, '')) <= 1000
  and length(coalesce(status_label, '')) <= 80
  and length(coalesce(photo, '')) <= 4000000
) not valid;

alter table station_comments drop constraint if exists cng_len_station_comments;
alter table station_comments add constraint cng_len_station_comments check (
  length(coalesce(content, '')) <= 2000
) not valid;

alter table post_comments drop constraint if exists cng_len_post_comments;
alter table post_comments add constraint cng_len_post_comments check (
  length(coalesce(content, '')) <= 2000
) not valid;

alter table community_posts drop constraint if exists cng_len_community_posts;
alter table community_posts add constraint cng_len_community_posts check (
  length(coalesce(title, '')) <= 300
  and length(coalesce(content, '')) <= 10000
  and length(coalesce(image, '')) <= 4000000
) not valid;

alter table station_suggestions drop constraint if exists cng_len_station_suggestions;
alter table station_suggestions add constraint cng_len_station_suggestions check (
  length(coalesce(name, '')) <= 200
  and length(coalesce(address, '')) <= 400
  and length(coalesce(notes, '')) <= 2000
  and length(coalesce(photo, '')) <= 4000000
) not valid;

alter table station_media drop constraint if exists cng_len_station_media;
alter table station_media add constraint cng_len_station_media check (
  length(coalesce(media_url, '')) <= 4000000
) not valid;

-- analytics_events is insertable by anonymous visitors, so cap each field.
alter table analytics_events drop constraint if exists cng_len_analytics_events;
alter table analytics_events add constraint cng_len_analytics_events check (
  length(coalesce(name, '')) <= 64
  and length(coalesce(path, '')) <= 300
  and length(coalesce(session_id, '')) <= 100
  and length(coalesce(anon_id, '')) <= 100
  and length(coalesce(app_version, '')) <= 100
  and length(coalesce(props::text, '')) <= 4000
) not valid;

-- 8. Pin the one function the linter flagged for a mutable search_path ------

alter function public.cng_require_phone() set search_path = public;

-- 9. SECURITY DEFINER function privileges ----------------------------------
-- Postgres grants EXECUTE to PUBLIC by default, which is why the earlier
-- `revoke ... from anon` lines never took effect. Reset every SECURITY DEFINER
-- function in public, then re-grant only what the app actually needs:
--   * trigger functions: nobody (EXECUTE is only checked when a trigger is
--     created, not when it fires, so triggers keep working)
--   * admin_* and the signed-in-user RPCs: authenticated (each admin_* function
--     still checks is_admin itself)
--   * get_leaderboard / cng_is_admin / cng_report_hidden: anon too — the first
--     powers the public leaderboard, the other two are called from RLS policies
--     that anonymous visitors' reads of reports/media are evaluated through.
-- service_role and the dashboard (postgres) are unaffected.

do $$
declare
  r record;
begin
  for r in
    select p.proname,
           pg_get_function_identity_arguments(p.oid) as args,
           (p.prorettype = 'trigger'::regtype) as is_trigger
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prokind = 'f'
      and p.prosecdef
  loop
    execute format('revoke all on function public.%I(%s) from public, anon, authenticated', r.proname, r.args);

    if not r.is_trigger and (
      r.proname like 'admin\_%'
      or r.proname in (
        'award_report_points', 'claim_referral', 'cng_is_admin', 'cng_report_hidden',
        'get_leaderboard', 'my_managed_stations', 'my_referral_code',
        'my_referral_summary', 'report_station_status', 'toggle_post_like'
      )
    ) then
      execute format('grant execute on function public.%I(%s) to authenticated', r.proname, r.args);
    end if;

    if r.proname in ('get_leaderboard', 'cng_is_admin', 'cng_report_hidden') then
      execute format('grant execute on function public.%I(%s) to anon', r.proname, r.args);
    end if;
  end loop;
end $$;

-- Verification (run after the script; each should return what the comment says)
--
-- select tgname from pg_trigger where tgname in
--   ('protect_profile_admin_flag_trigger','protect_profile_counters_trigger');   -- 2 rows
--
-- select count(*) from pg_proc where proname = 'award_report_points';            -- 1
-- select count(*) from pg_proc where proname = 'update_station_pin';             -- 0
--
-- select proname from pg_proc p where pronamespace = 'public'::regnamespace
--   and prosecdef and has_function_privilege('anon', p.oid, 'execute');
--   -- exactly: cng_is_admin, cng_report_hidden, get_leaderboard
--
-- Smoke test in the app: sign in as a normal driver, file a report (points should
-- go up and persist after a refresh), open the leaderboard signed out, and open
-- the admin Users tab as admin.
