# Tech Stack & Dependencies
# Subscription Manager - Complete Technology Specification

**Version:** 1.0  
**Last Updated:** February 2026  
**Platform:** iOS Mobile (React Native + Expo)

---

## 1. Core Framework

### 1.1 React Native + Expo
```json
{
  "expo": "^52.0.0",
  "react": "18.3.1",
  "react-native": "0.76.5"
}
```

**Why Expo:**
- Rapid development with hot reload
- Expo Go for real-device testing without Xcode builds
- Built-in iOS Push Notifications support (future)
- Simplified deployment pipeline
- Cross-platform support (Android expansion ready)

**Expo SDK Modules Used:**
- `expo-font` - Custom font loading
- `expo-image-picker` - Screenshot uploads for OCR
- `expo-file-system` - Local file management
- `expo-secure-store` - Secure credential storage
- `expo-notifications` - Push notifications (future)
- `expo-sharing` - Share sheet for monthly reports
- `expo-status-bar` - Status bar styling

---

## 2. Language & Typing

### 2.1 TypeScript
```json
{
  "typescript": "^5.6.3"
}
```

**tsconfig.json Configuration:**
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "target": "ES2020",
    "lib": ["ES2020"],
    "jsx": "react-native",
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  }
}
```

**Type Safety Rules:**
- All components strongly typed
- No `any` types (use `unknown` if necessary)
- Strict null checks enabled
- All API responses typed with interfaces

---

## 3. State Management

### 3.1 React Context API + Hooks
**No External State Library** (Redux, MobX, Zustand)

**Why:**
- App state is simple (user data + subscriptions + personas)
- Context API sufficient for global state
- Reduces bundle size
- Native React patterns

**Context Structure:**
```typescript
// contexts/AuthContext.tsx
// contexts/SubscriptionContext.tsx
// contexts/PersonaContext.tsx
```

**State Management Hooks:**
```json
{
  "react": "18.3.1" // Built-in useState, useEffect, useContext, useReducer
}
```

---

## 4. Navigation

### 4.1 React Navigation v7
```json
{
  "@react-navigation/native": "^7.0.0",
  "@react-navigation/stack": "^7.0.0",
  "@react-navigation/bottom-tabs": "^7.0.0"
}
```

**Required Dependencies:**
```json
{
  "react-native-screens": "~4.4.0",
  "react-native-safe-area-context": "4.14.0",
  "react-native-gesture-handler": "~2.20.2"
}
```

**Navigation Structure:**
- Stack Navigator (Root): Onboarding → Setup → Main
- Tab Navigator (Main): Manager, Check-In, Audit, Report
- Modal Stack: Settings, Subscription Detail

---

## 5. Backend & Database

### 5.1 Supabase
```json
{
  "@supabase/supabase-js": "^2.47.10"
}
```

**Supabase Services Used:**
- **PostgreSQL Database** - All data storage
- **Authentication** - User accounts (email/password)
- **Storage** - Shareable report card images (future)
- **Real-time** (optional) - Live sync across devices (future)

**Database:** PostgreSQL 15+
**Region:** Auto-select closest (US East for US users, EU for European users)

**Connection Config:**
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});
```

---

## 6. AI Integration

### 6.1 Anthropic Claude API
```json
{
  "@anthropic-ai/sdk": "^0.32.1"
}
```

**Model:** 
- **Primary:** `claude-sonnet-4-20250514` (Sonnet 4.5)
- **Fallback:** `claude-haiku-4-20250514` (Haiku 4.5, for cost optimization on simple tasks)

**Use Cases:**
- **Audit Conversations:** Sonnet 4 (complex reasoning)
- **Check-In Questions:** Haiku 4 (simple, fast)
- **OCR (Vision):** Sonnet 4 (image analysis)
- **Persona Updates:** Haiku 4 (text summarization)
- **Report Suggestions:** Sonnet 4 (nuanced recommendations)

**API Configuration:**
```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY!
});

// Message creation with streaming
const stream = await anthropic.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1000,
  messages: [
    { role: 'user', content: 'Your prompt here' }
  ],
  stream: true
});
```

**Token Budget Management:**
- Free users: Max 30K tokens/month (~10 audits + 4 check-ins)
- Paid users: Unlimited (cost pass-through or included in subscription)

---

## 7. UI Component Library

### 7.1 No External UI Library
**Custom Components Only**

**Why:**
- Existing UI design is complete and custom
- UI libraries (React Native Paper, NativeBase) add bloat
- Full design control without overriding defaults
- Smaller bundle size

