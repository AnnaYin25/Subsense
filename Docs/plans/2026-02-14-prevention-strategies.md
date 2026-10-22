# Prevention Strategies: February 14, 2026

## Document Overview

**Purpose**: Transform today's problems into actionable guidelines to prevent future issues

**Generated**: 2026-02-14
**Based on**: 4 critical bug fixes + 3 UI/UX patterns implemented
**Context**: Phase 2.5 Persona System implementation with bounded-weight scoring architecture

---

## Executive Summary

Today we fixed **4 critical architectural bugs** in the stable judgement system and implemented **3 major UI/UX patterns**. This document extracts prevention strategies to avoid similar issues in future development.

### Issues Addressed Today

1. **Double Counting Bug** - CheckIn data counted in both Objective and CheckIn layers
2. **Half-Life Formula Error** - Mathematical formula didn't match semantic intent
3. **CheckIn Prompt Contradiction** - LLM prompt with impossible requirements
4. **Confidence Type Mismatch** - Data types causing gating failures + no time decay
5. **Stale Data Display** - Cached AuthContext vs fresh database values
6. **Limited Avatar Options** - Only 12 avatars overwhelming single screen
7. **Complex Multi-Step Form** - Collecting diverse input types in onboarding

**Impact Prevention**: Following these strategies will prevent:
- Bounded-weight violations (persona influence exceeding design limits)
- Score instability (same input producing different outputs)
- Data synchronization bugs (stale cached data)
- Poor user experience (UI clutter, confusing flows)

---

## Part 1: Bounded-Weight Architecture Guidelines

### Context

Bounded-weight systems ensure AI/ML components stay within design limits. Our judgement system must keep persona influence ≤10% while Objective + CheckIn dominate at ≥60%.

### Critical Rules

#### Rule 1.1: Strict Data Source Separation

**Problem Prevented**: Double counting (same signal counted twice)

**Guideline**: Each scoring layer must use **mutually exclusive data sources**.

```typescript
// ✅ CORRECT: Objective uses only independent signals
const calculateObjectiveScore = (
  subscription: Subscription,
  userBudget: number
  // NO checkInHistory parameter
): number => {
  // Only use:
  // - Database timestamps (created_at, updated_at)
  // - Subscription metadata (cost, billing_cycle)
  // - User budget (static per period)
  const usageFreq = calculateUsageFrequency(subscription);
  const costEff = calculateCostEfficiency(subscription, userBudget);

  return (
    usageFreq * 0.15 +
    costEff * 0.15
  );
};

// ❌ WRONG: Using CheckIn data in Objective layer
const calculateObjectiveScore = (
  subscription: Subscription,
  checkInHistory: CheckInResponse[] // NEVER do this
): number => {
  const satisfaction = checkInHistory.reduce(...); // This is CheckIn data!
  return satisfaction * 0.10; // Now counted in both layers
};
```

**Enforcement Checklist**:
- [ ] Review all scoring functions for overlapping data sources
- [ ] Document allowed data sources per layer in code comments
- [ ] Add unit tests verifying independence (modify one source, verify other layers unchanged)
- [ ] Code review: Check that each layer accesses different database tables

**When Adding New Scoring Components**:
1. List all data sources it will use
2. Check existing components for overlaps
3. If overlap exists, either:
   - Remove from new component
   - Remove from existing component
   - Split into sub-components with exclusive sources

---

#### Rule 1.2: Mathematical Formulas Must Match Semantics

**Problem Prevented**: Half-life decay incorrect (at t=halfLife, weight ≠ 0.5)

**Guideline**: If you name something "half-life", use the mathematically correct half-life formula.

```typescript
// ✅ CORRECT: True half-life decay
const halfLifeDecay = (ageInDays: number, halfLifeDays: number): number => {
  return Math.exp(-Math.LN2 * ageInDays / halfLifeDays);
  // At ageInDays = halfLifeDays, returns exactly 0.5 ✓
};

// ❌ WRONG: Not a true half-life
const halfLifeDecay = (ageInDays: number, halfLifeDays: number): number => {
  return Math.exp(-ageInDays / halfLifeDays);
  // At ageInDays = halfLifeDays, returns ~0.368 (not 0.5!) ✗
};
```

**Mathematical Verification Template**:

```typescript
// Always add verification tests for mathematical formulas
test('Half-life decay mathematical properties', () => {
  const halfLife = 30;

  // Test 1: At t=0, no decay
  expect(halfLifeDecay(0, halfLife)).toBe(1.0);

  // Test 2: At t=halfLife, exactly 50% weight
  expect(halfLifeDecay(halfLife, halfLife)).toBe(0.5);

  // Test 3: At t=2×halfLife, 25% weight
  expect(halfLifeDecay(2 * halfLife, halfLife)).toBe(0.25);

  // Test 4: At t=3×halfLife, 12.5% weight
  expect(halfLifeDecay(3 * halfLife, halfLife)).toBe(0.125);
});
```

**Naming Convention Decision Tree**:

```
Is weight = 0.5 at t = your_parameter?
  ├─ YES → Call it "halfLife" and use exp(-ln(2) * t / halfLife)
  └─ NO  → Call it "decayConstant" and use exp(-t / decayConstant)
```

**Code Review Checklist**:
- [ ] All decay formulas have verification tests
- [ ] Formula behavior matches variable name
- [ ] Comments explain mathematical rationale
- [ ] Edge cases tested (t=0, t=∞, t=halfLife)

---

#### Rule 1.3: Weight Sum Verification

**Problem Prevented**: Components exceeding 100% total weight

**Guideline**: Always maintain proof that total weight ≤ 100%

**Implementation Pattern**:

