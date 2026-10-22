# Multi-Step Setup Flow: Name → Avatar → Questionnaire Pattern

## Metadata

```yaml
category: ui-patterns
module: setup, onboarding
tags: [react-native, multi-step-form, state-machine, onboarding-ux]
symptoms:
  - "Need to collect user data across multiple screens"
  - "Onboarding flow requires different input types"
  - "State management for sequential form steps"
difficulty: intermediate
date_documented: 2026-02-14
related_files:
  - app/src/screens/SetupScreen.tsx
  - app/src/screens/AuthScreen.tsx
  - app/src/navigation/RootNavigator.tsx
```

## Problem

### Requirements

Build an onboarding setup flow with **3 distinct phases**:

1. **Name Input**: Text field for user's display name
2. **Avatar Selection**: Visual picker with pagination (36 options)
3. **Questionnaire**: 4 questions with multiple-choice options

### Challenges

1. **Different input types**: Text input, image selection, multiple choice
2. **State persistence**: Data must persist across steps
3. **Progress indication**: User needs to see their position in flow
4. **Navigation logic**: Back button, auto-advance, skip functionality
5. **Database integration**: Save all data at completion (not per-step)

### Initial Mistake

❌ **Collecting name in AuthScreen during signup**:

```typescript
// AuthScreen.tsx (OLD - DON'T DO THIS)
<TextInput
  placeholder="Name"
  value={name}
  onChangeText={setName}
/>
<TextInput
  placeholder="Email"
  value={email}
  onChangeText={setEmail}
/>
<TextInput
  placeholder="Password"
  value={password}
  onChangeText={setPassword}
  secureTextEntry
/>
```

**Problems**:
- Mixing authentication with profile setup
- Longer signup form = higher drop-off rate
- Name not part of authentication, shouldn't block account creation

## Solution

### Architecture: Step-Based State Machine with Negative Indices

Use **single `currentStep` state** with negative indices for pre-questionnaire steps:

```typescript
const [currentStep, setCurrentStep] = useState(-2); // Start at -2

// Step mapping:
// -2 = Name input
// -1 = Avatar selection
//  0 = Question 1
//  1 = Question 2
//  2 = Question 3
//  3 = Question 4

const isNameStep = currentStep === -2;
const isAvatarStep = currentStep === -1;
const isQuestionStep = currentStep >= 0;
```

**Why negative indices?**
- ✅ Questions use natural 0-based indexing: `SETUP_QUESTIONS[currentStep]`
- ✅ Name/Avatar don't need special handling logic
- ✅ Progress calculation is simple: `(currentStep + 3) / totalSteps`
- ✅ Back button logic works uniformly: `setCurrentStep(prev => prev - 1)`

### State Management

```typescript
// All form state in single component
const [userName, setUserName] = useState('');
const [selectedAvatarSeed, setSelectedAvatarSeed] = useState('1');
const [answers, setAnswers] = useState<Partial<SetupPreferences>>({});
const [isSubmitting, setIsSubmitting] = useState(false);
```

### Progress Bar

```typescript
const totalSteps = SETUP_QUESTIONS.length + 2; // +2 for name and avatar
const progress = ((currentStep + 3) / totalSteps) * 100; // +3 because starts at -2

<View style={styles.progressBarContainer}>
  <View style={[styles.progressBar, { width: `${progress}%` }]} />
</View>
```

**Progress values**:
- Step -2 (Name): 1/6 = 16.7%
- Step -1 (Avatar): 2/6 = 33.3%
- Step 0 (Q1): 3/6 = 50%
- Step 1 (Q2): 4/6 = 66.7%
- Step 2 (Q3): 5/6 = 83.3%
- Step 3 (Q4): 6/6 = 100%

### Step Rendering Logic

```typescript
<ScrollView>
  {isNameStep ? (
    /* Name Input Step */
    <>
      <Text style={styles.question}>What's your name?</Text>
      <TextInput
        value={userName}
        onChangeText={setUserName}
        autoFocus
      />
      <Pressable onPress={handleNameSubmit}>
        <Text>Continue</Text>
      </Pressable>
    </>
  ) : isAvatarStep ? (
    /* Avatar Selection Step */
    <>
      <Text style={styles.question}>Choose your avatar</Text>
      <AvatarGrid onSelect={handleSelectAvatar} />
      {/* Pagination controls */}
    </>
  ) : (
    /* Question Steps */
    <>
      <Text style={styles.question}>{currentQuestion?.question}</Text>
      <OptionsList onSelect={handleSelectOption} />
    </>
  )}
</ScrollView>
```

### Step Transitions

#### 1. Name → Avatar (Manual Advance)

User must click "Continue" button:

```typescript
const handleNameSubmit = () => {
  if (!userName.trim()) {
    alert('Please enter your name');
    return;
  }
  setCurrentStep(-1); // Move to avatar selection
};
```

**Why manual?** Text input requires explicit submission (user might be typing).

#### 2. Avatar → Question 1 (Auto Advance)

