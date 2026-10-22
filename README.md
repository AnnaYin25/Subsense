# Subscription Manager - AI-Powered iOS App
## Complete Documentation & UI Reference

**Project Status:** Documentation Complete, Ready for Implementation  
**Last Updated:** February 2026  
**Platform:** iOS (React Native + Expo)

---

## 🎯 Quick Start for AI Development Tools

**If you're an AI assistant (Claude Code, Cursor, etc.), start here:**

1. **READ FIRST:** [`docs/CLAUDE.md`](docs/CLAUDE.md) - Your operating manual
2. **THEN READ:** [`docs/progress.txt`](docs/progress.txt) - Current project status
3. **REFERENCE AS NEEDED:**
   - [`docs/PRD.md`](docs/PRD.md) - What to build
   - [`docs/APP_FLOW.md`](docs/APP_FLOW.md) - How it flows
   - [`docs/FRONTEND_GUIDELINES.md`](docs/FRONTEND_GUIDELINES.md) - How it looks
   - [`docs/BACKEND_STRUCTURE.md`](docs/BACKEND_STRUCTURE.md) - Data structure
   - [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) - Build sequence
   - [`docs/UI_CODE_REFERENCE.md`](docs/UI_CODE_REFERENCE.md) - Existing UI patterns

4. **CHECK EXISTING UI:** [`ui-reference/`](ui-reference/) - Production-quality UI code already exists

---

## 📁 Project Structure

```
subscription-manager-project/
│
├── 📁 docs/                          # Complete Documentation (8 files)
│   ├── PRD.md                        # Product Requirements (32K words)
│   ├── APP_FLOW.md                   # User Flows & Navigation (17K words)
│   ├── TECH_STACK.md                 # Technology Stack (10K words)
│   ├── FRONTEND_GUIDELINES.md        # Design System (12K words)
│   ├── BACKEND_STRUCTURE.md          # Database & API (8K words)
│   ├── IMPLEMENTATION_PLAN.md        # 8-Week Build Plan (15K words)
│   ├── CLAUDE.md                     # AI Operating Manual (6K words)
│   ├── progress.txt                  # Session Tracker (2K words)
│   └── UI_CODE_REFERENCE.md          # Existing UI Guide (4K words)
│
├── 📁 ui-reference/                  # Existing UI/UX Code (Reference Only)
│   ├── pages/                        # Screen components
│   │   ├── Hub.tsx                   # Manager dashboard ✅
│   │   ├── CheckIn.tsx               # Weekly check-in swipe cards ✅
│   │   ├── Assessment.tsx            # AI audit chat interface ✅
│   │   ├── Report.tsx                # Monthly report display ✅
│   │   ├── Setup.tsx                 # Onboarding setup flow ✅
│   │   ├── Onboarding.tsx            # Welcome screen ✅
│   │   ├── AddSubscription.tsx       # Add/edit subscription form ✅
│   │   └── SubscriptionDetail.tsx    # Subscription detail page ✅
│   ├── components/
│   │   └── BottomNav.tsx             # Bottom tab navigation ✅
│   ├── context/
│   │   └── SubscriptionContext.tsx   # State management ✅
│   ├── types.ts                      # TypeScript interfaces ✅
│   ├── constants.ts                  # Mock data ✅
│   └── README.md                     # UI code usage guide
│
└── 📄 README.md                      # This file
```

---

## 🚀 What This Project Is

An **AI-powered iOS mobile app** that helps users intelligently manage their subscriptions through:

1. **Track:** Calendar-based subscription tracking with renewal reminders
2. **Audit:** AI-powered pre-purchase assessment of new subscriptions
3. **Check-In:** Weekly swipe-based usage review with personalized AI questions
4. **Report:** Monthly health score with optimization suggestions

**Target Users:** Individuals (18-40) managing 5+ subscriptions, price-sensitive, seeking personalized budget management

**Unique Value:** AI personalization (not generic budget rules), conversational UX, proactive insights

---

## 📊 Documentation Overview

### Core Documents (Read in Order)

#### 1. **PRD.md** - Product Requirements Document
**What it contains:**
- 4 core features fully specified (Track, Audit, Check-In, Report)
- User stories, success criteria, design principles
- Technical requirements, constraints, out-of-scope features
- ~32,000 words of comprehensive product specification

**When to read:** Before starting any feature implementation

---

#### 2. **APP_FLOW.md** - User Flows & Navigation
**What it contains:**
- 11 major user flows (onboarding → setup → main features)
- Every screen's exact layout and content
- Navigation structure, transition types, error states
- Deep linking, accessibility considerations
- ~17,000 words of UI/UX specifications

