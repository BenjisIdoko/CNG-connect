-- Optional: make the database store real report times instead of the literal text 'Just now'.
-- (The app already ignores 'Just now' and uses station_reports.created_at, so nothing is
-- broken without this; it just keeps the raw data truthful for admin tools/exports.)
-- Paste into Supabase dashboard -> SQL Editor -> Run. Safe to re-run.

-- 1) New reports: stamp stations.last_updated with a real ISO time.
CREATE OR REPLACE FUNCTION report_station_status(
    p_station_id TEXT,
    p_status TEXT,
    p_status_label TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_status NOT IN ('full', 'low', 'queue', 'out') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  UPDATE stations
     SET status = p_status,
         status_label = p_status_label,
         last_updated = to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
   WHERE id = p_station_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Station not found: %', p_station_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION report_station_status(TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION report_station_status(TEXT, TEXT, TEXT) TO authenticated;

-- 2) Existing reports: replace 'Just now' with the real time the report was created.
UPDATE station_reports
   SET timestamp = to_char(created_at AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
 WHERE timestamp = 'Just now';

-- 3) Existing stations: last_updated = time of the newest report (or blank if none).
UPDATE stations s
   SET last_updated = COALESCE(
         (SELECT to_char(max(r.created_at) AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
            FROM station_reports r WHERE r.station_id = s.id),
         ''
       )
 WHERE s.last_updated = 'Just now';
