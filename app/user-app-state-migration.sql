-- Cross-device UI state for web/native app flows.
-- Run this once in Supabase SQL editor.

CREATE TABLE IF NOT EXISTS user_app_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, key)
);

ALTER TABLE user_app_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own app state" ON user_app_state;
CREATE POLICY "Users can view own app state" ON user_app_state
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own app state" ON user_app_state;
CREATE POLICY "Users can insert own app state" ON user_app_state
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own app state" ON user_app_state;
CREATE POLICY "Users can update own app state" ON user_app_state
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own app state" ON user_app_state;
CREATE POLICY "Users can delete own app state" ON user_app_state
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_app_state_user_key ON user_app_state(user_id, key);

DROP TRIGGER IF EXISTS update_user_app_state_updated_at ON user_app_state;
CREATE TRIGGER update_user_app_state_updated_at
  BEFORE UPDATE ON user_app_state
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