**Component Structure:**
```
/components
  /ui
    /Button.tsx
    /Card.tsx
    /Input.tsx
    /Badge.tsx
    /Chip.tsx
    /Modal.tsx
    /Avatar.tsx
  /layout
    /BottomNav.tsx
    /Header.tsx
```

---

## 8. Styling

### 8.1 NativeWind (Tailwind CSS for React Native)
```json
{
  "nativewind": "^4.1.23",
  "tailwindcss": "^3.4.17"
}
```

**Why NativeWind:**
- Tailwind utility classes work in React Native
- Consistent with existing UI design
- Supports dark mode (`dark:` prefix)
- Responsive design with breakpoints

**tailwind.config.js:**
```javascript
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: '#6366F1', // Indigo-500
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

## 9. Data Visualization

### 9.1 Victory Native
```json
{
  "victory-native": "^41.4.0",
  "react-native-svg": "15.8.0"
}
```

**Why Victory Native:**
- Built for React Native (not web port)
- Supports line charts (monthly report trend)
- Supports radar charts (audit dimensions)
- Touchable/interactive charts
- Small bundle size

**Charts Used:**
- **Line Chart:** Monthly report 6-month trend
- **Radar Chart:** Audit 7-dimension scores
- **Bar Chart:** Report dimension breakdown

---

## 10. Date & Time Handling

### 10.1 date-fns
```json
{
  "date-fns": "^4.1.0"
}
```

**Why date-fns over Moment.js:**
- Smaller bundle size (tree-shakeable)
- Modern API
- TypeScript support

**Use Cases:**
- Format renewal dates: `format(new Date(), 'MMM d, yyyy')`
- Calculate days until renewal: `differenceInDays(renewalDate, new Date())`
- Parse user inputs: `parseISO('2026-03-15')`
- Add billing cycles: `addMonths(new Date(), 1)`

**No Timezones Required:**
- All dates stored in ISO 8601 format (YYYY-MM-DD)
- No timezone conversion (user's local timezone assumed)

---

## 11. Form Handling

### 11.1 React Hook Form
```json
{
  "react-hook-form": "^7.54.2"
}
```

**Why:**
- Minimal re-renders (performance)
- Built-in validation
- TypeScript support
- Easy integration with custom inputs

**Example Usage:**
```typescript
import { useForm, Controller } from 'react-hook-form';

const { control, handleSubmit, formState: { errors } } = useForm({
  defaultValues: {
    serviceName: '',
    cost: '',
    billingCycle: 'monthly'
  }
});
```

**Forms in App:**
- Add Subscription Form
- Setup Questionnaire
- Settings Edits
- Audit Chat Input (controlled, not RHF)

---

## 12. Animations

### 12.1 React Native Reanimated v3
```json
{
  "react-native-reanimated": "~3.16.1"
}
```

**Why:**
- Runs on UI thread (60fps animations)
- Gesture-driven animations (check-in swipe)
- Spring physics (smooth card movements)

**Animations Used:**
- Swipe card gestures (PanGestureHandler)
- Card stack stacking effect
- Avatar emotional reactions during swipe
- Confetti celebration (check-in completion)
- Modal slide-in/out
- Tab transition fades

### 12.2 Lottie (Optional, for Complex Animations)
```json
{
  "lottie-react-native": "^7.1.0"
}
```

**Use Cases:**
- Onboarding hero illustrations (if animated)
- Loading spinners (OCR processing, AI thinking)
- Celebration animations (check-in done, report generated)

---

## 13. Icon System

### 13.1 Google Material Symbols
**No NPM Package** - Use Web Fonts

**Why:**
- Existing UI design uses Material Symbols
- Loaded via Expo Font
- Consistent icon style
- Variable font (Fill, Weight, Grade, Optical Size)

**Font Loading:**
```typescript
import * as Font from 'expo-font';

await Font.loadAsync({
  'MaterialSymbols': require('./assets/fonts/MaterialSymbolsOutlined.ttf')
});
```

**Usage in Components:**
```tsx
<Text style={{ fontFamily: 'MaterialSymbols', fontSize: 24 }}>
  dashboard
