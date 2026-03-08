-- Admin panel migration
-- Run this in your Supabase SQL Editor

-- Add admin flag and subscription tier to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free';

-- Add tracking columns to documents
ALTER TABLE documents ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'upload';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS extraction_duration_ms INTEGER;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Set yourself as admin (replace with your email)
-- UPDATE profiles SET is_admin = TRUE
--   WHERE id = (SELECT id FROM auth.users WHERE email = 'tvuj@email.cz');
