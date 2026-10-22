# Quick Reference Guide - UI/UX Best Practices

**Quick lookup for common scenarios when building features**

---

## Common Scenarios

### "I need to add a new color"

**DON'T:**
```typescript
backgroundColor: '#F9FAFB',
```

**DO:**
```typescript
import { colors } from '@/styles';
backgroundColor: colors.background,
```

**If color doesn't exist:**
1. Add to `src/styles/tokens.ts`
2. Use semantic name (e.g., `backgroundSecondary` not `gray100`)
3. Add both light and dark theme variants

---

### "I need to add spacing/padding"

**DON'T:**
```typescript
padding: 24,
marginBottom: 16,
```

**DO:**
```typescript
import { spacing } from '@/styles';
padding: spacing.lg,
marginBottom: spacing.md,
```

**Available spacing:**
- `xs: 4px` - Tiny gaps
- `sm: 8px` - Small gaps
- `md: 16px` - Standard spacing
- `lg: 24px` - Large spacing
- `xl: 32px` - Extra large
- `xxl: 40px` - Massive spacing
- `xxxl: 48px` - Huge spacing

---

### "I need to style text"

**DON'T:**
```typescript
fontSize: 16,
fontWeight: '700',
color: '#111827',
```

**DO:**
```typescript
import { fontSize, fontWeight, colors } from '@/styles';
fontSize: fontSize.base,
fontWeight: fontWeight.bold as any,
color: colors.textPrimary,
```

**Typography scale:**
- `xxs: 9px` - Ultra small labels
- `xs: 10px` - Micro text
- `sm: 12px` - Small text
- `base: 16px` - Body text
- `md: 18px` - Emphasized text
- `lg: 20px` - Subheadings
- `xl: 24px` - Headings
- `xxl: 28px` - Large headings
- `xxxl: 36px` - Hero text

---

### "I need an icon"

**DON'T:**
```typescript
<Text>⚙️</Text>
<Text>←</Text>
<Text>+</Text>
```

**DO:**
```typescript
import { Icon } from '@/components/Icon';

<Icon name="settings" size="md" color={colors.textSecondary} />
<Icon name="arrow-back" size="md" />
<Icon name="plus" size="lg" color={colors.white} />
```

**When emoji is OK:**
- User-selected decoration (like subscription custom icon)
- Illustrative purposes (not functional)

---

### "I need to format a date"

**DON'T:**
```typescript
new Date().toISOString().split('T')[0]
date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
```

**DO:**
```typescript
import { toISODate, formatDisplayDate } from '@/utils/dateUtils';

toISODate(new Date()) // "2026-02-12"
formatDisplayDate(date) // "Feb 12"
formatDisplayDate(date, 'DISPLAY_LONG') // "February 12, 2026"
```

**Common date functions:**
- `toISODate(date)` - Convert to YYYY-MM-DD
- `formatDisplayDate(date)` - Format for UI display
- `daysUntil(date)` - Calculate days remaining
- `isToday(date)` - Check if date is today
- `calculateNextRenewal(start, cycle)` - Get next renewal date

---

### "I need to create a card/container"

**DON'T:**
```typescript
const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
});
```

**DO:**
```typescript
import { commonStyles } from '@/styles';

<View style={commonStyles.card}>
  {/* content */}
</View>

// Or compose with custom styles
<View style={[commonStyles.card, { marginBottom: spacing.lg }]}>
```

**Available common styles:**
- `container` - Standard screen container
- `containerCentered` - Centered content
- `card` - Standard card
- `cardLarge` - Large card with more padding
- `buttonPrimary` - Primary button
- `buttonSecondary` - Secondary button
- `textTitle` - Uppercase title
- `textHeading` - Large heading
- `textBody` - Body text
- `textSecondary` - Secondary text
- `textMicro` - Small labels

---

### "I need theme-aware colors"

**DON'T:**
```typescript
backgroundColor: '#F9FAFB',
```

**DO:**
```typescript
import { useTheme } from '@/contexts/ThemeContext';

const Component = () => {
  const { theme } = useTheme();

  return (
    <View style={{ backgroundColor: theme.colors.background }}>
      <Text style={{ color: theme.colors.text }}>Content</Text>
    </View>
  );
};
```

---

### "I need a badge/label"

**DON'T:**
```typescript
<View style={{
  backgroundColor: '#3B82F614',
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 999,
}}>
  <Text style={{ fontSize: 10, color: '#3B82F6' }}>LABEL</Text>
</View>
```

**DO:**
```typescript
import { Badge } from '@/components/Badge';

<Badge label="LABEL" variant="primary" size="sm" />
```

**Badge variants:**
- `primary` - Blue (default)
- `success` - Green
- `warning` - Orange
- `danger` - Red
- `neutral` - Gray