```typescript
// Define constants at top of file
const WEIGHTS = {
  OBJECTIVE: 0.30,      // 30%
  CHECKIN: 0.30,        // 30%
  SETUP: 0.225,         // 22.5%
  BEHAVIORAL_MAX: 0.08, // ≤8% (capped)
  BIG_FIVE_MAX: 0.08    // ≤8% (capped)
} as const;

// Compile-time verification (TypeScript)
type WeightSum = typeof WEIGHTS.OBJECTIVE
  + typeof WEIGHTS.CHECKIN
  + typeof WEIGHTS.SETUP
  + typeof WEIGHTS.BEHAVIORAL_MAX
  + typeof WEIGHTS.BIG_FIVE_MAX;

// Runtime verification test
test('Weight bounds are mathematically provable', () => {
  const maxPossibleScore =
    WEIGHTS.OBJECTIVE +
    WEIGHTS.CHECKIN +
    WEIGHTS.SETUP +
    WEIGHTS.BEHAVIORAL_MAX +
    WEIGHTS.BIG_FIVE_MAX;

  expect(maxPossibleScore).toBeLessThanOrEqual(1.0);
  expect(maxPossibleScore).toBe(0.985); // Expected value
});

// Integration test with extreme inputs
test('Extreme inputs never exceed bounds', () => {
  const extremeInputs = {
    objective: { usage_freq: 1.0, cost_eff: 1.0 },
    checkin: { satisfaction: 1.0, value: 1.0 },
    setup: { /* perfect alignment */ },
    behavioral: { /* max signal */ },
    bigFive: { /* extreme traits */ }
  };

  const result = calculateFinalJudgement(subscription, extremeInputs);

  expect(result.final_score).toBeLessThanOrEqual(1.0);
  expect(result.breakdown.objective).toBeLessThanOrEqual(WEIGHTS.OBJECTIVE);
  expect(result.breakdown.checkin).toBeLessThanOrEqual(WEIGHTS.CHECKIN);
  expect(result.breakdown.behavioral).toBeLessThanOrEqual(WEIGHTS.BEHAVIORAL_MAX);
  expect(result.breakdown.bigFive).toBeLessThanOrEqual(WEIGHTS.BIG_FIVE_MAX);
});
```

**When Modifying Weights**:
1. Update constants file
2. Recalculate total weight proof
3. Update all tests to new expected values
4. Run full test suite before committing
5. Update documentation with new weight distribution table

---

#### Rule 1.4: Confidence-Gating Must Handle Time Decay

**Problem Prevented**: Stale personas dominating fresh signals

**Guideline**: Confidence must decay over time without fresh data

```typescript
// ✅ CORRECT: Effective confidence with decay
const getEffectiveConfidence = (
  persona: UserPersona,
  currentDate: Date = new Date()
): number => {
  const baseConfidence = persona.confidence_score;
  const daysSinceLastUpdate = getDaysBetween(persona.last_updated, currentDate);

  // Confidence decays with 90-day half-life
  const decayFactor = halfLifeDecay(daysSinceLastUpdate, 90);
  const effectiveConfidence = baseConfidence * decayFactor;

  // Lower bound: retain minimal validity
  return Math.max(effectiveConfidence, 0.2);
};

// ❌ WRONG: Static confidence (never decreases)
const getEffectiveConfidence = (persona: UserPersona): number => {
  return persona.confidence_score; // Ignores staleness
};
```

**Confidence Calculation Pattern**:

```typescript
interface ConfidenceInputs {
  checkInHistory: CheckInResponse[];
  subscriptionHistory: Subscription[];
  behavioralEvents: BehavioralEvent[];
  setupCompleted: boolean;
}

const calculateConfidenceScore = (
  inputs: ConfidenceInputs,
  timeWindowDays: number = 60 // Only count recent data
): number => {
  let confidence = 0.0;
  const now = new Date();

  // Base: Setup completed
  if (inputs.setupCompleted) {
    confidence += 0.3;
  }

  // Time-windowed CheckIns
  const recentCheckIns = inputs.checkInHistory.filter(c =>
    getDaysBetween(c.created_at, now) <= timeWindowDays
  );
  confidence += Math.min(recentCheckIns.length / 10, 0.4);

  // Lifetime subscriptions (no window)
  confidence += Math.min(inputs.subscriptionHistory.length / 20, 0.3);

  // Time-windowed behavior (90-day window)
  const recentBehavior = inputs.behavioralEvents.filter(e =>
    getDaysBetween(e.timestamp, now) <= 90
  );
  confidence += Math.min(recentBehavior.length / 15, 0.2);

  return Math.min(confidence, 1.0);
};
```

**Time Window Decision Matrix**:

| Data Type | Window | Rationale |
|-----------|--------|-----------|
| CheckIn Responses | 60 days | User preferences change every ~2 months |
| Behavioral Events | 90 days | Behavior patterns shift slower than feelings |
| Subscription History | No limit | Lifetime count reflects overall experience |
| Setup Preferences | No limit | Baseline persona (unless user re-takes setup) |

**Testing Strategy**:

```typescript
test('Confidence decreases with inactivity', () => {
  const persona = {
    confidence_score: 0.8,
    last_updated: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // 90 days ago
  };

  const effective = getEffectiveConfidence(persona);

  expect(effective).toBeLessThan(0.8); // Decayed
  expect(effective).toBeCloseTo(0.4); // 0.8 * 0.5 (half-life at 90 days)
  expect(effective).toBeGreaterThanOrEqual(0.2); // Lower bound
});
```

---

## Part 2: Data Synchronization Patterns

### Context

React Native + Supabase apps must distinguish between cached authentication state and fresh profile data to avoid stale data display bugs.

### Critical Rules

#### Rule 2.1: Separate Authentication State from Profile Data

**Problem Prevented**: Components showing stale cached user data

**Guideline**: AuthContext should only handle authentication, not profile data

```typescript
// ✅ CORRECT: AuthContext for authentication only
interface AuthState {
  session: Session | null;
  user: {
    id: string;
    email: string;
  } | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

// ❌ WRONG: Mixing auth + profile data
interface AuthState {
  session: Session | null;
  user: {
    id: string;
    email: string;
    name: string;        // ❌ Profile data (changes frequently)
    avatar: string;      // ❌ Profile data
    preferences: any;    // ❌ Profile data
  } | null;
}
```

