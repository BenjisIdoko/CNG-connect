-- Station manager signals. Safe to re-run.
--
-- A station's own staff (an admin assigns them in station_managers) can tell drivers two things:
--   * "Selling now" / "Not selling"   -> stations.manager_selling + manager_selling_at
--   * the pump pressure in bar        -> stations.live_pressure_bar + live_pressure_at
-- These are NOT driver reports: nothing here touches stations.status, station_reports, points or flags.
-- Only the two functions below write the columns, and each one checks that the caller manages that
-- station. Times come from the database clock. Every post is also appended to station_manager_posts
-- so a false claim can be reviewed later.

alter table stations add column if not exists manager_selling boolean;
alter table stations add column if not exists manager_selling_at timestamptz;
alter table stations add column if not exists live_pressure_bar integer;
alter table stations add column if not exists live_pressure_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'stations'::regclass and conname = 'stations_live_pressure_bar_range'
  ) then
    alter table stations
      add constraint stations_live_pressure_bar_range
      check (live_pressure_bar is null or live_pressure_bar between 10 and 300);
  end if;
end $$;

create table if not exists station_manager_posts (
  id uuid primary key default gen_random_uuid(),
  station_id text not null references stations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('selling', 'pressure')),
  selling boolean,
  pressure_bar integer,
  created_at timestamptz not null default now()
);

create index if not exists station_manager_posts_station_idx
  on station_manager_posts (station_id, created_at desc);

alter table station_manager_posts enable row level security;

drop policy if exists "admins read manager posts" on station_manager_posts;
create policy "admins read manager posts" on station_manager_posts
  for select to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and is_admin));

-- No insert/update/delete policy on purpose: rows are written only by the functions below.

create or replace function manager_post_selling(p_station_id text, p_selling boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from station_managers where station_id = p_station_id and user_id = auth.uid()
  ) then
    raise exception 'not authorized';
  end if;
  if p_selling is null then
    raise exception 'Invalid selling status';
  end if;

  update stations
  set manager_selling = p_selling,
      manager_selling_at = now()
  where id = p_station_id;

  insert into station_manager_posts (station_id, user_id, kind, selling)
  values (p_station_id, auth.uid(), 'selling', p_selling);
end;
$$;

create or replace function manager_post_pressure(p_station_id text, p_bar integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from station_managers where station_id = p_station_id and user_id = auth.uid()
  ) then
    raise exception 'not authorized';
  end if;
  if p_bar is null or p_bar < 10 or p_bar > 300 then
    raise exception 'Invalid pressure';
  end if;

  update stations
  set live_pressure_bar = p_bar,
      live_pressure_at = now()
  where id = p_station_id;

  insert into station_manager_posts (station_id, user_id, kind, pressure_bar)
  values (p_station_id, auth.uid(), 'pressure', p_bar);
end;
$$;

revoke all on function manager_post_selling(text, boolean) from public, anon;
revoke all on function manager_post_pressure(text, integer) from public, anon;
grant execute on function manager_post_selling(text, boolean) to authenticated;
grant execute on function manager_post_pressure(text, integer) to authenticated;
