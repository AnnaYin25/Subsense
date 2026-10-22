# Product Requirements Document (PRD)
# Subscription Manager - AI-Powered Personal Subscription Management

**Version:** 1.0  
**Last Updated:** February 2026  
**Platform:** iOS (React Native + Expo)  
**Target Launch:** MVP in 8 weeks

---

## 1. Executive Summary

### 1.1 Product Vision
An AI-powered subscription management app that helps individuals (18-40 years old) intelligently track, audit, and optimize their recurring subscriptions through personalized insights and proactive decision support.

### 1.2 Core Problem Statement
Users struggle with:
- Forgetting about unused subscriptions until renewal charges appear
- Impulsive subscription decisions during promotions without evaluating fit
- Generic budget advice that ignores personal preferences (e.g., music lovers need multiple streaming services)
- Lack of personalized, intelligent guidance for subscription decisions

### 1.3 Solution Overview
A mobile-first iOS app with four core capabilities:
1. **Track** - Manage existing subscriptions with calendar-based renewal tracking
2. **Audit** - AI-powered assessment of new subscriptions before commitment
3. **Check-in** - Weekly swipe-based usage review with intelligent follow-up questions
4. **Report** - Monthly health score and optimization recommendations

---

## 2. Target Users

### 2.1 Primary Audience
- **Age:** 18-40 years old
- **Characteristics:**
  - Web-native, comfortable with technology
  - Price-sensitive but values quality
  - Manages 5+ active subscriptions
  - Prone to impulse subscription decisions during sales
  - Wants personalization, not one-size-fits-all budget advice

### 2.2 User Personas (Examples)
- **The Trial Tester:** Always starts with free trials, needs reminders before conversion
- **The Long-term Subscriber:** Prefers stability, rarely cancels, values loyalty
- **The Impulse Buyer:** Subscribes during promotions, regrets later, needs pre-assessment guardrails

### 2.3 User Pain Points
1. Discovering unused subscriptions only after renewal charges
2. Subscription fatigue from managing 10+ services
3. Guilt about spending on "luxury" categories (entertainment, wellness) despite genuine need
4. Difficulty evaluating if new subscription overlaps with existing ones
5. Forgetting to cancel after deciding to do so "next month"

---

## 3. Product Scope

### 3.1 Subscription Definition
**Included:**
- Paid recurring subscriptions (Netflix, Spotify, SaaS tools)
- Free trial periods (tracked as reminders, distinct from active subscriptions)
- Software with recurring renewal fees (Adobe, Microsoft 365)
- Physical recurring services (gym memberships, magazine subscriptions)
- B2B SaaS tools (Notion, Figma, Slack)

**Excluded:**
- One-time purchases without renewal requirements
- Utility bills (electricity, water - these are necessities, not optional subscriptions)

### 3.2 Subscription Categories
1. **Entertainment** - Video (Netflix, Disney+), Music (Spotify, Apple Music), Gaming (Xbox Game Pass)
2. **Productivity** - Work tools (Notion, Figma, Grammarly), Cloud storage (Dropbox, Google One)
3. **Utilities** - Essential services (VPN, antivirus, domain hosting)
4. **Health** - Fitness apps (Strava Premium), Meditation (Headspace, Calm)

### 3.3 Currency Support
- **Supported Currencies:** USD, CNY, EUR, GBP, JPY, AUD, CAD (all major currencies)
- **Single Currency Mode:** Users select one currency during setup; cannot mix currencies in subscription list
- **Currency Switching:** 
  - Available in Settings
  - Switching currency requires manual price updates for all subscriptions (user warned beforehand)

---

## 4. Core Features

## 4.1 Feature 1: Track Subscriptions

### 4.1.1 Purpose
Centralized dashboard for managing all active, paused, and trial-ending subscriptions with proactive renewal visibility.