**Implementation Pattern**:

```typescript
// AuthContext.tsx - Authentication ONLY
export const AuthProvider: React.FC = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    setSession(data.session);
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

// Component - Fresh profile data
export const ProfileScreen: React.FC = () => {
  const { user } = useAuth(); // Only for user.id
  const [userInfo, setUserInfo] = useState<UserProfile | null>(null);

  useEffect(() => {
    loadFreshData();
  }, [user]);

  const loadFreshData = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('users')
      .select('name, avatar, avatar_style')
      .eq('id', user.id)
      .single();

    setUserInfo(data);
  };

  return (
    <View>
      {/* Use userInfo (fresh), not user (cached) */}
      <Text>{userInfo?.name}</Text>
      <Image source={{ uri: userInfo?.avatar }} />
    </View>
  );
};
```

**Decision Tree: When to Load Fresh Data**

```
Does this component display user-modifiable data?
  ├─ YES → Load fresh from database
  │         Examples: name, avatar, preferences, settings
  └─ NO  → Use cached AuthContext
            Examples: email (rarely changes), user.id (never changes)
```

**Code Review Checklist**:
- [ ] Components displaying profile data load fresh from DB
- [ ] AuthContext doesn't include user-modifiable fields
- [ ] Loading states shown while fetching fresh data
- [ ] Error handling for failed database queries

---

#### Rule 2.2: Use Real-Time Subscriptions for Critical Data

**Problem Prevented**: Data becoming stale during active session

**Guideline**: For data that must always be current, use Supabase real-time subscriptions

```typescript
// ✅ CORRECT: Real-time subscription for live data
const [userInfo, setUserInfo] = useState<UserProfile | null>(null);

useEffect(() => {
  // Initial load
  loadUserInfo();

  // Subscribe to changes
  const channel = supabase
    .channel('user-profile-changes')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'users',
      filter: `id=eq.${user.id}`
    }, (payload) => {
      setUserInfo(payload.new as UserProfile);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [user]);

// ❌ WRONG: Only loading once, never updating
useEffect(() => {
  loadUserInfo(); // Loaded once, becomes stale
}, []); // Empty deps = never reloads
```

**When to Use Real-Time Subscriptions**:

| Data Type | Use Real-Time? | Rationale |
|-----------|---------------|-----------|
| User profile (name, avatar) | Optional | Changes infrequently, refresh on mount sufficient |
| Subscription list | **YES** | User adds/removes subscriptions actively |
| CheckIn responses | **YES** | New responses affect scoring immediately |
| Monthly reports | NO | Generated once per month, static after creation |
| Setup preferences | Optional | Only changes if user re-takes setup |

---

#### Rule 2.3: Optimistic Updates for Better UX

**Problem Prevented**: UI lag making app feel sluggish

**Guideline**: Update UI immediately, then sync to database

```typescript
// ✅ CORRECT: Optimistic update pattern
const handleToggleFavorite = async (subscriptionId: string) => {
  // 1. Update UI immediately
  setSubscriptions(prev =>
    prev.map(sub =>
      sub.id === subscriptionId
        ? { ...sub, is_favorite: !sub.is_favorite }
        : sub
    )
  );

  // 2. Sync to database
  try {
    const { error } = await supabase
      .from('subscriptions')
      .update({ is_favorite: !subscription.is_favorite })
      .eq('id', subscriptionId);

    if (error) throw error;
  } catch (err) {
    // 3. Rollback on error
    setSubscriptions(prev =>
      prev.map(sub =>
        sub.id === subscriptionId
          ? { ...sub, is_favorite: !sub.is_favorite } // Revert
          : sub
      )
    );
    showErrorToast('Failed to update. Please try again.');
  }
};

// ❌ WRONG: Wait for database before updating UI
const handleToggleFavorite = async (subscriptionId: string) => {
  await supabase.from('subscriptions').update(...); // User waits...
  await loadSubscriptions(); // User waits more...
};
```

**Optimistic Update Template**:

```typescript
const optimisticUpdate = async <T,>(
  updateUIFn: () => void,
  databaseUpdateFn: () => Promise<void>,
  rollbackFn: () => void
) => {
  // Step 1: Update UI immediately
  updateUIFn();

  try {
    // Step 2: Sync to database
    await databaseUpdateFn();
  } catch (error) {
    // Step 3: Rollback on error
    rollbackFn();
    throw error;
  }
};
```

---

## Part 3: Multi-Step Form Design Principles

### Context

Onboarding flows require collecting diverse input types (text, images, multiple choice) across multiple steps with clear progress indication.

### Critical Rules

#### Rule 3.1: Single-Screen State Machine Pattern

**Problem Prevented**: Complex navigation logic and state synchronization issues

**Guideline**: Use single screen with step-based rendering, not multiple screens

```typescript
// ✅ CORRECT: Single screen with step state
const SetupScreen: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(-2);

  // Step mapping:
  // -2 = Name input
  // -1 = Avatar selection
  //  0-3 = Questions

  const isNameStep = currentStep === -2;
  const isAvatarStep = currentStep === -1;
  const isQuestionStep = currentStep >= 0;

  return (
    <View>
      <ProgressBar progress={(currentStep + 3) / totalSteps} />

      {isNameStep ? (
        <NameInput onSubmit={() => setCurrentStep(-1)} />
      ) : isAvatarStep ? (
        <AvatarPicker onSelect={() => setCurrentStep(0)} />
      ) : (
        <Question onAnswer={() => setCurrentStep(prev => prev + 1)} />
      )}
    </View>
  );
};

// ❌ WRONG: Multiple screens with navigation params
<Stack.Screen name="NameInput" component={NameInputScreen} />
<Stack.Screen name="AvatarSelect" component={AvatarSelectScreen} />
<Stack.Screen name="Questions" component={QuestionsScreen} />
// Problems: Complex param passing, multiple progress bars, hard to add steps
```

**Benefits of Single-Screen Pattern**:

