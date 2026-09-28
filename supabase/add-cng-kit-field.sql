-- Splits "Vehicle Details & Kit" into two separate profile fields: `vehicle` (the car) and
-- `cng_kit` (the CNG kit / conversion status), so they can be shown and edited independently.
-- Paste into Supabase dashboard -> SQL Editor -> Run. Safe to re-run.
--
-- Existing accounts keep whatever they already typed into the combined field as `vehicle` —
-- nothing is deleted or auto-split. `cng_kit` starts empty; drivers fill it in from Profile ->
-- Edit, the same place they already edit their vehicle.

alter table profiles add column if not exists cng_kit text not null default '';
