# Backend Structure & Database Schema
# Subscription Manager - Complete Backend Specification

**Version:** 1.0  
**Last Updated:** February 2026  
**Database:** Supabase (PostgreSQL 15+)  
**API:** Anthropic Claude API

---

## 1. Database Overview

### 1.1 Supabase Configuration
**Project Setup:**
- Region: Auto-select (US East for North America, EU West for Europe)
- PostgreSQL Version: 15+
- Row Level Security (RLS): Enabled on all tables
- Real-time: Disabled (MVP doesn't need live sync)

**Connection:**
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

---

## 2. Complete Database Schema

### Table List:
1. `users` - User profiles and preferences
2. `user_personas` - AI-generated persona data
3. `subscriptions` - All user subscriptions
4. `subscription_price_history` - Price change tracking
5. `assessments` - Audit reports
6. `weekly_checkins` - Check-in sessions
7. `checkin_responses` - Individual subscription responses
8. `monthly_reports` - Monthly health scores

---

### 2.1 Users Table

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  avatar TEXT NOT NULL,
  age INTEGER CHECK (age >= 18 AND age <= 100),
  monthly_budget DECIMAL(10, 2) NOT NULL DEFAULT 100.00,
  currency TEXT NOT NULL DEFAULT 'USD',
  reminder_day INTEGER NOT NULL DEFAULT 0 CHECK (reminder_day >= 0 AND reminder_day <= 6),
  reminder_days_before INTEGER NOT NULL DEFAULT 3 CHECK (reminder_days_before >= 1 AND reminder_days_before <= 14),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 2.2 User Personas Table

```sql
CREATE TABLE user_personas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  structured_data JSONB NOT NULL DEFAULT '{}',
  conversation_history JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);
```

**structured_data Example:**
```json
{
  "budget": 120.00,
  "category_preferences": {
    "Entertainment": 30,
    "Productivity": 40,
    "Utilities": 20,
    "Health": 10
  },
  "subscription_style": "free_trial_tester",
  "persona_metadata": {
    "emoji": "🧪",
    "title": "The Free Trial Tester",
    "description": "You love trying before buying.",
    "tip": "Consider starting with free trials to evaluate first."
  }
}
```

---

### 2.3 Subscriptions Table

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  cost DECIMAL(10, 2) NOT NULL,
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  category TEXT NOT NULL CHECK (category IN ('Entertainment', 'Productivity', 'Utilities', 'Health')),
  icon_emoji TEXT NOT NULL DEFAULT '📱',
  color TEXT NOT NULL DEFAULT '#6366F1',
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
```

---

### 2.4 Subscription Price History Table

```sql
CREATE TABLE subscription_price_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  old_price DECIMAL(10, 2) NOT NULL,
  new_price DECIMAL(10, 2) NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_note TEXT
);
```

---

### 2.5 Assessments Table

```sql
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
```

**dimension_scores Example:**
```json
{
  "price_reasonableness": 85,
  "overlap_with_existing": 40,
  "usage_match": 75,
  "budget_fit": 90,
  "has_free_trial": true,
  "value_for_money": 80,
  "cancellation_flexibility": 85
}
```

---

### 2.6 Weekly Check-Ins Table

```sql
CREATE TABLE weekly_checkins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  total_subs_reviewed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 2.7 Check-In Responses Table

```sql
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
```

---

### 2.8 Monthly Reports Table

```sql
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
```

**dimension_scores Example:**
```json
{
  "budget_health": 90,
  "usage_efficiency": 70,
  "subscription_health": 85,
  "cancellation_timeliness": 60,
  "category_balance": 75,
  "cost_optimization": 80
}
```

---

## 3. Row Level Security Policies

All tables have RLS enabled. Users can only access their own data.

**Example Policy (applies to all tables):**
```sql
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own data" ON subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own data" ON subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own data" ON subscriptions
  FOR DELETE USING (auth.uid() = user_id);
```

---

## 4. Indexes for Performance

```sql
-- Users
CREATE INDEX idx_users_email ON users(email);

-- User Personas
CREATE INDEX idx_user_personas_user_id ON user_personas(user_id);

-- Subscriptions
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_next_renewal_date ON subscriptions(next_renewal_date);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_category ON subscriptions(category);

-- Price History
CREATE INDEX idx_price_history_subscription_id ON subscription_price_history(subscription_id);

-- Assessments
CREATE INDEX idx_assessments_user_id ON assessments(user_id);
CREATE INDEX idx_assessments_created_at ON assessments(created_at DESC);

-- Check-Ins
CREATE INDEX idx_weekly_checkins_user_id ON weekly_checkins(user_id);
CREATE INDEX idx_weekly_checkins_date ON weekly_checkins(checkin_date DESC);
CREATE INDEX idx_checkin_responses_checkin_id ON checkin_responses(checkin_id);

-- Monthly Reports
CREATE INDEX idx_monthly_reports_user_id ON monthly_reports(user_id);
CREATE INDEX idx_monthly_reports_month ON monthly_reports(report_month DESC);
```

---

## 5. Anthropic Claude API Integration