| Aspect | Single Screen | Multiple Screens |
|--------|--------------|------------------|
| Progress Bar | ✅ Unified across all steps | ❌ Need separate bars per screen |
| State Management | ✅ Simple (local state) | ❌ Complex (navigation params) |
| Back Button | ✅ Uniform logic | ❌ Different per screen |
| Adding Steps | ✅ Increment counter | ❌ Add new screen + navigation |
| Testing | ✅ One component | ❌ Multiple components |

---

#### Rule 3.2: Negative Index Pattern for Pre-Sequence Steps

**Problem Prevented**: Special case handling for non-questionnaire steps

**Guideline**: Use negative indices for steps before main sequence

```typescript
// ✅ CORRECT: Negative indices for pre-sequence steps
const [currentStep, setCurrentStep] = useState(-2);

// Mapping:
// -2 = Name input
// -1 = Avatar selection
//  0 = Question 1 (SETUP_QUESTIONS[0])
//  1 = Question 2 (SETUP_QUESTIONS[1])
//  2 = Question 3 (SETUP_QUESTIONS[2])
//  3 = Question 4 (SETUP_QUESTIONS[3])

const currentQuestion = SETUP_QUESTIONS[currentStep]; // Works naturally for 0+
const progress = ((currentStep + 3) / totalSteps) * 100; // Simple math

// ❌ WRONG: Using special string flags
const [currentStep, setCurrentStep] = useState<number | 'name' | 'avatar'>('name');

// Problems:
// - Can't do arithmetic (currentStep + 1)
// - Need switch statements everywhere
// - Progress calculation is complex
```

**Why Negative Indices Work**:

1. **Natural array indexing**: `SETUP_QUESTIONS[currentStep]` works for step ≥ 0
2. **Simple arithmetic**: `currentStep + 1` advances uniformly
3. **Clear semantics**: Negative = before sequence, 0+ = in sequence
4. **Progress calculation**: `(currentStep + offset) / total` is straightforward

---

#### Rule 3.3: Auto-Advance vs Manual Advance Decision

**Problem Prevented**: Confusing UX (user unsure when to click "next")

**Guideline**: Choose transition type based on input finality

```typescript
// ✅ CORRECT: Manual advance for text input
const handleNameSubmit = () => {
  if (!userName.trim()) {
    alert('Please enter your name');
    return;
  }
  setCurrentStep(-1); // User must click Continue
};

// ✅ CORRECT: Auto-advance for selections
const handleSelectAvatar = (seed: string) => {
  setSelectedAvatarSeed(seed);

  // Auto-advance after brief delay (UX feedback)
  setTimeout(() => {
    setCurrentStep(0);
  }, 200);
};

// ❌ WRONG: Auto-advance for text input
const handleNameChange = (text: string) => {
  setUserName(text);

  if (text.length > 0) {
    setCurrentStep(-1); // Advances while user might still be typing!
  }
};
```

**Auto-Advance Decision Matrix**:

| Input Type | Advance | Delay | Rationale |
|------------|---------|-------|-----------|
| Text input | Manual | N/A | User might still be typing |
| Visual selection (avatar) | Auto | 200ms | Choice is immediate, show visual feedback |
| Multiple choice | Auto | 200ms | Selection is final, no ambiguity |
| File upload | Manual | N/A | User might want to review before continuing |
| Drag-to-order | Manual | N/A | User might adjust multiple items |

**Why 200ms Delay?**:
- User sees selection highlight briefly
- Feels intentional, not jarring
- Gives time for visual feedback animation
- Not too slow (300ms+ feels sluggish)
- Not instant (0ms feels abrupt)

---

#### Rule 3.4: Atomic Save at Completion

**Problem Prevented**: Partial state in database causing inconsistencies

**Guideline**: Save all form data at completion, not incrementally

```typescript
// ✅ CORRECT: Atomic save at end
const handleComplete = async () => {
  setIsSubmitting(true);

  try {
    // Save all data in single transaction
    await Promise.all([
      supabase.from('users').update({
        name: userName,
        avatar: avatarUrl,
        avatar_style: 'notionists'
      }).eq('id', user.id),

      supabase.from('user_personas').upsert({
        user_id: user.id,
        setup_preferences: completePreferences,
        setup_completed: true,
        confidence_score: 0.3
      })
    ]);

    navigation.navigate('PersonaResult');
  } catch (error) {
    alert('Failed to save. Please try again.');
  } finally {
    setIsSubmitting(false);
  }
};

// ❌ WRONG: Saving each step
const handleNameSubmit = async () => {
  await supabase.from('users').update({ name: userName }); // Saved
  setCurrentStep(-1);
};

const handleAvatarSelect = async (seed: string) => {
  await supabase.from('users').update({ avatar: avatarUrl }); // Saved
  setCurrentStep(0);
};

// Problem: If user quits after name but before avatar, database has partial state
```

**Benefits of Atomic Save**:

| Aspect | Atomic Save | Incremental Save |
|--------|-------------|------------------|
| Data Consistency | ✅ All-or-nothing | ❌ Partial states possible |
| Error Handling | ✅ Single try-catch | ❌ Need error handling at each step |
| User Freedom | ✅ Can navigate back freely | ❌ Back button must unsave data |
| Database Writes | ✅ Fewer writes | ❌ Many small writes |
| Rollback | ✅ Easy (nothing saved yet) | ❌ Complex (need undo logic) |

**Exception**: Use incremental saves if:
- Form is very long (>10 steps)
- Users commonly abandon mid-flow
- Data loss risk is high (app crashes frequently)

In these cases, implement local storage backup:

```typescript
// Backup pattern for long forms
useEffect(() => {
  AsyncStorage.setItem('setup-backup', JSON.stringify({
    userName,
    selectedAvatarSeed,
    answers,
    currentStep
  }));
}, [userName, selectedAvatarSeed, answers, currentStep]);
```

---

## Part 4: Avatar Pagination UX Rules

### Context

Visual selection UIs need balance between variety (many options) and simplicity (no clutter).

