# Supabase Setup Guide
## Subscription Manager - Complete Setup Instructions

---

## 📋 Prerequisites
- [ ] A Supabase account (free tier is sufficient)
- [ ] An Anthropic API key (for Claude API)

---

## 🚀 Step-by-Step Setup

### Step 1: Create Supabase Project

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Sign in or create an account

2. **Create New Project**
   - Click "New Project"
   - **Project Name:** `subscription-manager` (or any name you prefer)
   - **Database Password:** Create a strong password (save it securely)
   - **Region:** Select closest to you (e.g., US East, EU West)
   - **Plan:** Free tier is perfect for MVP
   - Click "Create new project"
   - ⏳ Wait 2-3 minutes for project to be ready

---

### Step 2: Run Database Schema

1. **Open SQL Editor**
   - In your Supabase project dashboard
   - Click "SQL Editor" in the left sidebar
   - Click "New query"

2. **Copy & Paste Schema**
   - Open the file: `supabase-schema.sql` (in this directory)
   - Copy ALL contents (entire file)
   - Paste into the SQL Editor

3. **Execute Schema**
   - Click "Run" button (or press Cmd/Ctrl + Enter)
   - ✅ You should see "Success. No rows returned"
   - This creates all 8 tables + RLS policies + indexes

---

### Step 3: Get API Keys

1. **Get Supabase Keys**
   - In Supabase Dashboard, click "Settings" (gear icon)
   - Click "API" in settings menu
   - Copy these two values:
     - **Project URL** (looks like: `https://xxxxx.supabase.co`)
     - **anon public** key (under "Project API keys")

2. **Get Anthropic API Key**
   - Visit: https://console.anthropic.com/
   - Sign in or create account
   - Go to "API Keys" section
   - Click "Create Key"
   - Copy the key (starts with `<your-anthropic-api-key>`)

---

### Step 4: Update .env File

1. **Open `.env` file** in the `app/` directory

2. **Paste your keys:**
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   EXPO_PUBLIC_ANTHROPIC_API_KEY=<your-anthropic-api-key>-here
   ```

3. **Save the file**
   - ⚠️ NEVER commit `.env` to Git (already in `.gitignore`)

---

### Step 5: Verify Database Setup

**Option A: Using Supabase Dashboard**
1. Go to "Table Editor" in Supabase
2. You should see 8 tables:
   - ✅ users
   - ✅ user_personas
   - ✅ subscriptions
   - ✅ subscription_price_history
   - ✅ assessments
   - ✅ weekly_checkins
   - ✅ checkin_responses
   - ✅ monthly_reports

**Option B: Using SQL Query**
Run this in SQL Editor:
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

---

### Step 6: Test Connection from App

1. **Start the app:**
   ```bash
   npm start
   ```

2. **Test authentication:**
   - App should load without errors
   - Try signing up with a test account
   - Check Supabase Dashboard → Authentication → Users
   - You should see the new user appear

---

## 🔒 Security Checklist

After setup, verify these security features:

### Row Level Security (RLS)
1. Go to "Authentication" → "Policies" in Supabase
2. Each table should have policies enabled
3. Test: Try accessing another user's data (should be blocked)

### Environment Variables
- [ ] `.env` file exists and has all 3 keys
- [ ] `.env` is listed in `.gitignore`
- [ ] Never shared API keys publicly

---

## 🧪 Test Queries

After setup, test these queries in Supabase SQL Editor:

**1. Check RLS is enabled:**
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = true;
```
Should return 8 tables.

**2. Check indexes:**
```sql
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename;
```
Should return 15+ indexes.

**3. Check triggers:**
```sql
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public';
```
Should return 4 triggers (updated_at triggers).

---

## 🐛 Troubleshooting

### Error: "relation does not exist"
**Solution:** Re-run the entire `supabase-schema.sql` file

### Error: "permission denied for table"
**Solution:** Check RLS policies are created correctly

### Error: "Could not connect to Supabase"
**Solution:**
- Verify `.env` file has correct keys
- Check Supabase project is active (not paused)
- Verify internet connection

### Error: "Anthropic API key invalid"
**Solution:**
- Get new key from https://console.anthropic.com/
- Make sure it starts with `sk-ant-`
- Check you have API credits remaining

---

## 📊 Database Size Estimates

**Free Tier Limits:**
- Database: 500 MB (more than enough for MVP)
- Storage: 1 GB
- Monthly API calls: Unlimited

**Expected Usage (100 users):**
- Users table: ~50 KB
- Subscriptions: ~500 KB
- Check-ins: ~2 MB
- Reports: ~1 MB
- **Total: ~3.5 MB** (well within limits)

---

## 🔄 Next Steps After Setup

1. ✅ Database schema created
2. ✅ RLS policies enabled
3. ✅ API keys configured
4. ✅ Connection tested

**Now you can:**
- Create your first user account
- Add subscriptions
- Test AI features
- Start building features

---

## 📞 Support

**Documentation:**
- Supabase Docs: https://supabase.com/docs
- Anthropic Docs: https://docs.anthropic.com/

**Common Issues:**
- Check `firebase-debug.log` for errors
- Use Supabase Dashboard logs: Project Settings → Logs
- Test queries in SQL Editor before running in app

---

**Last Updated:** February 2026
**Version:** 1.0
