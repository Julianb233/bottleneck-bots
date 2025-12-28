-- Bottleneck Bots Initial Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bots table
CREATE TABLE IF NOT EXISTS bots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  config JSONB DEFAULT '{}',
  status TEXT CHECK (status IN ('active', 'paused', 'stopped')) DEFAULT 'stopped',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bot runs table
CREATE TABLE IF NOT EXISTS bot_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('pending', 'running', 'completed', 'failed')) DEFAULT 'pending',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  result JSONB,
  error TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bots_user_id ON bots(user_id);
CREATE INDEX IF NOT EXISTS idx_bots_status ON bots(status);
CREATE INDEX IF NOT EXISTS idx_bot_runs_bot_id ON bot_runs(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_runs_status ON bot_runs(status);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to users
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply updated_at trigger to bots
DROP TRIGGER IF EXISTS update_bots_updated_at ON bots;
CREATE TRIGGER update_bots_updated_at
  BEFORE UPDATE ON bots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_runs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users (users can only see/edit their own data)
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for bots
CREATE POLICY "Users can view own bots" ON bots
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own bots" ON bots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bots" ON bots
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bots" ON bots
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for bot_runs (through bot ownership)
CREATE POLICY "Users can view runs of own bots" ON bot_runs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bots WHERE bots.id = bot_runs.bot_id AND bots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create runs for own bots" ON bot_runs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM bots WHERE bots.id = bot_runs.bot_id AND bots.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update runs of own bots" ON bot_runs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM bots WHERE bots.id = bot_runs.bot_id AND bots.user_id = auth.uid()
    )
  );

-- Grant access to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON users TO authenticated;
GRANT ALL ON bots TO authenticated;
GRANT ALL ON bot_runs TO authenticated;
