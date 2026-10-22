# UI Code Reference Guide
# How to Use Your Existing UI/UX Design Files

**Created:** 2026-02-07  
**Purpose:** Ensure all new code matches your existing UI design patterns

---

## ⚠️ CRITICAL INFORMATION

You have already created **production-quality UI/UX design files** with working React code. These are located in:

```
/home/claude/subscription-manager/
├── pages/
│   ├── Hub.tsx (Manager dashboard with calendar widget, stats cards)
│   ├── CheckIn.tsx (Swipe card stack with gesture animations)
│   ├── Assessment.tsx (AI chat interface with bot/user bubbles)
│   ├── Report.tsx (Monthly report with score display)
│   ├── Setup.tsx (Onboarding setup flow)
│   ├── Onboarding.tsx (Welcome screen)
│   ├── AddSubscription.tsx (Add subscription form)
│   └── SubscriptionDetail.tsx (Subscription detail page)
├── components/
│   └── BottomNav.tsx (Bottom tab navigation)
├── context/
│   └── SubscriptionContext.tsx (State management)
├── types.ts (TypeScript interfaces)
└── constants.ts (Mock data)
```

---

## Custom Tailwind Configuration Required

Your UI code uses **custom color variables** that MUST be added to `tailwind.config.js`:

```javascript
// tailwind.config.js
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./pages/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        // Your custom colors (REQUIRED)
        primary: '#6366F1',
        'primary-dark': '#4F46E5',
        'background-light': '#F9FAFB',
        'background-dark': '#111827',
        'surface-dark': '#1F2937',
        danger: '#EF4444',
        success: '#10B981',
        warning: '#F59E0B'
      },
      fontFamily: {
        black: ['Inter-Black'],
        bold: ['Inter-Bold'],
        medium: ['Inter-Medium'],
        regular: ['Inter-Regular']
      }
    }
  },
  plugins: []
};
```

---

## Custom Font Sizes Used

Your UI uses non-standard font sizes with the `text-[Xpx]` syntax:

```typescript
// Ultra-micro labels
text-[9px]  // "Subscription Persona" label

// Micro badges
text-[10px] // "PRO SAVER" badge, category labels

// Small button text
text-[11px] // Filter chip text

// Icon sizes
text-[16px] // Chat bot icon
text-[18px] // Typing indicator
```

**Important:** These are NOT standard Tailwind classes. You must use the bracket notation exactly as shown.

---

## Styling Patterns From Your Existing Code

### Page Container
```typescript
// Hub.tsx pattern
className="relative flex h-full min-h-screen w-full flex-col overflow-x-hidden max-w-md mx-auto bg-background-light dark:bg-background-dark shadow-2xl pb-24"
```

### Page Header
```typescript
// Hub.tsx pattern
className="flex items-center justify-between p-4 pb-2 sticky top-0 z-20 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm border-b border-transparent dark:border-slate-800"
```

### Page Title
```typescript
className="text-lg font-black leading-tight flex-1 text-center text-gray-900 dark:text-white uppercase tracking-[0.2em]"
```

### User Avatar
```typescript
className="size-20 rounded-3xl overflow-hidden border-4 border-primary/20 bg-slate-100 p-0.5 shrink-0 shadow-lg"
```

### User Name
```typescript
className="text-2xl font-black text-gray-900 dark:text-white tracking-tight leading-none mb-1"
```

### Persona Card (Glassmorphism)
```typescript
className="mb-6 bg-primary/5 dark:bg-primary/10 rounded-[32px] p-5 border border-primary/10 cursor-pointer transition-all duration-300 animate-fade-in-up group hover:bg-primary/10 dark:hover:bg-primary/20"
```

### Micro Labels (Badge Style)
```typescript
className="text-[10px] font-black text-primary uppercase tracking-[0.2em]"
```

### Ultra-Micro Labels
```typescript
className="text-[9px] font-black text-primary uppercase tracking-widest mb-0.5 opacity-70"
```

### Stats Cards
```typescript
// Budget card
className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex items-center justify-between border border-slate-100 dark:border-slate-800"

// Active spend card (primary colored)
className="p-4 bg-primary/5 dark:bg-primary/10 rounded-2xl flex items-center justify-between border border-primary/10"
```

### Chat Bubbles
```typescript
// User message
className="bg-primary text-white rounded-tr-none px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm font-medium"

// Bot message
className="bg-white dark:bg-[#2d3748] text-gray-800 dark:text-gray-200 rounded-tl-none border border-slate-100 dark:border-slate-800 px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm font-medium"
```

### Swipe Cards (CheckIn.tsx)
```typescript
className="bg-white dark:bg-slate-900 rounded-[40px] p-8 shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-sm"
```

### Primary Button
```typescript
className="bg-primary text-white px-8 py-4 rounded-full font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/25 active:scale-95 transition-all"
```

---

## Key Design Tokens From Your Code

### Spacing
- Page padding: `px-6 py-8` (Hub user stats section)
- Card padding: `p-5` (20px) or `p-8` (32px) for large cards
- Gap between elements: `gap-6` (24px for avatar + text), `gap-4` (16px standard)
- Bottom padding (above tabs): `pb-24` (96px)

### Border Radius
- Large cards: `rounded-[32px]` or `rounded-[40px]`
- Avatar: `rounded-3xl` (24px)
- Chat bubbles: `rounded-2xl` (16px)
- Buttons: `rounded-full`

