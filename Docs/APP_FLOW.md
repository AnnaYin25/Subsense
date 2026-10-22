# App Flow & Navigation
# Subscription Manager - User Journey Documentation

**Version:** 1.0  
**Last Updated:** February 2026  
**Platform:** iOS (React Native + Expo)

---

## 1. Navigation Architecture

### 1.1 App Structure Overview
```
Root Navigator (Stack)
├── Onboarding (first-time only)
├── Setup (first-time only)
└── Main App (Tab Navigator)
    ├── Manager (Hub) - Home/Dashboard
    ├── Check-In - Weekly review
    ├── Audit - New subscription assessment
    └── Report - Monthly health score
```

### 1.2 Bottom Tab Navigation
**Tabs (Left to Right):**
1. **Manager** - Icon: `dashboard` / Label: "Manager"
2. **Check-In** - Icon: `swipe` / Label: "Check-In"
3. **Audit** - Icon: `psychology` / Label: "Audit"
4. **Report** - Icon: `assessment` / Label: "Report"

**Tab Behavior:**
- Active tab highlighted with primary color
- Inactive tabs in gray
- Badge indicators:
  - Manager: None
  - Check-In: Red dot if check-in pending
  - Audit: None
  - Report: "New" badge on 1st of month

---

## 2. First-Time User Flow (FTUX)

### Flow 2.1: Onboarding → Setup → Main App

#### **Screen 2.1.1: Onboarding Welcome**
**Purpose:** Brand introduction and value proposition

**Layout:**
- Hero illustration (subscription chaos → organized bliss)
- Headline: "Take Control of Your Subscriptions"
- Subheadline: "Track, audit, and optimize with AI-powered insights"
- CTA button: "Get Started"

**User Actions:**
- Tap "Get Started" → Navigate to Setup Step 1

**Exit Points:** None (must complete onboarding)

---

#### **Screen 2.1.2: Setup Step 1 - Personal Info**
**Purpose:** Collect basic user information

**Form Fields:**
1. **Nickname** (text input, required)
   - Placeholder: "What should we call you?"
   - Max 20 characters
2. **Age** (number input, required)
   - Placeholder: "Your age"
   - Validation: 18-100
3. **Avatar Selection** (image picker)
   - 8 pre-designed avatars to choose from
   - Click to select, highlight with primary border

**Buttons:**
- "Next" (bottom right) → Navigate to Setup Step 2
- Validation: All fields required, shows error toast if incomplete

**Exit Points:** Back button closes app (with confirmation dialog)

---

#### **Screen 2.1.3: Setup Step 2 - Budget & Preferences**
**Purpose:** Establish financial context and subscription style

**Form Fields:**
1. **Monthly Budget** (currency input, required)
   - Label: "What's your monthly subscription budget?"
   - Placeholder: "$100"
   - Currency selector (dropdown): USD (default), CNY, EUR, GBP, JPY, etc.

2. **Subscription Style** (single-select, required)
   - Label: "Which describes you best?"
   - Options (radio buttons):
     - 🧪 "Free Trial Tester" - I always try before I buy
     - 🛡️ "Long-Term Subscriber" - I stick with what works
     - 🎯 "Impulse Buyer" - I subscribe when I see a good deal

3. **Category Priorities** (multi-select, optional)
   - Label: "Where do you currently spend most?"
   - Chips (tap to toggle):
     - 🎬 Entertainment
     - 💼 Productivity
     - 🔧 Utilities
     - 💪 Health
   - Shows visual distribution estimate (e.g., "Entertainment 40%, Productivity 30%...")

**Buttons:**
- "Back" (top left) → Return to Step 1
- "Next" (bottom right) → Navigate to Setup Step 3

---

#### **Screen 2.1.4: Setup Step 3 - Check-In Preferences**
**Purpose:** Set up weekly check-in schedule

**Form Fields:**
1. **Check-In Day** (dropdown, required)
   - Label: "When should we remind you for weekly check-ins?"
   - Options: Sunday (default), Monday, Tuesday, ..., Saturday
   
2. **Renewal Reminder** (number input, required)
   - Label: "Remind me __ days before renewals"
   - Default: 3 days
   - Validation: 1-14 days

