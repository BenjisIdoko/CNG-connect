-- CNG-Connect product analytics (first-party, anonymous).
-- Paste into Supabase dashboard -> SQL Editor -> Run. Safe to re-run.
--
-- * The app can only INSERT events (no reads). Only you (dashboard / service role) can query them.
-- * No names, emails, phone numbers or coordinates are ever stored — just an anonymous id.
-- * Time zone for the daily views is Africa/Lagos.

create table if not exists analytics_events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  name        text  not null check (char_length(name) <= 64),
  props       jsonb not null default '{}'::jsonb check (octet_length(props::text) <= 2000),
  anon_id     text  not null check (char_length(anon_id) <= 64),
  user_id     uuid,
  session_id  text  not null check (char_length(session_id) <= 64),
  path        text  check (char_length(path) <= 200),
  app_version text  check (char_length(app_version) <= 32),
  standalone  boolean not null default false
);

create index if not exists analytics_events_created_idx on analytics_events (created_at);
create index if not exists analytics_events_name_idx    on analytics_events (name, created_at);
create index if not exists analytics_events_anon_idx    on analytics_events (anon_id, created_at);

alter table analytics_events enable row level security;

revoke all on analytics_events from anon, authenticated;
grant insert on analytics_events to anon, authenticated;

drop policy if exists "analytics insert only" on analytics_events;
create policy "analytics insert only" on analytics_events
  for insert to anon, authenticated with check (true);

-- ---------------------------------------------------------------------------
-- KPI views (owner-only: clients cannot read them)
-- ---------------------------------------------------------------------------

-- Daily: active users, new users, reports, logins, directions, installs, errors
create or replace view v_kpi_daily as
select e.day,
       count(distinct e.anon_id)                                                        as active_users,
       count(distinct e.anon_id) filter (where e.name = 'app_open'
             and coalesce((e.props->>'returning')::boolean, true) = false)              as new_users,
       count(*) filter (where e.name = 'report_submitted')                              as reports,
       count(distinct e.anon_id) filter (where e.name = 'report_submitted')             as reporters,
       count(*) filter (where e.name = 'login_verified')                                as logins,
       count(*) filter (where e.name = 'directions_clicked')                            as directions,
       count(*) filter (where e.name in ('app_installed', 'install_prompt_accepted'))   as installs,
       count(*) filter (where e.name = 'js_error')                                      as js_errors
  from (select (created_at at time zone 'Africa/Lagos')::date as day, name, anon_id, props
          from analytics_events) e
 group by e.day
 order by e.day desc;

-- Reporting funnel (distinct drivers per step, per day)
create or replace view v_kpi_report_funnel as
select e.day,
       count(distinct e.anon_id) filter (where e.name = 'station_viewed')       as viewed_station,
       count(distinct e.anon_id) filter (where e.name = 'report_started')       as started_report,
       count(distinct e.anon_id) filter (where e.name = 'report_submitted')     as submitted_report,
       count(distinct e.anon_id) filter (where e.name = 'followup_prompt_shown') as shown_followup,
       count(distinct e.anon_id) filter (where e.name = 'report_submitted'
             and e.props->>'source' = 'followup')                               as reported_via_followup,
       count(distinct e.anon_id) filter (where e.name = 'report_submitted'
             and e.props->>'source' = 'arrival')                                as reported_via_arrival
  from (select (created_at at time zone 'Africa/Lagos')::date as day, name, anon_id, props
          from analytics_events) e
 group by e.day
 order by e.day desc;

-- Weekly retention by first-seen cohort
create or replace view v_kpi_retention as
with u as (
  select anon_id, date_trunc('week', created_at at time zone 'Africa/Lagos')::date as wk
    from analytics_events group by 1, 2
), f as (
  select anon_id, min(wk) as cohort from u group by 1
), sizes as (
  select cohort, count(*) as cohort_size from f group by 1
), j as (
  select f.cohort, ((u.wk - f.cohort) / 7) as weeks_since, count(distinct u.anon_id) as users
    from f join u using (anon_id) group by 1, 2
)
select j.cohort, j.weeks_since, j.users, s.cohort_size,
       round(100.0 * j.users / s.cohort_size, 1) as retention_pct
  from j join sizes s using (cohort)
 order by j.cohort desc, j.weeks_since;

-- Data freshness: how many stations have a report in the last 24 h / 7 days
create or replace view v_kpi_station_freshness as
select count(*)                                                        as stations,
       count(*) filter (where last_report >= now() - interval '24 hours') as fresh_24h,
       count(*) filter (where last_report >= now() - interval '7 days')   as fresh_7d,
       round(100.0 * count(*) filter (where last_report >= now() - interval '24 hours')
             / nullif(count(*), 0), 1)                                 as pct_fresh_24h,
       round(100.0 * count(*) filter (where last_report >= now() - interval '7 days')
             / nullif(count(*), 0), 1)                                 as pct_fresh_7d
  from (select s.id, (select max(r.created_at) from station_reports r where r.station_id = s.id) as last_report
          from stations s) x;

revoke all on v_kpi_daily, v_kpi_report_funnel, v_kpi_retention, v_kpi_station_freshness from anon, authenticated;

-- Try them:
--   select * from v_kpi_daily limit 14;
--   select * from v_kpi_report_funnel limit 14;
--   select * from v_kpi_retention;
--   select * from v_kpi_station_freshness;