### 4.1.2 User Stories
- **US-T1:** As a user, I want to manually add a subscription so I can track its renewal date and cost.
- **US-T2:** As a user, I want to upload a screenshot of a subscription confirmation so the app can auto-fill details for me.
- **US-T3:** As a user, I want to see a weekly calendar view of upcoming renewals so I'm not surprised by charges.
- **US-T4:** As a user, I want to categorize my subscriptions so I can see spending by Entertainment vs Productivity.
- **US-T5:** As a user, I want to record price changes so I know when subscriptions get more expensive.
- **US-T6:** As a user, I want to track free trial end dates separately from paid subscriptions so I can decide before auto-renewal.

### 4.1.3 Input Methods (Priority Order)
1. **Manual Entry** (Primary)
   - Required fields: Service name, Plan name, Cost, Billing cycle (daily/weekly/monthly/quarterly/yearly), Next renewal date, Category
   - Optional fields: Usage frequency (initial reference), Satisfaction score (initial reference), Notes
   - Auto-categorization: AI suggests category based on service name, user can override
   
2. **Screenshot OCR** (Secondary)
   - Supported sources: App Store subscription page, email confirmation
   - Flow: Upload → AI extracts data → Pre-filled form → User confirms/edits → Save
   - Fallback: If OCR fails, partial data is filled, user completes manually
   
3. **Email Scanning** (Future - not MVP)
   - Gmail/Outlook API integration
   - Auto-detect subscription confirmations

4. **Bank Account Sync** (Not Considered)
   - Privacy concerns, out of scope

### 4.1.4 Data Fields
**Required:**
- Service Name (string, max 50 chars)
- Plan Name (string, max 50 chars, e.g., "Premium", "Standard", "Pro")
- Cost (decimal, 2 decimal places)
- Billing Cycle (enum: daily, weekly, monthly, quarterly, yearly)
- Next Renewal Date (date)
- Category (enum: Entertainment, Productivity, Utilities, Health, user can add custom)

**Optional:**
- Start Date (date, original first payment date)
- Usage Frequency (enum: daily, weekly, rarely, initial reference only)
- Satisfaction Score (0-100, initial reference only)
- Notes (text, max 500 chars, e.g., "Family plan shared with roommate")

**System-Generated:**
- Icon Emoji (auto-assigned based on service name, user can customize)
- Color (auto-assigned for visual distinction)
- Status (enum: active, paused, cancelled, default: active)
- Is Reminder (boolean, true if free trial end reminder)

### 4.1.5 Dashboard Layout (Manager Page)
**Top Section:**
- User avatar, name, subscription persona badge
- Monthly budget vs current active spend (two cards side-by-side)
- Foldable persona highlight card (emoji, title, description, savings tip)

**Calendar Widget:**
- Weekly view (Sunday-Saturday)
- Month/Year display with prev/next week navigation
- Day cells show renewal count indicator
- Selected day shows list of subscriptions renewing that day
- Reminder subscriptions (trial ends) show in red, regular renewals in primary color

**Subscription List:**
- Grouped by category (Entertainment, Productivity, Utilities, Health)
- Each subscription card shows:
  - Icon emoji + service name + plan name
  - Cost + next renewal date
  - Click to view details page
- Filter chips: All / Active / Paused

**Search:**
- Search bar filters by service name or category

### 4.1.6 Subscription Detail Page
- Large icon emoji at top
- Service name, plan name, category badge
- Cost prominently displayed
- Next renewal date with countdown (e.g., "Renews in 5 days")
- Billing cycle displayed
- Usage trend (if available from check-ins)
- Notes section (editable)
- **Price History** (only visible if price changed):
  - List of price changes with dates
  - Old price → New price
  - User notes for each change
- Action buttons:
  - Edit subscription details
  - Pause subscription (status → paused)
  - Cancel subscription (status → cancelled)
  - Delete subscription (hard delete)

### 4.1.7 Renewal Reminders
- **Trigger:** X days before renewal date (user-configurable in Settings, default: 3 days)
- **Method:** 
  - MVP: App-internal notification (banner in-app)
  - Future: iOS Push Notification (requires Apple Developer account)