### Critical Rules

#### Rule 4.1: Pagination Sweet Spot Formula

**Problem Prevented**: Too many/few options per page

**Guideline**: Use this formula to determine items per page

```
Items Per Page = floor(Screen Width / Item Size) × floor(Screen Height / Item Size)

For mobile avatar selection:
- Screen width: ~390px
- Screen height (available): ~600px
- Avatar size: 80px (including padding)

Grid: 4 columns × 3 rows = 12 avatars per page ✓
```

**Validation Matrix**:

| Items/Page | Grid | Mobile UX | Desktop UX | Performance |
|------------|------|-----------|------------|-------------|
| 6 | 2×3 | ❌ Too few choices | ❌ Wasted space | ✅ Fast |
| 12 | 4×3 | ✅ Perfect balance | ✅ Good | ✅ Fast |
| 24 | 4×6 | ❌ Requires scrolling | ✅ Good | ⚠️ Slower load |
| 48 | 6×8 | ❌ Overwhelming | ⚠️ Scrolling needed | ❌ Slow load |

**General Rule**: Keep items per page between 9-16 for mobile, 16-25 for desktop

---

#### Rule 4.2: Boundary Protection Pattern

**Problem Prevented**: Users clicking "Next" on last page or "Prev" on first page

**Guideline**: Disable navigation buttons at boundaries

```typescript
// ✅ CORRECT: Automatic boundary protection
<Pressable
  onPress={() => setPage(Math.max(0, page - 1))}
  disabled={page === 0} // Disabled on first page
  style={[
    styles.pageButton,
    page === 0 && styles.pageButtonDisabled // Visual feedback
  ]}
>
  <Text>← Prev</Text>
</Pressable>

<Pressable
  onPress={() => setPage(Math.min(totalPages - 1, page + 1))}
  disabled={page === totalPages - 1} // Disabled on last page
  style={[
    styles.pageButton,
    page === totalPages - 1 && styles.pageButtonDisabled
  ]}
>
  <Text>Next →</Text>
</Pressable>

// ❌ WRONG: No boundary protection
<Pressable onPress={() => setPage(page - 1)}>
  <Text>← Prev</Text>
</Pressable>
// Problem: Clicking on page 0 goes to page -1 (undefined behavior)
```

**Visual Feedback Requirements**:
- Disabled buttons: 30-40% opacity
- Disabled buttons: No hover/press effects
- Disabled buttons: Cursor changes (web: not-allowed)

---

#### Rule 4.3: Selection Persistence Pattern

**Problem Prevented**: Selected item loses highlight when changing pages

**Guideline**: Selection state must be independent of pagination state

```typescript
// ✅ CORRECT: Global selection state
const [selectedAvatarSeed, setSelectedAvatarSeed] = useState<string | null>(null);
const [currentPage, setCurrentPage] = useState(0);

const avatarSeeds = allAvatarSeeds[currentPage];

avatarSeeds.map(seed => {
  const isSelected = selectedAvatarSeed === seed; // Works across pages

  return (
    <Pressable
      onPress={() => setSelectedAvatarSeed(seed)}
      style={[
        styles.avatar,
        isSelected && styles.avatarSelected
      ]}
    >
      <Image source={{ uri: generateAvatarUrl(seed) }} />
    </Pressable>
  );
});

// ❌ WRONG: Selection tied to current page
const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
// Problem: selectedIndex=0 on page 1 is different avatar than page 2
```

**State Structure Best Practices**:

```typescript
interface PaginatedSelectionState<T> {
  items: T[][]; // Array of pages, each page is array of items
  currentPage: number;
  selectedItem: T | null; // Global selection (not page-specific)
}

// Example:
const state: PaginatedSelectionState<string> = {
  items: [
    ['1', '2', '3', '4'], // Page 0
    ['5', '6', '7', '8']  // Page 1
  ],
  currentPage: 0,
  selectedItem: '5' // Selected item is on page 1
};
```

---

#### Rule 4.4: Page Indicator Patterns

**Problem Prevented**: User doesn't know which page they're on

**Guideline**: Use visual indicators with direct navigation

```typescript
// ✅ CORRECT: Clickable page dots with active state
<View style={styles.pageDots}>
  {allPages.map((_, index) => (
    <Pressable
      key={index}
      onPress={() => setPage(index)} // Direct navigation
      style={[
        styles.pageDot,
        currentPage === index && styles.pageDotActive
      ]}
    />
  ))}
</View>

// Styles
const styles = StyleSheet.create({
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
});

// ❌ WRONG: Text-only indicator
<Text>Page {currentPage + 1} of {totalPages}</Text>
// Problem: No visual feedback, can't click to navigate
```

**Indicator Pattern Decision Matrix**:

| Pattern | Use When | Pros | Cons |
|---------|----------|------|------|
| Page dots | 2-5 pages | ✅ Visual, clickable | ❌ Cluttered with many pages |
| Page numbers | 6-20 pages | ✅ Shows exact position | ⚠️ Less visual |
| Progress bar | Linear flow (no jumping) | ✅ Clear progress | ❌ Can't jump to page |
| Dropdown | >20 pages | ✅ Scalable | ❌ Less discoverable |

---

## Part 5: LLM Integration Best Practices

### Context

AI-powered features require careful prompt engineering to avoid contradictions and ensure deterministic behavior.

### Critical Rules

#### Rule 5.1: Never Mix Generation and Scoring

**Problem Prevented**: LLM prompts with contradictory requirements

**Guideline**: Separate question generation from answer scoring into two steps

```typescript
// ✅ CORRECT: Two-step process

// Step 1: LLM generates questions (returns JSON)
const QUESTION_GENERATION_PROMPT = `
Generate 3 check-in questions for this subscription.

CRITICAL: Return ONLY valid JSON. No markdown. No prose.

