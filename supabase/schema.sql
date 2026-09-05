-- ====================================================================
-- CNG CONNECT — CANONICAL SUPABASE SCHEMA (single source of truth)
-- Run this script in your Supabase SQL Editor (https://supabase.com)
--
-- Safe to run multiple times: every statement is idempotent, including
-- the ALTER/migration block near the top that upgrades a database that
-- already has an earlier version of this schema applied.
--
-- NOTE: supabase_schema.sql (repo root) is deprecated and points here.
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. STATIONS TABLE
CREATE TABLE IF NOT EXISTS stations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    distance TEXT,
    drive_time TEXT,
    status TEXT NOT NULL CHECK (status IN ('full', 'low', 'queue', 'out')),
    status_label TEXT NOT NULL,
    cng_price NUMERIC DEFAULT 230,
    price_trend TEXT DEFAULT 'stable' CHECK (price_trend IN ('stable', 'up', 'down')),
    pump_pressure INTEGER DEFAULT 215,
    busy_estimate TEXT,
    last_updated TEXT DEFAULT 'Just now',
    verified_by_community BOOLEAN DEFAULT true,
    is_picng_accredited BOOLEAN DEFAULT true,
    operator TEXT,
    phone TEXT,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    images JSONB DEFAULT '[]'::jsonb,
    member_count INTEGER DEFAULT 120,
    station_notice TEXT,
    station_comments JSONB DEFAULT '[]'::jsonb, -- legacy; superseded by the station_comments TABLE below
    location_precision TEXT DEFAULT 'city',
    area TEXT,
    accuracy_radius_m INTEGER,
    needs_pin_review BOOLEAN DEFAULT false,
    data_source TEXT DEFAULT 'pci.gov.ng',
    data_source_date TEXT DEFAULT '2026-08-20',
    created_by TEXT DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- --------------------------------------------------------------------
-- MIGRATION GUARDS for databases created from an earlier version of this
-- file (before the real-geocoding pass and the community-sync tables).
-- --------------------------------------------------------------------
DO $$
BEGIN
  -- Older installs only allowed ('geocoded','gps_confirmed'); the geocoding
  -- pass in scripts/geocode-stations.ts now writes honest, finer-grained
  -- tiers. Widen the constraint instead of rejecting those rows.
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'stations_location_precision_check'
  ) THEN
    ALTER TABLE stations DROP CONSTRAINT stations_location_precision_check;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stations' AND column_name = 'area'
  ) THEN
    ALTER TABLE stations ADD COLUMN area TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stations' AND column_name = 'accuracy_radius_m'
  ) THEN
    ALTER TABLE stations ADD COLUMN accuracy_radius_m INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stations' AND column_name = 'needs_pin_review'
  ) THEN
    ALTER TABLE stations ADD COLUMN needs_pin_review BOOLEAN DEFAULT false;
  END IF;

  -- EV charging station columns (the table predates the EV feature).
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stations' AND column_name = 'station_type'
  ) THEN
    ALTER TABLE stations ADD COLUMN station_type TEXT NOT NULL DEFAULT 'cng' CHECK (station_type IN ('cng', 'ev_charging'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stations' AND column_name = 'connector_types'
  ) THEN
    ALTER TABLE stations ADD COLUMN connector_types JSONB DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stations' AND column_name = 'charging_speed_kw'
  ) THEN
    ALTER TABLE stations ADD COLUMN charging_speed_kw NUMERIC;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stations' AND column_name = 'price_per_kwh'
  ) THEN
    ALTER TABLE stations ADD COLUMN price_per_kwh NUMERIC;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stations' AND column_name = 'total_ports'
  ) THEN
    ALTER TABLE stations ADD COLUMN total_ports INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stations' AND column_name = 'network'
  ) THEN
    ALTER TABLE stations ADD COLUMN network TEXT;
  END IF;
END $$;