Avatar selection auto-advances after brief delay:

```typescript
const handleSelectAvatar = (seed: string) => {
  setSelectedAvatarSeed(seed);

  // Auto-advance after 200ms (UX feedback time)
  setTimeout(() => {
    setCurrentStep(0);
  }, 200);
};
```

**Why auto?** Visual selection is immediate, no need for extra button click.

#### 3. Questions 1-3 → Next Question (Auto Advance)

Questions auto-advance on selection:

```typescript
const handleSelectOption = (optionIndex: number) => {
  const selectedOption = currentQuestion.options[optionIndex];

  // Merge selected values into answers
  setAnswers(prev => ({
    ...prev,
    ...selectedOption.values
  }));

  // Auto-advance after 200ms
  setTimeout(() => {
    if (isLastQuestion) {
      handleComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  }, 200);
};
```

**Why auto?** Multiple choice is immediate, auto-advance feels fluid.

#### 4. Question 4 → Completion

Last question triggers completion handler:

```typescript
const handleComplete = async () => {
  setIsSubmitting(true);

  try {
    // Merge answers with defaults
    const completePreferences = mergeSetupAnswers(answers);

    // Save name and avatar to users table
    await supabase
      .from('users')
      .update({
        name: userName.trim(),
        avatar: `https://api.dicebear.com/7.x/notionists/png?seed=${selectedAvatarSeed}&size=150`,
        avatar_style: 'notionists'
      })
      .eq('id', user.id);

    // Save preferences to user_personas table
    await supabase
      .from('user_personas')
      .upsert({
        user_id: user.id,
        setup_preferences: completePreferences,
        setup_completed: true,
        confidence_score: 0.3, // Base confidence
        last_updated: new Date().toISOString()
      });

    // Navigate to result screen
    navigation.navigate('PersonaResult');
  } catch (error) {
    alert('Failed to save. Please try again.');
  } finally {
    setIsSubmitting(false);
  }
};
```

### Back Button Logic

```typescript
const handleBack = () => {
  if (currentStep > -2) { // Can't go back from name step
    setCurrentStep(prev => prev - 1);
  }
};

<Pressable onPress={handleBack}>
  <Text>← Back</Text>
</Pressable>
```

**Only shown when**: `currentStep > -2` (hides on name step)

### Skip Functionality

```typescript
const handleSkip = async () => {
  // Save with default preferences
  const defaultPreferences = mergeSetupAnswers({});

  await supabase
    .from('user_personas')
    .upsert({
      user_id: user.id,
      setup_preferences: defaultPreferences,
      setup_completed: false, // Mark as skipped
      confidence_score: 0.2,  // Lower confidence
    });

  navigation.reset({
    index: 0,
    routes: [{ name: 'MainApp' }]
  });
};
```

**Only shown**: During questions (not on name/avatar steps)

## Data Flow

### 1. Signup (AuthScreen)

```typescript
// Create account with email/password only
await signUp(email, password, 'User'); // Temporary name
navigation.navigate('Setup');
```

**What's saved**:
- `auth.users`: email, encrypted password, id
- `public.users`: id, name='User' (placeholder)

### 2. Name Step (SetupScreen)

```typescript
const [userName, setUserName] = useState('');
// Stored in local state, NOT saved to database yet
```

**What's saved**: Nothing yet (local state only)

### 3. Avatar Step (SetupScreen)

```typescript
const [selectedAvatarSeed, setSelectedAvatarSeed] = useState('1');
// Stored in local state, NOT saved to database yet
```

**What's saved**: Nothing yet (local state only)

### 4. Questions (SetupScreen)

```typescript
const [answers, setAnswers] = useState<Partial<SetupPreferences>>({});

// Each question adds values:
setAnswers(prev => ({
  ...prev,
  budget_tightness: 0.8,
  waste_tolerance: 0.3,
  // ...
}));
```

**What's saved**: Nothing yet (local state only)

### 5. Completion Handler

**NOW everything is saved**:

```typescript
// 1. Update users table
await supabase.from('users').update({
  name: userName,
  avatar: avatarUrl,
  avatar_style: 'notionists'
});

// 2. Insert/update user_personas table
await supabase.from('user_personas').upsert({
  user_id: user.id,
  setup_preferences: completePreferences,
  setup_completed: true,
  confidence_score: 0.3
});

