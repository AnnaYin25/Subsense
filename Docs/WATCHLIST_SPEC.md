# Watchlist Feature Specification

**Date:** February 18, 2026
**Status:** Implemented ✅ — DB migration complete (2026-02-18)

---

## Overview

Watchlist is a **pre-subscription decision layer** — a status that lets users track services they are evaluating but have not yet committed to financially. It is not a variation of Active or Paused; it is a fundamentally different lifecycle stage with no billing, no renewal dates, and no reminders.

---

## Subscription Lifecycle

```
[Audit Screen]
      │
      ▼
  Watchlist ──────── "Subscribe Now" ──────── Active
  (no billing)         (two-step)            (billing)
                           │
                           └─► Edit Form (confirm renewal date)
                                     │
                                     └─► Active + billing config saved
```

| Status      | Billing | Calendar | Reminders | Entry Point                     |
|-------------|---------|----------|-----------|----------------------------------|
| `active`    | ✅      | ✅       | ✅        | Add/Edit form, Subscribe Now     |
| `paused`    | ⛔      | ⛔       | ⛔        | Pause button in Detail screen    |
| `watchlist` | ⛔      | ⛔       | ⛔        | Audit → "Not quite ready" CTA    |
| `cancelled` | ⛔      | ⛔       | ⛔        | Delete action                    |

---

## Data Model

When a Watchlist item is created (from Audit):

```ts
{
  status: 'watchlist',   // Not 'paused'
  isReminder: false,     // No billing cycle to remind about
  planName: 'Watchlist', // Visual identifier
  nextRenewalDate: null, // No real renewal date yet
}
```

**DB constraint requirement:**
```sql
ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_status_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('active', 'paused', 'cancelled', 'watchlist'));
```

---

## Screen-by-Screen Behavior

### AuditScreen

**Trigger:** Audit recommendation type is `'watchlist'`

**CTA:** "Save to Watchlist" button in the Audit Report view

**Action:**
```ts
await createSubscription({
  ...auditData,
  status: 'watchlist',
  isReminder: false,
  planName: 'Watchlist',
});
navigation.navigate('Manager');
```

---

### ManagerScreen

**Filter tab:** "Watchlist" is the 4th tab (after All / Active / Paused)

**Filter logic:**
```ts
if (filter === 'All')       return sub.status !== 'watchlist';  // excluded from All
if (filter === 'Active')    return sub.status === 'active';
if (filter === 'Paused')    return sub.status === 'paused';
if (filter === 'Watchlist') return sub.status === 'watchlist';
```

**Card style:** Watchlist cards display with 75% opacity and a 3px blue left border.

```ts
subscriptionCardWatchlist: {
  opacity: 0.75,
  borderLeftWidth: 3,
  borderLeftColor: colors.primary,
}
```

**Already-correct exclusions** (no change needed):
- `calculateMonthlySpend` filters `status === 'active'` ✓
- `getSubsForDate` (calendar dots) filters `status === 'active'` ✓

---

### SubscriptionDetailScreen

**Status badge:** 3-way conditional

```tsx
<View style={[
  styles.badge,
  status === 'active'    && styles.badgeActive,
  status === 'paused'    && styles.badgePaused,
  isWatchlist            && styles.badgeWatchlist,
]}>
  <Text>
    {status === 'active' ? 'ACTIVE' : status === 'paused' ? 'PAUSED' : 'WATCHLIST'}
  </Text>
</View>
```

Badge color: `colors.primary + '20'` background with `colors.primary` border.

**Hidden for watchlist:**
- Days-left badge: `{!isWatchlist && daysLeft >= 0 && (...)}`
- Next Renewal Date row: `{!isWatchlist && (...)}`
- Entire NOTIFICATION SETTINGS section: `{!isWatchlist && (...)}`

**Action button:**
```tsx
{isWatchlist ? (
  <Pressable onPress={handleActivate} style={styles.actionButtonPrimary}>
    <Text style={styles.actionButtonTextPrimary}>Subscribe Now</Text>
  </Pressable>
) : (
  <Pressable onPress={handleToggleStatus} style={...}>
    <Text>{isPaused ? 'Resume' : 'Pause'}</Text>
  </Pressable>
)}
```

**Two-step activation (`handleActivate`):**
```ts
const handleActivate = async () => {
  setLoading(true);
  const success = await editSubscription(subscription.id, { status: 'active' });
  setLoading(false);
  if (success) {
    navigation.navigate('AddSubscription', { subscriptionId: subscription.id });
  } else {
    Alert.alert('Error', 'Failed to activate subscription');
  }
};
```

**Why two steps?** Flipping status alone leaves `nextRenewalDate` as null. Navigating to the Edit form forces the user to confirm a real renewal date before the subscription enters the active billing lifecycle.

---

### AddSubscriptionScreen

**Notification settings hidden when editing watchlist:**
```tsx
{!(isEditing && existingSub?.status === 'watchlist') && (
  <View style={styles.section}>
    {/* 3-Day Reminder, Same-Day Reminder, Push Notifications */}
  </View>
)}
```

The Next Renewal Date field is still visible — the user needs to set it during the Subscribe Now → Edit flow.

---

## Custom Category Integration

### Problem
Supabase had a `subscriptions_category_check` constraint limiting categories to a hardcoded list. Custom categories caused error code `23514`.

### Solution
1. Drop the constraint: `ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_category_check;`
2. Store custom categories client-side via `categoryManager.ts`

### categoryManager.ts

```ts
const DEFAULT_CATEGORIES = ['Entertainment', 'Productivity', 'Utilities', 'Health'];
const CUSTOM_CATEGORIES_KEY = 'custom_categories';

getAllCategories()     // → DEFAULT + custom (from AsyncStorage)
addCustomCategory()   // → saves to AsyncStorage if not duplicate
getCustomCategories() // → custom only
```

### Where it's used
- **AddSubscriptionScreen:** `useEffect` loads on mount; saves new custom categories on form submit
- **ManagerScreen:** `useEffect` loads on mount for grouped category display

---

## DB Migrations Required

```sql
-- Run in Supabase SQL Editor

-- Migration 1: Watchlist status support
ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_status_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('active', 'paused', 'cancelled', 'watchlist'));

-- Migration 2: Data fix for old watchlist rows (created before this feature)
UPDATE subscriptions
SET status = 'watchlist', is_reminder = false
WHERE plan_name = 'Watchlist' AND status = 'paused' AND is_reminder = true;

-- Migration 3: Custom categories support
ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_category_check;
```

---

## Testing Checklist

- [ ] Run DB migrations (3 SQL statements above)
- [ ] Audit → "Not quite ready" → creates row with `status='watchlist'`, `isReminder=false`
- [ ] Manager "All" filter excludes watchlist items
- [ ] Manager "Watchlist" filter shows only watchlist items with blue border + 75% opacity
- [ ] Detail view: "WATCHLIST" badge (blue), no renewal row, no reminder toggles
- [ ] Detail view: "Subscribe Now" button visible
- [ ] "Subscribe Now" → status flips to `active` → navigates to Edit form
- [ ] Edit form pre-fills all existing fields
- [ ] After Edit save → item appears in "Active" filter
- [ ] Custom category typed → appears in next AddSubscription session
- [ ] Custom category appears in Manager grouped view
- [ ] Monthly spend / calendar dots exclude watchlist items (pre-existing filters)
