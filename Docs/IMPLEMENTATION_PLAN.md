# Implementation Plan
# Subscription Manager - Step-by-Step Build Sequence

**Version:** 1.0  
**Last Updated:** February 2026  
**Estimated Timeline:** 6-8 weeks (full-time development)  
**Platform:** iOS (React Native + Expo)

---

## Implementation Strategy

### Build Approach
- **Documentation-First:** All specs written before coding (DONE ✅)
- **Iterative Development:** Build in small, testable increments
- **Feature Flags:** Use flags for incomplete features (hide in UI)
- **Test Early:** Test on real device (iPhone) from Week 1

### Priority Levels
- **P0:** Must-have for MVP launch (product doesn't work without it)
- **P1:** Core value features (MVP must have these)
- **P2:** Important but can be added post-launch
- **P3:** Nice-to-have (future enhancements)

---

## Phase 1: Project Setup & Foundation (Week 1)

### Step 1.1: Initialize Project
**Priority:** P0  
**Duration:** 1 day  
**Dependencies:** None

**Tasks:**
```bash
# Create Expo project
npx create-expo-app subscription-manager --template blank-typescript

# Install core dependencies
cd subscription-manager
npx expo install react-native-reanimated react-native-gesture-handler react-native-screens react-native-safe-area-context
npm install @react-navigation/native @react-navigation/stack @react-navigation/bottom-tabs
npm install @supabase/supabase-js @anthropic-ai/sdk
npm install nativewind tailwindcss date-fns react-hook-form

# Setup Tailwind
npx tailwindcss init
```

**Configuration Files:**
- `tailwind.config.js` (copy from TECH_STACK.md)
- `tsconfig.json` (TypeScript strict mode)
- `app.json` (Expo config, bundle ID, name)
- `.gitignore` (add `.env`, `node_modules`)

**Verification:**
- Run `npx expo start` → App loads blank screen
- Test on physical iPhone via Expo Go

---

### Step 1.2: Setup Supabase Project
**Priority:** P0  
**Duration:** 0.5 day  
**Dependencies:** Step 1.1

**Tasks:**
1. Create Supabase project at supabase.com
2. Copy project URL and anon key
3. Create `.env` file:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://yourproject.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   EXPO_PUBLIC_ANTHROPIC_API_KEY=<your-anthropic-api-key>
   ```
4. Create database tables (copy SQL from BACKEND_STRUCTURE.md)
5. Enable Row Level Security on all tables
6. Test connection from app

**Verification:**
- Query `users` table from app (should return empty array)

---

### Step 1.3: Create Type Definitions
**Priority:** P0  
**Duration:** 0.5 day  
**Dependencies:** Step 1.2

**Files to Create:**
- `src/types/index.ts` (all TypeScript interfaces from PRD)

**Key Types:**
```typescript
export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string;
  monthly_budget: number;
  currency: string;
  // ... (from BACKEND_STRUCTURE.md)
}

export interface Subscription {
  id: string;
  user_id: string;
  name: string;
  plan_name: string;
  cost: number;
  // ... (from BACKEND_STRUCTURE.md)
}

// Export all interfaces
```

**Verification:**
- No TypeScript errors
- Types imported successfully in test component

---

### Step 1.4: Setup Authentication Context
**Priority:** P0  
**Duration:** 1 day  
**Dependencies:** Step 1.2, 1.3

**Files to Create:**
- `src/contexts/AuthContext.tsx`

**Features:**
- `signUp(email, password, name, avatar)`
- `signIn(email, password)`
- `signOut()`
- `currentUser` state
- Auto-load session on app start

**Verification:**
- Test sign-up flow (creates user in Supabase)
- Test sign-in flow (returns user data)
- Test sign-out flow (clears session)

---

### Step 1.5: Create Basic Navigation Structure
**Priority:** P0  
**Duration:** 1 day  
**Dependencies:** Step 1.4

**Files to Create:**
- `src/navigation/RootNavigator.tsx`
- `src/navigation/MainTabNavigator.tsx`

**Navigation Flow:**
```
RootNavigator (Stack)
├── OnboardingScreen (if first-time)
├── SetupScreen (if no subscriptions)
└── MainTabs (Bottom Tabs)
    ├── ManagerScreen (Hub)
    ├── CheckInScreen
    ├── AuditScreen
    └── ReportScreen