// 3. Navigate to result
navigation.navigate('PersonaResult');
```

## Navigation Integration

### RootNavigator Logic

```typescript
const determineInitialRoute = async () => {
  if (!session || !user) {
    setInitialRoute('Onboarding'); // Not logged in
  } else {
    // Check if setup completed
    const { data: persona } = await supabase
      .from('user_personas')
      .select('setup_completed')
      .eq('user_id', user.id)
      .single();

    if (persona?.setup_completed) {
      setInitialRoute('MainTabs'); // Go to app
    } else {
      setInitialRoute('Setup'); // Continue setup
    }
  }
};
```

**Flow**:
1. User signs up → Navigate to Setup
2. User completes setup → Navigate to PersonaResult → Navigate to MainApp
3. User logs in later → Check `setup_completed` → Skip to MainApp directly

### Preventing Direct Access

```typescript
// RootNavigator.tsx
<Stack.Navigator screenOptions={{ headerShown: false }}>
  {!session ? (
    <>
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Auth" component={AuthScreen} />
    </>
  ) : initialRoute === 'Setup' ? (
    <>
      <Stack.Screen name="Setup" component={SetupScreen} />
      <Stack.Screen name="PersonaResult" component={PersonaResultScreen} />
    </>
  ) : (
    <Stack.Screen name="MainTabs" component={MainTabNavigator} />
  )}
</Stack.Navigator>
```

**Protection**:
- Can't access MainApp without session
- Can't skip Setup if not completed
- Can't go back to Setup after completion

## Design Decisions

### Why Not Multi-Screen Setup?

**Alternative**: Separate screens for Name, Avatar, Questions

```typescript
// Could have done this:
<Stack.Screen name="NameInput" component={NameInputScreen} />
<Stack.Screen name="AvatarSelect" component={AvatarSelectScreen} />
<Stack.Screen name="Questions" component={QuestionsScreen} />
```

**Why single screen is better**:
- ✅ Single progress bar across all steps
- ✅ Simpler state management (no navigation params)
- ✅ Unified back button behavior
- ✅ Easier to add/remove steps
- ✅ Less boilerplate code

### Why Save All at End?

**Alternative**: Save each step to database as user progresses

**Why batch save is better**:
- ✅ Atomic transaction (all-or-nothing)
- ✅ Fewer database writes
- ✅ User can freely navigate back without data inconsistency
- ✅ No partial states in database
- ✅ Easier error handling

### Why 200ms Delay on Auto-Advance?

```typescript
setTimeout(() => setCurrentStep(prev => prev + 1), 200);
```

**Psychological UX**:
- User sees their selection highlight briefly
- Feels more intentional, less jarring
- Gives time for visual feedback animation
- 200ms is sweet spot (not too slow, not instant)

## Common Pitfalls

### ❌ Pitfall 1: Forgetting to Reset State

```typescript
// BAD: State persists if user logs out and logs in as different user
const [userName, setUserName] = useState('');
```

**Fix**: Reset state on navigation or user change:

```typescript
useEffect(() => {
  // Reset when component mounts
  setUserName('');
  setSelectedAvatarSeed('1');
  setAnswers({});
  setCurrentStep(-2);
}, []);
```

### ❌ Pitfall 2: Not Handling Loading State

```typescript
// BAD: No indication that save is in progress
const handleComplete = async () => {
  await saveToDatabase();
  navigation.navigate('PersonaResult');
};
```

**Fix**: Show loading indicator:

```typescript
const [isSubmitting, setIsSubmitting] = useState(false);

if (isSubmitting) {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" />
      <Text>Setting up your profile...</Text>
    </View>
  );
}
```

### ❌ Pitfall 3: Allowing Invalid Progression

```typescript
// BAD: User can advance without entering name
<Pressable onPress={() => setCurrentStep(-1)}>
  <Text>Continue</Text>
</Pressable>
```

**Fix**: Validate before advancing:

```typescript
const handleNameSubmit = () => {
  if (!userName.trim()) {
    alert('Please enter your name');
    return; // Don't advance
  }
  setCurrentStep(-1);
};
```

## Testing Checklist

- [ ] Signup → Setup flows correctly
- [ ] Name required before advancing
- [ ] Avatar selection auto-advances
- [ ] Questions auto-advance
- [ ] Progress bar updates correctly at each step
- [ ] Back button works (except on first step)
- [ ] Skip button only shows on questions
- [ ] Loading state shows during save
- [ ] Database saves all data atomically
- [ ] Navigation to PersonaResult works
- [ ] Logged-out users can't access Setup
- [ ] Completed users skip directly to MainApp

## Future Enhancements

1. **Local Storage**: Save progress to AsyncStorage for crash recovery
2. **Step Validation**: Add `canAdvance()` function per step
3. **Dynamic Steps**: Load questions from database
4. **Progress Persistence**: Resume from last step on app restart
5. **Animations**: Add slide transitions between steps
6. **Accessibility**: Add screen reader support for progress

## Related Documentation

- `avatar-pagination-system-design.md` - Avatar selection implementation
- `react-native-supabase-data-sync-pattern.md` - How data is loaded after setup

## Technology Context

- **Framework**: React Native (Expo 52)
- **Database**: Supabase (PostgreSQL)
- **Navigation**: React Navigation v7
- **TypeScript**: 5.6.3

## Key Takeaway

**Single-screen multi-step forms with state machine pattern** provide best UX for onboarding:
- Unified progress indication
- Simple state management
- Flexible navigation
- Atomic data persistence

The **negative index trick** elegantly handles pre-questionnaire steps without special cases.
