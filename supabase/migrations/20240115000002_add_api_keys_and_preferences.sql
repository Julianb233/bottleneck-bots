-- Create API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  hashed_key TEXT NOT NULL,
  last_used TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for API keys
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key ON api_keys(key);
CREATE INDEX idx_api_keys_hashed_key ON api_keys(hashed_key);

-- Add notification preferences to users table
ALTER TABLE auth.users
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "emailOnFailure": true,
  "emailOnSuccess": false,
  "slackNotifications": false
}'::jsonb;

-- Enable RLS for API keys
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own API keys
CREATE POLICY "Users can view own API keys"
  ON api_keys
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can create their own API keys
CREATE POLICY "Users can create own API keys"
  ON api_keys
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own API keys
CREATE POLICY "Users can delete own API keys"
  ON api_keys
  FOR DELETE
  USING (auth.uid() = user_id);

-- Policy: Users can update their own API keys (for last_used)
CREATE POLICY "Users can update own API keys"
  ON api_keys
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER api_keys_updated_at
  BEFORE UPDATE ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_api_keys_updated_at();

-- Create webhook secrets table for bot-specific authentication
CREATE TABLE IF NOT EXISTS webhook_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  secret TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bot_id)
);

-- Enable RLS for webhook secrets
ALTER TABLE webhook_secrets ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view webhook secrets for their own bots
CREATE POLICY "Users can view own webhook secrets"
  ON webhook_secrets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = webhook_secrets.bot_id
      AND bots.user_id = auth.uid()
    )
  );

-- Policy: Users can create webhook secrets for their own bots
CREATE POLICY "Users can create webhook secrets"
  ON webhook_secrets
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = webhook_secrets.bot_id
      AND bots.user_id = auth.uid()
    )
  );

-- Policy: Users can delete webhook secrets for their own bots
CREATE POLICY "Users can delete webhook secrets"
  ON webhook_secrets
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM bots
      WHERE bots.id = webhook_secrets.bot_id
      AND bots.user_id = auth.uid()
    )
  );
