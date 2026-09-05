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
    status TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN ('full', 'low', 'queue', 'out', 'unknown')),
    status_label TEXT NOT NULL DEFAULT 'No recent reports',
    cng_price NUMERIC,
    price_trend TEXT CHECK (price_trend IN ('stable', 'up', 'down')),
    pump_pressure INTEGER,
    busy_estimate TEXT,
    last_updated TEXT,
    verified_by_community BOOLEAN DEFAULT false,
    is_picng_accredited BOOLEAN DEFAULT false,
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

  -- Older installs only allowed status IN ('full','low','queue','out'), which
  -- forced honest "no report yet" stations to be seeded as 'full'. Widen it to
  -- allow 'unknown' (the real default until a driver reports), then clear any
  -- stations still carrying a seeded status with a "No recent reports" label.
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'stations_status_check'
  ) THEN
    ALTER TABLE stations DROP CONSTRAINT stations_status_check;
  END IF;
  ALTER TABLE stations ADD CONSTRAINT stations_status_check
    CHECK (status IN ('full', 'low', 'queue', 'out', 'unknown'));
  UPDATE stations SET status = 'unknown'
    WHERE status <> 'unknown' AND status_label = 'No recent reports';

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

-- 11. (removed) The hand-rolled otp_sessions table + api/otp/* serverless
-- verification system has been replaced by Supabase Auth's own email-OTP
-- sign-in (supabase.auth.signInWithOtp / verifyOtp) — see
-- src/context/AuthContext.tsx. That system is no longer used by the app;
-- drop its table.
DROP TABLE IF EXISTS otp_sessions;

-- 12. PROFILES TABLE — the durable, cross-device driver profile, one row per
-- real Supabase Auth user (auth.users). Everything that used to live only in
-- this browser's localStorage (name, vehicle, reputation, points, etc.) now
-- lives here, keyed by the verified identity from email-OTP sign-in.
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    avatar TEXT NOT NULL DEFAULT '',
    vehicle TEXT NOT NULL DEFAULT '',
    cng_installed_date TEXT NOT NULL DEFAULT '',
    monthly_savings NUMERIC NOT NULL DEFAULT 0,
    reports_count INTEGER NOT NULL DEFAULT 0,
    reputation_score NUMERIC NOT NULL DEFAULT 5.0,
    community_points INTEGER NOT NULL DEFAULT 0,
    state TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Auto-create a (mostly empty) profile row the instant someone verifies an
-- email-OTP for the first time. The client fills in the rest (name, vehicle,
-- etc.) via the "complete your profile" step — see SignUpScreen.tsx. A
-- profile with an empty `name` is exactly how the client knows a signed-in
-- user is brand new and needs that step.
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (NEW.id, COALESCE(NEW.email, ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

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
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "Allow public read station_suggestions" ON station_suggestions;
CREATE POLICY "Allow public read station_suggestions" ON station_suggestions FOR SELECT USING (true);

-- Profiles are publicly readable (author name/avatar show up on public
-- reports/posts/comments anyway) but only the owner can write their own row.
DROP POLICY IF EXISTS "Allow public read profiles" ON profiles;
CREATE POLICY "Allow public read profiles" ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow self update profiles" ON profiles;
CREATE POLICY "Allow self update profiles" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- The client's updateProfile() upserts rather than updates (see
-- AuthContext.tsx) so a session whose profile row is somehow missing (e.g.
-- created before this trigger existed) still saves instead of silently
-- no-op'ing — that path needs INSERT rights too, not just UPDATE.
DROP POLICY IF EXISTS "Allow self insert profiles" ON profiles;
CREATE POLICY "Allow self insert profiles" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Driver-generated content now requires a real signed-in session (email-OTP
-- verified via Supabase Auth) — browsing/reading stays public, writing does
-- not. `user_id` on each of these tables is never trusted from the client;
-- a BEFORE INSERT trigger below stamps it from auth.uid() unconditionally,
-- so a request can't claim to be written by someone else's account.
DROP POLICY IF EXISTS "Allow insert station_reports" ON station_reports;
CREATE POLICY "Allow insert station_reports" ON station_reports FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow insert station_media" ON station_media;
CREATE POLICY "Allow insert station_media" ON station_media FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow insert station_presence" ON station_presence;
CREATE POLICY "Allow insert station_presence" ON station_presence FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update station_presence" ON station_presence;
CREATE POLICY "Allow update station_presence" ON station_presence FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow insert community_posts" ON community_posts;
CREATE POLICY "Allow insert community_posts" ON community_posts FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow insert station_comments" ON station_comments;
CREATE POLICY "Allow insert station_comments" ON station_comments FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow insert post_comments" ON post_comments;
CREATE POLICY "Allow insert post_comments" ON post_comments FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow insert station_suggestions" ON station_suggestions;
CREATE POLICY "Allow insert station_suggestions" ON station_suggestions FOR INSERT TO authenticated WITH CHECK (true);

-- post_likes has NO direct insert/delete policy at all — toggling only
-- happens through the toggle_post_like() SECURITY DEFINER function below, so
-- a client can never insert an arbitrary like count or vote as another user.

-- user_id columns + trigger that force-stamps them from the verified session,
-- ignoring whatever (if anything) the client sends for that column.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'station_reports' AND column_name = 'user_id') THEN
    ALTER TABLE station_reports ADD COLUMN user_id UUID REFERENCES auth.users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'station_comments' AND column_name = 'user_id') THEN
    ALTER TABLE station_comments ADD COLUMN user_id UUID REFERENCES auth.users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'post_comments' AND column_name = 'user_id') THEN
    ALTER TABLE post_comments ADD COLUMN user_id UUID REFERENCES auth.users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'community_posts' AND column_name = 'user_id') THEN
    ALTER TABLE community_posts ADD COLUMN user_id UUID REFERENCES auth.users(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'station_suggestions' AND column_name = 'user_id') THEN
    ALTER TABLE station_suggestions ADD COLUMN user_id UUID REFERENCES auth.users(id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION stamp_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.user_id := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stamp_user_id_station_reports ON station_reports;
CREATE TRIGGER stamp_user_id_station_reports BEFORE INSERT ON station_reports FOR EACH ROW EXECUTE FUNCTION stamp_user_id();

DROP TRIGGER IF EXISTS stamp_user_id_station_comments ON station_comments;
CREATE TRIGGER stamp_user_id_station_comments BEFORE INSERT ON station_comments FOR EACH ROW EXECUTE FUNCTION stamp_user_id();

DROP TRIGGER IF EXISTS stamp_user_id_post_comments ON post_comments;
CREATE TRIGGER stamp_user_id_post_comments BEFORE INSERT ON post_comments FOR EACH ROW EXECUTE FUNCTION stamp_user_id();

DROP TRIGGER IF EXISTS stamp_user_id_community_posts ON community_posts;
CREATE TRIGGER stamp_user_id_community_posts BEFORE INSERT ON community_posts FOR EACH ROW EXECUTE FUNCTION stamp_user_id();

DROP TRIGGER IF EXISTS stamp_user_id_station_suggestions ON station_suggestions;
CREATE TRIGGER stamp_user_id_station_suggestions BEFORE INSERT ON station_suggestions FOR EACH ROW EXECUTE FUNCTION stamp_user_id();

-- station_presence.user_key predates real auth and was a client-supplied
-- email/phone string; force it to the verified session id instead (same
-- "never trust the client for identity" rule as stamp_user_id() above, just
-- writing a TEXT column rather than a UUID one).
CREATE OR REPLACE FUNCTION stamp_user_key_from_auth()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.user_key := auth.uid()::text;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stamp_user_key_station_presence ON station_presence;
CREATE TRIGGER stamp_user_key_station_presence BEFORE INSERT OR UPDATE ON station_presence FOR EACH ROW EXECUTE FUNCTION stamp_user_key_from_auth();

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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

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

REVOKE EXECUTE ON FUNCTION report_station_status(TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION report_station_status(TEXT, TEXT, TEXT) TO authenticated;

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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

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

REVOKE EXECUTE ON FUNCTION update_station_pin(TEXT, DOUBLE PRECISION, DOUBLE PRECISION) FROM anon;
GRANT EXECUTE ON FUNCTION update_station_pin(TEXT, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

-- Idempotent like toggle: inserts/deletes exactly one (post_id, user_key) row
-- and keeps community_posts.likes as a denormalized, always-correct count —
-- avoids the classic "two clients increment at once, one increment is lost"
-- race you'd get from a plain `UPDATE ... SET likes = likes + 1`.
--
-- Identity comes from auth.uid(), never a client-supplied parameter — the
-- original version of this function took p_user_key as a free string, which
-- meant any caller could toggle likes as literally anyone else. Drop that
-- signature outright rather than leaving a still-callable insecure overload
-- alongside the new one (CREATE OR REPLACE does not replace a function
-- across a different parameter list; it just adds an overload).
DROP FUNCTION IF EXISTS toggle_post_like(TEXT, TEXT);

CREATE OR REPLACE FUNCTION toggle_post_like(
    p_post_id TEXT
)
RETURNS TABLE(liked BOOLEAN, like_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  already_liked BOOLEAN;
  new_liked BOOLEAN;
  caller_key TEXT := auth.uid()::text;
BEGIN
  IF caller_key IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM post_likes WHERE post_id = p_post_id AND user_key = caller_key
  ) INTO already_liked;

  IF already_liked THEN
    DELETE FROM post_likes WHERE post_id = p_post_id AND user_key = caller_key;
    new_liked := false;
  ELSE
    INSERT INTO post_likes (post_id, user_key) VALUES (p_post_id, caller_key);
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

GRANT EXECUTE ON FUNCTION toggle_post_like(TEXT) TO authenticated;
