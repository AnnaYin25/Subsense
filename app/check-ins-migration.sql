-- check_ins table migration
-- Run once in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS check_ins (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sub_id      UUID        NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  action      TEXT        NOT NULL CHECK (action IN ('love', 'review', 'unsure')),
  q1_answer   TEXT,
  q2_answer   TEXT,
  dive_deeper TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own check-ins" ON check_ins;
CREATE POLICY "Users can view own check-ins" ON check_ins
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own check-ins" ON check_ins;
CREATE POLICY "Users can insert own check-ins" ON check_ins
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_check_ins_user_sub ON check_ins(user_id, sub_id, created_at DESC);