```

**Verification:**
- Bottom tabs render with placeholder screens
- Tab switching works smoothly

---

## Phase 2: Onboarding & Setup (Week 1-2)

### Step 2.1: Build Onboarding Screen
**Priority:** P0  
**Duration:** 0.5 day  
**Dependencies:** Step 1.5

**File:** `src/screens/OnboardingScreen.tsx`

**Layout (from APP_FLOW.md):**
- Hero illustration (static image for now)
- Headline + subheadline
- "Get Started" button → Navigate to Setup

**Verification:**
- Screen renders on first app launch
- Button navigates to Setup

---

### Step 2.2: Build Setup Flow (4 Steps)
**Priority:** P0  
**Duration:** 2 days  
**Dependencies:** Step 2.1

**File:** `src/screens/SetupScreen.tsx`

**Steps (from APP_FLOW.md):**
1. Personal Info (name, age, avatar selection)
2. Budget & Preferences (monthly budget, currency, subscription style, category priorities)
3. Check-In Preferences (reminder day, renewal reminder days)
4. Add First Subscription (manual entry only for MVP, OCR in Step 7.2)

**State Management:**
- Use `useState` for form data
- Validate on "Next" button
- Save to Supabase on Step 4 completion

**Verification:**
- Complete all 4 steps → User created in `users` table
- First subscription created in `subscriptions` table
- Navigate to Manager dashboard

---

## Phase 3: Manager Dashboard (Week 2-3)

### Step 3.1: Build Manager Dashboard Layout
**Priority:** P0  
**Duration:** 2 days  
**Dependencies:** Step 2.2

**File:** `src/screens/ManagerScreen.tsx`

**Layout Sections (from APP_FLOW.md, reference existing Hub.tsx):**
1. Header (title + settings icon)
2. User Stats Card (avatar, name, budget vs spend)
3. Calendar Widget (weekly view, renewal indicators)
4. Filter Chips (All/Active/Paused)
5. Subscription List (grouped by category)
6. FAB (Add subscription button)

**Data Fetching:**
```typescript
const { data: subscriptions } = await supabase
  .from('subscriptions')
  .select('*')
  .eq('user_id', user.id)
  .eq('status', 'active');