**Badge sizes:**
- `sm` - Small
- `md` - Medium (default)
- `lg` - Large

---

### "I need to add a form input"

**DON'T:**
```typescript
const [category, setCategory] = useState('');

<Picker selectedValue={category} onValueChange={setCategory}>
  {CATEGORIES.map(cat => <Picker.Item key={cat} value={cat} />)}
</Picker>
```

**DO:**
```typescript
import { HybridSelector } from '@/components/HybridSelector';

<HybridSelector
  label="Category"
  options={CATEGORIES}
  value={category}
  onChange={setCategory}
  renderOption={(cat) => <Text>{cat}</Text>}
  allowCustom // Allows user to enter custom value
  customPlaceholder="Enter custom category"
/>
```

---

### "I need to create a button"

**DON'T:**
```typescript
<TouchableOpacity
  onPress={handlePress}
  style={{
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 999,
  }}
>
  <Text style={{ color: '#FFFFFF', fontSize: 16 }}>Button</Text>
</TouchableOpacity>
```

**DO:**
```typescript
import { commonStyles } from '@/styles';

<Pressable
  onPress={handlePress}
  style={({ pressed }) => [
    commonStyles.buttonPrimary,
    pressed && { opacity: 0.9 }
  ]}
>
  <Text style={{ color: colors.white, fontSize: fontSize.base }}>
    Button
  </Text>
</Pressable>
```

---

## Pre-Development Checklist

Before writing any code:

- [ ] Check `src/styles/common.ts` for existing patterns
- [ ] Review `src/components/` for reusable components
- [ ] Check `src/utils/` for utility functions
- [ ] Plan theme support (light + dark mode)

---

## Code Review Self-Check

Before submitting PR:

- [ ] No hardcoded colors (all from `colors` or `theme.colors`)
- [ ] No magic numbers (all from `spacing`, `fontSize`, etc.)
- [ ] No emoji for UI icons (use `<Icon>` component)
- [ ] Date logic uses utilities from `dateUtils`
- [ ] Custom input options provided where appropriate
- [ ] Theme-aware (works in dark mode)
- [ ] Accessibility labels added
- [ ] TypeScript types defined
- [ ] No duplicate StyleSheet definitions

---

## When to Create New Patterns

**Create reusable component if:**
- Pattern is used 3+ times
- Pattern will be used across multiple screens
- Pattern has complex logic/state

**Add to common styles if:**
- Style is used 3+ times
- Style is a foundational pattern (card, button, text)
- Style should be consistent across app

**Add to design tokens if:**
- Value is used 3+ times
- Value should be globally consistent
- Value differs between themes

---

## Import Shortcuts

```typescript
// All-in-one style import
import { colors, spacing, fontSize, fontWeight, borderRadius, shadows } from '@/styles';

// Common patterns
import { commonStyles } from '@/styles';

// Theme
import { useTheme } from '@/contexts/ThemeContext';

// Date utilities
import { toISODate, formatDisplayDate, daysUntil } from '@/utils/dateUtils';

// Components
import { Icon } from '@/components/Icon';
import { Badge } from '@/components/Badge';
import { HybridSelector } from '@/components/HybridSelector';
```

---

## File Locations

| Need | Location |
|------|----------|
| Design tokens | `src/styles/tokens.ts` |
| Common styles | `src/styles/common.ts` |
| Style helpers | `src/styles/helpers.ts` |
| Theme system | `src/contexts/ThemeContext.tsx` |
| Date utilities | `src/utils/dateUtils.ts` |
| Icon component | `src/components/Icon.tsx` |
| Badge component | `src/components/Badge.tsx` |

---

## Common Mistakes to Avoid

### ❌ Hardcoded values
```typescript
backgroundColor: '#F9FAFB',
padding: 24,
fontSize: 16,
```

### ❌ Duplicate styles
```typescript
// Same card style in 5 different files
const styles = StyleSheet.create({
  card: { /* ... */ },
});
```

### ❌ Emoji for functional icons
```typescript
<Text>⚙️</Text> // Settings button
<Text>+</Text>  // Add button
```

### ❌ Inconsistent date formatting
```typescript
new Date().toISOString().split('T')[0]
date.toLocaleDateString('en-US', { ... })
```

### ❌ No theme support
```typescript
backgroundColor: '#FFFFFF',
color: '#111827',
// Won't work in dark mode
```

---

## Need Help?

1. Check full documentation: `docs/solutions/ui-ux-polish-prevention-strategies.md`
2. Review existing components in `src/components/`
3. Look at similar screens for patterns
4. Ask in team chat/review

---

**Version:** 1.0
**Last Updated:** 2026-02-12