ALTER TABLE stations ADD CONSTRAINT stations_location_precision_check
  CHECK (location_precision IN (
    'source_exact', 'gps_confirmed', 'rooftop', 'street', 'area', 'city',
    'geocoded', -- legacy tier kept for old rows; new writes should not use it
    'unlocated'
  ));

-- 2. STATION REPORTS TABLE (with verification_level & verification_weight)
CREATE TABLE IF NOT EXISTS station_reports (
    id TEXT PRIMARY KEY,
    station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    author TEXT NOT NULL,
    author_avatar TEXT,
    verified BOOLEAN DEFAULT false,
    is_photo_verified BOOLEAN DEFAULT false,
    verification_level TEXT DEFAULT 'unverified_text' CHECK (verification_level IN ('unverified_text', 'quick_tap_geofence', 'verified_live_photo')),
    verification_weight NUMERIC DEFAULT 0.5 CHECK (verification_weight >= 0 AND verification_weight <= 1.0),
    timestamp TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('full', 'low', 'queue', 'out')),
    status_label TEXT NOT NULL,
    wait_minutes INTEGER DEFAULT 0,
    comment TEXT,
    likes INTEGER DEFAULT 1,
    dislikes INTEGER DEFAULT 0,
    photo TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. STATION MEDIA TABLE (with geo-verification & perceptual hash fields)
CREATE TABLE IF NOT EXISTS station_media (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    report_id TEXT REFERENCES station_reports(id) ON DELETE SET NULL,
    media_url TEXT NOT NULL,
    is_verified BOOLEAN DEFAULT false,
    geo_lat DOUBLE PRECISION,
    geo_lng DOUBLE PRECISION,
    geo_accuracy_meters NUMERIC,
    photo_timestamp TIMESTAMP WITH TIME ZONE,
    perceptual_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. STATION PRESENCE TABLE (Ephemeral Proximity TTL)
CREATE TABLE IF NOT EXISTS station_presence (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    user_key TEXT NOT NULL,
    entered_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_ping_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now() + interval '20 minutes') NOT NULL,
    UNIQUE(station_id, user_key)
);

-- 5. STATION NUDGES TABLE
CREATE TABLE IF NOT EXISTS station_nudges (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    user_key TEXT NOT NULL,
    nudge_timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    response_status TEXT
);

