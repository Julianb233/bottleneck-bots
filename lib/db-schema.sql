-- Bottleneck Bots - Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bots table
CREATE TABLE IF NOT EXISTS bots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  bot_type VARCHAR(100) NOT NULL DEFAULT 'custom',
  config JSONB DEFAULT '{}',
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  schedule JSONB, -- Cron-like scheduling config
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT chk_bot_status CHECK (status IN ('active', 'paused', 'stopped', 'error'))
);

-- Bot runs / execution logs
CREATE TABLE IF NOT EXISTS bot_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  trigger_type VARCHAR(50) NOT NULL DEFAULT 'manual', -- manual, scheduled, webhook
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,
  result JSONB,
  error TEXT,
  logs JSONB DEFAULT '[]',
  
  CONSTRAINT chk_run_status CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'))
);

-- Bot templates (pre-built bot configurations)
CREATE TABLE IF NOT EXISTS bot_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  config JSONB NOT NULL DEFAULT '{}',
  is_public BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Webhooks for bot triggers
CREATE TABLE IF NOT EXISTS bot_webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  webhook_url TEXT NOT NULL,
  secret_key VARCHAR(255) NOT NULL,
  events JSONB DEFAULT '["trigger"]',
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_bots_user_id ON bots(user_id);
CREATE INDEX idx_bots_status ON bots(status);
CREATE INDEX idx_bot_runs_bot_id ON bot_runs(bot_id);
CREATE INDEX idx_bot_runs_status ON bot_runs(status);
CREATE INDEX idx_bot_runs_started_at ON bot_runs(started_at DESC);
CREATE INDEX idx_bot_templates_category ON bot_templates(category);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bots_updated_at
  BEFORE UPDATE ON bots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bot_templates_updated_at
  BEFORE UPDATE ON bot_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_webhooks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid()::text = id::text);

CREATE POLICY "Users can view own bots"
  ON bots FOR SELECT
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can create own bots"
  ON bots FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own bots"
  ON bots FOR UPDATE
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own bots"
  ON bots FOR DELETE
  USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can view own bot runs"
  ON bot_runs FOR SELECT
  USING (
    bot_id IN (
      SELECT id FROM bots WHERE user_id::text = auth.uid()::text
    )
  );

CREATE POLICY "Anyone can view public templates"
  ON bot_templates FOR SELECT
  USING (is_public = true OR created_by::text = auth.uid()::text);