**Buttons:**
- "Back" → Return to Step 2
- "Next" → Navigate to Setup Step 4

---

#### **Screen 2.1.5: Setup Step 4 - Add First Subscription**
**Purpose:** Guide user to add at least one subscription to activate dashboard

**Layout:**
- Heading: "Let's add your first subscription!"
- Subheading: "You can add more anytime from the Manager tab"
- Two large action cards:
  1. **"Add Manually"** (primary card)
     - Icon: `edit` 
     - → Navigate to Add Subscription Form
  2. **"Upload Screenshot"** (secondary card)
     - Icon: `photo_camera`
     - → Trigger image picker → OCR flow

**Buttons:**
- "Skip for Now" (text link, bottom center) → Navigate to Manager (empty state)
- If subscription added: "Done" button appears → Navigate to Manager

---

#### **Screen 2.1.6: Add Subscription Form (Embedded in Setup)**
**Purpose:** Capture first subscription details

**Form Fields (Single Page):**
1. **Service Name** (text input, required)
   - Placeholder: "e.g., Netflix"
   - Auto-suggest from common services (Netflix, Spotify, etc.)

2. **Plan Name** (text input, required)
   - Placeholder: "e.g., Premium"

3. **Cost** (currency input, required)
   - Placeholder: "15.99"
   - Currency symbol auto-filled from setup

4. **Billing Cycle** (dropdown, required)
   - Options: Daily, Weekly, Monthly (default), Quarterly, Yearly

5. **Category** (dropdown, required)
   - Options: Entertainment (default), Productivity, Utilities, Health
   - AI auto-suggests based on service name

6. **Next Renewal Date** (date picker, required)
   - Calendar UI, defaults to 30 days from today

7. **Notes** (text area, optional)
   - Placeholder: "e.g., Family plan, shared with roommate"
   - Max 500 characters

**Buttons:**
- "Cancel" (top left) → Return to Setup Step 4 (confirm discard changes)
- "Save Subscription" (bottom, full-width primary) → Save to database → Return to Setup Step 4 (shows success toast)

---

#### **Screen 2.1.7: OCR Screenshot Flow (Alternative to Manual)**
**Purpose:** Extract subscription data from screenshot

**Step 1: Image Picker**
- Opens iOS photo library / camera
- User selects image

**Step 2: Processing Screen**
- Loading spinner with message: "Analyzing screenshot with AI..."
- Takes 2-5 seconds

**Step 3: Review Extracted Data**
- Shows same Add Subscription Form (Screen 2.1.6)
- Fields pre-filled with OCR results:
  - Service Name, Cost, Billing Cycle auto-populated
  - Category AI-suggested
  - Other fields blank (user completes)
- Highlighted fields indicate AI-extracted data
- User edits if needed

**Step 4: Save**
- Same as manual flow → Return to Setup Step 4

**Error Handling:**
- If OCR fails: Toast message "Couldn't extract data. Please enter manually." → Opens blank form

---

### Flow 2.2: Setup Completion → Manager Dashboard

**Transition:**
- After first subscription saved (or skip), navigate to Manager tab
- Shows animated celebration: "You're all set! 🎉"
- Bottom tabs appear for first time

---

## 3. Manager (Hub) Flow

### Flow 3.1: Manager Dashboard Main View

#### **Screen 3.1.1: Manager Dashboard**
**Purpose:** Central hub for subscription overview

**Layout Sections (Top to Bottom):**

**Header:**
- Title: "MANAGER" (centered, uppercase)
- Settings icon (top right) → Navigate to Settings

**User Stats Card:**
- Avatar (left, large, tappable → Settings)
- Name + Subscription Persona Badge (e.g., "PRO SAVER" with premium icon)
- Foldable Persona Highlight (tap to expand):
  - Persona emoji, title, description
  - Savings tip in a card
- Budget vs Active Spend (2 cards side-by-side):
  - Budget: $100 (gray card)
  - Active: $87.50 (primary-colored card)

**Calendar Widget:**
- Weekly view (Sunday-Saturday)
- Month/Year header with prev/next week buttons
- 7 day cells:
  - Show day number
  - Renewal indicator dot (primary color) if subscriptions renew that day
  - Reminder indicator dot (red, pulsing) if trial ends that day
  - Selected day highlighted with primary background
