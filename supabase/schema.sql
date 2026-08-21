-- GasFinder Postgres/Supabase Database Schema
-- Run this script in your Supabase SQL Editor or migration runner

-- Enable PostGIS extension for spatial queries (optional, fallback to lat/lng numbers)
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
    station_comments JSONB DEFAULT '[]'::jsonb,
    location_precision TEXT DEFAULT 'geocoded' CHECK (location_precision IN ('geocoded', 'gps_confirmed')),
    data_source TEXT DEFAULT 'pci.gov.ng',
    data_source_date TEXT DEFAULT '2026-08-20',
    created_by TEXT DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

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
    likes INTEGER DEFAULT 1,
    replies_count INTEGER DEFAULT 0,
    comments JSONB DEFAULT '[]'::jsonb,
    is_listing BOOLEAN DEFAULT false,
    price TEXT,
    car_details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- INDEXES FOR FAST QUERYING
CREATE INDEX IF NOT EXISTS idx_stations_status ON stations(status);
CREATE INDEX IF NOT EXISTS idx_stations_city ON stations(city);
CREATE INDEX IF NOT EXISTS idx_station_reports_station_id ON station_reports(station_id);
CREATE INDEX IF NOT EXISTS idx_station_media_station_id ON station_media(station_id);
CREATE INDEX IF NOT EXISTS idx_station_media_hash ON station_media(perceptual_hash);
CREATE INDEX IF NOT EXISTS idx_community_posts_category ON community_posts(category);

-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_nudges ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;

-- Allow public read access to all tables
CREATE POLICY "Allow public read stations" ON stations FOR SELECT USING (true);
CREATE POLICY "Allow public read station_reports" ON station_reports FOR SELECT USING (true);
CREATE POLICY "Allow public read station_media" ON station_media FOR SELECT USING (true);
CREATE POLICY "Allow public read station_presence" ON station_presence FOR SELECT USING (true);
CREATE POLICY "Allow public read community_posts" ON community_posts FOR SELECT USING (true);

-- Allow public insert/update for demo app driver actions
CREATE POLICY "Allow public insert station_reports" ON station_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public insert station_media" ON station_media FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public insert station_presence" ON station_presence FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update station_presence" ON station_presence FOR UPDATE USING (true);
CREATE POLICY "Allow public update stations" ON stations FOR UPDATE USING (true);
CREATE POLICY "Allow public insert community_posts" ON community_posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update community_posts" ON community_posts FOR UPDATE USING (true);