</Text>
```

**Icons Used:**
- `dashboard` - Manager tab
- `swipe` - Check-In tab
- `psychology` - Audit tab (AI brain)
- `assessment` - Report tab
- `add` - FAB (add subscription)
- `settings` - Settings icon
- `chevron_left`, `chevron_right` - Navigation arrows
- `keyboard_arrow_down` - Dropdowns
- `more_vert` - More menu

---

## 14. Image Handling

### 14.1 Expo Image
```json
{
  "expo-image": "~2.0.3"
}
```

**Why Expo Image over react-native-fast-image:**
- Built into Expo SDK
- Better caching
- Supports placeholders and blurhash
- WebP support

**Use Cases:**
- User avatars (8 pre-designed options)
- Service logos (future: dynamic loading)
- Shareable report cards

---

## 15. Local Storage

### 15.1 AsyncStorage
```json
{
  "@react-native-async-storage/async-storage": "^2.1.0"
}
```

**Why:**
- Persist user auth session (Supabase requirement)
- Cache API responses for offline mode (future)
- Store app settings (dark mode preference, etc.)

**Storage Keys:**
- `@auth:session` - Supabase session token
- `@settings:theme` - Light/dark mode (future)
- `@cache:personas` - Cached persona data (offline mode)

**Data Stored in Supabase, NOT AsyncStorage:**
- Subscriptions
- Check-in responses
- Audit reports
- Monthly reports
- User persona

---

## 16. Environment Variables

### 16.1 dotenv + Expo Constants
```json
{
  "dotenv": "^16.4.7"
}
```

**`.env` File (Never Commit to Git):**
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_ANTHROPIC_API_KEY=<your-anthropic-api-key>
```

**Access in Code:**
```typescript
import Constants from 'expo-constants';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
// or
const anthropicKey = Constants.expoConfig?.extra?.anthropicApiKey;
```

**Security:**
- API keys prefixed with `EXPO_PUBLIC_` are embedded in app bundle (acceptable for anon keys)
- Sensitive keys (Anthropic API key) should be proxied through backend (future enhancement)

---

## 17. Testing (Future, Not MVP)

### 17.1 Jest + React Native Testing Library
```json
{
  "jest": "^29.7.0",
  "@testing-library/react-native": "^12.8.1"
}
```

**Test Coverage Goals:**
- Unit tests: Utility functions (date calculations, score formulas)
- Integration tests: Component interactions (swipe gestures, form submissions)
- E2E tests: Detox (future)

---

## 18. Code Quality Tools

### 18.1 ESLint + Prettier
```json
{
  "eslint": "^9.17.0",
  "@typescript-eslint/eslint-plugin": "^8.18.2",
  "@typescript-eslint/parser": "^8.18.2",
  "prettier": "^3.4.2",
  "eslint-config-prettier": "^9.1.0"
}
```

**ESLint Rules:**
- Extend `@typescript-eslint/recommended`
- Enforce consistent imports
- No unused variables
- Prefer const over let

**Prettier Config:**
```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

---

## 19. Build & Deployment

### 19.1 EAS (Expo Application Services)
```json
{
  "eas-cli": "^14.2.2"
}
```

**Build Profiles (eas.json):**
```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "production": {
      "distribution": "store",
      "ios": {
        "bundleIdentifier": "com.submanager.app"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "your-app-store-connect-id"
      }
    }
  }
}
```

**Build Commands:**
- Development: `eas build --profile development --platform ios`
- Production: `eas build --profile production --platform ios`
- Submit to App Store: `eas submit -p ios`

---

## 20. Version Control

### 20.1 Git + GitHub
**Repository Structure:**
```
subscription-manager/
├── .git/
├── .github/
│   └── workflows/ (CI/CD pipelines, future)
├── src/
├── assets/
├── .env (gitignored)
├── .gitignore
├── package.json
├── tsconfig.json
├── app.json (Expo config)
└── README.md
```

**Git Workflow:**
- Main branch: `main` (production-ready code)
- Feature branches: `feature/audit-chat`, `feature/check-in-swipe`
- No commits directly to `main`
- Squash merge for clean history

---

## 21. Package Manager

### 21.1 npm (Default)
**Version:** npm 10.x (comes with Node.js 22)

**Why npm over yarn/pnpm:**
- Default with Expo
- Simplicity
- Lock file: `package-lock.json`

**Scripts (package.json):**
```json
{
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "lint": "eslint .",
    "format": "prettier --write .",
    "type-check": "tsc --noEmit"
  }
}
```

---

## 22. Node.js Version

### 22.1 Node.js
**Required Version:** 22.x LTS

**Version Manager:** 
- Use `nvm` (Node Version Manager)
- `.nvmrc` file in project root:
  ```
  22
  ```
- Run `nvm use` to switch to correct version

---

## 23. iOS Development Requirements

### 23.1 Development Machine
- **macOS** 13 (Ventura) or later
- **Xcode** 15.x or later (for iOS Simulator)
- **iOS Simulator:** iPhone 14 Pro (iOS 17+) for testing
- **Physical Device:** iPhone 12 or newer (iOS 16+) for real-device testing via Expo Go

### 23.2 Apple Developer Account
**Required for:**
- Push Notifications (future)
- TestFlight distribution (beta testing)
- App Store submission

**Cost:** $99/year (individual developer account)

**Not Required for MVP:**
- Development builds work without paid account
- Expo Go testing works without paid account

---

## 24. Optional Future Enhancements

### 24.1 Analytics (Future)
- **Expo Application Insights** - User behavior tracking
- **Sentry** - Error monitoring and crash reporting

### 24.2 Performance Monitoring (Future)
- **React Native Performance** - Built-in profiler
- **Flipper** - Debugging tool with network inspector

### 24.3 Internationalization (Future)
- **i18next** - Multi-language support
- Initial launch: English only

---

## 25. Dependency Installation Commands

### 25.1 Fresh Install
```bash
# Clone repository
git clone https://github.com/your-org/subscription-manager.git
cd subscription-manager

