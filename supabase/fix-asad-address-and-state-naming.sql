-- Two fixes found while cross-checking our data against pci.gov.ng's
-- refuelling-stations.html / network-map.html (both pages share the same
-- underlying stations-data.js, so one comparison covers both):
--
-- 1. ASAD Energy Fleet's Abuja station: pci.gov.ng now lists its address as
--    "Dei-Dei, Along Kubwa Expressway, Abuja" — ours still has the old
--    "Bida-Abuja Rd, Jiwa" address from when it was first scraped
--    (2026-08-27). Jiwa and Dei-Dei/Kubwa Expressway are genuinely different
--    parts of Abuja, so the old precise (source_exact) coordinates no longer
--    match the corrected address. This moves it to an approximate point near
--    Kubwa Expressway (reusing the coordinate already verified for the
--    nearby "NNPC Retail - Murtala Mohammed Expressway" station, since
--    Murtala Mohammed Expressway is the same road) and flags it for a real
--    pin fix via the ?admin=1 editor rather than guessing at a precise spot.
--
-- 2. State-name inconsistency: 21 stations use "FCT Abuja", 8 use
--    "Abuja FCT" — an exact-match state filter would silently miss whichever
--    spelling it doesn't expect. Normalizes onto "FCT Abuja" (the majority
--    spelling).

begin;

update stations
set
  address = 'Dei-Dei, Along Kubwa Expressway, Abuja',
  city = 'Dei-Dei',
  lat = 9.128604,
  lng = 7.256419,
  location_precision = 'area',
  accuracy_radius_m = 700,
  needs_pin_review = true,
  data_source = 'pci.gov.ng address updated 2026-09 — pin needs re-verification',
  data_source_date = to_char(timezone('utc', now()), 'YYYY-MM-DD')
where id = 'pci-station-86';

update stations
set state = 'FCT Abuja'
where state = 'Abuja FCT';

commit;