- Below calendar: List of subscriptions renewing on selected day
  - Service emoji + name + cost
  - Tap subscription → Navigate to Subscription Detail
- If no renewals: "No active events on [date]"

**Filter Chips:**
- "All" / "Active" / "Paused"
- Tap to filter subscription list below

**Subscription List (Grouped by Category):**
- Categories: Entertainment, Productivity, Utilities, Health
- Each category shows if ≥1 subscription in that category
- Subscription Cards:
  - Icon emoji + Service name + Plan name
  - Cost + Next renewal date
  - If paused: Grayscale + opacity 50%
  - If reminder: Red text "Trial End" instead of cost
  - Tap card → Navigate to Subscription Detail

**Floating Action Button (FAB):**
- Icon: `add` (primary colored, bottom right corner, above bottom tabs)
- Tap → Show action sheet:
  - "Add Manually" → Navigate to Add Subscription Form
  - "Upload Screenshot" → Trigger OCR flow
  - "Cancel"

**User Actions:**
- Tap subscription card → Navigate to Subscription Detail (Flow 3.2)
- Tap FAB → Add new subscription (Flow 3.3)
- Tap Settings icon → Navigate to Settings (Flow 3.4)
- Swipe calendar week left/right → Change week
- Tap filter chip → Update list
- Search (future): Search bar at top

---

### Flow 3.2: Subscription Detail Page

#### **Screen 3.2.1: Subscription Detail**
**Purpose:** View and edit individual subscription

**Layout:**
- **Header:**
  - Back button (top left) → Return to Manager
  - Title: Service Name
  - More icon (top right, `more_vert`) → Show action menu:
    - "Edit Details"
    - "Pause Subscription"
    - "Cancel Subscription"
    - "Delete Subscription"

- **Hero Section:**
  - Large icon emoji (center)
  - Service name (large text)
  - Plan name + category badge

- **Key Info Cards:**
  - Cost (large, primary-colored)
  - Next renewal date with countdown (e.g., "Renews in 5 days")
  - Billing cycle (e.g., "Monthly")

- **Usage Trend (if available):**
  - Line chart showing usage scores from check-ins
  - X-axis: Past 4 weeks
  - Y-axis: 0-100 (hidden, just visual trend)
  - Label: "Usage Trend"

- **Notes Section:**
  - Editable text area
  - Placeholder: "Add notes about this subscription..."
  - Save button (appears on edit)

- **Price History (only if price changed):**
  - Heading: "Price History"
  - List of price changes:
    - Old price → New price
    - Date of change
    - User note (optional)

**User Actions:**
- **Edit Details:**
  - Opens inline edit mode
  - Editable fields: Plan name, Cost, Billing cycle, Category, Renewal date, Notes
  - "Save" / "Cancel" buttons
  - If cost changed: Prompts for optional note, logs to price history

- **Pause Subscription:**
  - Confirmation dialog: "Pausing will hide this from active spending. You can unpause anytime."
  - "Pause" / "Cancel"
  - If confirmed: Status → paused, return to Manager with toast "Subscription paused"

- **Cancel Subscription:**
  - Confirmation dialog: "Canceling marks this as inactive. Historical data is kept."
  - "Cancel Subscription" / "Keep It"
  - If confirmed: Status → cancelled, return to Manager

- **Delete Subscription:**
  - Confirmation dialog: "This will permanently delete all data. This cannot be undone."
  - "Delete" (red, destructive) / "Cancel"
  - If confirmed: Hard delete from database, return to Manager

---

### Flow 3.3: Add New Subscription (From Manager FAB)

#### **Screen 3.3.1: Add Subscription Form**
**Purpose:** Add new subscription (manual or OCR)

**Same as Screen 2.1.6 (Setup embedded form)**

**Differences:**
- Accessed from Manager FAB instead of setup flow
- "Cancel" button returns to Manager (not setup)
- "Save Subscription" returns to Manager with success toast

---

### Flow 3.4: Settings

#### **Screen 3.4.1: Settings Menu**
**Purpose:** App configuration and account management

**Sections:**