```

**Verification:**
- Dashboard displays subscriptions from database
- Calendar shows renewal dates correctly
- FAB opens Add Subscription form

---

### Step 3.2: Build Subscription Card Component
**Priority:** P0  
**Duration:** 1 day  
**Dependencies:** Step 3.1

**File:** `src/components/SubscriptionCard.tsx`

**Props:**
```typescript
interface SubscriptionCardProps {
  subscription: Subscription;
  onPress: () => void;
}
```

**Layout:**
- Icon emoji (left)
- Service name + plan name (center)
- Cost + renewal date (right)
- Style from FRONTEND_GUIDELINES.md

**Verification:**
- Card renders with correct data
- Tap opens Subscription Detail screen

---

### Step 3.3: Build Calendar Widget
**Priority:** P0  
**Duration:** 1.5 days  
**Dependencies:** Step 3.1

**File:** `src/components/CalendarWidget.tsx`

**Features:**
- Weekly view (Sunday-Saturday)
- Current week displayed by default
- Prev/Next week navigation
- Renewal indicators on days with subscriptions
- Selected day shows list of subscriptions renewing

**Logic:**
```typescript
const getSubsForDate = (date: Date) => {
  const dateStr = format(date, 'yyyy-MM-dd');
  return subscriptions.filter(s => s.next_renewal_date === dateStr);
};
```

**Verification:**
- Calendar displays current week
- Renewal dots appear on correct days
- Clicking day shows subscriptions renewing that day

---

### Step 3.4: Build Subscription Detail Screen
**Priority:** P0  
**Duration:** 1 day  
**Dependencies:** Step 3.2

**File:** `src/screens/SubscriptionDetailScreen.tsx`

**Layout (from APP_FLOW.md):**
- Hero section (icon, name, plan, category)
- Key info cards (cost, renewal date, billing cycle)
- Notes section (editable)
- Action buttons (Edit, Pause, Cancel, Delete)
- Price history (only if price changed)

**Verification:**
- All data displays correctly
- Edit mode works (inline editing)
- Pause/Cancel/Delete update database and return to Manager

---

### Step 3.5: Build Add/Edit Subscription Form
**Priority:** P0  
**Duration:** 1.5 days  
**Dependencies:** Step 3.4

**File:** `src/screens/AddSubscriptionScreen.tsx`

**Form Fields (from PRD):**
- Service Name, Plan Name, Cost, Billing Cycle, Category, Next Renewal Date, Notes

**Validation (react-hook-form):**
```typescript
const { control, handleSubmit, formState: { errors } } = useForm({
  defaultValues: {
    name: '',
    plan_name: '',
    cost: '',
    billing_cycle: 'monthly',
    category: 'Entertainment',
    next_renewal_date: addMonths(new Date(), 1),
    notes: ''
  }
});
```

**Auto-Category Suggestion:**
- Use simple keyword matching (Netflix → Entertainment, Notion → Productivity)
- Future: Claude API for smarter categorization

**Verification:**
- Form saves to Supabase
- Validation works (required fields, numeric cost)
- Returns to Manager with success toast

---

## Phase 4: AI Audit Feature (Week 3-4)

### Step 4.1: Build Audit Landing Page
**Priority:** P1  
**Duration:** 0.5 day  
**Dependencies:** Phase 3 complete

**File:** `src/screens/AuditScreen.tsx`

**Layout:**
- Tab bar (New Audit / History)
- "Start New Audit" button → Navigate to Audit Chat
- History list (read from `assessments` table)

**Verification:**
- Tabs switch correctly
- History shows past assessments (if any)

---

### Step 4.2: Build Audit Chat Interface
**Priority:** P1  
**Duration:** 2 days  
**Dependencies:** Step 4.1

**File:** `src/screens/AuditChatScreen.tsx`

**Chat UI:**
- Message list (scrollable, auto-scroll to bottom)
- AI messages (left-aligned, gray bubbles)
- User messages (right-aligned, primary-colored bubbles)
- Input field (bottom, with Send button)
- Attachment button (screenshot upload, see Step 4.4 for OCR)

**Claude API Integration:**
```typescript
const sendMessage = async (userMessage: string) => {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: systemPrompt, // Include persona data
    messages: conversationHistory
  });
  
  const aiReply = response.content[0].text;
  setConversationHistory([...conversationHistory, { role: 'assistant', content: aiReply }]);
};
```

**Conversation Flow (from APP_FLOW.md):**
1. AI greeting
2. User inputs service name
3. AI asks 3-5 questions
4. AI generates report → Navigate to Audit Report

**Verification:**
- Messages display correctly
- AI responds with relevant questions
- Conversation history maintained

---

### Step 4.3: Build Audit Report Screen
**Priority:** P1  
**Duration:** 1.5 days  
**Dependencies:** Step 4.2

**File:** `src/screens/AuditReportScreen.tsx`

**Layout (from APP_FLOW.md):**
- Hero section (score, status badge, color-coded background)
- Radar chart (7 dimensions, use Victory Native)
- AI recommendation text
- Action buttons (Track It / Start Free Trial / Skip)

**Score Calculation:**
```typescript
const calculateScore = (dimensions: DimensionScores) => {
  const weights = {
    price_reasonableness: 0.15,
    overlap_with_existing: 0.20,
    usage_match: 0.20,
    budget_fit: 0.15,
    has_free_trial: 0.10,
    value_for_money: 0.10,
    cancellation_flexibility: 0.10
  };
  
  let score = 0;
  Object.keys(weights).forEach(key => {
    score += dimensions[key] * weights[key];
  });
  return Math.round(score);
};
```

**Verification:**
- Report displays with correct data
- Radar chart renders (Victory Native)
- Action buttons trigger correct flows

---

### Step 4.4: Implement OCR for Screenshot Upload
**Priority:** P2 (Can defer to post-MVP)  
**Duration:** 1 day  
**Dependencies:** Step 4.2

**Implementation:**
```typescript
import * as ImagePicker from 'expo-image-picker';

const pickImage = async () => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    base64: true,
    quality: 0.8
  });
  
  if (!result.canceled && result.assets[0].base64) {
    const extracted = await extractFromImage(result.assets[0].base64);
    // Pre-fill form with extracted data
  }
};

