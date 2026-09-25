-- CNG-Connect report moderation: drivers can flag a report, 3 distinct flags auto-hide it,
-- admins review a queue at /?moderation=1 (keep / remove / restore).
-- Paste into Supabase dashboard -> SQL Editor -> Run. Safe to re-run.

-- 0. columns first (the helper functions below read station_reports.hidden) --
alter table station_reports
  add column if not exists hidden        boolean not null default false,
  add column if not exists hidden_reason text,
  add column if not exists hidden_at     timestamptz,
  add column if not exists hidden_by     uuid;

alter table profiles add column if not exists is_admin boolean not null default false;

-- helpers -------------------------------------------------------------------
create or replace function cng_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false)
$$;
revoke all on function cng_is_admin() from public;
grant execute on function cng_is_admin() to anon, authenticated;

create or replace function cng_report_hidden(p_report_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select hidden from station_reports where id = p_report_id), false)
$$;
revoke all on function cng_report_hidden(text) from public;
grant execute on function cng_report_hidden(text) to anon, authenticated;

-- 1. hidden reports ---------------------------------------------------------

-- Hidden reports (and their photos) disappear for everyone except admins.
drop policy if exists "Allow public read station_reports" on station_reports;
create policy "Allow public read station_reports" on station_reports
  for select using (hidden = false or cng_is_admin());

drop policy if exists "Allow public read station_media" on station_media;
create policy "Allow public read station_media" on station_media
  for select using (report_id is null or not cng_report_hidden(report_id) or cng_is_admin());

-- 2. flags ------------------------------------------------------------------
create table if not exists report_flags (
  id         bigint generated always as identity primary key,
  report_id  text not null references station_reports(id) on delete cascade,
  flagged_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reason     text not null check (reason in ('wrong_status', 'spam', 'fake_photo', 'other')),
  note       text check (char_length(note) <= 300),
  resolved   boolean not null default false,
  created_at timestamptz not null default now(),
  unique (report_id, flagged_by)
);
create index if not exists report_flags_open_idx on report_flags (report_id) where not resolved;

alter table report_flags enable row level security;
revoke all on report_flags from anon, authenticated;
grant insert, select on report_flags to authenticated;

drop policy if exists "flags insert own" on report_flags;
create policy "flags insert own" on report_flags
  for insert to authenticated with check (flagged_by = auth.uid());
drop policy if exists "flags admin read" on report_flags;
create policy "flags admin read" on report_flags
  for select to authenticated using (cng_is_admin());

-- 3. station status follows the newest visible report ------------------------
create or replace function cng_recompute_station_status(p_station_id text)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select status, status_label, created_at into r
    from station_reports
   where station_id = p_station_id and not hidden
   order by created_at desc limit 1;
  if found then
    update stations
       set status = r.status,
           status_label = r.status_label,
           last_updated = to_char(r.created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
     where id = p_station_id;
  else
    update stations set status = 'unknown', status_label = 'No recent reports', last_updated = ''
     where id = p_station_id;
  end if;
end $$;
revoke all on function cng_recompute_station_status(text) from public, anon, authenticated;

-- 4. auto-hide after 3 distinct open flags -----------------------------------
create or replace function cng_flag_auto_hide()
returns trigger language plpgsql security definer set search_path = public as $$
declare n int; sid text;
begin
  select count(distinct flagged_by) into n from report_flags where report_id = new.report_id and not resolved;
  if n >= 3 then
    update station_reports
       set hidden = true, hidden_reason = 'auto: flagged by ' || n || ' drivers', hidden_at = now()
     where id = new.report_id and not hidden
    returning station_id into sid;
    if sid is not null then perform cng_recompute_station_status(sid); end if;
  end if;
  return new;
end $$;
drop trigger if exists report_flags_auto_hide on report_flags;
create trigger report_flags_auto_hide after insert on report_flags
  for each row execute function cng_flag_auto_hide();

-- 5. admin queue + actions ---------------------------------------------------
create or replace function admin_moderation_queue(p_view text default 'review')
returns table (
  report_id text, station_id text, station_name text, author text, status text, status_label text,
  comment text, photo text, verification_level text, created_at timestamptz,
  likes int, dislikes int, hidden boolean, hidden_reason text, open_flags bigint, reasons text[]
)
language plpgsql security definer set search_path = public as $$
begin
  if not cng_is_admin() then raise exception 'not authorized'; end if;
  return query
  select r.id, r.station_id, s.name, r.author, r.status, r.status_label,
         r.comment, r.photo, r.verification_level, r.created_at,
         r.likes, r.dislikes, r.hidden, r.hidden_reason,
         (select count(distinct f.flagged_by) from report_flags f where f.report_id = r.id and not f.resolved),
         (select array_agg(distinct f.reason) from report_flags f where f.report_id = r.id and not f.resolved)
    from station_reports r
    join stations s on s.id = r.station_id
   where case
           when p_view = 'hidden' then r.hidden and r.hidden_at > now() - interval '30 days'
           else not r.hidden and (r.dislikes >= 3 or exists (select 1 from report_flags f where f.report_id = r.id and not f.resolved))
         end
   order by 15 desc nulls last, r.created_at desc
   limit 40;
end $$;
revoke all on function admin_moderation_queue(text) from public, anon;
grant execute on function admin_moderation_queue(text) to authenticated;

create or replace function admin_moderate_report(p_report_id text, p_action text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare sid text;
begin
  if not cng_is_admin() then raise exception 'not authorized'; end if;

  if p_action = 'hide' then
    update station_reports
       set hidden = true, hidden_reason = coalesce(p_reason, 'removed by admin'), hidden_at = now(), hidden_by = auth.uid()
     where id = p_report_id returning station_id into sid;
    update report_flags set resolved = true where report_id = p_report_id;
  elsif p_action = 'restore' then
    update station_reports
       set hidden = false, hidden_reason = null, hidden_at = null, hidden_by = null
     where id = p_report_id returning station_id into sid;
    update report_flags set resolved = true where report_id = p_report_id;
  elsif p_action = 'keep' then
    update report_flags set resolved = true where report_id = p_report_id;
  else
    raise exception 'unknown action %', p_action;
  end if;

  if sid is not null then perform cng_recompute_station_status(sid); end if;
end $$;
revoke all on function admin_moderate_report(text, text, text) from public, anon;
grant execute on function admin_moderate_report(text, text, text) to authenticated;