Schema:
{
  "questions": [
    {
      "id": "usage_satisfaction",
      "text": "Your personalized question text",
      "options": [
        { "label": "Not satisfied", "score": 0.0 },
        { "label": "Very satisfied", "score": 1.0 }
      ]
    }
  ]
}
`;

const questions = await generateQuestions(prompt);

// Step 2: Local scoring (deterministic, no LLM)
const calculateCheckInScore = (userAnswer: number): number => {
  return questions[0].options[userAnswer].score;
  // Same answer always gives same score
};

// ❌ WRONG: Single-step with contradiction
const COMBINED_PROMPT = `
Generate questions for the user to answer.
Also score their responses.

CRITICAL: Return ONLY JSON. No prose. <-- Contradiction!
Display questions to the user. <-- Can't display JSON-only output!
`;
```

**Why Two-Step is Better**:

| Aspect | Two-Step | Single-Step |
|--------|----------|-------------|
| JSON Parsing | ✅ Always valid | ❌ Often fails (mixed text+JSON) |
| Scoring Consistency | ✅ Deterministic | ❌ LLM variance (0.7 vs 0.73) |
| UI Display | ✅ Questions visible to user | ❌ Can't show JSON-only output |
| Speed | ⚡ LLM once, local scoring instant | 🐢 Two LLM calls |
| Debuggability | ✅ Can inspect score calculation | ❌ Black box |

---

#### Rule 5.2: Structured Output Validation

**Problem Prevented**: LLM returning invalid JSON crashing the app

**Guideline**: Always validate LLM output with strict TypeScript types

```typescript
// ✅ CORRECT: Validation schema + fallback
import { z } from 'zod';

const QuestionSchema = z.object({
  id: z.string(),
  text: z.string().min(10),
  options: z.array(z.object({
    label: z.string(),
    score: z.number().min(0).max(1)
  })).min(2).max(5)
});

const QuestionsResponseSchema = z.object({
  questions: z.array(QuestionSchema).min(1).max(5)
});

const generateQuestions = async (prompt: string) => {
  try {
    const response = await anthropic.messages.create({ ... });
    const rawOutput = response.content[0].text;

    // Parse and validate
    const parsed = JSON.parse(rawOutput);
    const validated = QuestionsResponseSchema.parse(parsed);

    return validated.questions;
  } catch (error) {
    console.error('LLM output validation failed:', error);

    // Fallback to predefined questions
    return DEFAULT_QUESTIONS;
  }
};

// ❌ WRONG: No validation
const generateQuestions = async (prompt: string) => {
  const response = await anthropic.messages.create({ ... });
  return JSON.parse(response.content[0].text).questions; // Crashes if invalid
};
```

**Validation Checklist**:
- [ ] Schema defined with Zod or similar
- [ ] All required fields validated
- [ ] Numeric ranges enforced (scores 0-1)
- [ ] Array lengths constrained (min/max)
- [ ] Fallback data exists for all LLM calls
- [ ] User sees error message, not crash

---

#### Rule 5.3: Deterministic Scoring Functions

**Problem Prevented**: Same user input producing different scores

**Guideline**: Scoring logic must be code, not LLM

```typescript
// ✅ CORRECT: Fixed score mappings
const SATISFACTION_SCORES = {
  'not_satisfied': 0.0,
  'somewhat_satisfied': 0.3,
  'moderately_satisfied': 0.5,
  'very_satisfied': 0.7,
  'extremely_satisfied': 1.0
} as const;

const calculateSatisfactionScore = (answer: keyof typeof SATISFACTION_SCORES): number => {
  return SATISFACTION_SCORES[answer];
  // Same answer always returns same score
};

// ❌ WRONG: LLM scoring
const calculateSatisfactionScore = async (answer: string): Promise<number> => {
  const prompt = `Rate satisfaction from 0-1 based on: "${answer}"`;
  const response = await anthropic.messages.create({ ... });
  return parseFloat(response.content[0].text);
  // Different calls might return 0.7, 0.73, 0.68 for same answer!
};
```

**Testing Deterministic Functions**:

```typescript
test('Scoring is deterministic', () => {
  const answer = 'very_satisfied';

  // Call multiple times
  const score1 = calculateSatisfactionScore(answer);
  const score2 = calculateSatisfactionScore(answer);
  const score3 = calculateSatisfactionScore(answer);

  // Must be identical
  expect(score1).toBe(score2);
  expect(score2).toBe(score3);
  expect(score1).toBe(0.7); // Exact expected value
});
```

---

## Part 6: Testing Checklist

### Unit Tests

#### Bounded-Weight System Tests

```typescript
describe('Bounded-Weight Architecture', () => {
  test('Components use exclusive data sources', () => {
    const objective = calculateObjectiveScore(subscription, userBudget);

    // Modify CheckIn data
    const modifiedCheckIn = { ...checkIn, satisfaction: 0.9 };
    const objectiveAfter = calculateObjectiveScore(subscription, userBudget);

    expect(objective).toBe(objectiveAfter); // Unchanged
  });

  test('Half-life decay at t=halfLife equals 0.5', () => {
    const halfLife = 30;
    expect(halfLifeDecay(halfLife, halfLife)).toBe(0.5);
  });

  test('Weight sum never exceeds 100%', () => {
    const extremeInputs = { /* all max values */ };
    const result = calculateFinalJudgement(subscription, extremeInputs);

    expect(result.final_score).toBeLessThanOrEqual(1.0);
  });

  test('Confidence decays with inactivity', () => {
    const stalePersona = {
      confidence_score: 0.8,
      last_updated: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    };

    const effective = getEffectiveConfidence(stalePersona);
    expect(effective).toBeLessThan(0.8);
  });
});
```

#### Data Sync Tests

```typescript
describe('Data Synchronization', () => {
  test('Component loads fresh data from database', async () => {
    const { getByText } = render(<ProfileScreen />);

    // Wait for fresh data load
    await waitFor(() => {
      expect(getByText('Alice')).toBeTruthy(); // User's actual name
    });
  });

  test('Optimistic update rolls back on error', async () => {
    // Mock database failure
    jest.spyOn(supabase, 'from').mockRejectedValue(new Error('Network error'));

    const { getByText } = render(<SubscriptionList />);
    const favoriteButton = getByText('Favorite');

    fireEvent.press(favoriteButton);

    // UI updates immediately
    expect(getByText('Unfavorite')).toBeTruthy();

    // After error, rolls back
    await waitFor(() => {
      expect(getByText('Favorite')).toBeTruthy();
    });
  });
});
```

