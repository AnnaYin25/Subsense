# Avatar Selection Pagination System (36 DiceBear Variants)

## Metadata

```yaml
category: ui-patterns
module: setup, avatar-selection
tags: [react-native, pagination, ui-ux, dicebear, avatar-picker]
symptoms:
  - "Too many avatars overwhelming single screen"
  - "Need to show more avatar options without UI clutter"
  - "Users want variety in avatar selection"
difficulty: beginner-intermediate
date_documented: 2026-02-14
related_files:
  - app/src/screens/SetupScreen.tsx
```

## Problem

### Initial Implementation

Setup flow showed only **12 avatar options** in a single grid:

```typescript
const avatarSeeds = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

<View style={styles.avatarGrid}>
  {avatarSeeds.map((seed) => (
    <Pressable onPress={() => handleSelectAvatar(seed)}>
      <Image source={{ uri: `https://api.dicebear.com/7.x/notionists/png?seed=${seed}` }} />
    </Pressable>
  ))}
</View>
```

### User Feedback

"能不能给一个第二页的选择或者第三页，看起来头像多一点"
("Can we have a second or third page? Make it look like there are more avatars")

### Requirements

1. Show **more avatar options** (target: 36 total)
2. **Don't overcrowd** the screen
3. **Easy navigation** between avatar sets
4. **Visual indicator** of current page
5. **Maintain selection state** across page changes

## Solution

### Architecture: Paginated Avatar Grid

Implemented **3 pages with 12 avatars each** (36 total):

```typescript
const [avatarPage, setAvatarPage] = useState(0);

// 3 pages of seeds
const allAvatarSeeds = [
  // Page 1: Seeds 1-12
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
  // Page 2: Seeds 13-24
  ['13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24'],
  // Page 3: Seeds 25-36
  ['25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36']
];

const currentAvatarSeeds = allAvatarSeeds[avatarPage];
```

### UI Components

#### 1. Avatar Grid (Unchanged)

```typescript
<View style={styles.avatarGrid}>
  {currentAvatarSeeds.map((seed) => {
    const avatarUrl = `https://api.dicebear.com/7.x/notionists/png?seed=${seed}&size=150`;
    const isSelected = selectedAvatarSeed === seed;

    return (
      <Pressable
        key={seed}
        onPress={() => handleSelectAvatar(seed)}
        style={[
          styles.avatarOption,
          isSelected && styles.avatarOptionSelected,
        ]}
      >
        <Image source={{ uri: avatarUrl }} style={styles.avatarPreview} />
      </Pressable>
    );
  })}
</View>
```

#### 2. Pagination Controls

```typescript
<View style={styles.avatarPagination}>
  {/* Previous Button */}
  <Pressable
    onPress={() => setAvatarPage(Math.max(0, avatarPage - 1))}
    disabled={avatarPage === 0}
    style={[
      styles.pageButton,
      avatarPage === 0 && styles.pageButtonDisabled,
    ]}
  >
    <Text style={styles.pageButtonText}>← Prev</Text>
  </Pressable>

  {/* Page Dots Indicator */}
  <View style={styles.pageDots}>
    {allAvatarSeeds.map((_, index) => (
      <Pressable
        key={index}
        onPress={() => setAvatarPage(index)}
        style={[
          styles.pageDot,
          avatarPage === index && styles.pageDotActive
        ]}
      />
    ))}
  </View>

  {/* Next Button */}
  <Pressable
    onPress={() => setAvatarPage(Math.min(allAvatarSeeds.length - 1, avatarPage + 1))}
    disabled={avatarPage === allAvatarSeeds.length - 1}
    style={[
      styles.pageButton,
      avatarPage === allAvatarSeeds.length - 1 && styles.pageButtonDisabled,
    ]}
  >
    <Text style={styles.pageButtonText}>Next →</Text>
  </Pressable>
