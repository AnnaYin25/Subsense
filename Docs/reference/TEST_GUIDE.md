# Testing Guide - Phase 1 Completion

**Date:** 2026-02-08
**Completed:** Phase 1, Steps 1.4-1.5
**Status:** Ready for testing

---

## What Was Completed

### ✅ Step 1.4: Authentication Context
- **File:** `app/src/contexts/AuthContext.tsx`
- **Features:**
  - `signUp(email, password, name, avatar)` - Creates new user and profile
  - `signIn(email, password)` - Authenticates existing user
  - `signOut()` - Logs out current user
  - Auto-session loading on app start
  - User profile management

### ✅ Step 1.5: Navigation Structure
- **Files:**
  - `app/src/navigation/RootNavigator.tsx` - Main stack navigator
  - `app/src/navigation/MainTabNavigator.tsx` - Bottom tab navigator
  - `app/src/screens/OnboardingScreen.tsx` - Welcome screen
  - `app/src/screens/ManagerScreen.tsx` - Dashboard placeholder
  - `app/src/screens/CheckInScreen.tsx` - Check-in placeholder
  - `app/src/screens/AuditScreen.tsx` - Audit placeholder
  - `app/src/screens/ReportScreen.tsx` - Report placeholder

### ✅ Infrastructure Updates
- **File:** `app/src/utils/supabase.ts` - Supabase client initialization
- **File:** `app/App.tsx` - Integrated AuthProvider and RootNavigator
- **File:** `app/babel.config.js` - Added NativeWind plugin
- **File:** `app/global.css` - NativeWind global styles
- **Installed:** `@react-navigation/native-stack` package

---

## How to Test

### Prerequisites
Before testing, you need to set up Supabase:

1. **Create Supabase Project:**
   - Go to https://supabase.com
   - Create a new project
   - Wait for database provisioning

2. **Configure Environment Variables:**
   Edit `app/.env` and add your Supabase credentials:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://yourproject.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   EXPO_PUBLIC_ANTHROPIC_API_KEY=your-claude-api-key-here
   ```

3. **Run Database Schema:**
   - Go to Supabase Dashboard → SQL Editor
   - Copy schema from `Docs/BACKEND_STRUCTURE.md` (if it exists)
   - Run the SQL to create tables
   - Enable Row Level Security on all tables

### Test Steps

#### 1. Start Development Server
```bash
cd app
npx expo start
```

#### 2. Launch on iPhone
- Scan QR code with Camera app (iOS)
- App should open in Expo Go
- You should see the Onboarding screen

#### 3. Test Navigation
- **Onboarding Screen:**
  - Should display "Welcome to Subscription Manager"
  - Tap "Get Started" button
  - Should navigate to MainTabs

- **Bottom Tabs:**
  - Verify all 4 tabs are visible: Manager, Check-In, Audit, Report
  - Tap each tab and verify screen changes
  - Each screen should show placeholder text

#### 4. Test Dark Mode (Optional)
- Change iPhone settings: Settings → Display & Brightness → Dark
- App should automatically switch to dark mode
- All text should be readable with proper contrast

---

## Expected Behavior

### ✅ Success Criteria
- [ ] App launches without errors
- [ ] Onboarding screen displays correctly
- [ ] "Get Started" button navigates to tabs
- [ ] All 4 tabs render and are tappable
- [ ] Tab bar styling matches design (primary color for active tab)
- [ ] No TypeScript errors in Metro bundler logs
- [ ] No red error screens

### ⚠️ Known Limitations (Expected)
- **Authentication not functional yet** - Auth requires Supabase database setup
- **All screens are placeholders** - Real content coming in Phase 2
- **No real data** - Database queries will fail until schema is created
- **Settings screen missing** - Will be added in Phase 7

---

## Troubleshooting

### Issue: App won't start
**Solution:**
```bash
# Clear Metro cache
npx expo start -c

# Reinstall dependencies
rm -rf node_modules
npm install
```

### Issue: "Cannot find module '@react-navigation/native-stack'"
**Solution:**
```bash
npm install @react-navigation/native-stack
```

### Issue: NativeWind classes not applying
**Solution:**
1. Verify `global.css` exists in `app/` directory
2. Verify `babel.config.js` includes `'nativewind/babel'` plugin
3. Restart Metro bundler: `npx expo start -c`

### Issue: Supabase connection error
**Solution:**
1. Verify `.env` file has correct values
2. Check Supabase project is not paused (free tier auto-pauses after inactivity)
3. Verify API keys are correct (copy fresh from Supabase Dashboard)

---

## Next Steps (Phase 2)

After testing Phase 1, proceed to **Phase 2: Onboarding & Setup**:

### Step 2.1: Build Onboarding Screen
- Enhance OnboardingScreen with hero illustration
- Add app feature highlights
- Improve button styling

### Step 2.2: Build Setup Flow (4 Steps)
- Personal Info (name, age, avatar selection)
- Budget & Preferences
- Check-In Preferences
- Add First Subscription

**Estimated Time:** 2-3 days for Phase 2

---

## Files Modified This Session

```
app/
├── App.tsx (updated - integrated AuthProvider & RootNavigator)
├── babel.config.js (updated - added NativeWind plugin)
├── global.css (created - NativeWind styles)
├── package.json (updated - added native-stack)
└── src/
    ├── contexts/
    │   └── AuthContext.tsx (created)
    ├── navigation/
    │   ├── RootNavigator.tsx (created)
    │   └── MainTabNavigator.tsx (created)
    ├── screens/
    │   ├── OnboardingScreen.tsx (created)
    │   ├── ManagerScreen.tsx (created)
    │   ├── CheckInScreen.tsx (created)
    │   ├── AuditScreen.tsx (created)
    │   └── ReportScreen.tsx (created)
    └── utils/
        └── supabase.ts (created)

Docs/
└── progress.txt (updated - marked Phase 1 complete)
```

---

## Code Quality Checklist

- [✅] All files follow TypeScript strict mode
- [✅] Path aliases (@/) used correctly
- [✅] Error handling in AuthContext (try-catch blocks)
- [✅] Proper TypeScript typing for navigation
- [✅] NativeWind classes for styling (no inline styles)
- [✅] Accessibility labels on navigation tabs
- [✅] Dark mode support in all screens
- [✅] Follows CLAUDE.md conventions

---

**End of Test Guide**

**Remember:** Test on a real iPhone device for best results. Simulator may have different behavior with gestures and animations.