**Personal:**
- Avatar, Name (tap to edit)
- Edit button → Opens edit form (same fields as Setup Step 1)

**Preferences:**
- Monthly Budget (tap to edit → number input)
- Currency (tap to change → dropdown, warns about manual price updates)
- Check-In Day (tap to edit → dropdown)
- Renewal Reminder Days (tap to edit → number input)

**Account:**
- Email (display only, from auth)
- "Change Password" → Opens Supabase Auth password change flow
- "Log Out" → Confirmation → Sign out → Return to Onboarding

**Data Management:**
- "Export My Data" → Generates JSON download
- "Delete Account" → Confirmation dialog → Hard delete → Return to Onboarding

**About:**
- App version
- Privacy Policy (external link)
- Terms of Service (external link)
- "Contact Support" (email link)

**User Actions:**
- Tap any setting → Edit inline or navigate to sub-screen
- Back button → Return to Manager

---

## 4. Check-In Flow

### Flow 4.1: Weekly Check-In Session

#### **Screen 4.1.1: Check-In Landing (If Pending)**
**Purpose:** Initiate weekly check-in

**Layout:**
- User avatar with animated greeting (waving hand)
- Heading: "Time for Your Weekly Check-In!"
- Subheading: "This will take about 2 minutes. Let's see how your subscriptions are doing."
- Progress preview: "You have [X] subscriptions to review"
- "Start Check-In" button (large, primary)

**User Actions:**
- Tap "Start Check-In" → Navigate to Card Stack (Screen 4.1.2)
- Swipe down / Back button → Return to Manager (check-in skipped, shows warning toast)

---

#### **Screen 4.1.2: Check-In Card Stack**
**Purpose:** Swipe through subscriptions with gesture-based feedback

**Layout:**
- **Progress Bar (top):** "3 / 10 subscriptions"
- **Card Stack:**
  - Top card fully visible
  - 2-3 cards peeking below with stacking effect
  - Card content:
    - Service icon emoji (large, center-top)
    - Service name + plan name
    - Cost per month
    - Usage trend badge (if available): "↑ Increasing" / "→ Stable" / "↓ Decreasing"
    - Last check-in note: "Last week: Heavy use"

- **Swipe Hints (first card only):**
  - Faint directional icons:
    - Left: "👈 Barely using"
    - Right: "👉 Love it"
    - Down: "👇 Occasional"

**User Actions:**

**Swipe Right (Love It):**
- Card flies off right with green glow
- Avatar reaction: Excited, grows larger
- **30% chance:** Next card shows 1 follow-up question
  - "What do you love most?" → 4 option buttons: Features / Content / Price / Community
  - Select option → Next subscription card
- **100% chance if new subscription:** Always asks follow-up on first check-in

**Swipe Left (Barely Using):**
- Card stops mid-screen, flips to reveal question UI
- Avatar reaction: Concerned, slight grayscale
- **Always triggers 3-5 AI questions:**
  - Question 1 (multiple choice): "Why is usage decreasing?"
    - Options: Too busy / Found alternative / Content stale / Price too high / Other (text input)
  - Question 2 (slider): "How likely to cancel in next 30 days?" (0-100%)
  - Question 3 (conditional, based on Q1 answer): AI-generated personalized question
  - Max 5 questions total
- After last question: "Next" button → Next subscription card

**Swipe Down (Occasional):**
- Card flips to show question UI (same as left swipe)
- Avatar reaction: Neutral
- **Triggers 2-3 AI questions:**
  - Fewer and lighter questions than left swipe
  - Example: "Is this service meeting your expectations?" (Yes/No/Somewhat)
- After questions: Next card

**Alternative (Accessibility):**
- Three buttons below card: "Barely Using" / "Occasional" / "Love It"
- Tap button → Same logic as swipe

**If 2+ Weeks of Left Swipes (Long-term low usage):**
- AI adds extra question: "Is this temporary or a permanent shift?"
- AI question count increases to 5 (max)

**Last Card:**
- After final swipe, navigate to Check-In Completion (Screen 4.1.3)

**Exit Points:**
- Back button (top left) → Confirmation dialog: "Progress won't be saved. Exit anyway?"
  - "Exit" → Return to Manager (check-in incomplete)
  - "Stay" → Resume check-in

