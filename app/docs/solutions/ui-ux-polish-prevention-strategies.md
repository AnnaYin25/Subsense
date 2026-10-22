# UI/UX Polish: Prevention Strategies & Best Practices

**Date:** 2026-02-12
**Context:** Learnings from UI/UX polish session addressing duplicate styles, inconsistent patterns, and maintainability issues

---

## Table of Contents

1. [Duplicate StyleSheet Definitions](#1-duplicate-stylesheet-definitions)
2. [Inconsistent Badge Styling](#2-inconsistent-badge-styling)
3. [Hardcoded Date Logic](#3-hardcoded-date-logic)
4. [Limited Notification Options](#4-limited-notification-options)
5. [No Custom Input Flexibility](#5-no-custom-input-flexibility)
6. [Emoji Icons Instead of Proper Icons](#6-emoji-icons-instead-of-proper-icons)
7. [Theme Inconsistency](#7-theme-inconsistency)
8. [Quick Reference Checklist](#8-quick-reference-checklist)

---

## 1. Duplicate StyleSheet Definitions

### Problem
Multiple components had duplicated StyleSheet definitions for common patterns (containers, buttons, cards), leading to:
- Code bloat and maintenance overhead
- Inconsistent spacing and styling
- Difficult-to-implement design changes
- No single source of truth

### Prevention Strategy

**1. Design System First Approach**
- Always check `src/styles/common.ts` before creating new styles
- If a pattern is used in 2+ places, it belongs in the design system
- Create reusable style compositions instead of copy-pasting

**2. Style Audit Process**
- Monthly review: Search codebase for duplicate style patterns
- Use linting tools to detect style duplication
- Code review checklist must include "Is this style reusable?"

**3. Component Library Building**
- Extract common patterns into shared components
- Build a component library incrementally
- Document all reusable styles

### Best Practice

```typescript
// ❌ BAD: Duplicated styles in every component
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
  },
});

// ✅ GOOD: Import from design system
import { commonStyles, spacing, colors } from '@/styles';

// Use existing styles
<View style={commonStyles.container}>
  <View style={commonStyles.card}>

// Or compose with custom overrides
<View style={[commonStyles.card, { padding: spacing.xl }]}>
```

**Design System Organization:**
```typescript
// src/styles/tokens.ts - Primitives (colors, spacing, fonts)
export const colors = { primary: '#3B82F6', ... };
export const spacing = { xs: 4, sm: 8, md: 16, ... };

// src/styles/common.ts - Common patterns
export const commonStyles = StyleSheet.create({
  container: { /* ... */ },
  card: { /* ... */ },
  buttonPrimary: { /* ... */ },
});

// src/styles/helpers.ts - Utilities
export const composeStyles = (...styles) => { /* ... */ };
```

### Testing Approach

**Automated Tests:**
```typescript
// tests/styles/duplicates.test.ts
describe('Style Duplication Detection', () => {
  it('should not have duplicate backgroundColor definitions', () => {
    // Parse all StyleSheet.create() calls
    // Flag if same values appear 3+ times
    const backgrounds = extractStyleProperty('backgroundColor');
    const duplicates = findDuplicates(backgrounds);
    expect(duplicates).toHaveLength(0);
  });
});
```

**Manual Code Review Checklist:**
- [ ] Does this style pattern already exist in `commonStyles`?
- [ ] Is this style used in 2+ components?
- [ ] Are all values using design tokens (no hardcoded values)?
- [ ] Can this be composed from existing styles?

**Visual Regression Testing:**
```bash
# Take screenshots of all screens
npm run test:visual:baseline

# After refactoring, compare
npm run test:visual:compare
```

### Design System Guidelines

**Rule 1: Token-First Design**
- ALL color values must come from `colors` object
- ALL spacing must use `spacing` scale
- ALL fonts must use `fontSize` and `fontWeight`
- NO magic numbers or hardcoded hex codes

**Rule 2: Composition Over Duplication**
```typescript
// ✅ Compose existing styles
const customCard = [
  commonStyles.card,
  { backgroundColor: colors.primaryLight }
];

// ❌ Don't redefine from scratch
const customCard = {
  backgroundColor: '#93C5FD',
  borderRadius: 32,
  padding: 24,
  // ... duplicating commonStyles.card
};
```

**Rule 3: Three-Use Rule**
- Used once: Component-local style is OK
- Used twice: Consider extraction
- Used three times: MUST extract to design system

**Rule 4: Documentation**
```typescript
// src/styles/common.ts
export const commonStyles = StyleSheet.create({
  /**
   * Standard card container
   * Usage: List items, info cards, form sections
   * Variants: Use backgroundColor or borderColor to customize
   */
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
});
```

---

## 2. Inconsistent Badge Styling

### Problem
Badge components had inconsistent:
- Font sizes (9px vs 10px vs 12px)
- Font weights (bold vs black)
- Letter spacing (1.2 vs 1.6)
- Colors (different shades of primary)
- Padding and border radius

### Prevention Strategy

**1. Component Variants Pattern**
```typescript
// src/components/Badge.tsx
import { colors, fontSize, fontWeight, spacing, borderRadius } from '@/styles';

type BadgeVariant = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'primary',
  size = 'md',
  icon
}) => {
  const style = [
    styles.base,
    styles[variant],
    styles[`size_${size}`]
  ];

  return (
    <View style={style}>
      {icon && <Text style={styles.icon}>{icon}</Text>}
      <Text style={styles.text}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.full,
  },
  // Variants
  primary: {
    backgroundColor: `${colors.primary}14`,
    borderColor: `${colors.primary}1A`,
  },
  success: {
    backgroundColor: `${colors.success}14`,
    borderColor: `${colors.success}1A`,
  },
  // Sizes
  size_sm: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  size_md: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  text: {
    fontSize: fontSize.xxs,
    fontWeight: fontWeight.black as any,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
```

**2. Storybook/Documentation**
- Create visual documentation of all badge variants
- Show examples of correct usage
- Include do's and don'ts

**3. Lint Rules**
```typescript
// .eslintrc.js
rules: {
  'no-inline-badge-styles': 'error', // Custom rule
  'use-badge-component': 'error',
}
```

### Best Practice

**Always use the Badge component:**
```typescript
// ❌ BAD: Inline badge styling
<View style={{
  flexDirection: 'row',
  backgroundColor: '#3B82F614',
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 999,
}}>
  <Text style={{ fontSize: 10, color: '#3B82F6' }}>
    PRO SAVER
  </Text>
</View>

// ✅ GOOD: Use Badge component
<Badge label="PRO SAVER" variant="primary" size="sm" icon="⭐" />
```

**Create a Badge Design Spec:**
```markdown
# Badge Component Specification

## Sizes
- Small: 8px vertical padding, 12px horizontal
- Medium: 10px vertical, 16px horizontal
- Large: 12px vertical, 20px horizontal

## Typography
- Font size: 10px (fixed)
- Font weight: 900 (black)
- Letter spacing: 1.2px
- Transform: uppercase

## Colors by Variant
- Primary: #3B82F614 background, #3B82F6 text
- Success: #10B98114 background, #10B981 text
- Warning: #F59E0B14 background, #F59E0B text
- Danger: #EF444414 background, #EF4444 text
- Neutral: #6B728014 background, #6B7280 text

## Usage
- Status indicators
- Category labels
- User tier badges
- Notification counts
```

### Testing Approach

**Visual Testing:**
```typescript
// Badge.test.tsx
import { render } from '@testing-library/react-native';
import { Badge } from './Badge';

describe('Badge Component', () => {
  it('renders all variants correctly', () => {
    const { toJSON } = render(
      <>
        <Badge label="PRIMARY" variant="primary" />
        <Badge label="SUCCESS" variant="success" />
        <Badge label="WARNING" variant="warning" />
      </>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('applies correct size styling', () => {
    const { getByText } = render(
      <Badge label="TEST" size="lg" />
    );
    // Assert padding, fontSize based on size
  });
});
```

**Screenshot Testing:**
```typescript
// Use react-native-testing-library + jest-image-snapshot
it('should match badge visual snapshot', () => {
  const tree = renderer.create(
    <BadgeShowcase /> // All variants
  ).toJSON();
  expect(tree).toMatchImageSnapshot();
});
```

**Manual QA Checklist:**
- [ ] All badges use same font size (10px)
- [ ] All badges use black (900) font weight
- [ ] Letter spacing is consistent (1.2px)
- [ ] Colors match design tokens exactly
- [ ] Border radius is full/pill-shaped
- [ ] Padding follows size variants

### Design System Guidelines

**Badge Usage Matrix:**

| Context | Variant | Size | Icon |
|---------|---------|------|------|
| User tier | primary | sm | ⭐ |
| Subscription status | success/warning | md | - |
| Category tags | neutral | sm | - |
| Alert count | danger | sm | 🔔 |

**Naming Convention:**
```typescript
// Clear, semantic names
<Badge label="ACTIVE" variant="success" />
<Badge label="PAUSED" variant="warning" />
<Badge label="EXPIRED" variant="danger" />

// Not vague colors
<Badge label="ACTIVE" color="green" /> // ❌ Avoid
```

**Accessibility:**
```typescript
<Badge
  label="PRO USER"
  variant="primary"
  accessibilityLabel="Pro user badge"
  accessibilityHint="This user has a pro subscription"
/>
```

---

## 3. Hardcoded Date Logic

### Problem
Date handling was scattered across components with:
- Hardcoded date format strings
- Inconsistent date parsing logic
- No timezone handling
- Copy-pasted date utility functions

### Prevention Strategy

**1. Centralized Date Utilities**
```typescript
// src/utils/dateUtils.ts
import { format, parseISO, addDays, startOfWeek, endOfWeek } from 'date-fns';
import { enUS } from 'date-fns/locale';

/**
 * Standard date formats used across the app
 */
export const DateFormats = {
  ISO: 'yyyy-MM-dd',           // 2026-02-12
  DISPLAY_SHORT: 'MMM d',      // Feb 12
  DISPLAY_LONG: 'MMMM d, yyyy', // February 12, 2026
  DISPLAY_WITH_DAY: 'EEE, MMM d', // Wed, Feb 12
  TIME: 'h:mm a',              // 3:30 PM
} as const;

/**
 * Format date to ISO string (YYYY-MM-DD)
 * Use this for database storage and comparison
 */
export const toISODate = (date: Date): string => {
  return format(date, DateFormats.ISO);
};

/**
 * Format date for display in UI
 */
export const formatDisplayDate = (
  date: Date | string,
  formatType: keyof typeof DateFormats = 'DISPLAY_SHORT'
): string => {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return format(dateObj, DateFormats[formatType], { locale: enUS });
};

/**
 * Get start of week (Sunday by default)
 */
export const getWeekStart = (date: Date, weekStartsOn: 0 | 1 = 0): Date => {
  return startOfWeek(date, { weekStartsOn });
};

/**
 * Calculate days until a date
 */
export const daysUntil = (targetDate: Date | string): number => {
  const target = typeof targetDate === 'string' ? parseISO(targetDate) : targetDate;
  const today = new Date();
  const diffTime = target.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Check if a date is today
 */
export const isToday = (date: Date | string): boolean => {
  const target = typeof date === 'string' ? parseISO(date) : date;
  return toISODate(target) === toISODate(new Date());
};

/**
 * Get next renewal date based on billing cycle
 */
export const calculateNextRenewal = (
  startDate: Date | string,
  billingCycle: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
): string => {
  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  let next: Date;

  switch (billingCycle) {
    case 'daily':
      next = addDays(start, 1);
      break;
    case 'weekly':
      next = addDays(start, 7);
      break;
    case 'monthly':
      next = addDays(start, 30);
      break;
    case 'quarterly':
      next = addDays(start, 90);
      break;
    case 'yearly':
      next = addDays(start, 365);
      break;
    default:
      next = addDays(start, 30);
  }

  return toISODate(next);
};
```

**2. Use date-fns Library**
```bash
npm install date-fns
```

**Why date-fns:**
- Immutable & pure functions
- Tree-shakeable (only import what you need)
- TypeScript support
- Extensive locale support
- Well-tested and maintained

**3. Configuration File**
```typescript
// src/config/dateConfig.ts
export const dateConfig = {
  weekStartsOn: 0 as const, // 0 = Sunday, 1 = Monday
  defaultLocale: 'en-US',
  defaultTimezone: 'America/New_York',
  dateFormat: 'MMM d',
  dateTimeFormat: 'MMM d, h:mm a',
};
```

### Best Practice

**Always use date utilities:**
```typescript
// ❌ BAD: Hardcoded date logic
const dateStr = new Date().toISOString().split('T')[0];
const formatted = new Date(sub.nextRenewalDate).toLocaleDateString('en-US', {
  month: 'short',
  day: 'numeric'
});

// ✅ GOOD: Use centralized utilities
import { toISODate, formatDisplayDate } from '@/utils/dateUtils';

const dateStr = toISODate(new Date());
const formatted = formatDisplayDate(sub.nextRenewalDate);
```

**Consistent Date Handling Pattern:**
```typescript
// Component: Display subscription renewal
import { formatDisplayDate, daysUntil, isToday } from '@/utils/dateUtils';

const RenewalDate = ({ subscription }) => {
  const days = daysUntil(subscription.nextRenewalDate);
  const formatted = formatDisplayDate(subscription.nextRenewalDate);
  const urgent = isToday(subscription.nextRenewalDate);

  return (
    <View>
      <Text>{formatted}</Text>
      {urgent && <Badge label="TODAY" variant="danger" />}
      {days <= 3 && !urgent && (
        <Text style={styles.warning}>Renews in {days} days</Text>
      )}
    </View>
  );
};
```

### Testing Approach

**Unit Tests:**
```typescript
// dateUtils.test.ts
import { toISODate, formatDisplayDate, daysUntil } from './dateUtils';

describe('Date Utilities', () => {
  it('toISODate formats correctly', () => {
    const date = new Date('2026-02-12T15:30:00');
    expect(toISODate(date)).toBe('2026-02-12');
  });

  it('formatDisplayDate handles short format', () => {
    const date = new Date('2026-02-12');
    expect(formatDisplayDate(date, 'DISPLAY_SHORT')).toBe('Feb 12');
  });

  it('daysUntil calculates correctly', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(daysUntil(tomorrow)).toBe(1);
  });

  it('handles ISO string input', () => {
    const isoString = '2026-02-12';
    expect(formatDisplayDate(isoString)).toBe('Feb 12');
  });
});
```

**Integration Tests:**
```typescript
// Test date calculations in subscription context
describe('Subscription Renewal Calculation', () => {
  it('calculates monthly renewal correctly', () => {
    const start = '2026-01-15';
    const next = calculateNextRenewal(start, 'monthly');
    expect(next).toBe('2026-02-14'); // 30 days later
  });
});
```

**Edge Case Tests:**
```typescript
describe('Date Edge Cases', () => {
  it('handles leap years', () => {
    // Test Feb 29
  });

  it('handles month boundaries', () => {
    // Test Jan 31 -> Feb
  });

  it('handles timezone changes', () => {
    // Test DST transitions
  });
});
```

### Design System Guidelines

**Date Display Standards:**

| Context | Format | Example |
|---------|--------|---------|
| List items | MMM d | Feb 12 |
| Detail view | MMMM d, yyyy | February 12, 2026 |
| Calendar | d | 12 |
| Full context | EEE, MMM d | Wed, Feb 12 |
| Database | yyyy-MM-dd | 2026-02-12 |

**Color Coding by Urgency:**
```typescript
// Helper function
export const getRenewalUrgency = (date: string) => {
  const days = daysUntil(date);
  if (days <= 0) return 'overdue';
  if (days <= 3) return 'urgent';
  if (days <= 7) return 'soon';
  return 'normal';
};

// Use in component
const urgency = getRenewalUrgency(sub.nextRenewalDate);
const style = urgencyStyles[urgency];
```

**Accessibility:**
```typescript
// Always provide full date in accessibility label
<Text
  style={styles.date}
  accessibilityLabel={formatDisplayDate(date, 'DISPLAY_LONG')}
>
  {formatDisplayDate(date)}
</Text>
```

---

## 4. Limited Notification Options

### Problem
Notification settings were:
- Hardcoded to only 3-day reminders
- No customization options
- Not stored in database
- Missing notification types (email, SMS, etc.)

### Prevention Strategy

**1. Flexible Notification System**
```typescript
// src/types/notifications.ts
export type NotificationTiming = '1-day' | '3-day' | '7-day' | 'same-day' | 'custom';
export type NotificationMethod = 'push' | 'email' | 'sms';

export interface NotificationPreference {
  id: string;
  subscriptionId: string;
  timing: NotificationTiming;
  customDays?: number; // For 'custom' timing
  methods: NotificationMethod[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// Database schema
export interface Subscription {
  // ... other fields
  notificationPreferences: NotificationPreference[];
}
```

**2. Notification Settings Component**
```typescript
// src/components/NotificationSettings.tsx
interface NotificationSettingsProps {
  subscriptionId: string;
  preferences: NotificationPreference[];
  onChange: (preferences: NotificationPreference[]) => void;
}

export const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  subscriptionId,
  preferences,
  onChange
}) => {
  const timingOptions: { value: NotificationTiming; label: string }[] = [
    { value: '1-day', label: '1 Day Before' },
    { value: '3-day', label: '3 Days Before' },
    { value: '7-day', label: '7 Days Before' },
    { value: 'same-day', label: 'On Renewal Day' },
    { value: 'custom', label: 'Custom' },
  ];

  const methodOptions: { value: NotificationMethod; label: string; icon: string }[] = [
    { value: 'push', label: 'Push Notification', icon: '🔔' },
    { value: 'email', label: 'Email', icon: '📧' },
    { value: 'sms', label: 'SMS', icon: '💬' },
  ];

  return (
    <View style={styles.container}>
      {/* Timing Selection */}
      <Text style={styles.sectionTitle}>When to Notify</Text>
      {timingOptions.map(option => (
        <ToggleOption
          key={option.value}
          label={option.label}
          value={option.value}
          selected={preferences.some(p => p.timing === option.value)}
          onToggle={() => handleTimingToggle(option.value)}
        />
      ))}

      {/* Method Selection */}
      <Text style={styles.sectionTitle}>Notification Methods</Text>
      {methodOptions.map(option => (
        <ToggleOption
          key={option.value}
          label={option.label}
          icon={option.icon}
          value={option.value}
          selected={preferences.some(p => p.methods.includes(option.value))}
          onToggle={() => handleMethodToggle(option.value)}
        />
      ))}

      {/* Custom Days Input */}
      {preferences.some(p => p.timing === 'custom') && (
        <View style={styles.customInput}>
          <Text style={styles.label}>Days Before Renewal</Text>
          <TextInput
            keyboardType="number-pad"
            placeholder="Enter days"
            value={customDays?.toString()}
            onChangeText={handleCustomDaysChange}
          />
        </View>
      )}
    </View>
  );
};
```

**3. Database Migration**
```sql
-- Add notification preferences table
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
  timing VARCHAR(20) NOT NULL,
  custom_days INTEGER,
  methods JSONB NOT NULL DEFAULT '["push"]',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient queries
CREATE INDEX idx_notification_prefs_subscription
  ON notification_preferences(subscription_id);
```

### Best Practice

**Configuration Over Hardcoding:**
```typescript
// ❌ BAD: Hardcoded notification logic
const [notif3Day, setNotif3Day] = useState(false);
const [notifSameDay, setNotifSameDay] = useState(false);

// ✅ GOOD: Flexible configuration
const [preferences, setPreferences] = useState<NotificationPreference[]>([
  {
    id: '1',
    subscriptionId: sub.id,
    timing: '3-day',
    methods: ['push', 'email'],
    enabled: true,
  }
]);
```

**Default Notification Strategy:**
```typescript
// src/config/notificationDefaults.ts
export const DEFAULT_NOTIFICATION_PREFS: Partial<NotificationPreference>[] = [
  {
    timing: '3-day',
    methods: ['push'],
    enabled: true,
  },
  {
    timing: 'same-day',
    methods: ['push'],
    enabled: false, // User can opt-in
  },
];

// Apply defaults when creating subscription
const createSubscription = async (data: SubscriptionInput) => {
  const subscription = await db.subscriptions.create(data);

  // Create default notification preferences
  await Promise.all(
    DEFAULT_NOTIFICATION_PREFS.map(pref =>
      db.notificationPreferences.create({
        ...pref,
        subscriptionId: subscription.id,
      })
    )
  );

  return subscription;
};
```

### Testing Approach

**Unit Tests:**
```typescript
describe('Notification Preferences', () => {
  it('creates default preferences for new subscription', async () => {
    const sub = await createSubscription(mockData);
    const prefs = await getNotificationPreferences(sub.id);

    expect(prefs).toHaveLength(2);
    expect(prefs[0].timing).toBe('3-day');
    expect(prefs[0].methods).toContain('push');
  });

  it('allows custom day configuration', async () => {
    const pref = await createNotificationPreference({
      subscriptionId: 'sub-1',
      timing: 'custom',
      customDays: 14,
      methods: ['email'],
    });

    expect(pref.customDays).toBe(14);
  });

  it('validates custom days range', () => {
    expect(() => validateCustomDays(0)).toThrow();
    expect(() => validateCustomDays(91)).toThrow();
    expect(() => validateCustomDays(7)).not.toThrow();
  });
});
```

**Integration Tests:**
```typescript
describe('Notification System Integration', () => {
  it('sends notifications at correct times', async () => {
    // Mock subscription with 3-day reminder
    const sub = createMockSubscription({
      nextRenewalDate: '2026-02-15',
    });

    await createNotificationPreference({
      subscriptionId: sub.id,
      timing: '3-day',
      methods: ['push'],
    });

    // Simulate date being 2026-02-12 (3 days before)
    jest.setSystemTime(new Date('2026-02-12'));

    await runNotificationCron();

    expect(mockPushService.send).toHaveBeenCalledWith({
      userId: sub.userId,
      title: `${sub.name} renews in 3 days`,
      body: `Your ${sub.planName} plan will renew on Feb 15 for $${sub.cost}`,
    });
  });
});
```

**User Acceptance Tests:**
```typescript
// E2E test with Detox
describe('Notification Settings', () => {
  it('allows user to configure notifications', async () => {
    await element(by.id('subscription-detail')).tap();
    await element(by.id('notification-settings-button')).tap();

    // Enable 7-day reminder
    await element(by.text('7 Days Before')).tap();
    await expect(element(by.id('notification-7-day-toggle'))).toHaveToggleValue(true);

    // Add email notification
    await element(by.text('Email')).tap();
    await expect(element(by.id('notification-email-toggle'))).toHaveToggleValue(true);

    await element(by.id('save-notifications')).tap();
    await expect(element(by.text('Notification settings saved'))).toBeVisible();
  });
});
```

### Design System Guidelines

**Notification UX Patterns:**

1. **Progressive Disclosure**
   - Start with simple on/off toggle
   - Show advanced options on tap
   - Don't overwhelm with all options at once

2. **Smart Defaults**
   - Enable 3-day push notification by default
   - Suggest additional methods based on user behavior
   - Allow quick "notify me everything" option

3. **Clear Visual Hierarchy**
   ```
   Primary: Push notifications (most common)
   Secondary: Email (opt-in)
   Tertiary: SMS (requires phone verification)
   ```

4. **Confirmation Feedback**
   - Show toast when preferences saved
   - Highlight which notifications are active
   - Preview next notification date/time

**Notification Copy Guidelines:**
```typescript
// Good notification messages
const messages = {
  '1-day': `${name} renews tomorrow`,
  '3-day': `${name} renews in 3 days`,
  '7-day': `${name} renews in a week`,
  'same-day': `${name} renews today`,
};

// Include actionable info
const body = `Your ${plan} plan renews on ${date} for $${cost}.
Tap to manage or cancel.`;
```

---

## 5. No Custom Input Flexibility

### Problem
Forms had:
- Fixed dropdowns with no "Other" option
- No free-text input for custom values
- Limited emoji/icon picker
- Can't add new categories on-the-fly

### Prevention Strategy

**1. Hybrid Input Pattern**
```typescript
// src/components/HybridSelector.tsx
interface HybridSelectorProps<T> {
  label: string;
  options: T[];
  value: T;
  onChange: (value: T) => void;
  renderOption: (option: T) => React.ReactNode;
  allowCustom?: boolean;
  customPlaceholder?: string;
  customValidator?: (value: string) => { valid: boolean; error?: string };
}

export const HybridSelector = <T extends string>({
  label,
  options,
  value,
  onChange,
  renderOption,
  allowCustom = true,
  customPlaceholder = 'Enter custom value',
  customValidator,
}: HybridSelectorProps<T>) => {
  const [showCustom, setShowCustom] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [error, setError] = useState<string>();

  const isCustomValue = !options.includes(value);

  useEffect(() => {
    if (isCustomValue) {
      setShowCustom(true);
      setCustomValue(value);
    }
  }, [value, isCustomValue]);

  const handleCustomSubmit = () => {
    if (customValidator) {
      const result = customValidator(customValue);
      if (!result.valid) {
        setError(result.error);
        return;
      }
    }
    onChange(customValue as T);
    setError(undefined);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      {/* Preset Options */}
      <View style={styles.optionsGrid}>
        {options.map(option => (
          <Pressable
            key={option}
            onPress={() => {
              setShowCustom(false);
              onChange(option);
            }}
            style={[
              styles.option,
              value === option && !showCustom && styles.optionSelected
            ]}
          >
            {renderOption(option)}
          </Pressable>
        ))}

        {/* Custom Option Trigger */}
        {allowCustom && (
          <Pressable
            onPress={() => setShowCustom(true)}
            style={[
              styles.option,
              styles.optionCustom,
              showCustom && styles.optionSelected
            ]}
          >
            <Text style={styles.customTriggerText}>+ Custom</Text>
          </Pressable>
        )}
      </View>

      {/* Custom Input */}
      {showCustom && (
        <View style={styles.customInputContainer}>
          <TextInput
            value={customValue}
            onChangeText={setCustomValue}
            onSubmitEditing={handleCustomSubmit}
            onBlur={handleCustomSubmit}
            placeholder={customPlaceholder}
            style={styles.customInput}
            autoFocus
          />
          {error && <Text style={styles.error}>{error}</Text>}
        </View>
      )}
    </View>
  );
};
```

**2. Usage Example**
```typescript
// In AddSubscriptionScreen
import { HybridSelector } from '@/components/HybridSelector';

const CATEGORIES = ['Entertainment', 'Productivity', 'Utilities', 'Health'];

<HybridSelector
  label="Category"
  options={CATEGORIES}
  value={category}
  onChange={setCategory}
  renderOption={(cat) => <Text>{cat}</Text>}
  allowCustom
  customPlaceholder="Enter custom category"
  customValidator={(value) => ({
    valid: value.length >= 2 && value.length <= 30,
    error: value.length < 2 ? 'Too short' : 'Too long',
  })}
/>
```

**3. Emoji Picker Enhancement**
```typescript
// src/components/EmojiPicker.tsx
interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
  presetEmojis: string[];
  allowCustom?: boolean;
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  value,
  onChange,
  presetEmojis,
  allowCustom = true,
}) => {
  const [showCustomInput, setShowCustomInput] = useState(false);

  return (
    <View style={styles.emojiGrid}>
      {presetEmojis.map(emoji => (
        <Pressable
          key={emoji}
          onPress={() => {
            onChange(emoji);
            setShowCustomInput(false);
          }}
          style={[
            styles.emojiButton,
            value === emoji && !showCustomInput && styles.selected
          ]}
        >
          <Text style={styles.emoji}>{emoji}</Text>
        </Pressable>
      ))}

      {allowCustom && (
        showCustomInput ? (
          <View style={[styles.emojiButton, styles.selected]}>
            <TextInput
              style={styles.emojiInput}
              value={value}
              onChangeText={onChange}
              maxLength={2}
              autoFocus
              placeholder="😀"
              onBlur={() => {
                if (!value) {
                  setShowCustomInput(false);
                  onChange('📱'); // Default
                }
              }}
            />
          </View>
        ) : (
          <Pressable
            onPress={() => setShowCustomInput(true)}
            style={[styles.emojiButton, styles.customButton]}
          >
            <Text style={styles.plusIcon}>+</Text>
          </Pressable>
        )
      )}
    </View>
  );
};
```

### Best Practice

**Always Provide Custom Option for User Input:**
```typescript
// ✅ GOOD: Flexible category selection
const SUGGESTED_CATEGORIES = ['Entertainment', 'Productivity', 'Utilities'];

<HybridSelector
  label="Category"
  options={SUGGESTED_CATEGORIES}
  value={category}
  onChange={setCategory}
  allowCustom
/>

// ❌ BAD: Locked to preset options only
<Picker selectedValue={category} onValueChange={setCategory}>
  {CATEGORIES.map(cat => <Picker.Item key={cat} value={cat} />)}
</Picker>
```

**Validation Rules:**
```typescript
// src/utils/validators.ts
export const validators = {
  category: (value: string) => ({
    valid: value.length >= 2 && value.length <= 50,
    error: value.length < 2
      ? 'Category must be at least 2 characters'
      : 'Category must be less than 50 characters',
  }),

  planName: (value: string) => ({
    valid: value.length >= 1 && value.length <= 30,
    error: 'Plan name must be 1-30 characters',
  }),

  emoji: (value: string) => ({
    valid: value.length <= 2,
    error: 'Please enter a single emoji',
  }),
};
```

### Testing Approach

**Component Tests:**
```typescript
describe('HybridSelector', () => {
  it('renders preset options', () => {
    const { getByText } = render(
      <HybridSelector
        label="Category"
        options={['Entertainment', 'Productivity']}
        value="Entertainment"
        onChange={jest.fn()}
        renderOption={(opt) => <Text>{opt}</Text>}
      />
    );

    expect(getByText('Entertainment')).toBeTruthy();
    expect(getByText('Productivity')).toBeTruthy();
  });

  it('shows custom input when "+ Custom" pressed', () => {
    const { getByText, getByPlaceholderText } = render(
      <HybridSelector
        label="Category"
        options={['Entertainment']}
        value=""
        onChange={jest.fn()}
        renderOption={(opt) => <Text>{opt}</Text>}
        allowCustom
        customPlaceholder="Enter custom"
      />
    );

    fireEvent.press(getByText('+ Custom'));
    expect(getByPlaceholderText('Enter custom')).toBeTruthy();
  });

  it('validates custom input', () => {
    const onChange = jest.fn();
    const { getByPlaceholderText, getByText } = render(
      <HybridSelector
        label="Category"
        options={['Entertainment']}
        value=""
        onChange={onChange}
        renderOption={(opt) => <Text>{opt}</Text>}
        customValidator={(val) => ({
          valid: val.length >= 3,
          error: 'Too short'
        })}
      />
    );

    fireEvent.press(getByText('+ Custom'));
    const input = getByPlaceholderText('Enter custom value');

    fireEvent.changeText(input, 'A');
    fireEvent(input, 'blur');

    expect(getByText('Too short')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });
});
```

**E2E Tests:**
```typescript
describe('Custom Input Flow', () => {
  it('allows creating subscription with custom category', async () => {
    await element(by.id('add-subscription-button')).tap();

    // Select custom category
    await element(by.text('+ Custom')).tap();
    await element(by.id('custom-category-input')).typeText('Gaming');
    await element(by.id('custom-category-input')).tapReturnKey();

    // Fill other required fields
    await element(by.id('name-input')).typeText('Xbox Game Pass');
    await element(by.id('cost-input')).typeText('14.99');

    await element(by.id('save-button')).tap();

    // Verify subscription created with custom category
    await expect(element(by.text('Gaming'))).toBeVisible();
  });
});
```

### Design System Guidelines

**Custom Input UX Rules:**

1. **Make Custom Option Discoverable**
   - Always show "+ Custom" button at end of preset options
   - Use dashed border to indicate "add new"
   - Keep consistent position across all selectors

2. **Inline Editing**
   - Show custom input inline, not in modal
   - Auto-focus input when "+ Custom" pressed
   - Blur to save, ESC to cancel

3. **Validation Feedback**
   - Show validation errors below input
   - Use red color for errors
   - Disable save until valid

4. **Preserve User Input**
   - Store custom values in database
   - Show custom values in future selectors
   - Allow editing/deleting custom values

**Visual Design:**
```typescript
// Custom option styling
const styles = StyleSheet.create({
  optionCustom: {
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: colors.gray300,
    backgroundColor: 'transparent',
  },
  customTriggerText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold as any,
    color: colors.textSecondary,
  },
  customInput: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
});
```

---

## 6. Emoji Icons Instead of Proper Icons

### Problem
Using emoji for icons leads to:
- Platform inconsistencies (iOS vs Android rendering)
- Accessibility issues (screen readers)
- No color customization
- Limited design control
- Unpredictable sizing

### Prevention Strategy

**1. Migrate to React Native Vector Icons**
```bash
npm install react-native-vector-icons
npm install --save-dev @types/react-native-vector-icons
```

**2. Icon System Setup**
```typescript
// src/components/Icon.tsx
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Feather from 'react-native-vector-icons/Feather';
import { colors } from '@/styles';

type IconSet = 'material' | 'material-community' | 'feather';
type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const ICON_SIZES: Record<IconSize, number> = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 48,
};

interface IconProps {
  name: string;
  set?: IconSet;
  size?: IconSize | number;
  color?: string;
  accessibilityLabel?: string;
}

export const Icon: React.FC<IconProps> = ({
  name,
  set = 'material',
  size = 'md',
  color = colors.textPrimary,
  accessibilityLabel,
}) => {
  const iconSize = typeof size === 'number' ? size : ICON_SIZES[size];

  const IconComponent = {
    material: MaterialIcons,
    'material-community': MaterialCommunityIcons,
    feather: Feather,
  }[set];

  return (
    <IconComponent
      name={name}
      size={iconSize}
      color={color}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
    />
  );
};
```

**3. Create Icon Mapping**
```typescript
// src/config/subscriptionIcons.ts
import { Icon } from '@/components/Icon';

export const SUBSCRIPTION_ICONS: Record<string, {
  name: string;
  set: IconSet;
  color?: string;
}> = {
  // Entertainment
  netflix: { name: 'movie', set: 'material', color: '#E50914' },
  spotify: { name: 'spotify', set: 'material-community', color: '#1DB954' },
  youtube: { name: 'youtube', set: 'material-community', color: '#FF0000' },
  disney: { name: 'disney', set: 'material-community', color: '#113CCF' },

  // Productivity
  notion: { name: 'notebook', set: 'material', color: '#000000' },
  slack: { name: 'slack', set: 'material-community', color: '#4A154B' },
  dropbox: { name: 'dropbox', set: 'material-community', color: '#0061FF' },

  // Utilities
  electricity: { name: 'flash', set: 'feather', color: '#F59E0B' },
  water: { name: 'droplet', set: 'feather', color: '#3B82F6' },
  internet: { name: 'wifi', set: 'feather', color: '#10B981' },

  // Fitness
  gym: { name: 'fitness-center', set: 'material', color: '#EF4444' },
  yoga: { name: 'yoga', set: 'material-community', color: '#8B5CF6' },

  // Default
  default: { name: 'star', set: 'material', color: colors.primary },
};

// Helper to get icon for subscription
export const getSubscriptionIcon = (
  serviceName: string,
  category: string
): typeof SUBSCRIPTION_ICONS[string] => {
  const key = serviceName.toLowerCase().replace(/\s+/g, '');
  return SUBSCRIPTION_ICONS[key] || getCategoryIcon(category) || SUBSCRIPTION_ICONS.default;
};

const getCategoryIcon = (category: string) => {
  const categoryIcons: Record<string, typeof SUBSCRIPTION_ICONS[string]> = {
    Entertainment: { name: 'play-circle', set: 'feather' },
    Productivity: { name: 'briefcase', set: 'feather' },
    Utilities: { name: 'zap', set: 'feather' },
    Health: { name: 'heart', set: 'feather' },
    Finance: { name: 'dollar-sign', set: 'feather' },
  };
  return categoryIcons[category];
};
```

**4. Migration Path**
```typescript
// Gradual migration: Support both emoji and icons
interface SubscriptionIcon {
  type: 'emoji' | 'vector';
  value: string; // emoji character or icon name
  set?: IconSet;
  color?: string;
}

// Component that handles both
export const SubscriptionIcon: React.FC<{ icon: SubscriptionIcon }> = ({ icon }) => {
  if (icon.type === 'emoji') {
    return <Text style={styles.emoji}>{icon.value}</Text>;
  }

  return (
    <Icon
      name={icon.value}
      set={icon.set || 'material'}
      color={icon.color}
      size="lg"
    />
  );
};
```

### Best Practice

**Use Vector Icons for UI Elements:**
```typescript
// ❌ BAD: Emoji for functional icons
<Text style={styles.backIcon}>←</Text>
<Text style={styles.settingsIcon}>⚙️</Text>
<Text style={styles.addIcon}>+</Text>

// ✅ GOOD: Vector icons
<Icon name="arrow-back" size="md" color={colors.textPrimary} />
<Icon name="settings" size="md" color={colors.textSecondary} />
<Icon name="plus" size="lg" color={colors.white} />
```

**Use Emoji Only for User-Selected Decoration:**
```typescript
// ✅ OK: User chooses emoji as decoration
<TextInput
  placeholder="Choose an emoji icon (optional)"
  value={userChosenEmoji}
  onChangeText={setUserChosenEmoji}
  maxLength={2}
/>

// Display with fallback
<View style={styles.subscriptionIcon}>
  {subscription.customEmoji ? (
    <Text style={styles.emoji}>{subscription.customEmoji}</Text>
  ) : (
    <Icon
      name={getSubscriptionIcon(subscription.name, subscription.category).name}
      size="lg"
    />
  )}
</View>
```

**Icon Organization:**
```typescript
// Create icon constants for reusability
export const ICONS = {
  // Navigation
  back: { name: 'arrow-back', set: 'material' as const },
  forward: { name: 'arrow-forward', set: 'material' as const },
  close: { name: 'close', set: 'material' as const },

  // Actions
  add: { name: 'plus', set: 'feather' as const },
  edit: { name: 'edit-2', set: 'feather' as const },
  delete: { name: 'trash-2', set: 'feather' as const },
  save: { name: 'check', set: 'feather' as const },

  // Status
  active: { name: 'check-circle', set: 'feather' as const },
  paused: { name: 'pause-circle', set: 'feather' as const },
  warning: { name: 'alert-circle', set: 'feather' as const },

  // Common
  search: { name: 'search', set: 'feather' as const },
  filter: { name: 'filter', set: 'feather' as const },
  settings: { name: 'settings', set: 'feather' as const },
};

// Usage
<Icon {...ICONS.back} size="md" color={colors.textPrimary} />
```

### Testing Approach

**Visual Snapshot Tests:**
```typescript
describe('Icon Component', () => {
  it('renders all icon sets correctly', () => {
    const tree = renderer.create(
      <View>
        <Icon name="home" set="material" />
        <Icon name="home-outline" set="material-community" />
        <Icon name="home" set="feather" />
      </View>
    ).toJSON();

    expect(tree).toMatchSnapshot();
  });

  it('renders all sizes correctly', () => {
    const sizes: IconSize[] = ['xs', 'sm', 'md', 'lg', 'xl'];
    const tree = renderer.create(
      <View>
        {sizes.map(size => (
          <Icon key={size} name="star" size={size} />
        ))}
      </View>
    ).toJSON();

    expect(tree).toMatchSnapshot();
  });
});
```

**Accessibility Tests:**
```typescript
describe('Icon Accessibility', () => {
  it('has accessible label for screen readers', () => {
    const { getByLabelText } = render(
      <Icon
        name="settings"
        accessibilityLabel="Open settings"
      />
    );

    expect(getByLabelText('Open settings')).toBeTruthy();
  });

  it('icon buttons are focusable', () => {
    const { getByRole } = render(
      <Pressable accessibilityRole="button">
        <Icon name="add" accessibilityLabel="Add item" />
      </Pressable>
    );

    const button = getByRole('button');
    expect(button).toBeTruthy();
  });
});
```

**Platform Consistency Tests:**
```typescript
describe('Cross-Platform Icon Rendering', () => {
  it('renders consistently on iOS and Android', () => {
    Platform.OS = 'ios';
    const iosTree = renderer.create(<Icon name="star" />).toJSON();

    Platform.OS = 'android';
    const androidTree = renderer.create(<Icon name="star" />).toJSON();

    // Icons should render identically
    expect(iosTree).toEqual(androidTree);
  });
});
```

### Design System Guidelines

**Icon Usage Matrix:**

| Context | Icon Type | Example |
|---------|-----------|---------|
| Navigation buttons | Vector | Back, Close, Menu |
| Action buttons | Vector | Add, Edit, Delete |
| Status indicators | Vector | Check, Warning, Error |
| Category badges | Vector | Entertainment, Productivity |
| User decoration | Emoji (optional) | User-chosen subscription icon |

**Icon Sizing Guidelines:**
```typescript
// Touch target minimum: 44x44 points
const IconButton = ({ icon }) => (
  <Pressable
    style={styles.iconButton} // 44x44
    hitSlop={8}
  >
    <Icon {...icon} size="md" /> {/* 24x24 */}
  </Pressable>
);
```

**Color Guidelines:**
```typescript
// Use semantic colors
<Icon name="check" color={colors.success} /> // Green
<Icon name="alert" color={colors.warning} /> // Orange
<Icon name="trash" color={colors.danger} />  // Red

// Use theme colors
<Icon name="star" color={colors.primary} />
<Icon name="settings" color={colors.textSecondary} />
```

**Accessibility Requirements:**
1. Always provide `accessibilityLabel` for actionable icons
2. Use `accessibilityRole="button"` for pressable icons
3. Ensure 44x44 minimum touch target
4. Provide text alternatives for icon-only buttons

---

## 7. Theme Inconsistency

### Problem
Inconsistent theming across:
- Some components using hardcoded colors
- No dark mode support
- Inconsistent gray shades (#F9FAFB vs #F3F4F6)
- Mixed color naming (white vs textInverse)

### Prevention Strategy

**1. Comprehensive Theme System**
```typescript
// src/styles/theme.ts
export interface Theme {
  colors: {
    // Primary
    primary: string;
    primaryDark: string;
    primaryLight: string;

    // Background
    background: string;
    backgroundSecondary: string;
    surface: string;
    surfaceSecondary: string;

    // Text
    text: string;
    textSecondary: string;
    textTertiary: string;
    textInverse: string;

    // Semantic
    success: string;
    warning: string;
    danger: string;
    info: string;

    // Borders
    border: string;
    borderLight: string;
    borderDark: string;

    // Shadows
    shadow: string;
  };
  spacing: typeof spacing;
  fontSize: typeof fontSize;
  fontWeight: typeof fontWeight;
  borderRadius: typeof borderRadius;
}

// Light theme
export const lightTheme: Theme = {
  colors: {
    primary: '#3B82F6',
    primaryDark: '#2563EB',
    primaryLight: '#93C5FD',

    background: '#F9FAFB',
    backgroundSecondary: '#F3F4F6',
    surface: '#FFFFFF',
    surfaceSecondary: '#F9FAFB',

    text: '#111827',
    textSecondary: '#6B7280',
    textTertiary: '#9CA3AF',
    textInverse: '#FFFFFF',

    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#3B82F6',

    border: '#E5E7EB',
    borderLight: '#F3F4F6',
    borderDark: '#D1D5DB',

    shadow: '#000000',
  },
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
};

// Dark theme
export const darkTheme: Theme = {
  colors: {
    primary: '#60A5FA',
    primaryDark: '#3B82F6',
    primaryLight: '#93C5FD',

    background: '#111827',
    backgroundSecondary: '#1F2937',
    surface: '#1F2937',
    surfaceSecondary: '#374151',

    text: '#F9FAFB',
    textSecondary: '#D1D5DB',
    textTertiary: '#9CA3AF',
    textInverse: '#111827',

    success: '#34D399',
    warning: '#FBBF24',
    danger: '#F87171',
    info: '#60A5FA',

    border: '#374151',
    borderLight: '#4B5563',
    borderDark: '#1F2937',

    shadow: '#000000',
  },
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
};
```

**2. Theme Context**
```typescript
// src/contexts/ThemeContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightTheme, darkTheme, Theme } from '@/styles/theme';

type ThemeMode = 'light' | 'dark' | 'auto';

interface ThemeContextType {
  theme: Theme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('auto');

  // Load saved preference
  useEffect(() => {
    AsyncStorage.getItem('themeMode').then(saved => {
      if (saved) setModeState(saved as ThemeMode);
    });
  }, []);

  // Determine active theme
  const activeScheme = mode === 'auto' ? systemColorScheme : mode;
  const theme = activeScheme === 'dark' ? darkTheme : lightTheme;
  const isDark = activeScheme === 'dark';

  const setMode = async (newMode: ThemeMode) => {
    setModeState(newMode);
    await AsyncStorage.setItem('themeMode', newMode);
  };

  return (
    <ThemeContext.Provider value={{ theme, mode, setMode, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
```

**3. Update Components to Use Theme**
```typescript
// Before: Hardcoded colors
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F9FAFB',
  },
  text: {
    color: '#111827',
  },
});

// After: Theme-aware
import { useTheme } from '@/contexts/ThemeContext';

const MyComponent = () => {
  const { theme } = useTheme();

  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.background,
    },
    text: {
      color: theme.colors.text,
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Hello</Text>
    </View>
  );
};
```

### Best Practice

**Always Use Theme Context:**
```typescript
// ✅ GOOD: Theme-aware styling
import { useTheme } from '@/contexts/ThemeContext';

const Component = () => {
  const { theme } = useTheme();

  return (
    <View style={{ backgroundColor: theme.colors.background }}>
      <Text style={{ color: theme.colors.text }}>Content</Text>
    </View>
  );
};

// ❌ BAD: Hardcoded colors
const Component = () => {
  return (
    <View style={{ backgroundColor: '#F9FAFB' }}>
      <Text style={{ color: '#111827' }}>Content</Text>
    </View>
  );
};
```

**Create Theme-Aware Style Factory:**
```typescript
// src/styles/createStyles.ts
import { StyleSheet } from 'react-native';
import { Theme } from './theme';

export const createStyles = <T extends StyleSheet.NamedStyles<T>>(
  stylesFn: (theme: Theme) => T
) => {
  return (theme: Theme) => StyleSheet.create(stylesFn(theme));
};

// Usage
const useStyles = createStyles((theme) => ({
  container: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
  },
  text: {
    color: theme.colors.text,
    fontSize: theme.fontSize.base,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
}));

// In component
const Component = () => {
  const { theme } = useTheme();
  const styles = useStyles(theme);

  return <View style={styles.container}>...</View>;
};
```

### Testing Approach

**Theme Switching Tests:**
```typescript
describe('Theme Context', () => {
  it('defaults to system color scheme', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });

    expect(result.current.mode).toBe('auto');
  });

  it('switches to dark theme', async () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });

    await act(async () => {
      await result.current.setMode('dark');
    });

    expect(result.current.isDark).toBe(true);
    expect(result.current.theme.colors.background).toBe('#111827');
  });

  it('persists theme preference', async () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ThemeProvider,
    });

    await act(async () => {
      await result.current.setMode('dark');
    });

    const saved = await AsyncStorage.getItem('themeMode');
    expect(saved).toBe('dark');
  });
});
```

**Visual Regression Tests:**
```typescript
describe('Theme Visual Consistency', () => {
  it('renders all screens in light mode', async () => {
    const screens = [
      'Manager',
      'CheckIn',
      'Audit',
      'Report',
      'AddSubscription',
    ];

    for (const screen of screens) {
      const tree = renderer.create(
        <ThemeProvider initialMode="light">
          <Screen name={screen} />
        </ThemeProvider>
      ).toJSON();

      expect(tree).toMatchSnapshot(`${screen}-light`);
    }
  });

  it('renders all screens in dark mode', async () => {
    // Same as above but with dark mode
  });
});
```

**Color Contrast Tests:**
```typescript
import { getContrast } from 'polished';

describe('Theme Accessibility', () => {
  it('text colors have sufficient contrast', () => {
    // WCAG AA requires 4.5:1 for normal text
    const lightThemeContrast = getContrast(
      lightTheme.colors.text,
      lightTheme.colors.background
    );
    expect(lightThemeContrast).toBeGreaterThanOrEqual(4.5);

    const darkThemeContrast = getContrast(
      darkTheme.colors.text,
      darkTheme.colors.background
    );
    expect(darkThemeContrast).toBeGreaterThanOrEqual(4.5);
  });
});
```

### Design System Guidelines

**Theme Naming Conventions:**

Use semantic names, not specific colors:
```typescript
// ✅ GOOD: Semantic
text: '#111827',
textSecondary: '#6B7280',
background: '#F9FAFB',
surface: '#FFFFFF',

// ❌ BAD: Color-specific
gray900: '#111827',
gray500: '#6B7280',
gray50: '#F9FAFB',
white: '#FFFFFF',
```

**Color Usage Matrix:**

| Element | Light Theme | Dark Theme | Token |
|---------|-------------|------------|-------|
| App background | #F9FAFB | #111827 | `theme.colors.background` |
| Card background | #FFFFFF | #1F2937 | `theme.colors.surface` |
| Primary text | #111827 | #F9FAFB | `theme.colors.text` |
| Secondary text | #6B7280 | #D1D5DB | `theme.colors.textSecondary` |
| Borders | #E5E7EB | #374151 | `theme.colors.border` |

**Theme Implementation Checklist:**
- [ ] All colors come from `theme.colors`
- [ ] Component works in both light and dark mode
- [ ] Text has sufficient contrast (4.5:1 minimum)
- [ ] Shadows are visible in both themes
- [ ] Borders are visible in both themes
- [ ] No hardcoded hex colors in component

---

## 8. Quick Reference Checklist

### Pre-Development Checklist

Before starting any new component:

- [ ] Check `src/styles/common.ts` for existing patterns
- [ ] Review design system tokens in `src/styles/tokens.ts`
- [ ] Check `src/components/` for reusable components
- [ ] Verify theme support in `src/contexts/ThemeContext.tsx`
- [ ] Review similar screens for consistency

### During Development Checklist

While building:

- [ ] Use design tokens, no hardcoded values
- [ ] Import from `@/styles`, not inline styles
- [ ] Use `<Icon>` component, not emoji for UI
- [ ] Use `useTheme()` hook for all colors
- [ ] Add custom input options for user flexibility
- [ ] Use date utilities from `@/utils/dateUtils`
- [ ] Create reusable components for repeated patterns
- [ ] Add TypeScript types for all props
- [ ] Add accessibility labels

### Code Review Checklist

Before submitting PR:

- [ ] No duplicate StyleSheet definitions
- [ ] All colors from theme context
- [ ] No magic numbers, all spacing uses tokens
- [ ] Consistent badge/label styling
- [ ] Date logic uses centralized utilities
- [ ] Notification settings are flexible
- [ ] Custom input options available
- [ ] Vector icons instead of emoji (except user decoration)
- [ ] Theme-aware (works in dark mode)
- [ ] Tests pass
- [ ] Visual snapshots updated
- [ ] Accessibility tested

### Testing Checklist

For each component:

- [ ] Unit tests for logic
- [ ] Snapshot tests for visual consistency
- [ ] Accessibility tests (labels, contrast, touch targets)
- [ ] Theme tests (light and dark mode)
- [ ] Edge case tests (empty states, long text)
- [ ] Integration tests with context
- [ ] E2E tests for critical flows

### Design System Maintenance

Monthly review:

- [ ] Search for duplicate styles across codebase
- [ ] Audit color usage (no hardcoded hex)
- [ ] Check for emoji icons in UI (should be vector)
- [ ] Review notification settings for flexibility
- [ ] Verify date logic centralization
- [ ] Update design tokens if needed
- [ ] Document new patterns in `/docs`
- [ ] Run visual regression suite

---

## Conclusion

By following these prevention strategies and best practices, future UI/UX issues can be caught early and prevented. The key principles are:

1. **Centralization**: One source of truth for styles, dates, icons
2. **Flexibility**: Allow customization without requiring code changes
3. **Consistency**: Use design system and theme throughout
4. **Testing**: Automated checks for common issues
5. **Documentation**: Clear guidelines for the team

Regular audits and strict code review will maintain quality as the codebase grows.

---

**Document Version:** 1.0
**Last Updated:** 2026-02-12
**Maintained By:** Development Team