- **Content:** "[Service Name] renews in [X] days for $[Amount]"
- **Action:** Click to view subscription detail page

### 4.1.8 Success Criteria
- User can add 10 subscriptions manually in under 5 minutes
- OCR correctly extracts 80%+ of data from standard subscription screenshots
- Calendar view loads instantly (<500ms)
- 90%+ of users understand renewal dates from calendar at first glance

---

## 4.2 Feature 2: Audit New Subscriptions

### 4.2.1 Purpose
AI-powered conversational assessment of potential new subscriptions to prevent regretful impulse purchases and identify overlaps with existing subscriptions.

### 4.2.2 User Stories
- **US-A1:** As a user, I want to chat with an AI bot about a service I'm considering so I get personalized advice before subscribing.
- **US-A2:** As a user, I want to upload a screenshot of a promotion so the AI can evaluate if it's a good deal for me.
- **US-A3:** As a user, I want to see a scored report comparing the new service to my existing subscriptions so I avoid redundancy.
- **US-A4:** As a user, I want action buttons (Track / Try Free Trial / Skip) so I can act immediately on the recommendation.
- **US-A5:** As a user, I want to review my assessment history so I can see what I decided to skip and why.

### 4.2.3 Entry Points
- Dedicated "Audit" tab in bottom navigation
- "Audit new subscription" button on Manager dashboard

### 4.2.4 Conversation Flow
**Step 1: Initiation**
- AI greeting: "Hi [User Name]! I'm here to help you evaluate new subscriptions. What service are you considering?"
- User input options:
  - Text: "I'm thinking about Spotify Premium"
  - Screenshot upload: AI performs OCR → "I see you're looking at Spotify Premium for $10.99/month. Let me ask you a few questions..."

**Step 2: Information Gathering (3-5 questions, dynamically adjusted)**
Example questions based on persona:
- "This service costs $X/month. Your monthly budget is $Y, and you've already spent $Z. Does this fit comfortably?"
- "I noticed you already have Apple Music. Would this replace it, or would you keep both?"
- "Based on your past check-ins, you mentioned reducing music usage due to busy schedule. Has that changed?"
- "Does this service offer a free trial? Would you prefer starting there?"

**AI Personalization Rules:**
- Reference user's existing subscriptions: "You already have Netflix and Disney+..."
- Reference budget: "This would be 15% of your entertainment budget..."
- Reference persona traits: "You mentioned you prefer trying free trials first..."
- Reference recent check-in insights: "You said Spotify usage dropped because..."

**Step 3: Report Generation**
- Triggered automatically after conversation concludes
- AI generates:
  1. Overall score (0-100)
  2. Dimension scores (7 dimensions, visualized as radar chart)
  3. AI-written recommendation (2-3 sentences)
  4. Action buttons (size varies by score)

### 4.2.5 Scoring Dimensions (7 total)
1. **Price Reasonableness (15%)** - Compared to market average for similar services
2. **Overlap with Existing (20%)** - Functional redundancy with current subscriptions
3. **Usage Habit Match (20%)** - Alignment with user's lifestyle from persona
4. **Budget Fit (15%)** - Impact on category budget and total budget
5. **Free Trial Availability (10%)** - Bonus points if trial exists
6. **Value for Money (10%)** - Features per dollar ratio
7. **Cancellation Flexibility (10%)** - How easy to cancel (web scraping or knowledge base)

**Score Calculation:**
- Each dimension scored 0-100
- Weighted average = overall score
- Score buckets:
  - 80-100: Good (green) - "Strong fit, go for it"
  - 50-79: Fair (yellow/orange) - "Proceed with caution"
  - 0-49: Poor (red) - "Not recommended right now"

### 4.2.6 Assessment Report Page
**Visual Elements:**
- Service name + cost at top
- Overall score (large, color-coded)
- Status badge (Good/Fair/Poor)
- Radar chart showing 7 dimensions (no numeric labels, just visual size, color shifts red→orange→green based on score)

