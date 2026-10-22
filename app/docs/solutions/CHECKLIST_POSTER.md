# UI/UX Quality Checklist
## Post this near your desk!

---

## 🎨 DESIGN TOKENS ONLY

```
✅ colors.primary
✅ spacing.lg
✅ fontSize.base
✅ fontWeight.bold
✅ borderRadius.md
✅ shadows.sm

❌ '#3B82F6'
❌ 24
❌ 16
❌ '700'
❌ 16
❌ { shadowOpacity: 0.1 }
```

**RULE: Zero hardcoded values in components**

---

## 🎯 IMPORT CHECKLIST

Every component should start with:

```typescript
import {
  colors,
  spacing,
  fontSize,
  fontWeight
} from '@/styles';
import { useTheme } from '@/contexts/ThemeContext';
```

---

## 🔍 BEFORE YOU CODE

- [ ] Does `commonStyles` have this pattern?
- [ ] Does `src/components/` have this component?
- [ ] Will this work in dark mode?
- [ ] Can users customize this?

---

## 📝 WHILE CODING

### Colors
```typescript
✅ theme.colors.background
❌ '#F9FAFB'
```

### Spacing
```typescript
✅ spacing.lg
❌ 24
```

### Icons
```typescript
✅ <Icon name="settings" />
❌ <Text>⚙️</Text>
```

### Dates
```typescript
✅ formatDisplayDate(date)
❌ date.toLocaleDateString()
```

### Text
```typescript
✅ fontSize.base
❌ 16
```

---

## 🧪 BEFORE COMMIT

- [ ] No hex colors in component
- [ ] No magic numbers
- [ ] No emoji for UI icons
- [ ] Works in dark mode
- [ ] Has accessibility labels
- [ ] Has TypeScript types
- [ ] Reusable patterns extracted
- [ ] Tests added

---

## 🚫 NEVER DO

```typescript
❌ backgroundColor: '#FFFFFF'
❌ padding: 24
❌ fontSize: 16
❌ <Text>←</Text>
❌ new Date().toISOString().split('T')[0]
❌ fontWeight: '700'
```

---

## ✅ ALWAYS DO

```typescript
✅ backgroundColor: theme.colors.surface
✅ padding: spacing.lg
✅ fontSize: fontSize.base
✅ <Icon name="arrow-back" />
✅ toISODate(new Date())
✅ fontWeight: fontWeight.bold as any
```

---

## 🎨 COMMON PATTERNS

### Card
```typescript
<View style={commonStyles.card}>
```

### Button
```typescript
<Pressable style={commonStyles.buttonPrimary}>
```

### Container
```typescript
<View style={commonStyles.container}>
```

### Title Text
```typescript
<Text style={commonStyles.textTitle}>
```

---

## 🌓 THEME SUPPORT

Every component MUST work in both modes:

```typescript
const { theme } = useTheme();

<View style={{
  backgroundColor: theme.colors.background
}}>
  <Text style={{
    color: theme.colors.text
  }}>
    Content
  </Text>
</View>
```

---

## 📊 QUALITY METRICS

### Your code is good if:
- ✅ 0 hardcoded colors
- ✅ 0 magic numbers
- ✅ 0 emoji UI icons
- ✅ 100% theme coverage
- ✅ All dates use utils
- ✅ All custom inputs allowed

### Your code needs work if:
- ❌ Any hex colors
- ❌ Any raw numbers
- ❌ Emoji in buttons/icons
- ❌ Breaks in dark mode
- ❌ Date logic inline
- ❌ No custom options

---

## 🔧 QUICK FIXES

| Problem | Solution |
|---------|----------|
| Hard-coded color | Import from `colors` or `theme.colors` |
| Magic number | Import from `spacing` or `fontSize` |
| Emoji icon | Use `<Icon>` component |
| Date logic | Import from `dateUtils` |
| Duplicate style | Extract to `commonStyles` |
| No dark mode | Use `useTheme()` hook |

---

## 📚 DOCUMENTATION

Full details: `docs/solutions/ui-ux-polish-prevention-strategies.md`

Quick lookup: `docs/solutions/QUICK_REFERENCE.md`

---

## 🎯 THE GOLDEN RULE

**If you copy-paste styles 3+ times,**
**it belongs in the design system!**

---

## 💡 REMEMBER

```
Good code is:
  ✓ Consistent
  ✓ Reusable
  ✓ Theme-aware
  ✓ Accessible
  ✓ Tested

Bad code is:
  ✗ Hardcoded
  ✗ Duplicated
  ✗ Theme-blind
  ✗ Rigid
  ✗ Untested
```

---

## 🚀 LEVEL UP

Want to become a UI/UX expert?

1. Read the full guide (55KB of wisdom!)
2. Study existing components
3. Review PRs critically
4. Refactor old code
5. Help teammates

---

**Print this and keep it visible!**

---

Last Updated: 2026-02-12