---

#### **Screen 4.1.3: Check-In Completion**
**Purpose:** Celebrate completion and show next steps

**Layout:**
- Confetti animation
- Avatar gives thumbs up
- Heading: "Check-In Complete! 🎉"
- Summary stats:
  - "You reviewed [X] subscriptions in [Y] minutes!"
  - "Next check-in: [Next Sunday/Selected Day]"
- "Done" button (large, primary) → Return to Manager

**User Actions:**
- Tap "Done" → Navigate to Manager
- Auto-dismiss after 5 seconds → Navigate to Manager

**Background Processing:**
- AI parses all answers
- Extracts insights
- Updates `user_personas.conversation_history`
- Updates `user_personas.structured_data` (category preferences, subscription style)
- Saves raw responses to `checkin_responses` table

---

#### **Screen 4.1.4: Check-In Landing (If Already Completed)**
**Purpose:** Show completion status and next check-in date

**Layout:**
- Avatar (neutral pose)
- Heading: "You're all caught up!"
- Subheading: "You completed this week's check-in on [Date]."
- Next check-in reminder: "Next check-in: [Date]"
- "View Insights" button (future feature, currently disabled)

**User Actions:**
- Back button → Return to Manager

---

## 5. Audit Flow

### Flow 5.1: New Subscription Audit

#### **Screen 5.1.1: Audit Landing Page**
**Purpose:** Entry point for starting new assessment or viewing history

**Layout:**

**Tab Bar (top):**
- "New Audit" (default) / "History"

**Tab 1: New Audit**
- Hero illustration (AI assistant character)
- Heading: "Should You Subscribe?"
- Subheading: "Let's evaluate this together. I'll ask a few questions to give you personalized advice."
- "Start New Audit" button (large, primary)

**Tab 2: History**
- List of past assessments (most recent first, max 30):
  - Service emoji + name
  - Overall score (color-coded)
  - Date assessed
  - Final action badge (Tracked / Trial / Skipped)
- Tap item → Navigate to Archived Report (read-only)
- If empty: "No assessments yet. Start your first audit!"

**User Actions:**
- Tap "Start New Audit" → Navigate to Audit Chat (Screen 5.1.2)
- Tap history item → Navigate to Audit Report (Screen 5.1.4, read-only mode)

---

#### **Screen 5.1.2: Audit Chat Interface**
**Purpose:** Conversational AI-powered assessment

**Layout:**
- **Header:**
  - Back button (top left) → Confirmation: "Exit audit? Progress won't be saved."
  - Title: "Audit Assistant"

- **Chat Messages (scrollable):**
  - AI messages (left-aligned, light gray bubbles)
  - User messages (right-aligned, primary-colored bubbles)
  - Timestamp below each message

- **Input Area (bottom):**
  - Text input field
  - Send button (icon: `send`)
  - Attachment button (icon: `attach_file`) → Upload screenshot

**Conversation Flow:**

**Turn 1 (AI Greeting):**
- "Hi [User Name]! I'm here to help you evaluate new subscriptions. What service are you considering?"

**Turn 2 (User Input):**
- **Option A: Text**
  - User types: "I'm thinking about Spotify Premium"
- **Option B: Screenshot Upload**
  - User taps attachment → Image picker
  - AI performs OCR → Extracts service name, cost
  - AI responds: "I see you're looking at Spotify Premium for $10.99/month. Let me ask you a few questions..."

**Turn 3-7 (AI Questions, 3-5 total):**
- AI asks personalized questions based on:
  - User's existing subscriptions
  - User's budget
  - User's persona (from `user_personas`)
  - Recent check-in insights

**Example Questions:**
1. "This costs $10.99/month. Your monthly budget is $100, and you've spent $87.50. Does this fit comfortably?"
2. "I noticed you already have Apple Music for $9.99/month. Would Spotify replace it, or would you keep both?"
3. "In your recent check-in, you mentioned reducing music usage due to work. Has that changed?"
4. "Spotify Premium offers a free trial. Would you prefer starting with the trial first?"
5. "What features are most important to you? (Offline downloads / Playlists / Podcasts / Audio quality)"

