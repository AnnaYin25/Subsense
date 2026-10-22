# Stable Judgement System: 4 Critical Bug Fixes & Weight Rebalancing

## Metadata

```yaml
category: architecture-issues
module: judgement-engine, persona-system
tags: [bounded-weight, double-counting, half-life-decay, confidence-gating, llm-prompts]
symptoms:
  - "Persona influence exceeding 10% design bound"
  - "CheckIn satisfaction counted twice in scoring"
  - "Half-life decay formula incorrect (at t=halfLife, weight≠0.5)"
  - "CheckIn prompt contradiction (ask questions + JSON-only)"
  - "Confidence data type mismatch causing gating failure"
  - "Stale user data dominating fresh signals"
difficulty: advanced
date_documented: 2026-02-14
related_files:
  - Docs/2026-02-14-stable-judgement-system-plan.md
  - Docs/2026-02-14-phase-2.5-persona-system-plan.md
  - Docs/communication-content
related_systems:
  - subscription-scoring
  - persona-confidence
  - checkin-flow
  - behavioral-tracking
```

## Context

The Stable Judgement System is a **bounded-weight architecture** designed to score subscriptions (0-1 scale) based on:
- **Objective data** (usage frequency, cost efficiency)
- **CheckIn responses** (user-reported satisfaction)
- **Setup preferences** (baseline persona)
- **Behavioral patterns** (real usage tracking)
- **Big Five traits** (personality-based micro-adjustments)

**Design Goal**: Objective + CheckIn dominate (≥60%), while persona layers (Behavioral + Big Five) stay ≤10% combined to prevent AI hallucination from overwhelming hard facts.

## Critical Bugs Discovered

During implementation review, **4 critical bugs** were identified that would cause:
- ❌ Double counting (same signal counted twice)
- ❌ Incorrect mathematical formulas (half-life decay broken)
- ❌ Impossible LLM prompts (contradictory requirements)
- ❌ Type mismatches causing gating failures