**Text Content:**
- AI recommendation paragraph (e.g., "Based on your usage patterns and existing Netflix subscription, Disney+ might not add enough unique content to justify $10.99/month. Consider starting with the free trial to evaluate.")

**Action Buttons (size proportional to recommendation strength):**
1. **"Start Free Trial"** 
   - Largest if score is Fair/Poor and trial exists
   - Creates a trial-end reminder in Manager
   - Prompts: "When does the trial end?" (date picker) → Saves as reminder subscription
   
2. **"Track It"** 
   - Largest if score is Good and no trial
   - Navigates to Add Subscription page
   - Pre-fills fields from conversation (service name, cost, category)
   - User confirms details → Saves to subscriptions list
   
3. **"Skip for Now"**
   - Always available
   - Saves assessment to history with "skipped" status
   - Closes report

### 4.2.7 Assessment History
**Location:** Audit page → "History" tab

**Display:**
- List of past assessments (most recent first, max 30 stored)
- Each item shows:
  - Service logo (emoji) + name
  - Score (color-coded number)
  - Date assessed
  - Final action taken (tracked/trial/skipped)
- Click to reopen full report (read-only)

### 4.2.8 Data Storage
- Conversation transcript stored as JSONB array in `assessments` table
- Insights extracted by AI and saved to `user_personas.conversation_history`
- Original transcript auto-deleted after 30 days to save storage

### 4.2.9 Success Criteria
- 70%+ of users complete at least one audit before subscribing to a new service
- Audit reports are comprehensible without AI knowledge (tested with non-technical users)
- Action button recommendations match user's final decision 80%+ of the time

---

## 4.3 Feature 3: Weekly Check-In

### 4.3.1 Purpose
Lightweight, gamified weekly review to capture subscription usage patterns and surface dissatisfaction early, building the persona model over time.

### 4.3.2 User Stories
- **US-C1:** As a user, I want a quick 2-minute weekly check-in so I can reflect on what I'm actually using.
- **US-C2:** As a user, I want to swipe cards left/right/down to indicate usage so it feels effortless.
- **US-C3:** As a user, I want the AI to ask personalized follow-up questions so I can articulate why usage changed.
- **US-C4:** As a user, I want to skip check-ins if I'm busy, but I understand this limits personalization.
- **US-C5:** As a user, I want the app to learn from my answers so future recommendations improve.

### 4.3.3 Trigger & Scheduling
- **Default:** Every Sunday evening (8:00 PM local time)
- **Customizable:** User selects preferred day in Settings (Sunday-Saturday)
- **Reminder:** 
  - MVP: App-internal notification
  - Future: iOS Push Notification ("Time for your weekly subscription check-in!")
- **Skippable:** User can dismiss, no penalty, but warned: "Skipping reduces personalization accuracy"

### 4.3.4 Check-In Flow
**Screen 1: Introduction**
- User avatar with animated greeting
- "Let's review your subscriptions! This will take about 2 minutes."
- Progress indicator: "0 / [X] subscriptions"
- "Start Check-In" button

**Screen 2-N: Swipe Cards**
- **Card Stack Display:** 
  - Top card fully visible with stacking effect below (2-3 cards peeking)
  - Card content:
    - Service icon emoji (large)
    - Service name + plan name
    - Cost per month
    - Usage trend (if available: "↑ Increasing" / "→ Stable" / "↓ Decreasing")
    - Last check-in feedback (e.g., "Last week: Heavy use")

- **Swipe Gestures:**
  - **Swipe Right** → "I'm using this actively and loving it"
    - Card flies right off screen with green glow
    - 30% chance triggers 1 follow-up question: "What do you love most about [service]?" (options: Features / Content / Price / Community)
    - 100% chance if first check-in for new subscription
  
  - **Swipe Left** → "Barely using this, considering canceling"
    - Card flips to show question interface
    - Always triggers 3-5 AI-generated follow-up questions
  
  - **Swipe Down** → "Using it occasionally, not great, not terrible"
    - Card flips to show question interface
    - Triggers 2-3 AI-generated questions (fewer than left swipe)