**When to read:** Before building any screen or navigation

---

#### 3. **TECH_STACK.md** - Technology Stack
**What it contains:**
- All dependencies with exact version numbers
- React Native 0.76.5 + Expo 52 configuration
- Supabase + Anthropic Claude API integration
- NativeWind (Tailwind for RN), Victory Native, Reanimated
- Complete package.json specification
- ~10,000 words of technical specifications

**When to read:** During project setup and when adding dependencies

---

#### 4. **FRONTEND_GUIDELINES.md** - Design System
**What it contains:**
- Complete color system (light + dark mode)
- Typography scale, spacing, shadows, border radius
- Component styling patterns (buttons, cards, forms)
- Accessibility guidelines (VoiceOver, touch targets, contrast)
- **Based on existing UI code** from `ui-reference/`
- ~12,000 words of design specifications

**When to read:** Before styling any component

---

#### 5. **BACKEND_STRUCTURE.md** - Database & API
**What it contains:**
- 8 database tables with full SQL schemas
- Row Level Security policies for Supabase
- Anthropic Claude API integration patterns
- Data flow diagrams, indexes, cleanup policies
- ~8,000 words of backend specifications

**When to read:** When working with database or AI API

---

#### 6. **IMPLEMENTATION_PLAN.md** - Build Sequence
**What it contains:**
- 8-week development timeline (Phase 1-8)
- 30+ discrete implementation steps
- Priority levels (P0/P1/P2/P3)
- Dependencies mapped, critical path identified
- Feature flags for phased rollout
- ~15,000 words of implementation guidance

**When to read:** At the start of each development session

---

### Supporting Documents

#### 7. **CLAUDE.md** - AI Operating Manual
**Purpose:** Rules and patterns for AI development tools (Claude Code, Cursor)

**Contains:**
- File structure rules, code conventions
- Design system tokens (quick reference)
- Common code patterns and anti-patterns
- Lessons learned (self-improving section)

**Who reads this:** AI assistants at the start of every session

---

#### 8. **progress.txt** - Session Tracker
**Purpose:** Track what's done, what's next, blockers

**Contains:**
- Completed tasks (✅)
- In-progress work (🔄)
- Next steps (📋)
- Blockers (🚫)
- Session checklist

**Who updates this:** Developer/AI at the end of every session

---

#### 9. **UI_CODE_REFERENCE.md** - Existing UI Guide
**Purpose:** How to use the production-quality UI code in `ui-reference/`

**Contains:**
- Custom Tailwind configuration required
- Styling patterns extracted from existing code
- Component structure to replicate
- Dark mode implementation
- Conversion notes (Web React → React Native)

**When to read:** Before building any new UI component

---

## 🎨 UI Reference Code (`ui-reference/`)

### ⚠️ IMPORTANT

The `ui-reference/` folder contains **production-quality UI/UX code** that's already been designed and implemented. This is **NOT placeholder code** - it's the actual design you must match.

**Status:** ✅ Complete (8 screens + components + state management)

**Technology:** Currently Web React (uses `<div>`, `<span>`, `className`)  
**Target:** React Native (will convert to `<View>`, `<Text>`, keep `className` via NativeWind)

### What's Already Built

| File | Purpose | Status |
|------|---------|--------|
| `Hub.tsx` | Manager dashboard with calendar widget | ✅ Complete |
| `CheckIn.tsx` | Weekly swipe card stack with animations | ✅ Complete |
| `Assessment.tsx` | AI chat interface (audit feature) | ✅ Complete |
| `Report.tsx` | Monthly health score display | ✅ Complete |
| `Setup.tsx` | 4-step onboarding setup flow | ✅ Complete |
| `Onboarding.tsx` | Welcome screen | ✅ Complete |
| `AddSubscription.tsx` | Add/edit subscription form | ✅ Complete |
| `SubscriptionDetail.tsx` | Individual subscription detail page | ✅ Complete |
| `BottomNav.tsx` | Bottom tab navigation | ✅ Complete |
| `SubscriptionContext.tsx` | State management pattern | ✅ Complete |

### How to Use UI Reference

1. **Before building a new component:** Check if similar UI exists in `ui-reference/`
2. **Copy the styling pattern:** Use EXACT `className` combinations
3. **Match the structure:** Follow the same component hierarchy
4. **Convert to RN:** `<div>` → `<View>`, `<span>` → `<Text>` (keep classes)

