-- Two fixes from the security audit, both scoped to change nothing about
-- how the app behaves for a legitimate user — only what a client can get
-- away with by talking to Supabase directly instead of through the app.
--
-- 1. Author/avatar spoofing: station_reports/station_comments/post_comments/
--    community_posts INSERT policies are `WITH CHECK (true)` — the client
--    sends `author`/`author_avatar` as plain strings, so anyone could insert
--    a report or comment that LOOKS like it came from another driver. Every
--    legitimate call site already sends the current user's own name/avatar
--    (verified by grepping every `author:` call site in the app), so this
--    trigger just makes that the only possible outcome, following the exact
--    pattern already used for `stamp_user_id()` below it in schema.sql.
--
-- 2. Points/reputation gaming: community_points/reports_count are plain
--    columns on `profiles`, writable by the row's own owner (the "Allow self
--    update profiles" RLS policy is row-level only). The app computes the
--    new total client-side and writes it directly, so a user can set their
--    own points to anything. Moves the increment into a SECURITY DEFINER
--    RPC that reads the report's own (already-inserted) is_photo_verified
--    value rather than trusting a fresh client-supplied one, and is
--    idempotent per report_id so the RPC itself can't be farmed by calling
--    it repeatedly for one real report.

-- 1. Force author identity from the caller's own profile ------------------

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

-- 2. Server-validated, idempotent point awarding ---------------------------

alter table station_reports add column if not exists points_awarded boolean not null default false;

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

revoke all on function award_report_points(text) from anon;
grant execute on function award_report_points(text) to authenticated;