- **Alternative: Tap Buttons (for accessibility)**
  - Three buttons below card: "Barely Using" / "Occasional" / "Love It"

**Screen: AI Follow-Up Questions (appears after left/down swipe)**
- Card flips to reveal question UI on same screen (no navigation)
- Question format options:
  - **Multiple choice:** "Why is usage decreasing?" → Options: Too busy / Found alternative / Content stale / Price too high / Other
  - **Slider:** "How likely to cancel in next 30 days?" → 0% to 100% slider
  - **Text input:** "Tell me more..." (optional, short answer)
- AI-generated questions based on:
  - Subscription category (e.g., for fitness app: "Is it winter, so less motivation?")
  - User persona traits (e.g., for Trial Tester: "Did the trial experience not meet expectations?")
  - Past check-in patterns (e.g., if 2+ weeks of low use: "Is this temporary or a permanent shift?")
- Question count:
  - Left swipe (low usage): 3-5 questions, dig deeper
  - Down swipe (occasional): 2-3 questions, lighter touch
  - Right swipe (love it): 0-1 question, optional
  - Max 5 questions total (prevent fatigue)

**Screen: Completion**
- Celebratory animation (confetti, avatar gives thumbs up)
- Summary: "You reviewed [X] subscriptions in [Y] minutes!"
- Next check-in reminder: "See you next [Day]!"
- "View Insights" button → Navigate to persona summary (future feature)

### 4.3.5 Persona Update Logic
**After Each Check-In:**
1. AI parses all user answers
2. Extracts key insights:
   - Usage pattern changes (e.g., "User reduced Spotify usage due to busy work schedule")
   - Sentiment shifts (e.g., "User loves Netflix's original content")
   - Budget sensitivity triggers (e.g., "User reconsidering $15+ subscriptions")
3. Appends insights to `user_personas.conversation_history` as JSON:
   ```json
   {
     "timestamp": "2026-02-15T20:30:00Z",
     "source": "weekly_checkin",
     "subscription": "Spotify Premium",
     "content": "User swiped left, stated 'too busy' as reason",
     "insights": "Reduced usage due to temporary work overload, not dissatisfaction with service"
   }
   ```
4. Updates `user_personas.structured_data`:
   - Adjusts category preferences if spending shifts
   - Updates subscription style if behavior changes (e.g., Trial Tester → Long-term if user starts keeping subscriptions longer)

**Conflict Resolution:**
- If new insight contradicts old insight, DO NOT overwrite
- Store both with timestamps
- AI uses most recent insight in decision-making, but retains old context
- Example: "User said Spotify usage dropped in Jan due to work, but increased in Feb" → Both stored, AI infers this is temporary fluctuation

### 4.3.6 Visual Feedback During Swipe
- **Avatar Emotional Response:**
  - Swipe left: Avatar looks concerned, slight grayscale filter
  - Swipe right: Avatar looks excited, grows larger, green glow
  - Swipe down: Avatar looks neutral, no filter
- **Card Animation:**
  - Left: Red background fades in behind card
  - Right: Green background fades in behind card
  - Down: Yellow/orange background fades in
- **Progress Bar:** Updates after each card (e.g., "5 / 10 completed")

### 4.3.7 Skipping Logic
- User can exit check-in anytime (back button or close)
- Progress is NOT saved (all-or-nothing, must complete in one session)
- Skipped check-in shows warning next time: "You skipped last week. Your persona insights may be less accurate."
- Maximum check-in duration: 2 minutes (enforced by limiting to 10-12 active subscriptions per check-in)

### 4.3.8 Data Storage
**Tables Involved:**
- `weekly_checkins`: One row per check-in session
  - `checkin_date`, `completed` (boolean), `total_subs_reviewed`
- `checkin_responses`: One row per subscription reviewed
  - `subscription_id`, `swipe_direction`, `ai_questions` (JSONB array), `user_answers` (JSONB array), `extracted_insights` (text summary)

