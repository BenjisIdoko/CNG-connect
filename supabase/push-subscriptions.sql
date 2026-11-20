-- Push notifications for community manager posts: where each opted-in phone is registered. Safe to re-run.
--
-- * push_subscriptions holds one row per registered phone/browser: the push service address (endpoint) and
--   its two keys, the driver's state, and the stations they favourited. A person can read and delete only
--   their own rows. Rows are written only by save_push_subscription(), which checks the input.
-- * The server function that sends notifications reads this table with the service role (it bypasses row
--   security). No policy lets anyone read other people's rows.
-- * push_notification_log remembers the last notification per station (to avoid repeats and floods). It is
--   used only by the server function (service role); row security is on and there is no policy.
-- * Nothing here touches reports, points, flags or stations.

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  state text,
  favorite_station_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_state_idx on push_subscriptions (state);
create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

drop policy if exists "read own push subscriptions" on push_subscriptions;
create policy "read own push subscriptions" on push_subscriptions
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "delete own push subscriptions" on push_subscriptions;
create policy "delete own push subscriptions" on push_subscriptions
  for delete to authenticated
  using (user_id = auth.uid());

-- No insert/update policy on purpose: rows are written only by save_push_subscription().

create table if not exists push_notification_log (
  id uuid primary key default gen_random_uuid(),
  station_id text not null,
  state text not null,
  recipients integer not null default 0,
  sent_at timestamptz not null default now()
);

create index if not exists push_notification_log_station_idx on push_notification_log (station_id, sent_at desc);

alter table push_notification_log enable row level security;
-- No policies: only the service role (the server function) reads or writes this table.

-- ---- register (or update) the caller's phone ----
create or replace function save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_state text default null,
  p_favorites text[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_favorites text[] := coalesce(p_favorites, '{}');
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;
  if p_endpoint is null or p_endpoint !~ '^https://' or length(p_endpoint) > 2000 then
    raise exception 'Invalid subscription';
  end if;
  if coalesce(p_p256dh, '') = '' or length(p_p256dh) > 200 or coalesce(p_auth, '') = '' or length(p_auth) > 200 then
    raise exception 'Invalid subscription';
  end if;
  if cardinality(v_favorites) > 100 then
    raise exception 'Too many favourites';
  end if;

  -- A phone that changes account is re-assigned to the new account: the endpoint is the phone itself.
  insert into push_subscriptions (user_id, endpoint, p256dh, auth, state, favorite_station_ids)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, nullif(left(trim(coalesce(p_state, '')), 80), ''), v_favorites)
  on conflict (endpoint) do update
    set user_id = auth.uid(),
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        state = excluded.state,
        favorite_station_ids = excluded.favorite_station_ids,
        updated_at = now();
end;
$$;

-- ---- stop notifications for this phone ----
create or replace function remove_push_subscription(p_endpoint text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;
  delete from push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
end;
$$;

revoke all on function save_push_subscription(text, text, text, text, text[]) from public, anon;
revoke all on function remove_push_subscription(text) from public, anon;
grant execute on function save_push_subscription(text, text, text, text, text[]) to authenticated;
grant execute on function remove_push_subscription(text) to authenticated;

-- ---- the sender claims the right to notify a station, atomically ----
-- Called only by the server function (service role). Under a lock per station it checks the last
-- notification and, if the station may be notified now, records the new one and returns its id; otherwise
-- it returns null. Rules: at most one notification per station every 15 minutes, and the same status is not
-- repeated within 6 hours. Doing the check and the insert together stops two simultaneous requests from
-- both sending.
create or replace function claim_push_slot(p_station_id text, p_state text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last record;
  v_id uuid;
begin
  if coalesce(p_station_id, '') = '' or p_state is null or p_state not in ('selling', 'out') then
    raise exception 'Invalid request';
  end if;

  perform pg_advisory_xact_lock(hashtext('push:' || p_station_id));

  select state, sent_at into v_last
  from push_notification_log
  where station_id = p_station_id
  order by sent_at desc
  limit 1;

  if found then
    if v_last.sent_at > now() - interval '15 minutes' then
      return null;
    end if;
    if v_last.state = p_state and v_last.sent_at > now() - interval '6 hours' then
      return null;
    end if;
  end if;

  insert into push_notification_log (station_id, state, recipients)
  values (p_station_id, p_state, 0)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function claim_push_slot(text, text) from public, anon, authenticated;
grant execute on function claim_push_slot(text, text) to service_role;
