# UI Reference Code
## Production-Quality UI/UX Design (DO NOT MODIFY - Reference Only)

**Status:** ✅ Complete  
**Technology:** Web React (to be converted to React Native)  
**Last Updated:** February 2026

---

## ⚠️ IMPORTANT - READ THIS FIRST

This folder contains **production-quality UI/UX code** that defines the visual design and interaction patterns for the Subscription Manager app.

**This is NOT starter code or placeholder code - it's the FINAL design you must match.**

---

## 📁 What's In This Folder

### Screens (`pages/`)

| File | Purpose | Complexity | Status |
|------|---------|------------|--------|
| **Hub.tsx** | Manager dashboard with calendar widget, stats cards, subscription list | High | ✅ Complete |
| **CheckIn.tsx** | Weekly swipe card stack with gesture animations, AI follow-up questions | Very High | ✅ Complete |
| **Assessment.tsx** | AI chat interface for subscription audit (bot/user bubbles, typing indicator) | Very High | ✅ Complete |
| **Report.tsx** | Monthly health score with radar chart, trend line, suggestions | High | ✅ Complete |
| **Setup.tsx** | 4-step onboarding setup flow (personal info, budget, preferences, first subscription) | High | ✅ Complete |
| **Onboarding.tsx** | Welcome screen with hero illustration | Low | ✅ Complete |
| **AddSubscription.tsx** | Add/edit subscription form with validation | Medium | ✅ Complete |
| **SubscriptionDetail.tsx** | Individual subscription detail page with edit/pause/delete actions | Medium | ✅ Complete |

### Components (`components/`)

| File | Purpose | Status |
|------|---------|--------|
| **BottomNav.tsx** | Bottom tab navigation bar (4 tabs: Manager, Check-In, Audit, Report) | ✅ Complete |

### Context (`context/`)

| File | Purpose | Status |
|------|---------|--------|
| **SubscriptionContext.tsx** | Global state management pattern using React Context API | ✅ Complete |

### Configuration

| File | Purpose | Status |
|------|---------|--------|
| **types.ts** | TypeScript interfaces (Subscription, AssessmentReport, Factor) | ✅ Complete |
| **constants.ts** | Mock subscription data for development | ✅ Complete |

---

## 🎯 How to Use This Code

### Step 1: DO NOT MODIFY THESE FILES
These files are **reference only**. Copy patterns from them, but don't edit them directly.

### Step 2: Understand What You're Looking At
This code is currently **Web React**:
- Uses `<div>`, `<span>`, `<img>`
- Uses `className` for Tailwind classes
- Uses `react-router-dom` for navigation

**You will convert to React Native:**
- `<div>` → `<View>`
- `<span>` → `<Text>`
- `<img>` → `<Image>` (from `expo-image`)
- Keep `className` (NativeWind supports it)
- Replace `react-router-dom` with React Navigation

### Step 3: Copy Styling Patterns EXACTLY
When building a new component, find similar UI in these files and copy the **exact `className` combinations**.

**Example from Hub.tsx:**
```typescript
// Page title pattern
<h2 className="text-lg font-black leading-tight flex-1 text-center text-gray-900 dark:text-white uppercase tracking-[0.2em]">
  Manager
</h2>

// When you build a new page, use this EXACT pattern:
<Text className="text-lg font-black leading-tight flex-1 text-center text-gray-900 dark:text-white uppercase tracking-[0.2em]">
  Settings
</Text>
```

### Step 4: Study the Interaction Patterns

**Swipe Gestures (CheckIn.tsx):**
- Uses `react-native-gesture-handler` (web version uses mouse events)
- Left swipe = low usage → triggers AI questions
- Right swipe = love it → animates away
- Down swipe = occasional → brief questions

**AI Chat (Assessment.tsx):**
- Bot messages: left-aligned, gray bubbles
- User messages: right-aligned, primary-colored bubbles
- Typing indicator: animated dots
- Auto-scroll to bottom on new messages

**Calendar Widget (Hub.tsx):**
- Weekly view (Sunday-Saturday)
- Prev/Next week buttons
- Renewal indicators (colored dots)
- Click day to see subscriptions renewing that day

---

## 🎨 Custom Tailwind Configuration

These files use **custom color variables** that MUST be in your `tailwind.config.js`:

```javascript
// tailwind.config.js (REQUIRED)
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#6366F1',
        'background-light': '#F9FAFB',
        'background-dark': '#111827',
        'surface-dark': '#1F2937'
      }
    }
  }
};
```

**Without these, your styling will break.**

---

## 🔍 Key Design Tokens Extracted

### Colors
- **Primary:** `#6366F1` (indigo)
- **Background (light mode):** `#F9FAFB`
- **Background (dark mode):** `#111827`
- **Surface (dark mode):** `#1F2937`
- **Gradients:** `from-primary to-blue-400` (chat bot avatar)

### Spacing
- Page padding: `px-6 py-8`
- Card padding: `p-5` (20px) or `p-8` (32px)
- Gap between elements: `gap-6` (24px), `gap-4` (16px)
- Bottom padding (above tabs): `pb-24` (96px)