### 4.3.9 Success Criteria
- Average check-in completion time: < 2 minutes
- 60%+ weekly check-in completion rate
- AI-generated questions feel personalized (validated through user testing)
- Persona accuracy improves over time (measured by audit recommendation acceptance rate)

---

## 4.4 Feature 4: Monthly Report

### 4.4.1 Purpose
Automated monthly health assessment providing users with a clear score, trend analysis, and actionable optimization suggestions (informational, not directive).

### 4.4.2 User Stories
- **US-R1:** As a user, I want an automatic monthly report so I can see if my subscription habits are improving.
- **US-R2:** As a user, I want a single health score (0-100) so I can quickly gauge my performance.
- **US-R3:** As a user, I want to see which subscriptions I'm wasting money on so I can decide what to cancel.
- **US-R4:** As a user, I want AI suggestions for optimization without being told what to do (I make final decisions).
- **US-R5:** As a user, I want to share my score on social media so I can celebrate progress (or get accountability).

### 4.4.3 Trigger & Access
- **Auto-Generation:** 1st of every month at 12:00 AM local time
- **First Month:** Report unavailable until user has:
  - Tracked ≥3 subscriptions
  - Completed ≥1 weekly check-in
  - Placeholder message: "Your first report will generate on [Next Month 1st]. Keep tracking!"
- **Manual Access:** "Report" tab in bottom navigation

### 4.4.4 Overall Health Score (0-100)
**Calculation Formula (6 Dimensions):**

1. **Budget Health (25%)**
   - Formula: `100 - (actualSpend / monthlyBudget * 100 - 100)`
   - If under budget: Full points (100)
   - If at budget: 75 points
   - If over budget: Exponential decay (e.g., 20% over = 40 points)

2. **Usage Efficiency (25%)**
   - Formula: `(high-usage subs count / total active subs) * 100`
   - High-usage = right-swiped ≥2 weeks in a row during check-ins
   - Low-usage = left-swiped ≥2 weeks in a row (zombie subscriptions)
   - Zombie subs heavily penalize this dimension

3. **Subscription Health (15%)**
   - Formula: `(active subs / (active + paused + cancelled subs)) * 100`
   - Active subscriptions are healthy
   - Paused/cancelled subs indicate churn, reduce score

4. **Cancellation Timeliness (15%)**
   - Formula: Bonus points for canceling low-usage subs within 30 days of first left-swipe
   - Max +15 points if user canceled ≥1 zombie sub this month
   - 0 points if user kept zombies despite warnings

5. **Category Balance (10%)**
   - Formula: `100 - (sum of absolute deviations from target category %)`
   - Example: User wants 30% Entertainment, but spending 45% → -15 penalty
   - Calculated per category, averaged

6. **Cost Optimization (10%)**
   - Formula: Bonus points for:
     - Using free trials before committing (+3 points per trial used)
     - Downgrading to cheaper plans (+5 points per downgrade)
     - Pausing instead of canceling (+2 points, shows thoughtful decision)
   - Max +10 points total

**Final Score:**
- Weighted average of 6 dimensions
- Rounded to nearest integer (0-100)
- Color-coded:
  - 80-100: Green (Excellent)
  - 60-79: Yellow (Good)
  - 40-59: Orange (Needs Improvement)
  - 0-39: Red (Critical)

### 4.4.5 Report Content Layout

**Section 1: Hero Score**
- Large overall score (e.g., "78")
- Color-coded background
- Status badge (Excellent/Good/Needs Improvement/Critical)
- Month label (e.g., "February 2026 Report")

**Section 2: Monthly Stats**
- **Total Spend This Month:** $XX.XX
- **Change from Last Month:** +2 subscriptions, -1 cancellation
- **Budget Status:** Under/At/Over budget

**Section 3: 6-Month Trend Line Chart**
- X-axis: Past 6 months (or fewer if new user)
- Y-axis: Score (0-100)
- Line graph showing score evolution
- First-time users see placeholder: "Chart unlocks after 6 months of data"