#### Multi-Step Form Tests

```typescript
describe('Multi-Step Setup Flow', () => {
  test('Progress bar updates at each step', () => {
    const { getByTestId } = render(<SetupScreen />);
    const progressBar = getByTestId('progress-bar');

    // Initial: 16.7%
    expect(progressBar.props.style.width).toBe('16.7%');

    // After name: 33.3%
    fireEvent.press(getByText('Continue'));
    expect(progressBar.props.style.width).toBe('33.3%');
  });

  test('Name validation prevents advance', () => {
    const { getByText } = render(<SetupScreen />);

    fireEvent.press(getByText('Continue')); // Empty name

    expect(getByText('Please enter your name')).toBeTruthy();
    expect(currentStep).toBe(-2); // Still on name step
  });

  test('Atomic save - all data saved at completion', async () => {
    const { getByText } = render(<SetupScreen />);

    // Complete all steps
    // ...

    fireEvent.press(getByText('Finish'));

    await waitFor(() => {
      // Verify both database tables updated
      expect(supabase.from('users').update).toHaveBeenCalled();
      expect(supabase.from('user_personas').upsert).toHaveBeenCalled();
    });
  });
});
```

#### LLM Integration Tests

```typescript
describe('LLM Integration', () => {
  test('Invalid LLM output falls back to defaults', async () => {
    // Mock LLM returning invalid JSON
    jest.spyOn(anthropic.messages, 'create').mockResolvedValue({
      content: [{ text: 'Invalid JSON{' }]
    });

    const questions = await generateQuestions(prompt);

    expect(questions).toEqual(DEFAULT_QUESTIONS);
  });

  test('Scoring is deterministic', () => {
    const answer = 'very_satisfied';

    const score1 = calculateScore(answer);
    const score2 = calculateScore(answer);

    expect(score1).toBe(score2);
    expect(score1).toBe(0.7);
  });
});
```

### Integration Tests

```typescript
describe('End-to-End Flows', () => {
  test('Complete setup flow saves all data', async () => {
    // 1. Signup
    await signUp('test@example.com', 'password123');

    // 2. Navigate to Setup
    expect(screen.getByText('What\'s your name?')).toBeTruthy();

    // 3. Enter name
    fireEvent.changeText(screen.getByPlaceholderText('Name'), 'Alice');
    fireEvent.press(screen.getByText('Continue'));

    // 4. Select avatar
    fireEvent.press(screen.getAllByTestId('avatar-option')[5]);

    // 5. Answer questions
    for (let i = 0; i < 4; i++) {
      fireEvent.press(screen.getAllByTestId('option')[0]);
      await waitFor(() => {}); // Wait for auto-advance
    }

    // 6. Verify navigation to result
    expect(screen.getByText('Your Persona')).toBeTruthy();

    // 7. Verify database state
    const { data: user } = await supabase
      .from('users')
      .select('name, avatar')
      .eq('email', 'test@example.com')
      .single();

    expect(user.name).toBe('Alice');
    expect(user.avatar).toContain('dicebear.com');
  });
});
```

---

## Part 7: Code Review Guidelines

### Pre-Commit Checklist

Before merging any PR that touches these systems:

#### Bounded-Weight Changes