const extractFromImage = async (base64: string) => {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
        { type: 'text', text: 'Extract subscription details. Return JSON: {name, cost, billing_cycle, category}' }
      ]
    }]
  });
  
  return JSON.parse(response.content[0].text);
};
```

**Verification:**
- Upload subscription screenshot → Extracts name, cost
- Form pre-fills with extracted data
- User confirms/edits before saving

---

## Phase 5: Weekly Check-In Feature (Week 4-5)

### Step 5.1: Build Check-In Landing Screen
**Priority:** P1  
**Duration:** 0.5 day  
**Dependencies:** Phase 4 complete

**File:** `src/screens/CheckInScreen.tsx`

**Layout:**
- If check-in pending: Welcome message + "Start Check-In" button
- If completed: "You're all caught up!" message

**Verification:**
- Screen detects if check-in pending (based on last check-in date)
- Button navigates to Card Stack

---

### Step 5.2: Build Swipe Card Stack
**Priority:** P1  
**Duration:** 3 days  
**Dependencies:** Step 5.1

**File:** `src/components/SwipeCardStack.tsx`

**Implementation (react-native-reanimated + gesture-handler):**
```typescript
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

const pan = Gesture.Pan()
  .onUpdate((e) => {
    translateX.value = e.translationX;
    translateY.value = e.translationY;
  })
  .onEnd((e) => {
    if (e.translationX > 120) {
      // Swipe right → Love it
      handleSwipeComplete('right');
    } else if (e.translationX < -120) {
      // Swipe left → Barely using
      handleSwipeComplete('left');
    } else if (e.translationY > 120) {
      // Swipe down → Occasional
      handleSwipeComplete('down');
    } else {
      // Reset card position
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    }
  });