**AI Question Format:**
- Multiple choice (buttons below AI message)
- Text input (user types answer)
- Slider (for likelihood scales)

**Turn 8 (AI Generates Report):**
- AI: "Thanks for answering! Let me analyze this for you..."
- Loading spinner (2-3 seconds)
- AI: "I've completed your assessment. Here's what I found." → Navigate to Audit Report (Screen 5.1.3)

**User Actions:**
- Type message → Send → AI responds
- Upload screenshot → OCR → AI extracts data → Continues conversation
- Back button → Exit with confirmation

**Background Processing (During Conversation):**
- Each AI question/answer logged to `assessments.conversation_transcript` (JSONB array)
- AI reads from `user_personas.structured_data` and `conversation_history` for personalization

---

#### **Screen 5.1.3: Audit Report (Generated)**
**Purpose:** Display assessment results with actionable recommendations

**Layout:**

**Hero Section:**
- Service name (large text, center)
- Service cost display (e.g., "$10.99/month")
- Overall score (huge number, e.g., "78")
- Status badge (Good / Fair / Poor, color-coded)
- Color-coded background gradient (green/yellow/orange/red based on score)

**Radar Chart Section:**
- 7-axis radar chart showing dimension scores (no numeric labels, just visual size)
- Axes:
  1. Price Reasonableness
  2. Overlap with Existing
  3. Usage Habit Match
  4. Budget Fit
  5. Free Trial Availability
  6. Value for Money
  7. Cancellation Flexibility
- Color gradient from red (low) → orange → yellow → green (high)

**AI Recommendation Section:**
- Heading: "My Recommendation"
- 2-3 sentence paragraph generated by AI
- Example: "Based on your existing Apple Music subscription and recent reduction in music usage, Spotify Premium might not add enough unique value right now. I recommend starting with the free trial to test if the exclusive podcasts justify the overlap."

**Action Buttons (size proportional to score):**
- **If score 80-100 (Good):**
  - "Track It" (largest, primary)
  - "Start Free Trial" (medium, secondary, if trial exists)
  - "Skip for Now" (smallest, text link)
  
- **If score 50-79 (Fair):**
  - "Start Free Trial" (largest, if trial exists)
  - "Track It" (medium)
  - "Skip for Now" (medium)
  
- **If score 0-49 (Poor):**
  - "Skip for Now" (largest, primary)
  - "Start Free Trial" (medium, if trial exists)
  - "Track It" (smallest, text link)

**User Actions:**

**Tap "Start Free Trial":**
- Dialog: "When does the trial end?" → Date picker
- User selects date → Save as subscription with:
  - `is_reminder = true`
  - `cost = 0`
  - `next_renewal_date = trial_end_date`
  - `status = active`
- Save to `assessments` table with `final_action = trial`
- Navigate to Manager with toast: "Trial reminder added!"

**Tap "Track It":**
- Navigate to Add Subscription Form (Screen 3.3.1)
- Pre-fill fields from conversation:
  - Service name, Cost, Category
- User confirms/edits → Save
- Save to `assessments` table with `final_action = tracked`
- Navigate to Manager with toast: "Subscription added!"

**Tap "Skip for Now":**
- Save to `assessments` table with `final_action = skipped`
- Navigate to Audit Landing with toast: "Assessment saved to history."

**Tap "Back":**
- Returns to Audit Landing (report is auto-saved to history)

**Background Processing (After Report Generation):**
- AI extracts insights from conversation
- Appends to `user_personas.conversation_history`:
  ```json
  {
    "timestamp": "2026-02-15T14:30:00Z",
    "source": "audit_assessment",
    "subscription": "Spotify Premium",
    "content": "User considering Spotify but already has Apple Music",
    "insights": "User values podcast content, willing to overlap if unique value exists"
  }
  ```
- Saves full report to `assessments` table

---

#### **Screen 5.1.4: Audit Report (Archived, Read-Only)**
**Purpose:** View past assessment from history

**Same layout as Screen 5.1.3, but:**
- No action buttons (read-only)
- "View Original Conversation" button (expands chat transcript below report)
- Back button → Return to Audit History

---

## 6. Report Flow

### Flow 6.1: Monthly Report

#### **Screen 6.1.1: Report Landing (If No Report Available)**
**Purpose:** Inform user report will generate after first month

