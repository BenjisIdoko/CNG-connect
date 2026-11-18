-- Where the phone was when a report's photo was taken. Run once in the Supabase SQL editor; safe to re-run.
--
-- Every report needs a live photo taken within 150 m of the station. The app records the phone's
-- position at that moment and saves it with the report so it can be checked (by the app now, and by
-- the database rule in supabase/require-report-proof.sql once that is switched on).
--
-- Only adds two nullable columns: nothing changes for existing reports or for the live app.

alter table station_reports add column if not exists photo_lat double precision;
alter table station_reports add column if not exists photo_lng double precision;