# Install dependencies
npm install

# Start development server
npx expo start
```

### 25.2 Adding New Packages
```bash
# Example: Adding a new library
npx expo install package-name

# For native modules, always use expo install (handles version compatibility)
npx expo install react-native-gesture-handler

# For non-native modules, npm works fine
npm install date-fns
```

---

## 26. Locked Package Versions (package.json)

```json
{
  "name": "subscription-manager",
  "version": "1.0.0",
  "main": "expo/AppEntry.js",
  "scripts": {
    "start": "expo start",
    "ios": "expo start --ios",
    "lint": "eslint .",
    "format": "prettier --write .",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "expo": "^52.0.0",
    "react": "18.3.1",
    "react-native": "0.76.5",
    "@react-navigation/native": "^7.0.0",
    "@react-navigation/stack": "^7.0.0",
    "@react-navigation/bottom-tabs": "^7.0.0",
    "@supabase/supabase-js": "^2.47.10",
    "@anthropic-ai/sdk": "^0.32.1",
    "react-hook-form": "^7.54.2",
    "date-fns": "^4.1.0",
    "nativewind": "^4.1.23",
    "tailwindcss": "^3.4.17",
    "victory-native": "^41.4.0",
    "react-native-svg": "15.8.0",
    "react-native-reanimated": "~3.16.1",
    "react-native-gesture-handler": "~2.20.2",
    "react-native-screens": "~4.4.0",
    "react-native-safe-area-context": "4.14.0",
    "@react-native-async-storage/async-storage": "^2.1.0",
    "expo-font": "~13.0.1",
    "expo-image-picker": "~16.0.3",
    "expo-image": "~2.0.3",
    "expo-file-system": "~18.0.6",
    "expo-secure-store": "~14.0.0",
    "expo-sharing": "~13.0.0",
    "expo-status-bar": "~2.0.0",
    "lottie-react-native": "^7.1.0"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "@types/react": "~18.3.12",
    "@types/react-native": "~0.76.0",
    "eslint": "^9.17.0",
    "@typescript-eslint/eslint-plugin": "^8.18.2",
    "@typescript-eslint/parser": "^8.18.2",
    "prettier": "^3.4.2",
    "eslint-config-prettier": "^9.1.0",
    "dotenv": "^16.4.7"
  }
}
```

---

## 27. Technology Decision Rationale Summary

**React Native + Expo:**
- Cross-platform potential (iOS now, Android later)
- Fast development cycle with hot reload
- Large ecosystem and community support

**Supabase:**
- PostgreSQL database (reliable, scalable)
- Built-in auth (no custom auth implementation)
- Free tier generous for MVP

**Anthropic Claude:**
- Best-in-class conversational AI
- Vision API for OCR
- Reasonable pricing for MVP scale

**NativeWind:**
- Tailwind utility classes in React Native
- Existing UI design uses this approach
- Dark mode support built-in

**TypeScript:**
- Type safety prevents bugs
- Better IDE autocomplete
- Self-documenting code

**No External State Library:**
- React Context sufficient for app complexity
- Reduces dependencies and bundle size

**Victory Native for Charts:**
- Native React Native support (not web port)
- Smaller than alternatives (Recharts requires react-native-webview)

---

**END OF TECH_STACK.md**