```

**Features:**
- Card stacking effect (show top card + 2 peeking below)
- Swipe gestures (left/right/down)
- Avatar emotional reactions (scale, grayscale, brightness)
- Progress indicator ("3 / 10 subscriptions")

**Verification:**
- Swipe gestures work smoothly (60fps)
- Avatar reacts to swipe direction
- Progress updates after each card

---

### Step 5.3: Build AI Follow-Up Questions
**Priority:** P1  
**Duration:** 1.5 days  
**Dependencies:** Step 5.2

**Implementation:**
- Left swipe → Card flips to show question UI (3-5 questions)
- Down swipe → 2-3 questions
- Right swipe → 30% chance of 1 question

**Question Generation (Claude API):**
```typescript
const generateQuestions = async (subscription: Subscription, swipeDirection: string) => {
  const questionCount = swipeDirection === 'left' ? 5 : swipeDirection === 'down' ? 3 : 1;
  
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-20250514',
    max_tokens: 300,
    system: `Generate ${questionCount} personalized questions about ${subscription.name} usage.
    User persona: ${JSON.stringify(personaData)}`,
    messages: [{
      role: 'user',
      content: `User swiped ${swipeDirection}. Why might usage have changed?`
    }]
  });
  
  return parseQuestions(response.content[0].text);
};
```

**Question UI:**
- Multiple choice buttons
- Slider inputs
- Optional text input

**Verification:**
- AI generates relevant questions
- User can answer and proceed to next card

---

### Step 5.4: Update Persona After Check-In
**Priority:** P1  
**Duration:** 1 day  
**Dependencies:** Step 5.3

**Implementation:**
```typescript
const updatePersona = async (checkInResponses: CheckInResponse[]) => {
  // Extract insights from all responses
  const insights = await extractInsights(checkInResponses);
  
  // Append to conversation_history
  await supabase
    .from('user_personas')
    .update({
      conversation_history: [...existingHistory, ...insights]
    })
    .eq('user_id', user.id);
  
  // Update structured_data (e.g., category preferences)
  // Update usage_score and satisfaction_score on subscriptions
};
```

**Verification:**
- Persona updated after check-in
- Subscription usage_score updated
- Next audit references check-in insights

---

## Phase 6: Monthly Report Feature (Week 5-6)

### Step 6.1: Build Report Landing Screen
**Priority:** P1  
**Duration:** 0.5 day  
**Dependencies:** Phase 5 complete

**File:** `src/screens/ReportScreen.tsx`

**Layout:**
- If no report: "Your first report will generate on [date]"
- If report available: Display report

**Verification:**
- Screen detects if report exists for current month
- Shows placeholder if no report

---

### Step 6.2: Build Monthly Report Generation Logic
**Priority:** P1  
**Duration:** 2 days  
**Dependencies:** Step 6.1

**File:** `src/utils/generateMonthlyReport.ts`

**Calculation (from PRD):**
```typescript
const generateMonthlyReport = async (userId: string, month: Date) => {
  // Fetch data
  const subscriptions = await fetchSubscriptions(userId);
  const checkIns = await fetchCheckIns(userId, month);
  const budget = await fetchUserBudget(userId);
  
  // Calculate dimension scores
  const budgetHealth = calculateBudgetHealth(subscriptions, budget);
  const usageEfficiency = calculateUsageEfficiency(subscriptions, checkIns);
  const subscriptionHealth = calculateSubscriptionHealth(subscriptions);
  const cancellationTimeliness = calculateCancellationTimeliness(subscriptions, checkIns);
  const categoryBalance = calculateCategoryBalance(subscriptions, budget);
  const costOptimization = calculateCostOptimization(subscriptions);
  
  // Weighted average
  const overallScore = Math.round(
    budgetHealth * 0.25 +
    usageEfficiency * 0.25 +
    subscriptionHealth * 0.15 +
    cancellationTimeliness * 0.15 +
    categoryBalance * 0.10 +
    costOptimization * 0.10
  );
  
  // AI suggestions
  const suggestions = await generateSuggestions(subscriptions, checkIns);
  
  // Save to database
  await supabase.from('monthly_reports').insert({
    user_id: userId,
    report_month: format(month, 'yyyy-MM-01'),
    overall_score: overallScore,
    dimension_scores: { budgetHealth, usageEfficiency, ... },
    // ...
  });
};
```

**Verification:**
- Report generates with correct scores
- AI suggestions are informational (not directive)

---

### Step 6.3: Build Report Display UI
**Priority:** P1  
**Duration:** 1.5 days  
**Dependencies:** Step 6.2

**Layout (from APP_FLOW.md):**
- Hero score card (large number, color-coded)
- Monthly stats summary
- 6-month trend line chart (Victory Native)
- Dimension breakdown (horizontal bars)
- Top 3 wasted subscriptions
- AI optimization suggestions

**Verification:**
- All data displays correctly
- Trend chart shows past 6 months (or available months)
- Color coding matches score ranges

---

### Step 6.4: Build Shareable Report Card
**Priority:** P2 (Can defer)  
**Duration:** 1 day  
**Dependencies:** Step 6.3

**Implementation:**
- Generate PNG image (1080x1080px) using `react-native-view-shot`
- Upload to Supabase Storage
- Save URL in `monthly_reports.shareable_card_url`
- Open iOS share sheet

**Verification:**
- "Share My Score" button generates card
- Card displays score, stats, app branding
- Share sheet opens with PNG

---

## Phase 7: Polish & Optimization (Week 6-7)

### Step 7.1: Implement Dark Mode
**Priority:** P2  
**Duration:** 1 day  
**Dependencies:** All screens built

**Implementation:**
- Use `useColorScheme()` to detect system theme
- Apply `dark:` classes from FRONTEND_GUIDELINES.md
- Test all screens in dark mode

**Verification:**
- All screens look good in dark mode
- Colors contrast correctly

---

### Step 7.2: Add Loading States & Error Handling
**Priority:** P1  
**Duration:** 1 day  
**Dependencies:** All features built

**Tasks:**
- Add spinners for async operations
- Add error toasts for failed API calls
- Add empty states for lists
- Add retry buttons

**Verification:**
- No UI hangs during loading
- Errors display user-friendly messages

---

### Step 7.3: Implement Settings Screen
**Priority:** P1  
**Duration:** 1 day  
**Dependencies:** Manager complete

**File:** `src/screens/SettingsScreen.tsx`

**Features (from APP_FLOW.md):**
- Edit personal info (name, avatar, age)
- Edit preferences (budget, currency, check-in day, reminder days)
- Account actions (change password, log out, delete account)
- About section (privacy policy, terms, app version)

**Verification:**
- All edits save to database
- Log out returns to onboarding
- Delete account removes all user data

---

### Step 7.4: Add Animations & Micro-Interactions
**Priority:** P2  
**Duration:** 1.5 days  
**Dependencies:** All screens built

**Tasks:**
- Button press animations (scale-95)
- Card entrance animations (fade-in)
- Modal slide-in transitions
- Confetti animation (check-in completion)
- Avatar reactions (swipe feedback)

**Verification:**
- All animations run at 60fps
- No jank or lag

---

### Step 7.5: Test on Real Device & Fix Bugs
**Priority:** P1  
**Duration:** 2 days  
**Dependencies:** All features complete

**Testing Checklist:**
- Test all flows end-to-end
- Test on iPhone SE (small screen)
- Test on iPhone 14 Pro Max (large screen)
- Test with VoiceOver (accessibility)
- Test network errors (airplane mode)
- Test with large datasets (100+ subscriptions)

**Bug Fixes:**
- Fix any layout issues
- Fix any performance issues
- Fix any crashes

---

## Phase 8: Deployment (Week 7-8)

### Step 8.1: Prepare for TestFlight
**Priority:** P1  
**Duration:** 1 day  
**Dependencies:** All bugs fixed

**Tasks:**
1. Create Apple Developer account ($99/year)
2. Create App Store Connect app record
3. Configure bundle ID, app icon, splash screen
4. Update `app.json` with production settings
5. Build production app with EAS

```bash
eas build --platform ios --profile production
```

**Verification:**
- Build completes without errors
- .ipa file generated

---

### Step 8.2: Submit to TestFlight
**Priority:** P1  
**Duration:** 0.5 day  
**Dependencies:** Step 8.1

**Tasks:**
```bash
eas submit --platform ios
```

**App Store Connect Settings:**
- App name: "Subscription Manager"
- Primary category: Finance
- Age rating: 4+
- Privacy policy URL
- Support URL

**Verification:**
- App appears in TestFlight
- Internal testers can download

---

### Step 8.3: Beta Testing & Iteration
**Priority:** P1  
**Duration:** 1 week  
**Dependencies:** Step 8.2

**Tasks:**
- Recruit 10-20 beta testers
- Collect feedback via TestFlight
- Fix critical bugs
- Iterate on UX issues
- Submit new builds as needed

**Success Criteria:**
- 80%+ beta tester satisfaction
- <0.1% crash rate
- All P0/P1 features working

---

### Step 8.4: App Store Submission
**Priority:** P1  
**Duration:** 1 day  
**Dependencies:** Beta testing complete

**App Store Assets:**
- App icon (1024x1024px)
- Screenshots (6.5" and 5.5" iPhones)
- App preview video (optional)
- App description (engaging copy)
- Keywords (subscription, budget, AI, tracker)

**Review Notes:**
- Explain AI features (Anthropic Claude usage)
- Provide test account credentials
- Clarify data privacy (no credit cards stored)

**Verification:**
- App submitted for review
- Review time: 1-3 days typically

---

## Critical Path Timeline

**Week 1:** Setup, Onboarding, Setup Flow  
**Week 2:** Manager Dashboard (P0 features)  
**Week 3:** Manager Detail Pages + Add/Edit Subscription  
**Week 4:** AI Audit Feature  
**Week 5:** Weekly Check-In Feature  
**Week 6:** Monthly Report Feature  
**Week 7:** Polish, Settings, Testing  
**Week 8:** Deployment & Beta Testing  

**Total:** 8 weeks to production-ready MVP

---

## Feature Flags for Phased Rollout

```typescript
const FEATURE_FLAGS = {
  OCR_ENABLED: false,           // Enable in v1.1
  PUSH_NOTIFICATIONS: false,    // Enable in v1.2
  EMAIL_SCANNING: false,        // Enable in v2.0
  WEB_VERSION: false,           // Enable in v2.0
  DARK_MODE: true,              // Enabled in v1.0
  MONTHLY_REPORT_SHARE: true    // Enabled in v1.0
};
```

---

## Post-MVP Roadmap (v1.1+)

**v1.1 (Month 2):**
- OCR screenshot upload (if deferred from MVP)
- iOS Push Notifications
- Improved AI question generation

**v1.2 (Month 3):**
- Email scanning (Gmail/Outlook integration)
- Subscription price change auto-detection (via web scraping)
- Advanced analytics (spending trends, category drilldowns)

**v2.0 (Month 6):**
- Android version
- Web version (React Native Web)
- Family plans (shared subscriptions)
- Referral program

---

**END OF IMPLEMENTATION_PLAN.md**