**See [`ui-reference/README.md`](ui-reference/README.md) and [`docs/UI_CODE_REFERENCE.md`](docs/UI_CODE_REFERENCE.md) for details.**

---

## 🛠️ Development Workflow

### Session Start (Every Time)
1. ✅ Read [`docs/CLAUDE.md`](docs/CLAUDE.md)
2. ✅ Read [`docs/progress.txt`](docs/progress.txt)
3. ✅ Check current phase in [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md)
4. ✅ Reference relevant docs (PRD, APP_FLOW, FRONTEND_GUIDELINES, BACKEND_STRUCTURE)

### During Development
- ✅ Follow file structure rules from CLAUDE.md
- ✅ Use exact styling from FRONTEND_GUIDELINES.md and ui-reference/
- ✅ Reference database schema from BACKEND_STRUCTURE.md
- ✅ Test immediately after writing code
- ✅ Handle errors gracefully (try-catch everywhere)

### Session End (Every Time)
1. ✅ Update [`docs/progress.txt`](docs/progress.txt) (mark completed steps)
2. ✅ Update [`docs/CLAUDE.md`](docs/CLAUDE.md) if new patterns/lessons learned
3. ✅ Commit code to Git with descriptive message
4. ✅ Note blockers for next session

---

## 📅 Timeline

**Total Duration:** 6-8 weeks (full-time development)

**Phase Breakdown:**
- **Week 1:** Project setup, authentication, navigation
- **Week 2:** Manager dashboard, subscription CRUD
- **Week 3:** Subscription detail pages, calendar widget
- **Week 4:** AI Audit feature (chat + report)
- **Week 5:** Weekly Check-In (swipe cards + AI questions)
- **Week 6:** Monthly Report feature
- **Week 7:** Polish, settings, testing
- **Week 8:** Deployment, beta testing, App Store submission

**See [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) for detailed step-by-step plan.**

---

## 🎯 Key Technologies

- **Frontend:** React Native 0.76.5, Expo 52, TypeScript 5.6
- **Navigation:** React Navigation v7
- **Styling:** NativeWind (Tailwind for React Native)
- **Backend:** Supabase (PostgreSQL + Auth)
- **AI:** Anthropic Claude API (Sonnet 4.5 + Haiku 4.5)
- **Charts:** Victory Native
- **Animations:** React Native Reanimated v3
- **State:** React Context API (no Redux/MobX)

**See [`docs/TECH_STACK.md`](docs/TECH_STACK.md) for complete list with exact versions.**

---

## 🔒 Security & Privacy

- **No credit card storage** - Only subscription amounts tracked
- **No bank account access** - Users manually input subscriptions
- **Anonymized AI training** - All user data anonymized before use
- **RLS enabled** - Row Level Security on all Supabase tables
- **GDPR/CCPA compliant** - User data export and deletion supported

---

## 📱 Platform

**MVP:** iOS only (React Native + Expo)  
**Future:** Android (v2.0), Web (v2.0)

**Why iOS first:**
- Target demographic primarily uses iPhone
- Faster iteration with Expo Go testing
- TestFlight for easy beta distribution

---

## 💰 Monetization (Future)

**MVP:** Free for all users (no paywall)

**Future Paid Tier ($4.99/month):**
- Unlimited AI assessments (free: 3/month)
- Advanced weekly check-in questions
- Enhanced monthly reports
- Email scanning integration

---

## 🤝 Contributing

This is a personal project with complete documentation. If you're helping with development:

1. Read [`docs/CLAUDE.md`](docs/CLAUDE.md) first
2. Follow the [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) sequence
3. Match UI patterns from [`ui-reference/`](ui-reference/)
4. Update [`docs/progress.txt`](docs/progress.txt) after each session

---

## 📞 Support

**Project Owner:** Rbc  
**Purpose:** Personal subscription management + research showcase  
**Academic Context:** HCI research on LLM trustworthiness and AI delegation

---

## 📄 License

Private project - All rights reserved

---

## 🎉 Current Status

✅ **Documentation:** 100% complete (106,000+ words across 8 documents)  
✅ **UI/UX Design:** 100% complete (8 screens, production-ready code)  
🔄 **Implementation:** Not started (ready to begin Phase 1)  
⏳ **Timeline:** 6-8 weeks to MVP launch  

**Next Step:** Run `npx create-expo-app` and start Phase 1, Step 1.1 from IMPLEMENTATION_PLAN.md

---

**Last Updated:** February 7, 2026  
**Version:** 1.0 (Documentation Complete)