</View>
```

### Styling

```typescript
avatarPagination: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginTop: spacing.lg,
  paddingHorizontal: spacing.sm,
},
pageButton: {
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
  borderRadius: borderRadius.md,
  backgroundColor: colors.white,
  borderWidth: 1,
  borderColor: colors.gray200,
  minWidth: 80,
  alignItems: 'center',
},
pageButtonDisabled: {
  opacity: 0.3,
},
pageButtonPressed: {
  transform: [{ scale: 0.96 }],
  backgroundColor: colors.gray50,
},
pageDots: {
  flexDirection: 'row',
  gap: spacing.xs,
  alignItems: 'center',
},
pageDot: {
  width: 8,
  height: 8,
  borderRadius: 4,
  backgroundColor: colors.gray200,
},
pageDotActive: {
  backgroundColor: colors.primary,
  width: 24, // Elongated to show active state
},
```

## Key Features

### 1. **Boundary Protection**

Buttons automatically disable at first/last page:

```typescript
disabled={avatarPage === 0} // Prev button on page 1
disabled={avatarPage === allAvatarSeeds.length - 1} // Next button on page 3
```

### 2. **Direct Page Navigation**

Users can tap page dots to jump directly:

```typescript
<Pressable onPress={() => setAvatarPage(index)} />
```

### 3. **Selection Persistence**

Selected avatar remains highlighted across page changes:

```typescript
const isSelected = selectedAvatarSeed === seed;
// Works even if selected avatar is on a different page
```

### 4. **Visual Feedback**

- **Active page dot** is elongated and colored primary
- **Disabled buttons** have reduced opacity
- **Pressed state** for all interactive elements

## DiceBear Integration

### How Seeds Work

DiceBear's API generates **deterministic avatars** based on seed:

```
https://api.dicebear.com/7.x/notionists/png?seed={SEED}&size=150
```

- Same seed = Same avatar (consistent across sessions)
- Different seed = Different avatar
- Seed can be any string: '1', 'alice', 'random-uuid', etc.

### Why Numeric Seeds 1-36

**Pros**:
- ✅ Simple to generate in code
- ✅ Predictable variety
- ✅ Easy to debug/test
- ✅ No duplicate risk

**Alternative**: Could use random UUIDs or user-based seeds for truly unique avatars:

```typescript
const generateUniqueSeeds = (count: number) => {
  return Array.from({ length: count }, () => crypto.randomUUID());
};
```

## UX Design Decisions

### Why 12 Avatars Per Page?

- **Visual Balance**: 4×3 grid fits mobile screens without scrolling
- **Choice Variety**: Enough options to feel rich, not overwhelming
- **Performance**: All 12 images load quickly

### Why 3 Pages?

- **36 total options**: Provides good variety without analysis paralysis
- **Odd number of pages**: Middle page creates visual symmetry in dots
- **Navigation simplicity**: Few enough pages that users explore all

### Auto-Advance on Selection

```typescript
const handleSelectAvatar = (seed: string) => {
  setSelectedAvatarSeed(seed);

  // Auto-advance to questions after brief delay
  setTimeout(() => {
    setCurrentStep(0);
  }, 200);
};
```

**Rationale**: User rarely changes avatar after selection, so auto-advancing reduces friction.

## Alternative Implementations

### Option 1: Infinite Scroll

```typescript
// Could load more avatars dynamically
const [displayCount, setDisplayCount] = useState(12);

const loadMore = () => {
  setDisplayCount(prev => prev + 12);
};

<ScrollView onEndReached={loadMore} />
```

**Pros**: No pagination UI needed
**Cons**: Harder to return to specific avatar, performance issues with many images

### Option 2: Search/Filter

```typescript
const [filter, setFilter] = useState('');

const filteredSeeds = allSeeds.filter(seed =>
  // Filter by style, color, characteristics
);
```

**Pros**: Power users can find exact avatar quickly
**Cons**: Requires avatar metadata, complex UI

### Option 3: Random Regeneration

```typescript
const [currentSeeds, setCurrentSeeds] = useState(generateRandomSeeds(12));

const regenerate = () => {
  setCurrentSeeds(generateRandomSeeds(12));
};

<Button onPress={regenerate}>Show Different Avatars</Button>
```

**Pros**: Feels more dynamic
**Cons**: User can't return to previously seen avatars

## Performance Considerations

### Image Loading Strategy

DiceBear images are loaded via `<Image source={{ uri }}>`:

```typescript
<Image
  source={{ uri: `https://api.dicebear.com/7.x/notionists/png?seed=${seed}&size=150` }}
  style={styles.avatarPreview}
/>
```

**Current approach**: Load all 12 images on page mount
**Optimization**: Could preload next page images in background:

```typescript
useEffect(() => {
  const nextPage = avatarPage + 1;
  if (nextPage < allAvatarSeeds.length) {
    allAvatarSeeds[nextPage].forEach(seed => {
      Image.prefetch(`https://api.dicebear.com/7.x/notionists/png?seed=${seed}&size=150`);
    });
  }
}, [avatarPage]);
```

### Memory Management

- **12 images per page** × **~20KB each** = **~240KB per page**
- **Total**: ~720KB for all 36 avatars (acceptable for modern devices)
- React Native's `Image` component handles caching automatically

## Testing Checklist

- [ ] Page 1: Prev button disabled, Next button enabled
- [ ] Page 2: Both buttons enabled
- [ ] Page 3: Prev button enabled, Next button disabled
- [ ] Tapping page dots jumps to correct page
- [ ] Selected avatar stays highlighted when changing pages
- [ ] Avatar auto-advances to questions after selection
- [ ] All 36 avatars load correctly
- [ ] Page dot animation smooth (active dot elongates)

## Future Enhancements

1. **Swipe Gestures**: Use `react-native-gesture-handler` for swipe navigation
2. **Avatar Categories**: Group by style (e.g., "Professional", "Playful", "Abstract")
3. **Custom Upload**: Allow users to upload their own photo
4. **AI Generation**: Generate custom avatar based on user preferences
5. **Preview Modal**: Tap avatar to see larger preview before selecting

## Related Documentation

- `react-native-supabase-data-sync-pattern.md` - How selected avatar is saved and loaded
- `multi-step-setup-flow-pattern.md` - How avatar selection fits into overall setup

## Technology Context

- **Framework**: React Native (Expo 52)
- **Avatar Service**: DiceBear API v7.x (Notionists style)
- **TypeScript**: 5.6.3
- **Navigation**: React Navigation v7

## Key Takeaway

**Pagination is the sweet spot for medium-sized visual selections** (20-50 items). It balances:
- Variety (many options)
- Simplicity (no overwhelming UI)
- Performance (manageable memory)
- UX (clear navigation)

For avatar selection specifically, **3 pages of 12 avatars** provides ideal balance between choice and cognitive load.