**Layout:**
- Illustration (calendar with checkmark)
- Heading: "Your First Report is Coming Soon!"
- Subheading: "Reports generate automatically on the 1st of each month."
- Requirements checklist:
  - ✅ Track at least 3 subscriptions (if met)
  - ✅ Complete at least 1 check-in (if met)
  - "Your first report will generate on: [Next Month 1st]"

**User Actions:**
- Back button → Return to Manager

---

#### **Screen 6.1.2: Report Dashboard (Monthly Report Available)**
**Purpose:** Display monthly health score and insights

**Layout (Scrollable):**

**Section 1: Hero Score Card**
- Month label (e.g., "February 2026 Report")
- Overall score (huge number, center, e.g., "78")
- Color-coded background (green/yellow/orange/red)
- Status badge (Excellent / Good / Needs Improvement / Critical)

**Section 2: Monthly Stats Summary**
- Grid of stat cards (2x2):
  - **Total Spend:** "$87.50"
  - **Change from Last Month:** "+2 subscriptions, -1 cancelled"
  - **Budget Status:** "Under budget by $12.50" (green) or "Over budget by $5" (red)
  - **Active Subscriptions:** "10 active"

**Section 3: 6-Month Trend Chart**
- Line chart showing overall score over past 6 months
- X-axis: Month names (Feb, Mar, Apr...)
- Y-axis: Score (0-100, hidden labels, just trend line)
- Data points clickable → Navigate to archived report for that month
- If <6 months of data: Shows available months, placeholder for future

**Section 4: Dimension Breakdown**
- Heading: "Score Breakdown"
- 6 horizontal bars showing dimension scores:
  1. Budget Health (25%) - 90/100 (green bar)
  2. Usage Efficiency (25%) - 70/100 (yellow bar)
  3. Subscription Health (15%) - 85/100 (green bar)
  4. Cancellation Timeliness (15%) - 60/100 (orange bar)
  5. Category Balance (10%) - 75/100 (yellow bar)
  6. Cost Optimization (10%) - 80/100 (green bar)
- Each bar shows percentage fill and color gradient

**Section 5: Top 3 Wasted Subscriptions**
- Heading: "Subscriptions to Review"
- 3 cards (if applicable):
  - Service emoji + name
  - Monthly cost
  - Waste indicator: "Left-swiped 3 weeks in a row"
  - **NO action buttons** (informational only)
- If none: "Great job! No wasted subscriptions this month."

**Section 6: AI Optimization Suggestions**
- Heading: "Optimization Insights"
- Bulleted list (AI-generated text):
  - "Your Entertainment subscriptions are 45% of budget, 15% above your target. Consider optimizing this category."
  - "Netflix has shown low usage for 4 consecutive weeks. Review if still needed."
  - "You successfully canceled 2 low-usage subscriptions this month. Great progress!"
- **Tone:** Informational, NOT directive

**Section 7: Share Your Progress**
- "Share My Score" button (secondary, full-width)

**User Actions:**

**Tap "Share My Score":**
- Generates shareable card (PNG, 1080x1080px):
  - Background gradient (color matches score)
  - Overall score (large)
  - Month label
  - Stats:
    - "[X] subscriptions managed"
    - "Saved $[Y] this month" (budget - actual spend, if positive)
  - App logo + tagline: "Powered by Subscription Manager"
- Opens iOS share sheet → Save to Photos / Share to Instagram / X / Facebook / iMessage
- Saves card URL to `monthly_reports.shareable_card_url`

**Tap Month Dropdown (top right):**
- Dropdown menu: "February 2026" / "January 2026" / "December 2025" / ...
- Select past month → Navigate to archived report (same layout, read-only)

**Back Button:**
- Return to Manager

**Background Processing (Auto-Generated on 1st of Month at 12:00 AM):**
1. Calculate overall score (weighted average of 6 dimensions)
2. Generate dimension scores
3. Identify top 3 wasted subscriptions (waste_score = cost * (1 - usage_frequency))
4. AI generates optimization suggestions (3-5 bullets)
5. Generate shareable card image → Upload to S3 → Save URL
6. Save all data to `monthly_reports` table
7. If first report: Show "New" badge on Report tab