**Section 4: Top 3 Wasted Subscriptions**
- **Definition:** High cost + Low usage
- **Calculation:** `waste_score = cost * (1 - usage_frequency)`
  - Usage frequency from check-in swipes (0 = always left-swiped, 1 = always right-swiped)
- **Display:**
  - Service name + emoji
  - Monthly cost
  - Usage summary (e.g., "Left-swiped 3 weeks in a row")
  - NO "Cancel Now" button (informational only)

**Section 5: Optimization Suggestions (AI-Generated)**
- **Content Guidelines:**
  - Informational, NOT directive
  - BAD: "Cancel Disney+ to save $10.99"
  - GOOD: "Your Entertainment subscriptions are 45% of budget, 15% above your target. Consider optimizing this category."
- **Suggestion Format:**
  - Category-level insights (e.g., "Entertainment spending is high")
  - Specific subscription mentions (e.g., "Netflix: Low usage for 4 weeks")
  - NO action buttons, user explores on their own
- **Example Suggestions:**
  - "Productivity tools are 15% under target budget. You have room to add new tools if needed."
  - "You successfully canceled 2 low-usage subscriptions this month. Great job staying on top of waste!"
  - "Free trial usage increased this month. You're making thoughtful decisions before committing."

**Section 6: Social Share Card**
- **Trigger:** "Share My Score" button at bottom of report
- **Content:**
  - Overall score (large)
  - Month label
  - Total subscriptions managed
  - Money saved this month (calculated as: budget - actual spend, if positive)
  - NO specific subscription names (privacy protection)
  - App branding (logo + tagline)
- **Format:** Generic image (PNG, 1080x1080px for Instagram)
- **Share Targets:** System share sheet (X/Twitter, Instagram, Facebook, iMessage, etc.)

### 4.4.6 Report History
- Reports stored permanently in `monthly_reports` table
- Accessible via dropdown menu in Report tab: "View Past Reports" → List of months → Select to view archived report

### 4.4.7 Data Storage
**`monthly_reports` Table Fields:**
- `report_month` (date, YYYY-MM-01 format)
- `overall_score` (int, 0-100)
- `dimension_scores` (JSONB: 6 dimensions with individual scores)
- `total_spend` (decimal)
- `subs_added` (int)
- `subs_cancelled` (int)
- `top_wasted_subs` (JSONB array, top 3 with waste scores)
- `ai_suggestions` (JSONB array, generated text)
- `shareable_card_url` (string, S3 URL to pre-rendered PNG)

### 4.4.8 Success Criteria
- Monthly report generates without errors for 95%+ of users
- Users can explain what their score means after viewing report (comprehension test)
- Share feature used by 20%+ of users (viral potential)
- AI suggestions do NOT pressure users into specific actions (validated through user interviews)

---

## 5. Non-Functional Requirements

### 5.1 Performance
- App launch time: < 2 seconds on iPhone 12 or newer
- Dashboard load time: < 500ms
- AI response time (chat messages): < 3 seconds per message
- OCR processing time: < 5 seconds per image
- Monthly report generation: < 10 seconds

### 5.2 Usability
- Zero-tutorial onboarding: Users should understand core features without help
- Check-in completion: < 2 minutes for 10 subscriptions
- Subscription addition: < 1 minute via manual entry
- Accessibility: VoiceOver support for visually impaired users

### 5.3 Reliability
- App crash rate: < 0.1% of sessions
- Data sync success rate: > 99.9% (Supabase)
- AI API uptime: > 99.5% (Anthropic Claude)

### 5.4 Security & Privacy
- No credit card numbers stored (only subscription costs)
- No bank account access
- All user data anonymized for AI training
- GDPR/CCPA compliance:
  - User data export (JSON format)
  - User data deletion (complete account wipe)
  - Clear privacy policy

### 5.5 Scalability
- MVP supports 10,000 users
- Database schema supports 100 subscriptions per user
- AI token budget: 100K tokens/month per user (average)

