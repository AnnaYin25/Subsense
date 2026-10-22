# Frontend Guidelines & Design System
# Subscription Manager - Complete UI/UX Specification

**Version:** 1.0  
**Last Updated:** February 2026  
**Platform:** iOS (React Native + NativeWind/Tailwind)

**⚠️ CRITICAL: This document is based on your EXISTING UI/UX code**

All styling rules, color variables, spacing, and component patterns in this document are extracted from your uploaded UI files:
- `/subscription-manager/pages/Hub.tsx`
- `/subscription-manager/pages/CheckIn.tsx`
- `/subscription-manager/pages/Assessment.tsx`
- `/subscription-manager/pages/Report.tsx`
- `/subscription-manager/pages/Setup.tsx`
- `/subscription-manager/components/BottomNav.tsx`

**When implementing new features, ALWAYS match the styling patterns found in these existing files.**

---

## 1. Design Philosophy

### 1.1 Core Principles
1. **Clarity Over Cleverness** - Users should understand every UI element without guessing
2. **Delight Through Motion** - Animations make the app feel alive, not sluggish
3. **Personalization Without Overwhelm** - AI insights feel helpful, not invasive
4. **Minimalism With Warmth** - Clean design with personality (emojis, avatar reactions)
5. **Information, Not Direction** - UI assists decisions, never forces actions

### 1.2 Design Inspirations
- **Apple Design Language** - Clean, spacious, intuitive
- **Glassmorphism** - Subtle transparency and blur effects (persona card)
- **Bento Grid** - Modular card-based layouts (stats cards, subscription list)
- **Neo-Brutalism Elements** - Bold typography, high contrast (scores, headings)

---

## 2. Color System

### 2.1 Brand Colors

**IMPORTANT:** Your existing UI code uses custom Tailwind color variables defined in `tailwind.config.js`. These MUST be included in the config:

```javascript
// tailwind.config.js - Custom Color Extensions
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#6366F1',        // Main brand color (Indigo-500)
        'primary-dark': '#4F46E5', // Hover state
        'background-light': '#F9FAFB', // Light mode background
        'background-dark': '#111827',  // Dark mode background
        'surface-dark': '#1F2937',     // Dark mode cards/surfaces
        danger: '#EF4444',
        success: '#10B981',
        warning: '#F59E0B'
      }
    }
  }
};
```

**Standard Tailwind Colors Also Used:**
```javascript
const colors = {
  // Primary (Indigo)
  primary: {
    DEFAULT: '#6366F1',  // Indigo-500
    dark: '#4F46E5',     // Indigo-600
    light: '#818CF8',    // Indigo-400
    50: '#EEF2FF',
    100: '#E0E7FF',
    500: '#6366F1',
    600: '#4F46E5',
    700: '#4338CA'
  },
  
  // Semantic Colors
  success: '#10B981',    // Green-500
  warning: '#F59E0B',    // Amber-500
  danger: '#EF4444',     // Red-500
  info: '#3B82F6',       // Blue-500
  
  // Neutrals (Light Mode)
  gray: {
    50: '#F9FAFB',       // Background
    100: '#F3F4F6',      // Surface
    200: '#E5E7EB',      // Border light
    300: '#D1D5DB',      // Border
    400: '#9CA3AF',      // Text secondary
    500: '#6B7280',      // Text tertiary
    700: '#374151',      // Text secondary dark
    800: '#1F2937',      // Text primary dark
    900: '#111827'       // Text primary
  },
  
  // Dark Mode Colors
  slate: {
    800: '#1E293B',      // Surface dark
    900: '#0F172A',      // Background dark
    700: '#334155',      // Border dark
    600: '#475569',      // Text secondary dark
    400: '#94A3B8',      // Text tertiary dark
    200: '#E2E8F0'       // Text primary dark
  }
};
```

### 2.2 Color Usage Rules

