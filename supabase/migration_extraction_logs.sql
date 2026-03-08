-- Extraction logs - tracks every Claude API call with token usage
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS extraction_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'success', -- 'success' | 'error'
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for admin queries
CREATE INDEX IF NOT EXISTS idx_extraction_logs_created_at ON extraction_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_extraction_logs_user_id ON extraction_logs(user_id);

-- RLS: users can only see their own logs
ALTER TABLE extraction_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own extraction logs" ON extraction_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can insert (from API routes)
CREATE POLICY "Service role insert extraction logs" ON extraction_logs
  FOR INSERT WITH CHECK (true);
