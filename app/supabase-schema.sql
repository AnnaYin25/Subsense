-- Subscription Manager Database Schema
-- Run this entire file in Supabase SQL Editor
-- Version: 1.0

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. USERS TABLE
-- ============================================================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  avatar_style TEXT NOT NULL DEFAULT 'notionists',
  age INTEGER CHECK (age >= 18 AND age <= 100),
  monthly_budget DECIMAL(10, 2) NOT NULL DEFAULT 100.00,
  currency TEXT NOT NULL DEFAULT 'USD',
  reminder_day INTEGER NOT NULL DEFAULT 0 CHECK (reminder_day >= 0 AND reminder_day <= 6),
  reminder_days_before INTEGER NOT NULL DEFAULT 3 CHECK (reminder_days_before >= 1 AND reminder_days_before <= 14),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. USER PERSONAS TABLE
-- ============================================================================
CREATE TABLE user_personas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  structured_data JSONB NOT NULL DEFAULT '{}',
  conversation_history JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================================================
-- 3. SUBSCRIPTIONS TABLE
-- ============================================================================
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  cost DECIMAL(10, 2) NOT NULL,
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  category TEXT NOT NULL CHECK (category IN ('Entertainment', 'Productivity', 'Utilities', 'Health')),
  icon_emoji TEXT NOT NULL DEFAULT '📱',
  color TEXT NOT NULL DEFAULT '#3B82F6',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  is_reminder BOOLEAN NOT NULL DEFAULT FALSE,
  start_date DATE,
  next_renewal_date DATE NOT NULL,
  usage_score INTEGER CHECK (usage_score >= 0 AND usage_score <= 100),
  satisfaction_score INTEGER CHECK (satisfaction_score >= 0 AND satisfaction_score <= 100),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. SUBSCRIPTION PRICE HISTORY TABLE
-- ============================================================================
CREATE TABLE subscription_price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  old_price DECIMAL(10, 2) NOT NULL,
  new_price DECIMAL(10, 2) NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_note TEXT
);

-- ============================================================================
-- 5. ASSESSMENTS TABLE (AI Audit Feature)
-- ============================================================================
CREATE TABLE assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  service_cost DECIMAL(10, 2) NOT NULL,
  service_category TEXT NOT NULL CHECK (service_category IN ('Entertainment', 'Productivity', 'Utilities', 'Health')),
  conversation_transcript JSONB NOT NULL DEFAULT '[]',
  overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  dimension_scores JSONB NOT NULL,
  ai_recommendation TEXT NOT NULL,
  final_action TEXT CHECK (final_action IN ('tracked', 'trial', 'skipped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 6. WEEKLY CHECK-INS TABLE
-- ============================================================================
CREATE TABLE weekly_checkins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  total_subs_reviewed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 7. CHECK-IN RESPONSES TABLE
-- ============================================================================
CREATE TABLE checkin_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  checkin_id UUID NOT NULL REFERENCES weekly_checkins(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  swipe_direction TEXT NOT NULL CHECK (swipe_direction IN ('left', 'right', 'down')),
  ai_questions JSONB NOT NULL DEFAULT '[]',
  user_answers JSONB NOT NULL DEFAULT '[]',
  extracted_insights TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 8. MONTHLY REPORTS TABLE
-- ============================================================================
CREATE TABLE monthly_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_month DATE NOT NULL,
  overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  dimension_scores JSONB NOT NULL,
  total_spend DECIMAL(10, 2) NOT NULL,
  subs_added INTEGER NOT NULL DEFAULT 0,
  subs_cancelled INTEGER NOT NULL DEFAULT 0,
  top_wasted_subs JSONB NOT NULL DEFAULT '[]',
  ai_suggestions JSONB NOT NULL DEFAULT '[]',
  shareable_card_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, report_month)
);

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkin_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_reports ENABLE ROW LEVEL SECURITY;

-- Users table policies
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- User Personas table policies
CREATE POLICY "Users can view own persona" ON user_personas
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own persona" ON user_personas
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own persona" ON user_personas
  FOR UPDATE USING (auth.uid() = user_id);

-- Subscriptions table policies
CREATE POLICY "Users can view own subscriptions" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions" ON subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions" ON subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscriptions" ON subscriptions
  FOR DELETE USING (auth.uid() = user_id);

-- Price History policies
CREATE POLICY "Users can view own price history" ON subscription_price_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM subscriptions
      WHERE subscriptions.id = subscription_price_history.subscription_id
      AND subscriptions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own price history" ON subscription_price_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM subscriptions
      WHERE subscriptions.id = subscription_price_history.subscription_id
      AND subscriptions.user_id = auth.uid()
    )
  );

-- Assessments table policies
CREATE POLICY "Users can view own assessments" ON assessments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own assessments" ON assessments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Weekly Check-ins policies
CREATE POLICY "Users can view own checkins" ON weekly_checkins
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own checkins" ON weekly_checkins
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own checkins" ON weekly_checkins
  FOR UPDATE USING (auth.uid() = user_id);

-- Check-in Responses policies
CREATE POLICY "Users can view own checkin responses" ON checkin_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM weekly_checkins
      WHERE weekly_checkins.id = checkin_responses.checkin_id
      AND weekly_checkins.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own checkin responses" ON checkin_responses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM weekly_checkins
      WHERE weekly_checkins.id = checkin_responses.checkin_id
      AND weekly_checkins.user_id = auth.uid()
    )
  );

-- Monthly Reports policies
CREATE POLICY "Users can view own reports" ON monthly_reports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reports" ON monthly_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Users indexes
CREATE INDEX idx_users_email ON users(email);

-- User Personas indexes
CREATE INDEX idx_user_personas_user_id ON user_personas(user_id);

-- Subscriptions indexes
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_next_renewal_date ON subscriptions(next_renewal_date);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_category ON subscriptions(category);

-- Price History indexes
CREATE INDEX idx_price_history_subscription_id ON subscription_price_history(subscription_id);

-- Assessments indexes
CREATE INDEX idx_assessments_user_id ON assessments(user_id);
CREATE INDEX idx_assessments_created_at ON assessments(created_at DESC);

-- Check-Ins indexes
CREATE INDEX idx_weekly_checkins_user_id ON weekly_checkins(user_id);
CREATE INDEX idx_weekly_checkins_date ON weekly_checkins(checkin_date DESC);
CREATE INDEX idx_checkin_responses_checkin_id ON checkin_responses(checkin_id);

-- Monthly Reports indexes
CREATE INDEX idx_monthly_reports_user_id ON monthly_reports(user_id);
CREATE INDEX idx_monthly_reports_month ON monthly_reports(report_month DESC);

-- ============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_personas_updated_at
  BEFORE UPDATE ON user_personas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_weekly_checkins_updated_at
  BEFORE UPDATE ON weekly_checkins
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- DONE! 🎉
-- ============================================================================
-- All tables, RLS policies, indexes, and triggers are now set up.
-- Next steps:
-- 1. Get your Supabase URL and anon key from the project settings
-- 2. Update your .env file
-- 3. Test the connection from your app
