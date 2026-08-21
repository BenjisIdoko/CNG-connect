-- ====================================================================
-- CNG CONNECT — SUPABASE PRODUCTION DATABASE SCHEMA & SEED DATA
-- Run this script in your Supabase SQL Editor (https://supabase.com)
-- ====================================================================

-- 1. Create 'stations' table
CREATE TABLE IF NOT EXISTS stations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  status TEXT NOT NULL DEFAULT 'full',
  status_label TEXT NOT NULL DEFAULT 'Full Stock',
  pump_pressure INT NOT NULL DEFAULT 210,
  cng_price INT NOT NULL DEFAULT 230,
  price_trend TEXT DEFAULT 'stable',
  last_updated TEXT DEFAULT '5 mins ago',
  busy_estimate TEXT DEFAULT 'Short Queue',
  distance TEXT DEFAULT '2.4 km',
  drive_time TEXT DEFAULT '6 mins',
  is_pi_cng_accredited BOOLEAN DEFAULT true,
  rating DOUBLE PRECISION DEFAULT 4.8,
  operator TEXT,
  station_notice TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create 'station_reports' table
CREATE TABLE IF NOT EXISTS station_reports (
  id TEXT PRIMARY KEY,
  station_id TEXT REFERENCES stations(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  author_avatar TEXT,
  status TEXT NOT NULL,
  status_label TEXT NOT NULL,
  pump_pressure INT,
  wait_minutes INT,
  comment TEXT,
  timestamp TEXT NOT NULL,
  verified BOOLEAN DEFAULT true,
  is_photo_verified BOOLEAN DEFAULT false,
  verification_level TEXT DEFAULT 'verified_live_photo',
  verification_weight DOUBLE PRECISION DEFAULT 1.0,
  photo TEXT,
  likes INT DEFAULT 0,
  dislikes INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create 'station_media' table
CREATE TABLE IF NOT EXISTS station_media (
  id TEXT PRIMARY KEY,
  station_id TEXT REFERENCES stations(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  type TEXT DEFAULT 'image',
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create 'community_posts' table
CREATE TABLE IF NOT EXISTS community_posts (
  id TEXT PRIMARY KEY,
  author TEXT NOT NULL,
  author_avatar TEXT,
  author_initial TEXT,
  author_initial_bg TEXT,
  time_ago TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  category_label TEXT NOT NULL,
  likes INT DEFAULT 0,
  replies_count INT DEFAULT 0,
  is_liked BOOLEAN DEFAULT false,
  image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) & Public Read/Insert Access Policies
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on stations" ON stations FOR SELECT USING (true);
CREATE POLICY "Allow public write on stations" ON stations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on stations" ON stations FOR UPDATE USING (true);

CREATE POLICY "Allow public read on station_reports" ON station_reports FOR SELECT USING (true);
CREATE POLICY "Allow public write on station_reports" ON station_reports FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read on station_media" ON station_media FOR SELECT USING (true);
CREATE POLICY "Allow public write on station_media" ON station_media FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read on community_posts" ON community_posts FOR SELECT USING (true);
CREATE POLICY "Allow public write on community_posts" ON community_posts FOR INSERT WITH CHECK (true);

-- Initial Seed Data Insertion
INSERT INTO stations (id, name, address, city, state, lat, lng, status, status_label, pump_pressure, cng_price, operator, is_pi_cng_accredited, rating)
VALUES 
  ('st-1', 'NIPCO CNG Station - Maitama', 'Plot 1042 Cadastral Zone A05, Maitama', 'Abuja', 'Abuja FCT', 9.0765, 7.4853, 'full', 'Full Stock', 215, 230, 'NIPCO Gas', true, 4.9),
  ('st-2', 'NIPCO Gas Station - Ibafo Corridor', 'Km 24 Lagos-Ibadan Expressway, Ibafo', 'Ibafo', 'Ogun', 6.9075, 3.5813, 'full', 'Full Stock', 210, 230, 'NIPCO Gas', true, 4.8),
  ('st-3', 'NNPC Retail Mega Station - Airport Road', 'Lugbe Interchange, Airport Road', 'Abuja', 'Abuja FCT', 8.9801, 7.3789, 'queue', 'Queuing', 195, 230, 'NNPC Retail', true, 4.6),
  ('st-4', 'BOVAS CNG Station - Challenge', 'Ring Road Interchange, Challenge', 'Ibadan', 'Oyo', 7.3775, 3.9470, 'low', 'Low Pressure', 145, 230, 'BOVAS & Company', true, 4.4),
  ('st-5', 'NIPCO Gas Station - Isolo Industrial Zone', 'Oshodi-Apapa Expressway, Isolo', 'Lagos', 'Lagos', 6.5244, 3.3792, 'full', 'Full Stock', 205, 230, 'NIPCO Gas', true, 4.7)
ON CONFLICT (id) DO NOTHING;
