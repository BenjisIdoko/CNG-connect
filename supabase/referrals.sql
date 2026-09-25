-- CNG-Connect "share the app, earn N500 airtime" promo.
-- Paste into Supabase dashboard -> SQL Editor -> Run. Safe to re-run.
-- Needs supabase/moderation.sql to have been run first (uses cng_is_admin()).
--
-- Rules (all enforced here, not in the app):
--   * every driver gets a personal code (shared as a ?ref=CODE link)
--   * a friend who joins through it becomes a 'pending' referral
--   * it becomes 'qualified' (N500 owed) when that friend files their first station report
--   * max 10 qualified referrals per driver (N5,000)
--   * rejected: same phone number as the referrer, a phone number already rewarded, or over the cap
--   * you pay the airtime by hand and mark it paid at /?moderation=1 -> "Airtime payouts"

alter table profiles add column if not exists referral_code text;
create unique index if not exists profiles_referral_code_key on profiles (referral_code) where referral_code is not null;

create table if not exists referrals (
  id            bigint generated always as identity primary key,
  referrer_id   uuid not null references auth.users(id) on delete cascade,
  referred_id   uuid not null unique references auth.users(id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending', 'qualified', 'paid', 'rejected')),
  reward_naira  int  not null default 500,
  reject_reason text,
  created_at    timestamptz not null default now(),
  qualified_at  timestamptz,
  paid_at       timestamptz,
  paid_by       uuid
);
create index if not exists referrals_referrer_idx on referrals (referrer_id);
create index if not exists referrals_status_idx   on referrals (status);

-- No direct table access from the app: everything goes through the functions below.
alter table referrals enable row level security;
revoke all on referrals from anon, authenticated;

-- 1. my personal code (created on first use) ----------------------------------
create or replace function my_referral_code()
returns text language plpgsql security definer set search_path = public as $$
declare c text; tries int := 0;
begin
  if auth.uid() is null then return null; end if;
  select referral_code into c from profiles where id = auth.uid();
  if c is not null then return c; end if;
  loop
    c := (select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
            from generate_series(1, 6));
    begin
      update profiles set referral_code = c where id = auth.uid() and referral_code is null;
      exit;
    exception when unique_violation then
      tries := tries + 1;
      if tries > 10 then raise; end if;
    end;
  end loop;
  select referral_code into c from profiles where id = auth.uid();
  return c;
end $$;
revoke all on function my_referral_code() from public, anon;
grant execute on function my_referral_code() to authenticated;

-- 2. a new driver claims the code from the link they arrived with ---------------
-- Returns: ok | invalid | self | not_new | already
create or replace function claim_referral(p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare v_ref uuid; v_created timestamptz;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select id into v_ref from profiles where referral_code = upper(trim(p_code));
  if v_ref is null then return 'invalid'; end if;
  if v_ref = auth.uid() then return 'self'; end if;
  select created_at into v_created from profiles where id = auth.uid();
  if v_created is null or v_created < now() - interval '3 days' then return 'not_new'; end if;
  if exists (select 1 from station_reports where user_id = auth.uid()) then return 'not_new'; end if;
  insert into referrals (referrer_id, referred_id) values (v_ref, auth.uid())
    on conflict (referred_id) do nothing;
  if not found then return 'already'; end if;
  return 'ok';
end $$;
revoke all on function claim_referral(text) from public, anon;
grant execute on function claim_referral(text) to authenticated;

-- 3. the friend's first station report qualifies the referral -------------------
create or replace function cng_referral_qualify()
returns trigger language plpgsql security definer set search_path = public as $$
declare r referrals%rowtype; ph_new text; ph_ref text; n int;
begin
  if new.user_id is null then return new; end if;
  select * into r from referrals where referred_id = new.user_id and status = 'pending';
  if not found then return new; end if;

  select right(regexp_replace(phone, '\D', '', 'g'), 10) into ph_new from profiles where id = r.referred_id;
  select right(regexp_replace(phone, '\D', '', 'g'), 10) into ph_ref from profiles where id = r.referrer_id;
  if coalesce(ph_new, '') = '' then return new; end if;   -- wait until they have a phone number

  if ph_new = coalesce(ph_ref, '') then
    update referrals set status = 'rejected', reject_reason = 'same phone number as referrer' where id = r.id;
    return new;
  end if;
  if exists (
    select 1 from referrals x join profiles p on p.id = x.referred_id
     where x.id <> r.id and x.status in ('qualified', 'paid')
       and right(regexp_replace(p.phone, '\D', '', 'g'), 10) = ph_new
  ) then
    update referrals set status = 'rejected', reject_reason = 'phone number already rewarded' where id = r.id;
    return new;
  end if;

  select count(*) into n from referrals where referrer_id = r.referrer_id and status in ('qualified', 'paid');
  if n >= 10 then
    update referrals set status = 'rejected', reject_reason = 'referrer reached the N5,000 limit' where id = r.id;
  else
    update referrals set status = 'qualified', qualified_at = now() where id = r.id;
  end if;
  return new;
end $$;
drop trigger if exists station_reports_referral_qualify on station_reports;
create trigger station_reports_referral_qualify after insert on station_reports
  for each row execute function cng_referral_qualify();

-- 4. what a driver sees about their own referrals --------------------------------
create or replace function my_referral_summary()
returns table (code text, pending int, owed int, paid int, slots_left int)
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if auth.uid() is null then return; end if;
  c := my_referral_code();
  return query
  select c,
         (select count(*)::int from referrals where referrer_id = auth.uid() and status = 'pending'),
         (select count(*)::int from referrals where referrer_id = auth.uid() and status = 'qualified'),
         (select count(*)::int from referrals where referrer_id = auth.uid() and status = 'paid'),
         greatest(0, 10 - (select count(*)::int from referrals where referrer_id = auth.uid() and status in ('qualified', 'paid')));
end $$;
revoke all on function my_referral_summary() from public, anon;
grant execute on function my_referral_summary() to authenticated;

-- 5. admin: who is owed airtime, and marking it paid -----------------------------
create or replace function admin_referral_queue(p_view text default 'owed')
returns table (
  referral_id bigint, referrer_name text, referrer_phone text, referrer_email text,
  friend_name text, friend_phone text, reward_naira int, status text,
  qualified_at timestamptz, paid_at timestamptz, first_report text
)
language plpgsql security definer set search_path = public as $$
begin
  if not cng_is_admin() then raise exception 'not authorized'; end if;
  return query
  select x.id, rp.name, rp.phone, rp.email, fp.name, fp.phone, x.reward_naira, x.status, x.qualified_at, x.paid_at,
         (select s.name || ' — ' || r.status_label || ' (' || replace(r.verification_level, '_', ' ') || ')'
            from station_reports r join stations s on s.id = r.station_id
           where r.user_id = x.referred_id order by r.created_at limit 1)
    from referrals x
    join profiles rp on rp.id = x.referrer_id
    join profiles fp on fp.id = x.referred_id
   where case when p_view = 'paid' then x.status = 'paid' else x.status = 'qualified' end
   order by coalesce(x.paid_at, x.qualified_at) desc
   limit 200;
end $$;
revoke all on function admin_referral_queue(text) from public, anon;
grant execute on function admin_referral_queue(text) to authenticated;

create or replace function admin_referral_set(p_id bigint, p_action text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not cng_is_admin() then raise exception 'not authorized'; end if;
  if p_action = 'paid' then
    update referrals set status = 'paid', paid_at = now(), paid_by = auth.uid() where id = p_id and status = 'qualified';
  elsif p_action = 'reject' then
    update referrals set status = 'rejected', reject_reason = coalesce(p_reason, 'rejected by admin') where id = p_id and status in ('qualified', 'pending');
  elsif p_action = 'unpay' then
    update referrals set status = 'qualified', paid_at = null, paid_by = null where id = p_id and status = 'paid';
  else
    raise exception 'unknown action %', p_action;
  end if;
end $$;
revoke all on function admin_referral_set(bigint, text, text) from public, anon;
grant execute on function admin_referral_set(bigint, text, text) to authenticated;