-- 6. COMMUNITY POSTS TABLE
CREATE TABLE IF NOT EXISTS community_posts (
    id TEXT PRIMARY KEY,
    author TEXT NOT NULL,
    author_avatar TEXT,
    verified BOOLEAN DEFAULT false,
    time_ago TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('maintenance', 'parts', 'reviews', 'deals', 'conversions')),
    category_label TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    image TEXT,
    likes INTEGER DEFAULT 0,
    replies_count INTEGER DEFAULT 0,
    comments JSONB DEFAULT '[]'::jsonb, -- legacy; superseded by the post_comments TABLE below
    is_listing BOOLEAN DEFAULT false,
    price TEXT,
    car_details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. STATION COMMENTS TABLE (normalized — replaces the stations.station_comments JSONB blob
-- so two drivers commenting at once can't clobber each other's write)
CREATE TABLE IF NOT EXISTS station_comments (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    station_id TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    author TEXT NOT NULL,
    author_avatar TEXT,
    content TEXT NOT NULL CHECK (length(trim(content)) > 0 AND length(content) <= 2000),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. POST COMMENTS TABLE (normalized — replaces the community_posts.comments JSONB blob)
CREATE TABLE IF NOT EXISTS post_comments (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    author TEXT NOT NULL,
    author_avatar TEXT,
    content TEXT NOT NULL CHECK (length(trim(content)) > 0 AND length(content) <= 2000),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. POST LIKES TABLE (one row per driver per post => idempotent toggle,
-- and lets a returning driver see their own like state on reload)
CREATE TABLE IF NOT EXISTS post_likes (
    post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
    user_key TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (post_id, user_key)
);

-- 10. STATION SUGGESTIONS TABLE (new CNG/EV station submissions pending review)
CREATE TABLE IF NOT EXISTS station_suggestions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    station_type TEXT NOT NULL DEFAULT 'cng' CHECK (station_type IN ('cng', 'ev_charging')),
    city TEXT,
    state TEXT,
    operator TEXT,
    notes TEXT,
    photo TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    submitted_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. OTP / VERIFICATION SESSIONS TABLE (server-side challenge store)
-- Accessed ONLY via the service-role key from serverless functions.
-- No anon/authenticated policies are created => blocked for all non-service clients.
-- `identifier` holds a normalized email address (default channel — free) or an
-- E.164 phone number (only used if you later configure a paid SMS provider).
CREATE TABLE IF NOT EXISTS otp_sessions (
    identifier TEXT PRIMARY KEY,
    channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms')),
    code TEXT NOT NULL,
    expires_at BIGINT NOT NULL,
    last_sent_at BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  -- Upgrade an older otp_sessions table (keyed by `phone`) in place.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'otp_sessions' AND column_name = 'phone'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'otp_sessions' AND column_name = 'identifier'
  ) THEN
    ALTER TABLE otp_sessions RENAME COLUMN phone TO identifier;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'otp_sessions' AND column_name = 'channel'
  ) THEN
    ALTER TABLE otp_sessions ADD COLUMN channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms'));
  END IF;
END $$;

-- INDEXES FOR FAST QUERYING
CREATE INDEX IF NOT EXISTS idx_stations_status ON stations(status);
CREATE INDEX IF NOT EXISTS idx_stations_city ON stations(city);
CREATE INDEX IF NOT EXISTS idx_stations_station_type ON stations(station_type);
CREATE INDEX IF NOT EXISTS idx_stations_needs_pin_review ON stations(needs_pin_review) WHERE needs_pin_review = true;
CREATE INDEX IF NOT EXISTS idx_station_reports_station_id ON station_reports(station_id);
CREATE INDEX IF NOT EXISTS idx_station_media_station_id ON station_media(station_id);
CREATE INDEX IF NOT EXISTS idx_station_media_hash ON station_media(perceptual_hash);
CREATE INDEX IF NOT EXISTS idx_community_posts_category ON community_posts(category);
CREATE INDEX IF NOT EXISTS idx_station_comments_station_id ON station_comments(station_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_station_suggestions_status ON station_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_otp_sessions_expiry ON otp_sessions(expires_at);

-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_nudges ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_sessions ENABLE ROW LEVEL SECURITY;

-- Public read access (anon key may read)
DROP POLICY IF EXISTS "Allow public read stations" ON stations;
CREATE POLICY "Allow public read stations" ON stations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read station_reports" ON station_reports;
CREATE POLICY "Allow public read station_reports" ON station_reports FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read station_media" ON station_media;
CREATE POLICY "Allow public read station_media" ON station_media FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read station_presence" ON station_presence;
CREATE POLICY "Allow public read station_presence" ON station_presence FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read community_posts" ON community_posts;
CREATE POLICY "Allow public read community_posts" ON community_posts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read station_comments" ON station_comments;
CREATE POLICY "Allow public read station_comments" ON station_comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read post_comments" ON post_comments;
CREATE POLICY "Allow public read post_comments" ON post_comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read post_likes" ON post_likes;
CREATE POLICY "Allow public read post_likes" ON post_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read own station_suggestions" ON station_suggestions;
CREATE POLICY "Allow public read station_suggestions" ON station_suggestions FOR SELECT USING (true);

-- Driver-generated content: anon INSERT allowed.
-- The app uses custom OTP verification (not Supabase Auth yet). When Supabase
-- Auth is wired in, tighten these to `TO authenticated`.
DROP POLICY IF EXISTS "Allow insert station_reports" ON station_reports;
CREATE POLICY "Allow insert station_reports" ON station_reports FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow insert station_media" ON station_media;
CREATE POLICY "Allow insert station_media" ON station_media FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow insert station_presence" ON station_presence;
CREATE POLICY "Allow insert station_presence" ON station_presence FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update station_presence" ON station_presence;
CREATE POLICY "Allow update station_presence" ON station_presence FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow insert community_posts" ON community_posts;
CREATE POLICY "Allow insert community_posts" ON community_posts FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow insert station_comments" ON station_comments;
CREATE POLICY "Allow insert station_comments" ON station_comments FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow insert post_comments" ON post_comments;
CREATE POLICY "Allow insert post_comments" ON post_comments FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow insert station_suggestions" ON station_suggestions;
CREATE POLICY "Allow insert station_suggestions" ON station_suggestions FOR INSERT WITH CHECK (true);

-- post_likes has NO direct insert/delete policy for anon — toggling only
-- happens through the toggle_post_like() SECURITY DEFINER function below, so
-- a client can't insert an arbitrary like count or vote as another user_key.

-- Stations status updates are crowdsourced but the rest of the row must not be
-- editable by anonymous clients. Direct UPDATE is intentionally NOT granted.
-- Instead, writes go through these SECURITY DEFINER functions, each of which
-- can only touch the specific columns it's meant to.
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
  IF p_status NOT IN ('full', 'low', 'queue', 'out') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  UPDATE stations
     SET status = p_status,
         status_label = p_status_label,
         last_updated = 'Just now'
   WHERE id = p_station_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Station not found: %', p_station_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION report_station_status(TEXT, TEXT, TEXT) TO anon, authenticated;

-- Community GPS pin correction. Only touches location fields; marks the pin
-- gps_confirmed with a tight accuracy radius and clears the review flag.
CREATE OR REPLACE FUNCTION update_station_pin(
    p_station_id TEXT,
    p_lat DOUBLE PRECISION,
    p_lng DOUBLE PRECISION
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_lat < -90 OR p_lat > 90 OR p_lng < -180 OR p_lng > 180 THEN
    RAISE EXCEPTION 'Invalid coordinates';
  END IF;

  UPDATE stations
     SET lat = p_lat,
         lng = p_lng,
         location_precision = 'gps_confirmed',
         accuracy_radius_m = 20,
         needs_pin_review = false,
         data_source = 'Community GPS Confirmed Pin',
         data_source_date = to_char(timezone('utc', now()), 'YYYY-MM-DD'),
         verified_by_community = true
   WHERE id = p_station_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Station not found: %', p_station_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION update_station_pin(TEXT, DOUBLE PRECISION, DOUBLE PRECISION) TO anon, authenticated;

-- Idempotent like toggle: inserts/deletes exactly one (post_id, user_key) row
-- and keeps community_posts.likes as a denormalized, always-correct count —
-- avoids the classic "two clients increment at once, one increment is lost"
-- race you'd get from a plain `UPDATE ... SET likes = likes + 1`.
CREATE OR REPLACE FUNCTION toggle_post_like(
    p_post_id TEXT,
    p_user_key TEXT
)
RETURNS TABLE(liked BOOLEAN, like_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  already_liked BOOLEAN;
  new_liked BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM post_likes WHERE post_id = p_post_id AND user_key = p_user_key
  ) INTO already_liked;

  IF already_liked THEN
    DELETE FROM post_likes WHERE post_id = p_post_id AND user_key = p_user_key;
    new_liked := false;
  ELSE
    INSERT INTO post_likes (post_id, user_key) VALUES (p_post_id, p_user_key);
    new_liked := true;
  END IF;

  UPDATE community_posts
     SET likes = (SELECT count(*) FROM post_likes WHERE post_id = p_post_id)
   WHERE id = p_post_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post not found: %', p_post_id;
  END IF;

  RETURN QUERY SELECT new_liked, (SELECT likes FROM community_posts WHERE id = p_post_id);
END;
$$;

GRANT EXECUTE ON FUNCTION toggle_post_like(TEXT, TEXT) TO anon, authenticated;