### Shadows
- Standard cards: `shadow-sm`
- Elevated cards: `shadow-xl`
- Primary button: `shadow-xl shadow-primary/25` (colored shadow)
- Page container: `shadow-2xl`

### Colors in Use
- Primary: `#6366F1` (used as `bg-primary`, `text-primary`, `border-primary`)
- Primary with opacity: `bg-primary/5`, `bg-primary/10`, `bg-primary/20`
- Background light: `bg-background-light` (light mode)
- Background dark: `bg-background-dark` (dark mode)
- Surface dark: `bg-surface-dark` (dark mode cards)
- Gradient: `bg-gradient-to-tr from-primary to-blue-400` (chat bot avatar)

### Typography
- Page titles: `font-black text-lg uppercase tracking-[0.2em]`
- User name: `font-black text-2xl tracking-tight`
- Body text: `font-medium text-sm leading-relaxed`
- Labels: `font-black uppercase tracking-widest`

---

## When Building New Components

**Step 1:** Check if similar UI exists in uploaded files
- Building a card? Look at Hub.tsx stats cards
- Building a chat? Look at Assessment.tsx bubbles
- Building a form? Look at AddSubscription.tsx
- Building swipe gestures? Look at CheckIn.tsx

**Step 2:** Copy the exact `className` pattern
- Don't invent new class combinations
- Use the EXACT same spacing, colors, shadows
- Match the dark mode variants (`dark:` prefix)

**Step 3:** Verify custom variables are used
- Use `bg-background-light` not `bg-gray-50`
- Use `bg-surface-dark` not `bg-slate-800`
- Use `text-primary` not `text-indigo-500`

**Step 4:** Test in both light and dark mode
- All your existing UI has dark mode support
- New components MUST also have `dark:` variants

---

## Material Symbols Icons

Your UI uses Google Material Symbols (Outlined variant):

```typescript
// Icon rendering pattern
<span className="material-symbols-outlined">settings</span>
<span className="material-symbols-outlined text-primary">psychology</span>
<span className="material-symbols-outlined text-yellow-500 text-sm">workspace_premium</span>
```

**Icons used in your UI:**
- `settings` - Settings button
- `psychology` - AI/Audit icon
- `smart_toy` - Chat bot icon
- `workspace_premium` - Premium badge
- `account_balance_wallet` - Budget icon
- `payments` - Active spend icon

**Font family:** Load `MaterialSymbolsOutlined.ttf` via Expo Font

---

## Animation Patterns

Your UI uses these animation classes (likely custom Tailwind animations):

```typescript
// Fade in from bottom
className="animate-fade-in-up"

// Pulse effect
className="animate-pulse"

// Bounce (dots in typing indicator)
className="animate-bounce"
style={{ animationDelay: '0ms' }}
```

**These need to be defined in your Tailwind config or CSS:**

```css
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in-up {
  animation: fade-in-up 0.3s ease-out;
}
```

---

## React Native Specific Patterns

Your code uses web-based React (not React Native yet), so it uses:
- `<div>` instead of `<View>`
- `<span>` instead of `<Text>`
- `className` instead of `style`

**When converting to React Native:**
- Replace `<div>` with `<View>`
- Replace `<span>` with `<Text>`
- Keep `className` (NativeWind supports it)
- Replace `<img>` with `<Image>` (from `expo-image`)
- Replace `<input>` with `<TextInput>` (from `react-native`)

---

## File Naming Conventions You Use

Based on your uploaded files:
- Screens: PascalCase without "Screen" suffix (`Hub.tsx`, `Assessment.tsx`)
- Components: PascalCase (`BottomNav.tsx`)
- Context: PascalCase with "Context" suffix (`SubscriptionContext.tsx`)
- Types: lowercase (`types.ts`)
- Constants: lowercase (`constants.ts`)

**Recommendation:** Continue this pattern for consistency.

---

## State Management Pattern You Use

From `SubscriptionContext.tsx`:

```typescript
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface SubscriptionContextType {
  subscriptions: Subscription[];
  addSubscription: (sub: Subscription) => void;
  // ...
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  
  return (
    <SubscriptionContext.Provider value={{ subscriptions, addSubscription, ... }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscriptions = () => {
  const context = useContext(SubscriptionContext);
  if (!context) throw new Error('useSubscriptions must be used within SubscriptionProvider');
  return context;
};
```

**Follow this exact pattern** for any new contexts (AuthContext, PersonaContext).

---

## Summary Checklist

When implementing new features:

- [ ] Check if similar UI exists in uploaded files
- [ ] Use custom color variables (`bg-background-light`, etc.)
- [ ] Use custom font sizes (`text-[9px]`, `text-[10px]`)
- [ ] Copy exact `className` combinations from existing code
- [ ] Include dark mode variants (`dark:` prefix)
- [ ] Use Material Symbols icons (same pattern)
- [ ] Match spacing, shadows, and border radius
- [ ] Test in both light and dark mode
- [ ] Follow existing file naming conventions
- [ ] Use existing state management pattern

---

**Remember:** Your existing UI code is production-quality. New code should match it EXACTLY, not reinvent or "improve" the styling.

**END OF UI_CODE_REFERENCE.md**