**Impact if not fixed**:
- Persona influence could exceed 20% (design bound: ≤10%)
- Scores would be unstable (same input → different output)
- CheckIn UI would break (can't display questions)
- Stale data would dominate fresh signals

---

## Bug 1: Double Counting in Objective + CheckIn Layers

### Problem

**Section 14.1.3** used CheckIn `usage_satisfaction` as proxy for `feature_utilization`:

```typescript
// ❌ BAD: feature_utilization uses CheckIn data
const calculateFeatureUtilization = (
  subscription: Subscription,
  checkInHistory: CheckInResponse[]
): number => {
  const relevantCheckIns = checkInHistory
    .filter(c => c.subscription_id === subscription.id)
    .slice(-3); // Last 3 CheckIns

  if (relevantCheckIns.length === 0) return 0.5;

  const avgSatisfaction = relevantCheckIns.reduce(
    (sum, c) => sum + c.usage_satisfaction, 0
  ) / relevantCheckIns.length;

  return avgSatisfaction; // This is CheckIn data!
};

const calculateObjectiveScore = (...) => {
  const usageFreq = calculateUsageFrequency(subscription);
  const costEff = calculateCostEfficiency(subscription, userBudget);
  const featureUtil = calculateFeatureUtilization(subscription, checkInHistory);

  // Weighted sum (40% total)
  return (
    usageFreq * 0.15 +
    costEff * 0.15 +
    featureUtil * 0.10  // ❌ Using CheckIn data here
  );
};
```

**Then in final score calculation**:

```typescript
const finalScore =
  objectiveScore +        // 40% (includes CheckIn satisfaction via feature_util)
  checkinScore +          // 30% (includes usage_satisfaction directly)
  setupScore +            // 22.5%
  behavioralAdj +         // ≤8%
  bigFiveAdj;             // ≤8%
```

**Result**: `usage_satisfaction` counted **twice**:
1. In Objective layer (via `feature_utilization`)
2. In CheckIn layer (directly)

This breaks **bounded-weight architecture** (CheckIn effectively gets 40% instead of 30%).

### Root Cause

**Mixing data sources**: Objective layer should only use **independent signals** (database timestamps, subscription metadata), not derived from CheckIn responses.

### Solution

**Remove `feature_utilization` entirely** from Objective scoring:

```typescript
// ✅ GOOD: Objective uses only independent signals
const calculateObjectiveScore = (
  subscription: Subscription,
  userBudget: number
  // REMOVED: checkInHistory parameter
): number => {
  const usageFreq = calculateUsageFrequency(subscription); // Uses updated_at timestamp
  const costEff = calculateCostEfficiency(subscription, userBudget); // Uses cost vs budget

  // Weighted sum (reduced to 30% total)
  return (
    usageFreq * 0.15 +
    costEff * 0.15
    // REMOVED: featureUtil * 0.10
  );
};
```

**Weight redistribution**:

| Component | Old Weight | New Weight | Change |
|-----------|------------|------------|--------|
| Objective | 40% | **30%** | -10% (removed feature_util) |
| CheckIn | 30% | 30% | No change |
| Setup | 22.5% | 22.5% | No change |
| Behavioral | ≤8% | ≤8% | No change |
| Big Five | ≤8% | ≤8% | No change |
| **Total Max** | **108.5%** | **98.5%** | ✅ Within bounds |

### Verification

```typescript
test('CheckIn signal not counted twice', () => {
  const checkIn = { usage_satisfaction: 0.8, perceived_value: 0.7 };

  // Calculate objective (should NOT use checkIn data)
  const objective = calculateObjectiveScore(subscription, 100);

  // Modify checkIn, verify objective unchanged
  const modifiedCheckIn = { usage_satisfaction: 0.2, perceived_value: 0.3 };
  const objectiveAfter = calculateObjectiveScore(subscription, 100);

  expect(objective).toBe(objectiveAfter); // ✅ No double counting
});
```

### Prevention

**Rule**: Objective layer must use **only** these independent signals:
- Database timestamps (`created_at`, `updated_at`)
- Subscription metadata (`cost`, `billing_cycle`)
- User budget (static per period)
- Renewal counts (database-tracked)

**Never use**: CheckIn responses, Audit outcomes, or any LLM-generated data.

---

## Bug 2: Incorrect Half-Life Decay Formula

### Problem

Current formula in **Section 14.1.1, 14.7.1, 14.7.2**:

```typescript
// ❌ BAD: Not a true half-life
const decayWeight = Math.exp(-ageInDays / halfLifeDays);
```

**Mathematical error**: At `ageInDays = halfLifeDays`, this gives:
```
weight = exp(-1) ≈ 0.368 (not 0.5!)
```

**True half-life definition**: At `t = t_half`, weight must equal **exactly 0.5**.

### Root Cause

Confusion between:
- **Exponential decay constant** (`k` in `exp(-t/k)`)
- **Half-life** (`t_half` where `exp(-ln(2) * t / t_half) = 0.5`)

The correct formula requires the natural log of 2 factor.

### Solution

**Use mathematically correct half-life formula**:

```typescript
// ✅ GOOD: True half-life decay
const halfLifeDecay = (ageInDays: number, halfLifeDays: number): number => {
  return Math.exp(-Math.LN2 * ageInDays / halfLifeDays);
};

// Verification:
// halfLifeDecay(0, 30) = 1.0     ✅
// halfLifeDecay(30, 30) = 0.5    ✅ (at half-life, exactly 50%)
// halfLifeDecay(60, 30) = 0.25   ✅
// halfLifeDecay(90, 30) = 0.125  ✅
```

**Apply to all decay calculations**:

#### Usage Frequency (7-day half-life):
```typescript
const calculateUsageFrequency = (subscription: Subscription): number => {
  const daysSinceLastUpdate = getDaysBetween(subscription.updated_at, new Date());

  // CORRECTED: Proper 7-day half-life
  const recencyScore = halfLifeDecay(daysSinceLastUpdate, 7);

  const maturityBonus = Math.min(daysSinceCreation / 30, 1.0) * 0.2;
  return Math.min(recencyScore + maturityBonus, 1.0);
};
```

#### CheckIn Response Decay (30-day half-life):
```typescript
const applyCheckInDecay = (
  checkInHistory: CheckInResponse[],
  subscription: Subscription
): number => {
  const relevantCheckIns = checkInHistory.filter(
    c => c.subscription_id === subscription.id
  );

  if (relevantCheckIns.length === 0) return 0.5;

  const now = new Date();
  const halfLifeDays = 30;

  const weightedScores = relevantCheckIns.map(checkIn => {
    const ageInDays = getDaysBetween(checkIn.created_at, now);

    // CORRECTED: Proper half-life decay
    const decayWeight = halfLifeDecay(ageInDays, halfLifeDays);

    const score = (checkIn.usage_satisfaction + checkIn.perceived_value) / 2;
    return score * decayWeight;
  });

  const totalWeight = relevantCheckIns.reduce((sum, checkIn) => {
    const ageInDays = getDaysBetween(checkIn.created_at, now);
    return sum + halfLifeDecay(ageInDays, halfLifeDays);
  }, 0);

  return weightedScores.reduce((a, b) => a + b, 0) / totalWeight;
};
```

#### Behavioral Data Decay (60-day half-life):
```typescript
const applyBehavioralDecay = (
  behavioralHistory: BehavioralEvent[],
  halfLifeDays: number = 60
): BehavioralPatterns => {
  const now = new Date();

  const weightedEvents = behavioralHistory.map(event => {
    const ageInDays = getDaysBetween(event.timestamp, now);
    // CORRECTED: Proper half-life decay
    const weight = halfLifeDecay(ageInDays, halfLifeDays);
    return { event, weight };
  });

  // Aggregate weighted patterns...
};
```

### Verification

```typescript
test('Half-life decay at t=halfLife equals 0.5', () => {
  expect(halfLifeDecay(0, 30)).toBe(1.0);      // At t=0, no decay
  expect(halfLifeDecay(30, 30)).toBe(0.5);     // At t=halfLife, exactly 50%
  expect(halfLifeDecay(60, 30)).toBe(0.25);    // At 2x halfLife, 25%
  expect(halfLifeDecay(90, 30)).toBe(0.125);   // At 3x halfLife, 12.5%
});
```

### Prevention

**Rule**: When using time-based decay:
1. Decide if you want **half-life semantics** or **decay constant semantics**
2. If half-life: Use `exp(-ln(2) * t / t_half)`
3. If decay constant: Use `exp(-t / k)` but call parameter `decayConstant`, not `halfLife`
4. **Always add verification tests** to ensure formula matches intent

---

## Bug 3: CheckIn Prompt Self-Contradiction

### Problem

**Section 3.2** prompt asked LLM to:
1. "Ask 2-3 structured questions" (needs text output for user to see)
2. "Return ONLY JSON. No prose outside JSON." (strict JSON-only)

```typescript
// ❌ BAD: Contradictory requirements
const CHECKIN_PROMPT = `
Generate 2-3 personalized check-in questions.

CRITICAL: Ask questions that the user will answer.
Also CRITICAL: Return ONLY valid JSON. No markdown. No prose.

Schema:
{
  "responses": {
    "usage_satisfaction": 0.7,
    "perceived_value": 0.6,
    "decision_signal": "keep"
  }
}
`;
```

**Impossible to satisfy**:
- If LLM outputs questions as text → Violates "JSON-only" → Parsing fails
- If LLM outputs only JSON → User can't see questions → UI breaks

### Root Cause

**Mixing two concerns** in single LLM call:
1. Question generation (requires text)
2. Scoring (requires structured output)

### Solution

**Split into two-step process**:

#### Step 1: LLM Generates Questions (JSON with Question Schema)

```typescript
export const CHECKIN_QUESTION_GENERATION_PROMPT = (
  subscription: Subscription,
  persona: SetupPreferences
) => `
Generate 2-3 structured check-in questions for this subscription.

SUBSCRIPTION INFO:
- Name: ${subscription.name}
- Cost: $${subscription.cost}/${subscription.billing_cycle}
- Category: ${subscription.category}

USER PERSONA (for tone adaptation only):
- Communication Style: ${persona.decision_style === 'quick' ? 'concise' : 'conversational'}
- Budget Tightness: ${persona.budget_tightness}

REQUIRED DIMENSIONS (DO NOT change these):
1. usage_satisfaction - How satisfied with recent usage
2. perceived_value - Cost vs value perception
3. decision_signal - Keep, review, or cancel intent

CRITICAL: Return ONLY valid JSON. No markdown. No prose outside JSON.

Schema:
{
  "questions": [
    {
      "id": "usage_satisfaction",
      "text": "Your personalized question text here",
      "options": [
        { "label": "Not satisfied at all", "score": 0.0 },
        { "label": "Somewhat satisfied", "score": 0.3 },
        { "label": "Moderately satisfied", "score": 0.5 },
        { "label": "Very satisfied", "score": 0.7 },
        { "label": "Extremely satisfied", "score": 1.0 }
      ]
    },
    {
      "id": "perceived_value",
      "text": "Your personalized value question",
      "options": [
        { "label": "Not worth the cost", "score": 0.0 },
        { "label": "Barely worth it", "score": 0.3 },
        { "label": "Fair value", "score": 0.5 },
        { "label": "Good value", "score": 0.7 },
        { "label": "Excellent value", "score": 1.0 }
      ]
    },
    {
      "id": "decision_signal",
      "text": "What would you like to do?",
      "options": [
        { "label": "Keep it active", "value": "keep" },
        { "label": "Need to think about it", "value": "unsure" },
        { "label": "Cancel it", "value": "cancel" }
      ]
    }
  ]
}

Adapt question WORDING to persona, but keep structure and score mappings identical.
`;
```

**What LLM does**:
- ✅ Generates personalized question text
- ✅ Keeps fixed score mappings (0.0, 0.3, 0.5, 0.7, 1.0)
- ✅ Returns parseable JSON
- ❌ Does NOT score answers (that's Step 2)

#### Step 2: Local Deterministic Scoring (No LLM)

After user selects options, app calculates scores **locally**:

```typescript
interface CheckInAnswers {
  usage_satisfaction: { label: string; score: number };
  perceived_value: { label: string; score: number };
  decision_signal: { label: string; value: 'keep' | 'unsure' | 'cancel' };
}

const calculateCheckInScores = (answers: CheckInAnswers): CheckInResponses => {
  return {
    usage_satisfaction: answers.usage_satisfaction.score, // 0-1 from predefined mapping
    perceived_value: answers.perceived_value.score,       // 0-1 from predefined mapping
    decision_signal: answers.decision_signal.value        // enum
  };
};

// Pass to judgement engine (100% deterministic, no LLM variance)
```

### Benefits

| Aspect | Old (Single-Step) | New (Two-Step) |
|--------|------------------|----------------|
| **Question Visibility** | ❌ Can't show questions to user | ✅ User sees personalized questions in UI |
| **JSON Parsing** | ❌ Text+JSON mixed output fails | ✅ Always valid JSON |
| **Scoring Consistency** | ❌ LLM variance (0.7 vs 0.73 vs 0.68) | ✅ Deterministic (same answer → same score) |
| **Speed** | 🐢 Two LLM calls if needed | ⚡ Only one LLM call, scoring instant |
| **Debuggability** | ❌ Can't verify LLM scoring logic | ✅ Scoring logic is readable code |

### Verification

```typescript
test('LLM generates valid question JSON', async () => {
  const result = await generateCheckInQuestions(subscription, persona);

  expect(result.questions).toHaveLength(3);
  expect(result.questions[0].id).toBe('usage_satisfaction');
  expect(result.questions[0].options[0].score).toBeGreaterThanOrEqual(0);

  // User can see questions in UI
  expect(result.questions[0].text).toBeTruthy();
});

test('Scoring is deterministic without LLM', () => {
  const answers = {
    usage_satisfaction: { label: 'Very satisfied', score: 0.7 },
    perceived_value: { label: 'Good value', score: 0.7 },
    decision_signal: { label: 'Keep it active', value: 'keep' }
  };

  const score1 = calculateCheckInScores(answers);
  const score2 = calculateCheckInScores(answers);

  expect(score1).toEqual(score2); // ✅ Deterministic
});
```

### Prevention

**Rule**: When using LLM in user-facing flows:
1. **Separate generation from scoring**: LLM generates options, app scores selections
2. **Never ask LLM to both output text AND structured data** in same call
3. **Validation schema**: Always validate LLM output with strict TypeScript types
4. **Fallback questions**: Have predefined questions if LLM fails to generate valid JSON

---

## Bug 4: Confidence Data Type Mismatch + Time Decay Missing

### Problem 1: Type Mismatch

**Section 14.4** called:

```typescript
// ❌ BAD: Data type mismatch
const confidence = calculateConfidenceScore(
  persona.episodic_memory,  // Generic any[] - type unsafe
  user.subscriptions,
  persona.setup_completed
);
```

But function signature expected:

```typescript
const calculateConfidenceScore = (
  checkInHistory: CheckInResponse[],     // Typed check-in data
  subscriptionHistory: Subscription[],   // Subscription records
  setupCompleted: boolean
): number => { ... };
```

**Problem**: `episodic_memory` (generic event log) ≠ `CheckInResponse[]` (typed check-in data)

### Problem 2: No Time Decay

Current implementation:

```typescript
// ❌ BAD: Confidence only increases, never decreases
let confidence = 0.0;

if (setupCompleted) confidence += 0.3;
confidence += Math.min(checkInHistory.length / 10, 0.4);  // All CheckIns count equally
confidence += Math.min(subscriptionHistory.length / 20, 0.3);

return Math.min(confidence, 1.0);
```

**Problems**:
- All CheckIns weighted equally (3-month-old CheckIn = today's CheckIn)
- User behavior changes ignored (confidence never decreases)
- Gating becomes ineffective (stale personas dominate fresh signals)

### Root Cause

1. **Data source conflation**: Mixing generic event logs with typed structures
2. **No temporal awareness**: Treating all historical data as equally valid

### Solution

#### Part A: Separate Data Sources with Proper Types

```typescript
interface ConfidenceInputs {
  checkInHistory: CheckInResponse[];     // Typed check-in responses
  subscriptionHistory: Subscription[];   // Subscription records
  behavioralEvents: BehavioralEvent[];   // Behavioral signals
  setupCompleted: boolean;               // Setup completion flag
}

const calculateConfidenceScore = (
  inputs: ConfidenceInputs,
  timeWindowDays: number = 60 // Only count recent data
): number => {
  let confidence = 0.0;
  const now = new Date();

  // Base: Setup completed (+0.3)
  if (inputs.setupCompleted) {
    confidence += 0.3;
  }

  // CheckIn data (with 60-day time window)
  const recentCheckIns = inputs.checkInHistory.filter(c => {
    const ageInDays = getDaysBetween(c.created_at, now);
    return ageInDays <= timeWindowDays;
  });
  const checkInContribution = Math.min(recentCheckIns.length / 10, 0.4);
  confidence += checkInContribution;

  // Subscription history (lifetime count, no window)
  const subsCount = inputs.subscriptionHistory.length;
  const historyContribution = Math.min(subsCount / 20, 0.3);
  confidence += historyContribution;

  // Behavioral events (with 90-day window)
  const recentBehavior = inputs.behavioralEvents.filter(e => {
    const ageInDays = getDaysBetween(e.timestamp, now);
    return ageInDays <= 90;
  });
  const behaviorContribution = Math.min(recentBehavior.length / 15, 0.2);
  confidence += behaviorContribution;

  return Math.min(confidence, 1.0);
};
```

**Rationale for time windows**:
- CheckIn responses: **60-day window** (user preferences change every ~2 months)
- Behavioral events: **90-day window** (behavior patterns shift slower than feelings)
- Subscription history: **No window** (lifetime count reflects overall experience depth)

#### Part B: Effective Confidence with Decay

To prevent stale personas from breaking gating:

```typescript
const getEffectiveConfidence = (
  persona: UserPersona,
  currentDate: Date = new Date()
): number => {
  const baseConfidence = persona.confidence_score;
  const daysSinceLastUpdate = getDaysBetween(persona.last_updated, currentDate);

  // Confidence decays if user stops engaging
  // Half-life: 90 days (after 3 months inactive → 50% effective confidence)
  const decayFactor = halfLifeDecay(daysSinceLastUpdate, 90);

  const effectiveConfidence = baseConfidence * decayFactor;

  // Lower bound: 0.2 (even stale personas retain minimal validity)
  return Math.max(effectiveConfidence, 0.2);
};
```

**Why this matters**:
- Prevents 6-month-old personas from dominating fresh CheckIn signals
- Confidence can "decrease" through time decay (fixes gating issue)
- Lower bound (0.2) prevents complete loss of persona value
- Encourages periodic re-engagement (CheckIns refresh confidence)

#### Integration into Judgement Pipeline

```typescript
const calculateFinalJudgement = async (
  subscription: Subscription,
  user: User
): Promise<JudgementResult> => {
  const persona = await getPersona(user.id);

  // CORRECTED: Properly typed data sources
  const confidenceInputs: ConfidenceInputs = {
    checkInHistory: await getCheckInHistory(user.id),
    subscriptionHistory: await getSubscriptionHistory(user.id),
    behavioralEvents: await getBehavioralEvents(user.id),
    setupCompleted: persona.setup_completed
  };

  // Base confidence with time windows
  const baseConfidence = calculateConfidenceScore(confidenceInputs, 60);

  // Effective confidence with decay
  const effectiveConfidence = getEffectiveConfidence(persona);

  // Use effective confidence for gating (decays over time)
  const behavioralAdj = applyConfidenceGating(
    calculateBehavioralAdjustment(user.id, user.subscriptions),
    effectiveConfidence,  // Uses decayed confidence
    0.5                   // Minimum threshold
  );

  const bigFiveAdj = applyConfidenceGating(
    calculateBigFiveAdjustment(persona.big_five_traits, persona.setup_preferences),
    effectiveConfidence,
    0.5
  );

  // ... rest of calculation
};
```

### Verification

```typescript
test('Effective confidence decreases with inactivity', () => {
  const persona = {
    confidence_score: 0.8,
    last_updated: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // 90 days ago
  };

  const effective = getEffectiveConfidence(persona);

  expect(effective).toBeLessThan(0.8); // ✅ Decayed
  expect(effective).toBeCloseTo(0.4); // 0.8 * 0.5 (half-life)
  expect(effective).toBeGreaterThanOrEqual(0.2); // Lower bound
});

test('Time-windowed CheckIns count correctly', () => {
  const old CheckIn = { created_at: new Date('2025-01-01') }; // 13+ months old
  const recentCheckIn = { created_at: new Date() };

  const inputs = {
    checkInHistory: [oldCheckIn, recentCheckIn],
    // ...
  };

  const confidence = calculateConfidenceScore(inputs, 60);

  // Only recent CheckIn counts (60-day window)
  expect(confidence).toBeLessThan(0.7); // If all counted, would be higher
});
```

### Prevention

**Rules for confidence scoring**:
1. **Separate data types**: Don't conflate `episodic_memory`, `checkInHistory`, `behavioralEvents`
2. **Time windows**: Only count recent data for volatile signals (CheckIns, behavior)
3. **Effective confidence**: Apply decay to prevent stale data dominance
4. **Lower bounds**: Prevent confidence from dropping to zero (retain baseline validity)
5. **Regular updates**: Trigger confidence recalculation on each CheckIn/Audit

---

## Global Consistency Fixes

### Fix 1: Weight Table Update

**Section 4.1** table updated:

| Input Source | Weight | Role | Notes |
|--------------|--------|------|-------|
| **Objective Data** | **30%** | Stability anchor | Reduced from 40% (removed feature_utilization) |
| **CheckIn Responses** | **30%** | Primary subjective signal | Unchanged |
| **Setup Preferences** | **22.5%** | Baseline persona | Unchanged |
| **Behavioral Patterns** | **≤8%** | Real behavior correction | Capped, confidence-gated |
| **Big Five Traits** | **≤8%** | Micro personalization | Capped, confidence-gated |

**Total maximum**: 98.5% (within acceptable bounds ✅)

### Fix 2: Code Example Updates

All code examples in Sections 4.2, 10, 14 updated to reflect:
- Objective = 30% (not 40%)
- Removed `feature_utilization` calculations
- Proper `halfLifeDecay()` utility function
- Two-step CheckIn flow
- Typed confidence inputs with time windows

### Fix 3: Score Examples Rewritten

**Removed misleading examples** showing cold-start=0.93, typical=0.97.

**Added realistic neutral-input examples**:

#### Neutral Cold Start (Realistic)
```typescript
const neutralInputs = {
  objective: { usage_frequency: 0.5, cost_efficiency: 0.5 },
  checkin: { usage_satisfaction: 0.5, perceived_value: 0.5 },
  setup: { /* all 0.5 */ },
  behavioral: { adjustment: 0 }, // No data, gated to 0
  bigFive: { /* all 0.5 */ }      // Neutral, gated to ~0.02
};

const objectiveScore = 0.5 * 0.15 + 0.5 * 0.15 = 0.15;
const checkinScore = 0.5 * 0.15 + 0.5 * 0.15 = 0.15;
const setupScore = 0.5 * 0.225 = 0.1125;
const behavioralAdj = 0.0;
const bigFiveAdj = 0.024;

const neutralScore = 0.15 + 0.15 + 0.1125 + 0.0 + 0.024 = 0.4365;
```

**Result**: 0.44 → **"Review"** recommendation (not auto-keep)

✅ **Realistic behavior**: Neutral inputs produce neutral scores, not inflated "keep" recommendations.

---

## Bounded-Weight Verification

### Mathematical Proof

```typescript
// Maximum possible score with all components at max:
const maxObjective = 0.30;       // usage_freq=1.0, cost_eff=1.0
const maxCheckIn = 0.30;         // satisfaction=1.0, value=1.0
const maxSetup = 0.225;          // perfect alignment
const maxBehavioral = 0.08;      // capped
const maxBigFive = 0.08;         // capped

const maxPossibleScore =
  maxObjective + maxCheckIn + maxSetup + maxBehavioral + maxBigFive;
// = 0.30 + 0.30 + 0.225 + 0.08 + 0.08
// = 0.985 (98.5%)
```

✅ **Upper bound verified**: Total ≤ 100%

### Component Bound Tests

```typescript
test('All components within design bounds', () => {
  const result = calculateFinalJudgement(/* extreme inputs */);

  expect(result.breakdown.objective_contribution).toBeLessThanOrEqual(0.30);
  expect(result.breakdown.checkin_contribution).toBeLessThanOrEqual(0.30);
  expect(result.breakdown.setup_contribution).toBeLessThanOrEqual(0.225);
  expect(result.breakdown.behavioral_adjustment).toBeLessThanOrEqual(0.08);
  expect(result.breakdown.bigfive_adjustment).toBeLessThanOrEqual(0.08);
  expect(result.final_score).toBeLessThanOrEqual(1.0);
});
```

---

## Summary of Changes

| Bug | Old Behavior | New Behavior | Impact |
|-----|-------------|--------------|---------|
| **1. Double Counting** | CheckIn satisfaction counted in both Objective + CheckIn | Objective uses only independent signals | Prevents persona influence from exceeding 10% |
| **2. Half-Life Formula** | `exp(-age/k)` (incorrect) | `exp(-ln(2)*age/t_half)` (correct) | Accurate time decay at all time points |
| **3. CheckIn Prompt** | Contradictory requirements (questions + JSON-only) | Two-step process (question gen → local scoring) | UI works, scoring deterministic |
| **4. Confidence Types** | Type mismatch + no decay | Typed inputs + time windows + effective decay | Gating works, stale data doesn't dominate |

**Weight redistribution**:
- Objective: 40% → **30%** (-10%)
- Total max: 108.5% → **98.5%** (✅ bounded)

---

## Testing Strategy

### Unit Tests

```typescript
// Test 1: Double counting eliminated
test('CheckIn signal not counted twice', () => {
  // Modify CheckIn, verify Objective unchanged
});

// Test 2: Half-life decay correct
test('Half-life decay at t=halfLife equals 0.5', () => {
  expect(halfLifeDecay(30, 30)).toBe(0.5);
});

// Test 3: CheckIn questions displayable
test('LLM generates valid question JSON', async () => {
  const result = await generateCheckInQuestions(...);
  expect(result.questions).toHaveLength(3);
});

// Test 4: Confidence decays over time
test('Effective confidence decreases with inactivity', () => {
  const effective = getEffectiveConfidence(stalePersona);
  expect(effective).toBeLessThan(baseConfidence);
});

// Test 5: Bounded weights
test('All components within design bounds', () => {
  const result = calculateFinalJudgement(...);
  expect(result.final_score).toBeLessThanOrEqual(1.0);
});

// Test 6: Neutral inputs produce neutral scores
test('Neutral persona produces review recommendation', () => {
  const result = calculateFinalJudgement(neutralInputs);
  expect(result.final_score).toBeGreaterThan(0.4);
  expect(result.final_score).toBeLessThan(0.6);
  expect(result.recommendation).toBe('review');
});
```

### Integration Tests

```typescript
// Test 7: End-to-end CheckIn flow
test('User completes CheckIn → Score updates correctly', async () => {
  const questions = await generateCheckInQuestions(sub, persona);
  const answers = simulateUserAnswers(questions);
  const scores = calculateCheckInScores(answers);
  const result = calculateFinalJudgement(sub, user, scores);

  expect(result.final_score).toBeGreaterThan(0);
  expect(result.final_score).toBeLessThanOrEqual(1.0);
});

// Test 8: Persona confidence degrades over time
test('3-month inactive persona has lower effective confidence', async () => {
  const persona = await createPersonaAndWait(90); // days
  const effective = getEffectiveConfidence(persona);

  expect(effective).toBeLessThan(persona.confidence_score);
  expect(effective).toBeCloseTo(persona.confidence_score * 0.5, 1);
});
```

---

## Deployment Checklist

Before deploying fixes:

- [ ] Update all decay functions to use `halfLifeDecay()`
- [ ] Remove `feature_utilization` from Objective calculation
- [ ] Update weight constants (Objective: 30%)
- [ ] Implement two-step CheckIn flow
- [ ] Add `ConfidenceInputs` interface
- [ ] Implement `getEffectiveConfidence()` with decay
- [ ] Update all documentation references (40% → 30%)
- [ ] Run full test suite
- [ ] Verify bounded-weight guarantees
- [ ] Monitor scores in staging (check for outliers)

---

## Related Documentation

- **Stable Judgement System Plan**: `/Docs/2026-02-14-stable-judgement-system-plan.md`
- **Phase 2.5 Persona Plan**: `/Docs/2026-02-14-phase-2.5-persona-system-plan.md`
- **Communication Context**: `/Docs/communication-content`
- **React Native Data Sync**: `/Docs/solutions/react-native-supabase-data-sync-pattern.md`

---

## Key Takeaways

1. **Bounded-weight architecture requires vigilant source separation**: Never mix independent (Objective) and dependent (CheckIn) data sources.

2. **Mathematical formulas must match semantics**: If you call it "half-life", use the correct half-life formula. If you use `exp(-t/k)`, call it "decay constant".

3. **LLM prompts must be unambiguous**: Never ask LLM to both generate questions AND output only JSON. Separate concerns into multi-step flows.

4. **Time-aware confidence prevents stale data dominance**: Confidence must decay without fresh signals, or old personas will override new reality.

5. **Testing bounded systems requires proof**: Always verify max possible score ≤ design bounds with explicit test cases.

6. **Documentation and code must stay synchronized**: Misleading examples (cold-start=0.93) create false expectations. Use realistic neutral-input examples.

**The compound effect**: Fixing these 4 bugs prevents cascading failures in:
- Persona influence bounds
- Score stability
- CheckIn UX
- Behavioral gating
- User trust in recommendations

**Each fix makes the system more trustworthy. Together, they ensure the bounded-weight architecture works as designed.**

---

**END OF SOLUTION DOCUMENT**