---

## 6. Out of Scope (Explicitly Excluded)

### 6.1 Features NOT in MVP
- Email scanning for automatic subscription detection
- Bank account sync (Plaid integration)
- Web version (mobile-only)
- Android version (iOS-only for MVP)
- Multi-user family plans (single-user only)
- Subscription price change auto-detection (user manually updates)
- Subscription pause/cancel via API (user does it on service website)
- Referral program
- Gamification beyond check-in swipe cards (no achievements, streaks)

### 6.2 Monetization (Future Consideration)
**MVP:** Free for all users (no paywall)

**Future Paid Features (Not Implemented):**
- Free Tier:
  - Track unlimited subscriptions
  - 3 assessments per month
  - Weekly check-in (simplified questions)
  - Monthly report (basic)
- Pro Tier ($4.99/month):
  - Unlimited assessments
  - AI-powered check-in questions (personalized deep dives)
  - Advanced monthly report (category drilldowns, custom goals)
  - Email scanning integration
  - Priority AI response times

---

## 7. Success Metrics (Post-Launch)

### 7.1 Activation Metrics
- % of users who add ≥3 subscriptions within first session: Target 70%
- % of users who complete setup questionnaire: Target 85%
- % of users who return within 7 days: Target 60%

### 7.2 Engagement Metrics
- Weekly check-in completion rate: Target 60%
- Monthly report open rate: Target 80%
- Assessment usage before new subscription: Target 40%

### 7.3 Value Metrics
- Average money saved per user per month: Target $15
- % of users who cancel ≥1 zombie subscription: Target 50%
- NPS (Net Promoter Score): Target 40+

### 7.4 Retention Metrics
- 30-day retention rate: Target 50%
- 90-day retention rate: Target 30%

---

## 8. Risks & Mitigation

### 8.1 Risk: AI Hallucinations
- **Mitigation:** Clear prompts with persona context, validation rules, human-in-loop for first 100 assessments

### 8.2 Risk: User Abandons Setup
- **Mitigation:** Minimize setup questions (4-5 max), make questionnaire skippable with defaults

### 8.3 Risk: Check-In Fatigue
- **Mitigation:** Strict 2-minute limit, gamified swipe UX, allow skipping

### 8.4 Risk: Low AI Budget for Free Users
- **Mitigation:** Optimize prompts, use Claude Haiku for simple tasks, cache persona context

### 8.5 Risk: Users Don't Trust AI Recommendations
- **Mitigation:** Transparency in scoring logic, show data sources, never force actions

---

## 9. Design Principles

### 9.1 Informational, Not Directive
- App ASSISTS decision-making, NOT makes decisions for user
- Bad: "Cancel Netflix now"
- Good: "Netflix has low usage for 3 weeks. Review in detail?"

### 9.2 Personalization Over Generic Advice
- Avoid one-size-fits-all budget rules
- Respect user's passion spending (e.g., music lovers need multiple streaming services)

### 9.3 Transparency in AI Logic
- Users should understand why AI recommends something
- Show reasoning: "Based on your budget..." / "Compared to your existing subscriptions..."

### 9.4 Minimal Friction
- Every feature should feel effortless
- Check-in in <2 minutes, subscription add in <1 minute

### 9.5 Delight Through Design
- Swipe animations, avatar reactions, celebratory completion screens
- Make budgeting feel less like homework, more like self-care

---

## 10. Glossary

- **Subscription:** Any recurring payment service (digital or physical)
- **Persona:** AI-generated user profile based on behavior, not demographics
- **Check-In:** Weekly swipe-based usage review
- **Audit:** Pre-purchase AI assessment of new subscription
- **Zombie Subscription:** Active subscription with consistently low usage (left-swiped ≥2 weeks)
- **Trial Reminder:** Countdown notification before free trial converts to paid
- **Dimension Score:** Individual metric contributing to overall health score
- **Waste Score:** Metric combining cost and low usage to identify inefficiency

---

**END OF PRD**