- [ ] All scoring components use exclusive data sources (run independence test)
- [ ] Weight constants sum verified (compile-time + runtime tests)
- [ ] Decay formulas have mathematical verification tests
- [ ] Confidence calculation includes time-windowing and decay
- [ ] Extreme input tests pass (max values don't exceed bounds)
- [ ] Documentation updated with new weight distribution

#### Data Sync Changes

- [ ] AuthContext doesn't include user-modifiable profile fields
- [ ] Components load fresh data from database (not cached context)
- [ ] Loading states shown during data fetch
- [ ] Error handling for failed queries
- [ ] Optimistic updates have rollback logic
- [ ] Real-time subscriptions have cleanup in useEffect return

#### UI/UX Changes

- [ ] Multi-step forms use single-screen state machine pattern
- [ ] Progress bar updates correctly at each step
- [ ] Validation prevents invalid progression
- [ ] Atomic save at completion (not incremental)
- [ ] Back button works uniformly across steps
- [ ] Auto-advance only for selections, manual for text input

#### LLM Integration Changes

- [ ] Question generation separated from scoring
- [ ] LLM output validated with schema (Zod)
- [ ] Fallback data exists for all LLM calls
- [ ] Scoring functions are deterministic (unit tested)
- [ ] Prompts don't have contradictory requirements
- [ ] User sees meaningful error messages, not crashes

### Red Flags to Watch For

```typescript
// 🚩 RED FLAG 1: Mixing data sources
const calculateObjectiveScore = (subscription, checkInHistory) => {
  // Using checkInHistory in Objective layer!
};

// 🚩 RED FLAG 2: Formula doesn't match name
const halfLifeDecay = (age, halfLife) => {
  return Math.exp(-age / halfLife); // Not a true half-life!
};

// 🚩 RED FLAG 3: Static confidence
const getConfidence = (persona) => {
  return persona.confidence_score; // No time decay!
};

// 🚩 RED FLAG 4: Incremental saves
const handleNameSubmit = async () => {
  await saveToDatabase(); // Saving mid-flow!
};

// 🚩 RED FLAG 5: LLM for scoring
const calculateScore = async (answer) => {
  const response = await llm.call(...); // Non-deterministic!
};

// 🚩 RED FLAG 6: No validation
const result = JSON.parse(llmOutput); // Crashes if invalid!
```

### Review Questions

When reviewing code, ask:

1. **Data Sources**: Does this component use data already used elsewhere?
2. **Mathematical Correctness**: Do formulas match their semantic names?
3. **Time Awareness**: Does confidence/weight decay appropriately?
4. **State Persistence**: Is data saved atomically or incrementally?
5. **Determinism**: Will this produce same output for same input?
6. **Error Handling**: What happens if LLM/database fails?
7. **User Experience**: Is the flow intuitive? Clear feedback?

---

## Part 8: Monitoring & Alerts

### Production Metrics to Track

#### Bounded-Weight System

```typescript
// Alert if any component exceeds design bounds
const monitorWeightBounds = (result: JudgementResult) => {
  if (result.breakdown.objective > 0.30) {
    logAlert('OBJECTIVE_WEIGHT_EXCEEDED', { value: result.breakdown.objective });
  }

  if (result.breakdown.behavioral > 0.08) {
    logAlert('BEHAVIORAL_WEIGHT_EXCEEDED', { value: result.breakdown.behavioral });
  }

  if (result.final_score > 1.0) {
    logCritical('TOTAL_SCORE_EXCEEDED', { value: result.final_score });
  }
};

// Alert if confidence gating fails
const monitorConfidenceGating = (persona: UserPersona) => {
  const effective = getEffectiveConfidence(persona);

  if (effective < 0.2 && persona.confidence_score > 0.7) {
    logWarning('CONFIDENCE_DECAY_ANOMALY', {
      base: persona.confidence_score,
      effective: effective,
      daysSinceUpdate: getDaysBetween(persona.last_updated, new Date())
    });
  }
};
```

#### Data Sync Issues

```typescript
// Alert if stale data detected
const monitorDataStaleness = async (userId: string) => {
  const cachedData = authContext.user; // From cache
  const freshData = await supabase.from('users').select('*').eq('id', userId).single();

  if (cachedData.name !== freshData.data.name) {
    logWarning('STALE_DATA_DETECTED', {
      cached: cachedData.name,
      fresh: freshData.data.name
    });
  }
};
```

#### LLM Integration

```typescript
// Alert if LLM output validation fails frequently
let validationFailures = 0;

const monitorLLMValidation = (success: boolean) => {
  if (!success) {
    validationFailures++;

    if (validationFailures > 10) { // 10 failures in short period
      logCritical('LLM_VALIDATION_FAILURE_THRESHOLD', {
        count: validationFailures
      });
    }
  }
};
```

---

## Part 9: Documentation Standards

### When to Document

Document a solution when:
- ✅ Problem took >15 minutes to solve
- ✅ Issue is non-trivial (not a typo)
- ✅ Solution involves reusable patterns
- ✅ Mistake could be common across team

### Solution Document Template

Use this template for all new solutions:

```markdown
# [Problem Title]

## Metadata
```yaml
category: [integration-issues|architecture-issues|ui-patterns|...]
module: [affected-code-area]
tags: [searchable, keywords]
symptoms: ["Observable error messages"]
difficulty: [beginner|intermediate|advanced]
date_documented: YYYY-MM-DD
```

## Problem
[What went wrong, observable symptoms]

## Root Cause
[Why it happened, technical explanation]

## Solution
[Step-by-step fix with code examples]

## Verification
[Tests to verify fix]

## Prevention
[How to avoid in future - MOST IMPORTANT SECTION]

## Related Documentation
[Links to other solutions]
```

### Prevention Section Requirements

Every solution document must include:

1. **Best Practices**: Actionable guidelines
2. **Code Examples**: Before/after comparisons
3. **Testing Checklist**: Verification steps
4. **Code Review Guidelines**: What to check
5. **Common Pitfalls**: Red flags to watch for

---

## Part 10: Quick Reference Cards

### Bounded-Weight System

```
✅ DO:
- Use exclusive data sources per layer
- Test weight bounds with extreme inputs
- Include time decay in confidence scoring
- Verify mathematical formulas match semantics

❌ DON'T:
- Mix CheckIn data in Objective layer
- Use exp(-t/k) and call it "half-life"
- Let confidence stay static (must decay)
- Forget to test max possible score ≤ 100%
```

### Data Synchronization

```
✅ DO:
- Separate authentication state from profile data
- Load fresh data from DB in profile components
- Use real-time subscriptions for live data
- Implement optimistic updates with rollback

❌ DON'T:
- Store user-modifiable fields in AuthContext
- Cache profile data that changes frequently
- Update UI only after database confirms
- Skip loading states or error handling
```

### Multi-Step Forms

```
✅ DO:
- Use single-screen state machine pattern
- Use negative indices for pre-sequence steps
- Auto-advance for selections (200ms delay)
- Save atomically at completion

❌ DON'T:
- Create separate screens per step
- Use string flags for step state
- Auto-advance for text input
- Save incrementally during flow
```

### LLM Integration

```
✅ DO:
- Separate question generation from scoring
- Validate LLM output with schemas (Zod)
- Make scoring deterministic (code, not LLM)
- Have fallback data for all LLM calls

❌ DON'T:
- Ask LLM to both generate questions AND output JSON-only
- Parse LLM output without validation
- Use LLM for scoring (non-deterministic)
- Let app crash on invalid LLM output
```

---

## Conclusion

Following these prevention strategies will avoid the 7 major categories of issues we encountered today:

1. **Double Counting** - Strict data source separation
2. **Formula Errors** - Mathematical verification tests
3. **Prompt Contradictions** - Separate generation from scoring
4. **Type Mismatches** - Time-aware confidence with decay
5. **Stale Data** - Fresh database loads in components
6. **UI Clutter** - Pagination with sweet spot formula
7. **Complex Forms** - Single-screen state machine

**Time Investment**: These strategies add ~20% development time upfront
**Time Savings**: Prevent 10x debugging time + production issues
**Quality Impact**: More stable scores, better UX, fewer bugs

**Remember**: The first time you encounter a problem, solve it. The second time, document it. The third time never happens because you followed the prevention strategy.

---

**END OF PREVENTION STRATEGIES DOCUMENT**