**Primary Color (#6366F1 Indigo):**
- Active tab icons
- Primary buttons
- Selected state backgrounds
- Renewal date indicators
- Score badges (Good/Excellent)
- Links and interactive text

**Success Green (#10B981):**
- Positive trends (budget under target)
- Right swipe cards (love it)
- Score 80-100 backgrounds
- Celebration confetti

**Warning Amber (#F59E0B):**
- Score 50-79 backgrounds
- Moderate alerts (approaching budget limit)
- Down swipe cards (occasional use)

**Danger Red (#EF4444):**
- Trial end reminders
- Score 0-49 backgrounds
- Left swipe cards (barely using)
- Delete actions

**Neutrals:**
- Gray scale for text hierarchy
- Light mode: gray.900 (primary text), gray.500 (secondary), gray.300 (tertiary)
- Dark mode: slate.200 (primary text), slate.400 (secondary), slate.600 (tertiary)

### 2.3 Gradients
```javascript
const gradients = {
  scoreGood: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
  scoreFair: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)',
  scorePoor: 'linear-gradient(135deg, #EF4444 0%, #F87171 100%)',
  primary: 'linear-gradient(135deg, #6366F1 0%, #818CF8 100%)',
  glassmorphism: 'rgba(99, 102, 241, 0.05)' // Primary with 5% opacity
};
```

**Gradient Usage:**
- Monthly report hero cards (score-based gradient)
- Assessment report backgrounds
- Persona highlight card (subtle primary gradient)

---

## 3. Typography

### 3.1 Font Family
**Primary Font:** Inter (Variable font)

**Font Weights:**
```javascript
const fontWeights = {
  black: 900,     // Headings, scores, emphasis
  bold: 700,      // Subheadings, labels
  medium: 500,    // Body text, buttons
  regular: 400    // Body text, inputs
};
```

**Font Loading (Expo):**
```typescript
import * as Font from 'expo-font';

await Font.loadAsync({
  'Inter-Black': require('./assets/fonts/Inter-Black.ttf'),
  'Inter-Bold': require('./assets/fonts/Inter-Bold.ttf'),
  'Inter-Medium': require('./assets/fonts/Inter-Medium.ttf'),
  'Inter-Regular': require('./assets/fonts/Inter-Regular.ttf'),
  'MaterialSymbols': require('./assets/fonts/MaterialSymbolsOutlined.ttf')
});
```

### 3.2 Type Scale

**Standard Tailwind Sizes:**
```javascript
const fontSize = {
  // Display (Scores, Hero Numbers)
  '5xl': 64,  // Monthly report score
  '4xl': 48,  // Audit report score
  '3xl': 36,  // Section headings
  
  // Headings
  '2xl': 24,  // Page titles
  'xl': 20,   // Card titles
  'lg': 18,   // Subheadings
  
  // Body
  'base': 16, // Default body text
  'sm': 14,   // Secondary text
  'xs': 12,   // Captions, labels
};
```

**Custom Sizes (Use with `text-[Xpx]` syntax):**
```javascript
// These are used in your existing UI code
{
  '[9px]': 9,   // Ultra-micro labels (Subscription Persona label)
  '[10px]': 10, // Micro badges (PRO SAVER, category labels)
  '[11px]': 11, // Button text in filter chips
  '[16px]': 16, // Chat bot icon size
  '[18px]': 18  // Typing indicator icon
}
```

### 3.3 Text Styles (FROM ACTUAL UI CODE)

**These are the EXACT class combinations used in your existing UI:**

```typescript
// Page Titles (MANAGER, ASSESSMENT, etc.)
className="text-lg font-black uppercase tracking-[0.2em] text-gray-900 dark:text-white"

// Section Headings (Entertainment, Productivity)
className="text-sm font-black uppercase tracking-[0.2em] text-gray-900 dark:text-white"

// User Name (Manager Header)
className="text-2xl font-black text-gray-900 dark:text-white tracking-tight leading-none"

// Subscription Names
className="text-base font-black text-gray-900 dark:text-white"

// Plan Names / Category Labels
className="text-[10px] font-black uppercase tracking-widest text-gray-400"

// PRO SAVER Badge
className="text-[10px] font-black text-primary uppercase tracking-[0.2em]"

// Persona Label (Subscription Persona)
className="text-[9px] font-black text-primary uppercase tracking-widest opacity-70"

// Persona Title
className="font-black text-gray-900 dark:text-white text-base leading-tight"

// Costs (Large)
className="text-xl font-black text-primary"

// Body Text (Chat Bubbles)
className="text-sm leading-relaxed font-medium text-gray-800 dark:text-gray-200"

// Secondary Text
className="text-sm font-medium text-gray-500 dark:text-gray-400"

// Chat Input Placeholder
className="text-xs text-slate-400"
```

### 3.4 Letter Spacing
- **Uppercase Text:** `tracking-[0.2em]` (200% letter spacing) for all uppercase labels
- **Uppercase Badges:** `tracking-widest` (0.15em) for small badges
- **Body Text:** Default (no custom tracking)
- **Large Numbers:** `tracking-tight` (-0.025em) for scores

### 3.5 Line Height
- **Headings:** `leading-tight` (1.2)
- **Body Text:** `leading-normal` (1.5)
- **Micro Text:** `leading-none` (1.0)

---

## 4. Spacing & Layout

### 4.1 Spacing Scale (Tailwind Default)
```javascript
const spacing = {
  px: '1px',
  0: '0',
  0.5: '2px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
  24: '96px'
};
```

### 4.2 Component Spacing Rules

**Page Padding:**
- Horizontal: `px-4` (16px) on all pages
- Vertical: `py-4` (16px) between sections
- Bottom padding (above tabs): `pb-24` (96px) to clear bottom navigation

**Card Padding:**
- Standard card: `p-5` (20px)
- Large card (stats): `p-8` (32px)
- Compact card (subscription list): `p-5` (20px)

**Stack Spacing:**
- Between cards in list: `space-y-4` (16px)
- Between sections: `space-y-8` (32px)
- Between form fields: `space-y-6` (24px)

**Inline Spacing:**
- Button text + icon: `gap-2` (8px)
- Card elements (icon + text): `gap-4` (16px)
- Stat cards grid: `gap-4` (16px)

### 4.3 Layout Containers
**Max Width:**
- Mobile app: No max width (full screen)
- If web version added later: `max-w-md` (448px) centered

**Safe Areas:**
- Use `react-native-safe-area-context` for iOS notch/home indicator
- Top safe area: StatusBar height
- Bottom safe area: Home indicator height

---

## 5. Border Radius

### 5.1 Radius Scale
```javascript
const borderRadius = {
  none: '0',
  sm: '8px',      // Small elements (chips, badges)
  DEFAULT: '12px', // Default (inputs, buttons)
  lg: '16px',      // Cards
  xl: '24px',      // Large cards
  '2xl': '32px',   // Hero cards (subscription cards)
  '3xl': '40px',   // Calendar widget
  full: '9999px'   // Circular (avatar, action buttons)
};
```

### 5.2 Usage Rules
- **Buttons:** `rounded-full` (fully rounded capsule)
- **Input Fields:** `rounded-lg` (16px)
- **Cards (small):** `rounded-2xl` (32px)
- **Cards (large):** `rounded-[40px]` (40px)
- **Avatar:** `rounded-3xl` (24px with padding, not fully circular for personality)
- **Badges:** `rounded-full`
- **Calendar Days:** `rounded-2xl` (32px for touchable day cells)

---

## 6. Shadows & Elevation

### 6.1 Shadow System
```javascript
const boxShadow = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.05)',           // Subtle cards
  DEFAULT: '0 1px 3px rgba(0, 0, 0, 0.1)',       // Standard cards
  md: '0 4px 6px rgba(0, 0, 0, 0.1)',            // Elevated cards
  lg: '0 10px 15px rgba(0, 0, 0, 0.1)',          // Modals
  xl: '0 20px 25px rgba(0, 0, 0, 0.15)',         // Hero cards
  '2xl': '0 25px 50px rgba(0, 0, 0, 0.25)',      // Floating action button
  primary: '0 10px 25px rgba(99, 102, 241, 0.25)' // Primary-colored shadow
};
```

### 6.2 Usage Rules
- **Subscription cards:** `shadow-sm` (subtle)
- **Floating cards:** `shadow-xl`
- **Bottom navigation:** `shadow-2xl` (strong separation)
- **Primary buttons:** `shadow-primary` (colored shadow for depth)
- **Dark mode:** Reduce shadow opacity by 50% (`shadow-sm` in light → barely visible in dark)

### 6.3 Glassmorphism Effect
```typescript
// Persona highlight card
className="bg-primary/5 dark:bg-primary/10 border border-primary/10 backdrop-blur-sm"
```

**Components Using Glassmorphism:**
- Persona highlight card (foldable card on Manager)
- Floating modals (future)

---

## 7. Buttons & Interactive Elements

### 7.1 Button Variants

**Primary Button:**
```typescript
className="bg-primary text-white px-8 py-4 rounded-full font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/25 active:scale-95 transition-all"
```

**Secondary Button:**
```typescript
className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white px-8 py-4 rounded-full font-black text-sm uppercase tracking-widest active:scale-95 transition-all"
```

**Destructive Button:**
```typescript
className="bg-danger text-white px-8 py-4 rounded-full font-black text-sm uppercase tracking-widest active:scale-95 transition-all"
```

**Text Button:**
```typescript
className="text-primary font-black text-sm uppercase tracking-widest underline"
```

**Icon Button (Circular):**
```typescript
className="size-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-slate-800 active:scale-90 transition-all"
```

### 7.2 Button States

**Hover (Web, future):**
- `hover:bg-primary-dark` (darken primary color)
- `hover:shadow-2xl` (increase shadow)

**Active (Touch):**
- `active:scale-95` (shrink slightly on press)
- `active:opacity-80` (reduce opacity for feedback)

**Disabled:**
- `opacity-50 cursor-not-allowed`
- No pointer events

### 7.3 Filter Chips
```typescript
// Active state
className="bg-primary text-white shadow-xl shadow-primary/25 px-8 py-3 rounded-full font-black text-xs uppercase tracking-widest"

// Inactive state
className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-gray-500 px-8 py-3 rounded-full font-black text-xs uppercase tracking-widest"
```

### 7.4 Floating Action Button (FAB)
```typescript
className="size-16 bg-primary rounded-full flex items-center justify-center shadow-2xl shadow-primary/30 active:scale-90 transition-all"
// Position: Absolute, bottom-right, above bottom tabs
```

---

## 8. Form Elements

### 8.1 Text Input
```typescript
className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-4 text-base font-medium text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/20"
```

**Input States:**
- **Normal:** Gray border
- **Focus:** Primary border + ring glow
- **Error:** Red border + error text below

**Error Text:**
```typescript
className="text-xs font-medium text-danger mt-1"
```

### 8.2 Dropdown / Picker
**iOS Native Picker (Recommended):**
- Use `@react-native-picker/picker` for native iOS feel
- Style: Match input field styling

**Custom Dropdown:**
```typescript
className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-4 py-4 flex items-center justify-between"
```

### 8.3 Checkbox / Radio Buttons
**Custom Components (React Native doesn't have native checkboxes):**
```typescript
// Checked
className="size-6 rounded bg-primary flex items-center justify-center"

// Unchecked
className="size-6 rounded border-2 border-gray-300"
```

### 8.4 Slider
**React Native Slider:**
```typescript
import Slider from '@react-native-community/slider';

<Slider
  minimumValue={0}
  maximumValue={100}
  minimumTrackTintColor="#6366F1"
  maximumTrackTintColor="#E5E7EB"
  thumbTintColor="#6366F1"
/>
```

---

## 9. Cards & Containers

### 9.1 Subscription Card
```typescript
className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800 rounded-[32px] p-5 shadow-sm active:scale-[0.98] transition-all flex items-center"
```

**Content Layout:**
- Left: Icon emoji (48px, centered in 56px square with colored background)
- Center: Service name (bold) + Plan name (micro, uppercase)
- Right: Cost (bold) + Renewal date (micro, uppercase)

### 9.2 Stats Card
```typescript
className="bg-gray-50 dark:bg-slate-800/50 rounded-2xl p-4 flex items-center justify-between border border-gray-100 dark:border-slate-800"
```

**Content:**
- Left: Label (micro, uppercase) + Value (large, bold)
- Right: Icon (Material Symbol, gray)

### 9.3 Calendar Widget
```typescript
className="bg-white dark:bg-slate-800 rounded-[40px] p-8 shadow-xl border border-gray-200 dark:border-slate-800"
```

**Calendar Day Cell:**
```typescript
// Selected
className="h-12 rounded-2xl flex items-center justify-center bg-primary text-white shadow-xl scale-110"

// Has renewal
className="h-12 rounded-2xl flex items-center justify-center text-gray-700 dark:text-gray-300 relative"
// Dot indicator: absolute bottom-2, size-1.5, rounded-full, bg-primary

// Has trial reminder
// Same as above but dot is bg-danger and pulsing
```

### 9.4 Modal / Dialog
```typescript
className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-2xl max-w-sm mx-auto"
```

**Modal Actions:**
```typescript
className="flex gap-4 mt-6"
// Primary action (right)
// Secondary action (left)
```

---

## 10. Navigation

### 10.1 Bottom Tab Bar
```typescript
className="bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 shadow-2xl"
```

**Tab Button:**
```typescript
// Active
className="flex flex-col items-center py-2 gap-1"
// Icon: text-primary
// Label: text-primary font-black text-xxs uppercase tracking-widest

// Inactive
// Icon: text-gray-400
// Label: text-gray-400 font-black text-xxs uppercase tracking-widest
```

**Badge (for notifications):**
```typescript
className="absolute top-0 right-0 size-2 bg-danger rounded-full"
```

### 10.2 Header / Top Bar
```typescript
className="flex items-center justify-between p-4 pb-2 sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-transparent dark:border-slate-800"
```

**Header Elements:**
- Left: Back button or empty spacer (size-10)
- Center: Page title (uppercase, tracking wide)
- Right: Action icon (settings, more)

---

## 11. Animation & Motion

### 11.1 Transition Timing
```javascript
const transitions = {
  fast: '150ms',     // Hover states, button presses
  base: '300ms',     // Card animations, swipes
  slow: '500ms',     // Modal enter/exit, page transitions
  verySlow: '1000ms' // Loading animations
};
```

**Easing Functions:**
- **Default:** `ease-out` (natural deceleration)
- **Bounce:** `cubic-bezier(0.68, -0.55, 0.265, 1.55)` (overshoot effect)
- **Spring:** Use `react-native-reanimated` spring physics

### 11.2 Animation Use Cases

**Card Swipe (Check-In):**
- Use `react-native-reanimated` + `react-native-gesture-handler`
- PanGestureHandler for touch tracking
- Spring animation for card snap-back
- Duration: Physics-based (natural feel)

**Button Press:**
- `active:scale-95` (shrink on press)
- Duration: 150ms
- Easing: ease-out

**Modal Enter:**
- Slide up from bottom + fade in
- Duration: 300ms
- Easing: ease-out

**Confetti (Check-In Completion):**
- Use Lottie animation
- Duration: 2 seconds
- Auto-dismiss after animation

**Avatar Reaction (Swipe Feedback):**
- Left swipe: Grayscale filter + slight shrink + rotation
- Right swipe: Scale up + brightness increase + green glow
- Down swipe: Neutral (no animation)

### 11.3 Loading States

**Spinner:**
- Use Material Symbol `progress_activity` (animated)
- Or Lottie animation (custom spinner)
- Color: Primary

**Skeleton Screens:**
- Gray animated pulse for cards loading
- `animate-pulse` (Tailwind default)

**Pull-to-Refresh:**
- iOS native `RefreshControl` component
- Color: Primary

---

## 12. Icons & Imagery

### 12.1 Icon System
**Source:** Google Material Symbols (Outlined variant)

**Icon Sizes:**
```javascript
const iconSizes = {
  xs: 16,    // Inline icons
  sm: 20,    // Button icons
  base: 24,  // Default (navigation, actions)
  lg: 32,    // Large icons (headers)
  xl: 48     // Hero icons
};
```

**Icon Colors:**
- Active/Interactive: `text-primary`
- Secondary: `text-gray-400`
- Destructive: `text-danger`

### 12.2 Emoji Icons (Subscription Logos)
**Size:** 48px (text-4xl) for subscription cards
**Recommended Emojis:**
- Netflix: 🎬
- Spotify: 🎵
- Apple Music: 🎶
- Disney+: 🏰
- Notion: 📝
- Figma: 🎨
- Headspace: 🧘
- Gym: 💪
- Generic: 📱 (default fallback)

**Storage:** Store as string in database (`icon_emoji` field)

### 12.3 Avatar System
**8 Pre-Designed Avatars:**
- Store as static image files (PNG, 256x256px)
- Cartoon/illustration style (friendly, gender-neutral)
- Color variety (different backgrounds, characters)
- Examples: Animal characters (bear, cat, dog), abstract shapes, minimalist faces

**Avatar Display:**
```typescript
className="size-20 rounded-3xl overflow-hidden border-4 border-primary/20 bg-gray-100 p-0.5 shadow-lg"
```

---

## 13. Responsive Design (Mobile-First)

### 13.1 Screen Sizes
**Target Devices:**
- iPhone SE (375px width) - Minimum
- iPhone 14 Pro (393px width) - Primary
- iPhone 14 Pro Max (430px width) - Large

**No Tablet Support (MVP):**
- App is mobile-only
- Future: iPad support with adaptive layouts

### 13.2 Breakpoint Strategy
**React Native Dimensions:**
```typescript
import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

// Small phones (< 380px)
const isSmallPhone = width < 380;

// Large phones (> 420px)
const isLargePhone = width > 420;
```

**Adaptive Spacing:**
- Small phones: Reduce padding from `p-4` to `p-3`
- Large phones: Keep standard `p-4`

**Text Scaling:**
- Use `allowFontScaling={false}` for UI elements (buttons, labels)
- Allow scaling for body text (accessibility)

---

## 14. Dark Mode

### 14.1 Color Adjustments
**Automatic Detection:**
```typescript
import { useColorScheme } from 'react-native';

const colorScheme = useColorScheme(); // 'light' | 'dark'
```

**NativeWind Dark Mode:**
- Use `dark:` prefix for dark mode styles
- Example: `bg-white dark:bg-slate-900`

**Dark Mode Color Swaps:**
- Background: `#F9FAFB` → `#111827` (gray.50 → slate.900)
- Surface: `#FFFFFF` → `#1F2937` (white → slate.800)
- Text Primary: `#111827` → `#E2E8F0` (gray.900 → slate.200)
- Text Secondary: `#6B7280` → `#94A3B8` (gray.500 → slate.400)
- Borders: `#E5E7EB` → `#334155` (gray.200 → slate.700)

**Primary Color (No Change):**
- `#6366F1` stays the same in dark mode (high contrast)

**Shadows in Dark Mode:**
- Reduce opacity by 50%
- Example: `shadow-xl` → barely visible shadow in dark

### 14.2 Image Handling
**Icons:**
- Material Symbols automatically adapt to text color
- Use `className="text-gray-900 dark:text-white"` for icons

**Avatars:**
- No dark mode adjustments (images stay the same)

**Illustrations:**
- Use SVG with CSS variables for fill colors (future enhancement)

---

## 15. Accessibility

### 15.1 VoiceOver Support
**Accessibility Labels:**
```typescript
<Pressable
  accessibilityLabel="Add new subscription"
  accessibilityRole="button"
  accessibilityHint="Opens a form to add a subscription"
>
  <Text>+</Text>
</Pressable>
```

**All Interactive Elements MUST Have:**
- `accessibilityLabel` (what it is)
- `accessibilityRole` (button, link, image, etc.)
- `accessibilityHint` (what it does, optional)

### 15.2 Touch Targets
**Minimum Size:** 44x44 points (iOS Human Interface Guidelines)

**Examples:**
- Buttons: `h-11` (44px minimum height)
- Icon buttons: `size-11` (44x44px)
- Calendar day cells: `h-12` (48px for comfortable tapping)

### 15.3 Color Contrast
**WCAG AA Standard (4.5:1 for text):**
- Primary text on white: `#111827` on `#FFFFFF` = 18.2:1 ✅
- Secondary text on white: `#6B7280` on `#FFFFFF` = 4.6:1 ✅
- Primary color on white: `#6366F1` on `#FFFFFF` = 4.8:1 ✅

**Color Blindness:**
- Don't rely on color alone for information
- Use icons + color (e.g., red danger icon + text)
- Score badges use both color AND text label

### 15.4 Dynamic Type
**Scalable Text:**
```typescript
// Allow scaling for body text
<Text allowFontScaling={true}>Body text here</Text>

// Disable scaling for UI labels (prevents layout breaks)
<Text allowFontScaling={false}>MANAGER</Text>
```

**Test at 200% Scale:**
- Use iOS Accessibility settings to test large text
- Ensure no text overflow or layout breaks

---

## 16. Component Library Structure

### 16.1 File Organization
```
/src/components
  /ui
    /Button.tsx
    /Card.tsx
    /Input.tsx
    /Badge.tsx
    /Chip.tsx
    /Avatar.tsx
    /Modal.tsx
    /Spinner.tsx
  /layout
    /BottomNav.tsx
    /Header.tsx
    /Container.tsx
  /features
    /SubscriptionCard.tsx
    /CalendarWidget.tsx
    /SwipeCard.tsx (Check-In)
    /AuditReport.tsx
    /MonthlyReportCard.tsx
```

### 16.2 Component Naming Conventions
- PascalCase for component files
- Descriptive names (SubscriptionCard, not Card)
- Suffix with purpose (CalendarWidget, not Calendar)

---

## 17. Design Tokens (CSS Variables, Future)

**For Web Version (future):**
```css
:root {
  --color-primary: #6366F1;
  --color-danger: #EF4444;
  --spacing-4: 16px;
  --radius-lg: 16px;
  --shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.15);
}
```

**React Native Doesn't Support CSS Variables:**
- Use JavaScript object constants (in constants.ts)
- Import where needed

---

## 18. Performance Optimization

### 18.1 Image Optimization
- Use Expo Image (built-in caching)
- Serve avatars as optimized WebP (fallback to PNG)
- Lazy load off-screen images (future)

### 18.2 Animation Performance
- Use `react-native-reanimated` (runs on UI thread, not JS)
- Avoid `setState` in animation loops
- Use `useNativeDriver: true` for Animated API (deprecated, use Reanimated)

### 18.3 List Rendering
- Use `FlatList` with `keyExtractor` for subscription lists
- Set `removeClippedSubviews={true}` for long lists
- Use `getItemLayout` for fixed-height items (performance boost)

---

## 19. Design Checklist (Before Shipping)

**Visual Polish:**
- ✅ All text uses correct font weights (black for headings, medium for body)
- ✅ Consistent border radius (cards 32px, buttons full, inputs 16px)
- ✅ All interactive elements have active state (scale-95)
- ✅ Shadows applied correctly (cards shadow-sm, modals shadow-xl)
- ✅ Dark mode tested (all colors swap correctly)

**Spacing:**
- ✅ Consistent padding (pages px-4, cards p-5)
- ✅ Proper spacing between elements (space-y-4 for lists)
- ✅ Bottom padding above tabs (pb-24)

**Typography:**
- ✅ Uppercase labels have wide tracking (tracking-[0.2em])
- ✅ Large numbers have tight tracking (tracking-tight)
- ✅ Line height appropriate for text type

**Accessibility:**
- ✅ All buttons ≥44x44 points
- ✅ VoiceOver labels on all interactive elements
- ✅ Color contrast meets WCAG AA
- ✅ Tested with Dynamic Type (200% scale)

**Animation:**
- ✅ Smooth 60fps animations (no jank)
- ✅ Transitions feel natural (ease-out, 300ms)
- ✅ Loading states for all async actions

---

**END OF FRONTEND_GUIDELINES.md**