### Border Radius
- Large cards: `rounded-[32px]` or `rounded-[40px]`
- Avatar: `rounded-3xl` (24px)
- Chat bubbles: `rounded-2xl` (16px)
- Buttons: `rounded-full`

### Typography
- Page titles: `font-black text-lg uppercase tracking-[0.2em]`
- User name: `font-black text-2xl tracking-tight`
- Micro labels: `font-black text-[10px] uppercase tracking-[0.2em]`
- Ultra-micro: `font-black text-[9px] uppercase tracking-widest`

### Shadows
- Standard cards: `shadow-sm`
- Elevated cards: `shadow-xl`
- Primary button: `shadow-xl shadow-primary/25`

---

## 📊 File Complexity Guide

**Low Complexity (< 100 lines):**
- Onboarding.tsx

**Medium Complexity (100-300 lines):**
- AddSubscription.tsx
- SubscriptionDetail.tsx
- BottomNav.tsx

**High Complexity (300-500 lines):**
- Hub.tsx (calendar widget, stats cards, subscription list)
- Setup.tsx (4-step flow with validation)
- Report.tsx (charts, calculations)

**Very High Complexity (500+ lines):**
- CheckIn.tsx (gesture handling, animations, AI questions)
- Assessment.tsx (AI chat, Google Gemini integration)

**Start with low/medium complexity files to understand patterns, then tackle high complexity.**

---

## 🔄 Web React → React Native Conversion

### Replace Elements
| Web | React Native |
|-----|--------------|
| `<div>` | `<View>` |
| `<span>`, `<p>`, `<h1>` | `<Text>` |
| `<img>` | `<Image>` (from `expo-image`) |
| `<input>` | `<TextInput>` |
| `<button>` | `<Pressable>` or `<TouchableOpacity>` |

### Keep as-is
- ✅ `className` (NativeWind supports it)
- ✅ Tailwind class names (all work in NativeWind)
- ✅ Component structure
- ✅ State management patterns

### Replace Libraries
| Web | React Native |
|-----|--------------|
| `react-router-dom` | `@react-navigation/native` |
| Mouse events | `react-native-gesture-handler` |
| `window.scrollTo` | `ScrollView` with `ref.scrollTo` |

---

## 🚫 What NOT to Do

❌ **Don't modify these files directly** - They're reference only  
❌ **Don't "improve" the styling** - Match it exactly  
❌ **Don't use different class names** - Copy the exact combinations  
❌ **Don't skip dark mode** - All these files have `dark:` variants  
❌ **Don't invent new patterns** - Reuse what's here  

---

## ✅ What TO Do

✅ **Study the patterns** - Understand how components are structured  
✅ **Copy className combinations** - Use exact same styling  
✅ **Match the interactions** - Replicate gesture behaviors  
✅ **Convert elements** - Web → React Native (keep styles)  
✅ **Test both modes** - Light and dark mode  

---

## 📚 Additional Resources

**For detailed styling patterns, see:**
- [`../docs/FRONTEND_GUIDELINES.md`](../docs/FRONTEND_GUIDELINES.md) - Complete design system
- [`../docs/UI_CODE_REFERENCE.md`](../docs/UI_CODE_REFERENCE.md) - Usage guide

**For implementation guidance, see:**
- [`../docs/APP_FLOW.md`](../docs/APP_FLOW.md) - Screen-by-screen specs
- [`../docs/IMPLEMENTATION_PLAN.md`](../docs/IMPLEMENTATION_PLAN.md) - Build sequence

---

## 🎓 Learning Path

**If you're new to this codebase:**

1. **Start here:** Read this README
2. **Then:** Open `Hub.tsx` - it's the most complete example
3. **Study:** Look at how stats cards, calendar widget, subscription list are built
4. **Compare:** Check `CheckIn.tsx` for gesture handling patterns
5. **Review:** Look at `Assessment.tsx` for chat UI patterns
6. **Practice:** Try converting a simple component (Onboarding.tsx) to React Native

---

## 🐛 Known Issues / Notes

- **Google Gemini API used in Assessment.tsx** - Will be replaced with Anthropic Claude API in production
- **Web-only gestures in CheckIn.tsx** - Need to be converted to `react-native-gesture-handler`
- **No actual backend** - All data is mock data from `constants.ts`
- **Vite config present** - This was built with Vite, you'll use Expo instead

---

## 🎯 Quick Reference

**Need to build a...**

- **Card component?** → See `Hub.tsx` (stats cards, subscription cards)
- **Form?** → See `AddSubscription.tsx` or `Setup.tsx`
- **Chat interface?** → See `Assessment.tsx`
- **Swipe gestures?** → See `CheckIn.tsx`
- **Navigation bar?** → See `BottomNav.tsx`
- **Calendar?** → See `Hub.tsx` (calendar widget)
- **Chart?** → See `Report.tsx` (radar chart, line chart)

---

**Remember:** This code represents **months of design work**. Treat it as the source of truth for how the app should look and feel. Your job is to convert it to React Native while keeping every visual detail intact.

---

**Last Updated:** February 7, 2026  
**Status:** Design Frozen - Reference Only
