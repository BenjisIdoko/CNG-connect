-- Lets a driver add what they paid per kg of CNG (in naira) when they report a station, so the
-- map can show "₦230/kg · 2 hr ago" next to the status. The price rides on the report, so it
-- is aged, attributed and hidden/moderated exactly like the rest of the report.
-- Paste into Supabase dashboard -> SQL Editor -> Run. Safe to re-run.
--
-- Deploy order: run this BEFORE the app version that sends `cng_price_naira`. (The app only
-- includes the field when a driver typed a price, so reports without one keep working either
-- way; a report with a price would be rejected by an unmigrated database.)

alter table station_reports add column if not exists cng_price_naira numeric(7, 2);

-- Same bounds as the app (src/utils/stationPrice.ts): a typo or a joke never becomes a price.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'station_reports_cng_price_naira_range'
       and conrelid = 'station_reports'::regclass
  ) then
    alter table station_reports
      add constraint station_reports_cng_price_naira_range
      check (cng_price_naira is null or (cng_price_naira >= 50 and cng_price_naira <= 2000));
  end if;
end $$;

-- No new GRANT is needed: anon and authenticated already hold table-level INSERT and SELECT on
-- station_reports, which covers new columns. Existing row-level policies, the author/user
-- stamping triggers and the rate limiter apply to a priced report like any other.