---

## 7. Error States & Edge Cases

### 7.1 Empty States

**Manager - No Subscriptions:**
- Illustration (empty box)
- "No subscriptions yet"
- "Add your first subscription" CTA → Add Subscription Form

**Check-In - No Active Subscriptions:**
- "No active subscriptions to review. Add subscriptions to start check-ins."

**Audit - No History:**
- "No assessments yet. Start your first audit!"

**Report - Insufficient Data:**
- "Your first report will generate on [Date]. Keep tracking!"

### 7.2 Network Errors

**AI Chat Timeout (>10 seconds):**
- Toast: "AI is taking longer than usual. Retrying..."
- Retry 3 times → If still fails: "Couldn't reach AI. Please check your connection."

**Supabase Sync Failed:**
- Toast: "Couldn't sync data. Changes saved locally, will retry when online."
- Auto-retry when connection restored

### 7.3 OCR Failures

**No Data Extracted:**
- Toast: "Couldn't extract data from screenshot. Please enter manually."
- Opens blank Add Subscription Form

**Partial Data Extracted:**
- Pre-fills available fields, leaves rest blank
- Highlights AI-filled fields in green

### 7.4 Invalid User Input

**Form Validation Errors:**
- Red text below field: "Service name required"
- "Cost must be a number"
- "Date cannot be in the past"
- Disable submit button until valid

**Budget Exceeded (Warning, Not Blocking):**
- When adding subscription that exceeds budget:
- Toast: "This will put you over budget by $X. Proceed anyway?"
- "Add Anyway" / "Cancel"

---

## 8. Navigation Transitions

### 8.1 Transition Types

**Push (Stack Navigation):**
- Manager → Subscription Detail
- Audit Landing → Audit Chat
- Add Subscription Form → Manager (after save)

**Modal (Present):**
- Settings
- Share Sheet
- Confirmation Dialogs

**Tab Switch:**
- Manager ↔ Check-In ↔ Audit ↔ Report (bottom tabs)

### 8.2 Gesture Support

**iOS Standard Gestures:**
- Swipe from left edge → Back (stack pop)
- Pull down → Dismiss modal

**Custom Gestures:**
- Check-in swipe cards (left/right/down)
- Calendar week swipe (left/right to change weeks)

---

## 9. Notification Flows

### 9.1 App-Internal Notifications (MVP)

**Renewal Reminder:**
- Trigger: X days before renewal date (user-configured)
- Banner at top of Manager: "[Service Name] renews in [X] days - $[Amount]"
- Tap banner → Navigate to Subscription Detail

**Check-In Reminder:**
- Trigger: Weekly on selected day at 8:00 PM
- Banner at top of Manager: "Time for your weekly check-in!"
- Tap banner → Navigate to Check-In

**Monthly Report Available:**
- Trigger: 1st of month after report generation
- Banner at top of Manager: "Your [Month] report is ready!"
- Tap banner → Navigate to Report

### 9.2 iOS Push Notifications (Future, Not MVP)

**Same triggers as app-internal, but:**
- Delivered as iOS push when app is closed
- Requires Apple Developer account + Expo Notifications setup

---

## 10. Deep Linking (Future)

**URL Scheme:** `submanager://`

**Supported Links:**
- `submanager://manager` → Manager tab
- `submanager://checkin` → Check-In tab
- `submanager://audit` → Audit tab
- `submanager://report` → Report tab
- `submanager://subscription/{id}` → Subscription Detail
- `submanager://add` → Add Subscription Form

**Use Cases:**
- Push notification tap → Deep link to relevant screen
- Email links (e.g., marketing emails)
- Cross-promotion (e.g., Instagram bio link)

---

## 11. Accessibility Considerations

### 11.1 VoiceOver Support
- All interactive elements have accessibility labels
- Swipe gestures have button alternatives (Check-in)
- Images have alt text

### 11.2 Dynamic Type
- Text scales with iOS system font size settings
- Tested at 200% scale

### 11.3 Color Contrast
- Meets WCAG AA standards (4.5:1 for text)
- Score colors distinguishable for colorblind users (use patterns in addition to color)

---

**END OF APP_FLOW.md**