### 5.1 API Configuration

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY!
});
```

### 5.2 Use Cases

**1. Audit Conversations (Sonnet 4):**
```typescript
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1000,
  system: `You are an AI assistant helping users evaluate new subscriptions.
User context: ${JSON.stringify(personaData)}
Existing subscriptions: ${JSON.stringify(existingSubscriptions)}`,
  messages: conversationHistory
});
```

**2. OCR Screenshot Analysis (Sonnet 4 Vision):**
```typescript
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 500,
  messages: [{
    role: 'user',
    content: [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: base64ImageData
        }
      },
      {
        type: 'text',
        text: 'Extract subscription details from this screenshot. Return JSON: {name, cost, billing_cycle, category}'
      }
    ]
  }]
});
```

**3. Check-In Questions (Haiku 4):**
```typescript
const response = await anthropic.messages.create({
  model: 'claude-haiku-4-20250514',
  max_tokens: 300,
  system: `Generate 3 personalized questions about why the user reduced usage of ${subscriptionName}.
User context: ${JSON.stringify(personaInsights)}`,
  messages: [{
    role: 'user',
    content: 'User swiped left (low usage). Ask why.'
  }]
});
```

**4. Persona Insights Extraction (Haiku 4):**
```typescript
const response = await anthropic.messages.create({
  model: 'claude-haiku-4-20250514',
  max_tokens: 200,
  system: 'Extract key insights from this check-in conversation. Return concise bullet points.',
  messages: conversationHistory
});
```

**5. Monthly Report Suggestions (Sonnet 4):**
```typescript
const response = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 500,
  system: `Generate 3-5 optimization suggestions for the user's subscriptions.
Be informational, not directive. No commands like "Cancel X".
User data: ${JSON.stringify(monthlyData)}`,
  messages: [{
    role: 'user',
    content: 'Generate monthly report suggestions'
  }]
});
```

---

## 6. Data Flow Diagrams

### 6.1 Add Subscription Flow

```
User Input (Manual/OCR)
  ↓
Frontend Validation
  ↓
Supabase: INSERT INTO subscriptions
  ↓
Update User Persona (if first subscription in category)
  ↓
Return to Manager Dashboard
```

### 6.2 Audit Assessment Flow

```
User Initiates Audit
  ↓
Frontend → Claude API (Conversation)
  ↓
AI Questions ↔ User Answers (3-5 turns)
  ↓
AI Generates Score + Recommendation
  ↓
Supabase: INSERT INTO assessments
  ↓
Update User Persona (conversation_history)
  ↓
Display Report to User
```

### 6.3 Weekly Check-In Flow

```
User Swipes Card (left/right/down)
  ↓
Frontend → Claude API (Generate Questions)
  ↓
User Answers Questions
  ↓
Supabase: INSERT INTO checkin_responses
  ↓
AI Extracts Insights (Claude API)
  ↓
Supabase: UPDATE user_personas (conversation_history)
  ↓
Update Subscription (usage_score, satisfaction_score)
  ↓
Check-In Complete
```

### 6.4 Monthly Report Generation Flow

```
Scheduled Job (1st of Month, 12:00 AM)
  ↓
Fetch User Data (subscriptions, check-ins, assessments)
  ↓
Calculate Dimension Scores (6 formulas)
  ↓
Calculate Overall Score (weighted average)
  ↓
Claude API: Generate Suggestions
  ↓
Supabase: INSERT INTO monthly_reports
  ↓
Generate Shareable Card (PNG) → Upload to Supabase Storage
  ↓
Notify User (App-internal banner)
```

---

## 7. API Endpoints (Future Backend Service)

**MVP: All database operations are client-side via Supabase SDK.**

**Future (if backend service needed):**

### Authentication
- `POST /auth/signup` - Create account
- `POST /auth/login` - Sign in
- `POST /auth/logout` - Sign out
- `POST /auth/reset-password` - Password reset

### Subscriptions
- `GET /subscriptions` - List user's subscriptions
- `POST /subscriptions` - Add subscription
- `GET /subscriptions/:id` - Get subscription details
- `PATCH /subscriptions/:id` - Update subscription
- `DELETE /subscriptions/:id` - Delete subscription

### Assessments
- `POST /assessments` - Create assessment
- `GET /assessments` - List user's assessments
- `GET /assessments/:id` - Get assessment details

### Check-Ins
- `POST /checkins` - Start check-in session
- `POST /checkins/:id/responses` - Submit swipe response
- `PATCH /checkins/:id/complete` - Mark check-in complete

### Reports
- `GET /reports` - List user's monthly reports
- `GET /reports/:month` - Get specific month's report
- `POST /reports/:id/share` - Generate shareable card

### Personas
- `GET /persona` - Get user's persona
- `PATCH /persona` - Update persona (admin only)

---

## 8. Data Retention & Cleanup

### Auto-Deletion Policies

**Conversation Transcripts (assessments):**
- Delete after 30 days
- Keep dimension_scores and ai_recommendation

**Check-In Conversation History (user_personas):**
- Keep only last 30 days of entries
- Archive older insights to structured_data

**Assessment History:**
- Keep last 30 assessments per user
- Auto-delete older ones

**Monthly Reports:**
- Keep all reports (no deletion)

**Implemented via PostgreSQL Scheduled Job (pg_cron):**
```sql
-- Run daily at 2:00 AM
SELECT cron.schedule(
  'cleanup-old-data',
  '0 2 * * *',
  $$
  DELETE FROM assessments 
  WHERE created_at < NOW() - INTERVAL '30 days'
  AND user_id IN (
    SELECT user_id FROM assessments 
    GROUP BY user_id 
    HAVING COUNT(*) > 30
  );
  $$
);
```

---

## 9. Backup & Recovery

**Supabase Automatic Backups:**
- Daily backups (retained for 7 days on free tier)
- Point-in-time recovery (paid tiers)

**Manual Backup Command:**
```bash
pg_dump -h db.your-project.supabase.co -U postgres -d postgres > backup.sql
```

---

## 10. Environment Variables

**Required in `.env`:**
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_ANTHROPIC_API_KEY=<your-anthropic-api-key>
```

**Security Notes:**
- `SUPABASE_ANON_KEY` is safe to expose (RLS protects data)
- `ANTHROPIC_API_KEY` should ideally be proxied through backend (future enhancement)

---

**END OF BACKEND_STRUCTURE.md**
