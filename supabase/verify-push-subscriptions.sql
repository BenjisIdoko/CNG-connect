-- Smoke test for supabase/push-subscriptions.sql. It installs the migration INSIDE this transaction,
-- tests it, and rolls everything back, so nothing is changed or saved by running it.
-- The last SELECT lists one row per check; every row should be PASS.

begin;

-- ---- the migration (same text as supabase/push-subscriptions.sql) ----
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

-- ---- the checks ----
create temp table verify_results (step text, ok boolean, detail text);

create or replace function pg_temp.expect_error(p_step text, p_sql text, p_fragment text)
returns void
language plpgsql
as $f$
declare
  v_msg text;
begin
  begin
    execute p_sql;
    insert into verify_results values (p_step, false, 'expected an error, got none');
  exception when others then
    get stacked diagnostics v_msg = message_text;
    insert into verify_results values (p_step, position(p_fragment in v_msg) > 0, v_msg);
  end;
end
$f$;

do $$
declare
  v_u1 uuid;
  v_u2 uuid;
  v_n integer;
  r record;
begin
  select id into v_u1 from auth.users order by id limit 1;
  select id into v_u2 from auth.users where id <> v_u1 order by id limit 1;
  if v_u1 is null or v_u2 is null then
    raise exception 'need two accounts to test with';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  perform save_push_subscription('https://push.example.com/abc', 'p256dh-key', 'auth-key', 'Abuja FCT', array['s1','s2']);
  select count(*) into v_n from push_subscriptions where user_id = v_u1;
  insert into verify_results values ('a: a signed-in person registers a phone', v_n = 1, v_n::text);

  perform save_push_subscription('https://push.example.com/abc', 'p256dh-key2', 'auth-key2', 'Lagos', array['s3']);
  select * into r from push_subscriptions where endpoint = 'https://push.example.com/abc';
  insert into verify_results values ('b: saving the same phone again updates it, never duplicates',
    (select count(*) from push_subscriptions where endpoint = 'https://push.example.com/abc') = 1 and r.state = 'Lagos' and r.favorite_station_ids = array['s3'] and r.p256dh = 'p256dh-key2', coalesce(r.state, 'null'));

  perform pg_temp.expect_error('c: a non-https address is refused',
    $q$select save_push_subscription('http://push.example.com/x', 'k', 'a')$q$, 'Invalid subscription');
  perform pg_temp.expect_error('c2: missing keys are refused',
    $q$select save_push_subscription('https://push.example.com/y', '', 'a')$q$, 'Invalid subscription');
  perform pg_temp.expect_error('c3: more than 100 favourites are refused',
    format($q$select save_push_subscription('https://push.example.com/z', 'k', 'a', 'Lagos', %L::text[])$q$, (select array_agg('s' || g) from generate_series(1, 101) g)), 'Too many favourites');

  -- another person cannot remove it
  perform set_config('request.jwt.claims', json_build_object('sub', v_u2, 'role', 'authenticated')::text, true);
  perform remove_push_subscription('https://push.example.com/abc');
  select count(*) into v_n from push_subscriptions where endpoint = 'https://push.example.com/abc';
  insert into verify_results values ('d: another person cannot remove it', v_n = 1, v_n::text);

  -- the owner can
  perform set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  perform remove_push_subscription('https://push.example.com/abc');
  select count(*) into v_n from push_subscriptions where endpoint = 'https://push.example.com/abc';
  insert into verify_results values ('e: the owner can remove it', v_n = 0, v_n::text);

  -- a phone that changes account moves to the new account
  perform set_config('request.jwt.claims', json_build_object('sub', v_u2, 'role', 'authenticated')::text, true);
  perform save_push_subscription('https://push.example.com/abc', 'k', 'a', 'Lagos', '{}');
  perform set_config('request.jwt.claims', json_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  perform save_push_subscription('https://push.example.com/abc', 'k', 'a', 'Abuja FCT', '{}');
  select user_id into r from push_subscriptions where endpoint = 'https://push.example.com/abc';
  insert into verify_results values ('f: a phone that changes account moves to the new account', r.user_id = v_u1, coalesce(r.user_id::text, 'null'));

  perform set_config('request.jwt.claims', '', true);
end
$$;

insert into verify_results values (
  'g: anon cannot run either function, signed-in users can',
  not has_function_privilege('anon', 'save_push_subscription(text, text, text, text, text[])', 'execute')
  and not has_function_privilege('anon', 'remove_push_subscription(text)', 'execute')
  and has_function_privilege('authenticated', 'save_push_subscription(text, text, text, text, text[])', 'execute')
  and has_function_privilege('authenticated', 'remove_push_subscription(text)', 'execute'),
  '');

insert into verify_results values (
  'h: both tables have row security on; the log has no policy; the subscriptions table has no write policy',
  (select relrowsecurity from pg_class where oid = 'push_subscriptions'::regclass)
  and (select relrowsecurity from pg_class where oid = 'push_notification_log'::regclass)
  and not exists (select 1 from pg_policies where tablename = 'push_notification_log')
  and not exists (select 1 from pg_policies where tablename = 'push_subscriptions' and cmd in ('INSERT', 'UPDATE', 'ALL')),
  '');

insert into verify_results values (
  'i: the only read policy limits a signed-in person to their own rows',
  (select count(*) from pg_policies where tablename = 'push_subscriptions' and cmd = 'SELECT' and qual like '%user_id = auth.uid()%') = 1,
  '');

select step, case when ok then 'PASS' else 'FAIL' end as result, detail
from verify_results
order by step;

rollback;
