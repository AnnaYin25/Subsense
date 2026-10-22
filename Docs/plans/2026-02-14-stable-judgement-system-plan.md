---
title: Stable Persona-Driven AI Judgement System
type: architecture
date: 2026-02-14
---

# Stable Persona-Driven AI Judgement System

## 0. Core Product Definition

**This is NOT a personality test app.**

**This is an AI-assisted subscription judgement system.**

**Primary Goal**: Deliver personalized, explainable, and stable "worth it or not" decisions for subscription review.

**Key Principle**: Persona should ENHANCE judgement, not replace structured decision logic.

---

## 1. System Philosophy

### 1.1 Persona = Decision Preference Model (Not Psychological Profile)

Persona models **decision preferences**, NOT personality labels:
- Budget tightness
- Price sensitivity
- Waste tolerance
- Exploration tendency
- Quality preference
- Decision style (quick vs deliberate)

Big Five, behavioral patterns, and memory are **secondary adjustment layers**.

### 1.2 Hybrid Intelligence Architecture (CRITICAL)

Final judgement MUST be based on:
✅ Objective signals (usage, cost, frequency)
✅ Structured user preferences
✅ CheckIn responses
✅ Bounded persona adjustments

❌ NOT pure LLM free-form reasoning

---

## 2. Setup Question Bank (Cold Start Persona)

### 2.1 Setup Scope

- **Maximum**: 4–6 questions
- **Target time**: < 2 minutes
- **Skippable but recommended**
- **Goal**: Initialize decision preference weights (NOT fully understand user)

### 2.2 Core Setup Dimensions (Structured Mapping REQUIRED)

Each answer MUST map to **numeric values (0–1 scale)**.

**Required parameters:**
```typescript
interface SetupPreferences {
  budget_tightness: number;      // 0.0-1.0
  price_sensitivity: number;     // 0.0-1.0
  waste_tolerance: number;       // 0.0-1.0
  exploration_tendency: number;  // 0.0-1.0
  quality_preference: number;    // 0.0-1.0
  decision_style: 'quick' | 'moderate' | 'deliberate';
}
```

**Example mapping:**
```typescript
// Question: "How do you feel about unused subscriptions?"
const QUESTION_MAPPING = {
  "option_a": { waste_tolerance: 0.2, budget_tightness: 0.8 },
  "option_b": { waste_tolerance: 0.5, budget_tightness: 0.5 },
  "option_c": { waste_tolerance: 0.8, budget_tightness: 0.2 }
};
// NO free-text interpretation allowed
```

### 2.3 Persona is Dynamic (Not Static)

Persona refined through:
1. **CheckIn responses** (primary)
2. **Behavioral data** (secondary)
3. **Memory/context** (minor)
4. **Confidence score gating**

---

## 3. CheckIn Review System (2–3 Questions Per Subscription)

### 3.1 Fixed Structural Framework (MANDATORY)

Every CheckIn MUST include **2–3 structured questions**:

#### Q1: Usage / Experience Dimension
**Purpose**: Capture real engagement and satisfaction
**Output**: `usage_satisfaction` (0–1)

Example:
```
"How satisfied were you with your usage of [Service] recently?"
Options:
- Not at all (0.0)
- Somewhat (0.3)
- Moderately (0.5)
- Very (0.7)
- Extremely (1.0)
```

#### Q2: Value Perception Dimension
**Purpose**: Capture subjective cost-value alignment
**Output**: `perceived_value` (0–1)

Example:
```
"Considering the cost, does [Service] feel worth it to you?"
Options:
- Not worth it (0.0)
- Barely worth it (0.3)
- Fair value (0.5)
- Good value (0.7)
- Excellent value (1.0)
```

#### Q3: Action Intention Dimension (Recommended)
**Purpose**: Capture decision leaning
**Output**: `decision_signal` (enum)

Options:
- `keep` - Want to continue
- `unsure` - Need to think
- `cancel` - Ready to stop

### 3.2 Question Generation Rules for LLM (TWO-STEP PROCESS)

**CRITICAL CHANGE**: Separate question generation from scoring to ensure:
1. ✅ User can see and answer questions (UI requirement)
2. ✅ LLM output remains valid JSON (parsing requirement)
3. ✅ Scoring is deterministic and stable (consistency requirement)

#### Step 1: LLM Generates Questions (JSON Output Only)

Claude should:
✅ Generate 2-3 structured questions with predefined options
✅ Adapt question wording to persona tone (communication style)
✅ Stay within fixed evaluation dimensions (usage/value/decision)
✅ Return valid JSON matching strict schema

❌ NOT provide scores directly (scoring happens in Step 2)
❌ NOT ask open-ended questions outside dimensions
❌ NOT include prose outside JSON structure

**Prompt Template**:
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
- Last Renewal: ${subscription.next_renewal_date}

USER PERSONA (for tone adaptation only):
- Communication Style: ${persona.decision_style === 'quick' ? 'concise' : 'conversational'}
- Budget Tightness: ${persona.budget_tightness}
- Waste Tolerance: ${persona.waste_tolerance}

REQUIRED DIMENSIONS (DO NOT change these):
1. usage_satisfaction - How satisfied with recent usage/engagement
2. perceived_value - Cost vs value alignment perception
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
      "text": "What would you like to do with this subscription?",
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

#### Step 2: Local Deterministic Scoring (No LLM)

After user selects options, app calculates scores locally:

```typescript
interface CheckInAnswers {
  usage_satisfaction: { label: string; score: number };
  perceived_value: { label: string; score: number };
  decision_signal: { label: string; value: 'keep' | 'unsure' | 'cancel' };
}

const calculateCheckInScores = (answers: CheckInAnswers): CheckInResponses => {
  return {
    usage_satisfaction: answers.usage_satisfaction.score, // 0-1
    perceived_value: answers.perceived_value.score,       // 0-1
    decision_signal: answers.decision_signal.value        // enum
  };
};
```

**Benefits of Two-Step Approach**:
- ✅ User sees personalized questions in UI
- ✅ LLM output is always parseable JSON
- ✅ Scoring is 100% deterministic (no LLM variance)
- ✅ Faster (no second LLM call for scoring)
- ✅ Consistent across users (same answer → same score)

---

## 4. Bounded Weight Architecture (CRITICAL FOR STABILITY)

### 4.1 Final Score Composition (Deterministic Structure)

| Input Source | Weight | Role | Notes |
|--------------|--------|------|-------|
| **Objective Data** (usage, cost) | **30%** | Stability anchor | Reduced from 40% (removed feature_utilization) |
| **CheckIn Responses** | **30%** | Primary subjective signal | Unchanged |
| **Setup Preferences** | **22.5%** | Baseline persona | Unchanged |
| **Behavioral Patterns** | **≤8%** | Real behavior correction | Capped, confidence-gated |
| **Big Five Traits** | **≤8%** | Micro personalization only | Capped, confidence-gated |

**Total maximum**: 98.5% (within acceptable bounds)

**CRITICAL**: Objective and CheckIn layers must remain **independent** to prevent double-counting.

### 4.2 Capped Influence Rule (Mandatory)

All soft signals must be bounded:
- Big Five adjustment: **≤ 0.08**
- Behavioral adjustment: **≤ 0.08**
- Memory/context: **≤ 0.05**

**Hard rule**: Soft layers **cannot override** objective + check-in signals.

**Implementation:**
```typescript
const calculateFinalScore = (
  objective: ObjectiveData,
  checkin: CheckInResponses,
  setup: SetupPreferences,
  behavioral: BehavioralPatterns,
  bigFive: BigFiveTraits
): number => {
  // Base score from objective data (30% - REDUCED from 40%)
  const objectiveScore = (
    objective.usage_frequency * 0.15 +
    objective.cost_efficiency * 0.15
    // REMOVED: objective.feature_utilization * 0.10
  );

  // CheckIn contribution (30% - unchanged)
  const checkinScore = (
    checkin.usage_satisfaction * 0.15 +
    checkin.perceived_value * 0.15
  );

  // Setup preferences contribution (22.5% - unchanged)
  const setupScore = calculateSetupContribution(setup) * 0.225;

  // Behavioral adjustment (CAPPED at 8%)
  const behavioralAdj = Math.min(
    calculateBehavioralAdjustment(behavioral),
    0.08
  );

  // Big Five adjustment (CAPPED at 8%)
  const bigFiveAdj = Math.min(
    calculateBigFiveAdjustment(bigFive, setup),
    0.08
  );

  // Final score with bounded adjustments
  const finalScore = Math.max(0, Math.min(1,
    objectiveScore + checkinScore + setupScore + behavioralAdj + bigFiveAdj
  ));

  return finalScore;
};
```

### 4.3 Weight Verification and Realistic Score Examples

#### Upper Bound Proof (Edge Case)

Maximum possible score with all components at maximum:

```typescript
const maxPossibleScore =
  0.30 +   // Objective (max: both usage_freq and cost_eff at 1.0)
  0.30 +   // CheckIn (max: both satisfaction and value at 1.0)
  0.225 +  // Setup (max: perfect alignment)
  0.08 +   // Behavioral (max cap)
  0.08;    // Big Five (max cap)
// = 0.985 (98.5%)
```

✅ **Upper bound verified**: Total ≤ 100%

#### Neutral Input Example (Realistic Cold Start)

New user, neutral persona (all 0.5), mediocre subscription:

**Inputs**:
- Objective: usage_freq=0.5, cost_eff=0.5
- CheckIn: satisfaction=0.5, value=0.5
- Setup: all preferences=0.5 (neutral)
- Behavioral: 0 (no data, confidence-gated to 0)
- Big Five: all traits=0.5 (neutral, gated to ~0.02)
- Confidence: 0.3 (setup only, low data)

**Calculation**:
```typescript
const objectiveScore = 0.5 * 0.15 + 0.5 * 0.15 = 0.15;
const checkinScore = 0.5 * 0.15 + 0.5 * 0.15 = 0.15;
const setupScore = 0.5 * 0.225 = 0.1125;
const behavioralAdj = 0.0 * (0.3 / 0.5) = 0.0; // Gated to zero
const bigFiveAdj = 0.04 * (0.3 / 0.5) = 0.024; // Small adjustment

const neutralScore = 0.15 + 0.15 + 0.1125 + 0.0 + 0.024 = 0.4365;
```

**Result**: 0.44 → **"Review"** recommendation (not auto-keep)

✅ **Realistic behavior**: Neutral inputs produce neutral scores, not inflated "keep" recommendations.

#### Established User Example (High Confidence)

User with 10 CheckIns, clear preferences, good subscription fit:

**Inputs**:
- Objective: usage_freq=0.7, cost_eff=0.8
- CheckIn: satisfaction=0.8, value=0.7
- Setup: quality_pref=0.9, waste_tolerance=0.3 (cautious user)
- Behavioral: matches setup (small +0.02 adjustment)
- Big Five: conscientiousness=0.7 (slight +0.03 adjustment)
- Confidence: 0.8 (established user)

**Calculation**:
```typescript
const objectiveScore = 0.7 * 0.15 + 0.8 * 0.15 = 0.225;
const checkinScore = 0.8 * 0.15 + 0.7 * 0.15 = 0.225;
const setupScore = 0.85 * 0.225 = 0.191; // High alignment
const behavioralAdj = 0.02; // Small positive
const bigFiveAdj = 0.03; // Small positive

const establishedScore = 0.225 + 0.225 + 0.191 + 0.02 + 0.03 = 0.691;
```

**Result**: 0.69 → **"Keep"** recommendation (just below 0.7 threshold)

✅ **Realistic behavior**: Good fit produces high score, but not artificially inflated.

#### Summary of Score Ranges

| Scenario | Score Range | Recommendation | Notes |
|----------|-------------|----------------|-------|
| Neutral cold start | 0.40 - 0.50 | Review | Default for new users, mediocre fit |
| Poor fit | 0.20 - 0.40 | Cancel | Low usage, high cost, misaligned preferences |
| Moderate fit | 0.50 - 0.70 | Review/Keep border | Depends on confidence and recent signals |
| Good fit | 0.70 - 0.85 | Keep | High satisfaction, good value, aligned preferences |
| Excellent fit | 0.85 - 0.98 | Keep | Rare, requires near-perfect alignment across all signals |

**Key Insight**: Most subscriptions will score in the 0.4-0.7 range, NOT clustered at 0.9+. This prevents auto-keep bias and surfaces genuine review opportunities.

---

## 5. Big Five Integration Strategy (5–8% Controlled)

### 5.1 Allowed Influence Areas

Big Five should ONLY influence:
- **Micro-adjustment** of preference priors (±0.05 max)
- **Question tone** personalization
- **Explanation style**

❌ NOT direct decision override

### 5.2 Example Trait Mapping (Micro Adjustment Only)

```typescript
const applyBigFiveAdjustment = (
  basePreferences: SetupPreferences,
  bigFive: BigFiveTraits
): SetupPreferences => {
  return {
    ...basePreferences,
    exploration_tendency: Math.max(0, Math.min(1,
      basePreferences.exploration_tendency + (bigFive.openness - 0.5) * 0.1
    )),
    waste_tolerance: Math.max(0, Math.min(1,
      basePreferences.waste_tolerance - (bigFive.conscientiousness - 0.5) * 0.1
    )),
    budget_tightness: Math.max(0, Math.min(1,
      basePreferences.budget_tightness + (bigFive.neuroticism - 0.5) * 0.1
    ))
    // Agreeableness → softer recommendation tone (not numeric)
    // Extraversion → minimal impact on subscription judgement
  };
};
```

**All adjustments must be small and capped.**

---

## 6. JSON Output Stability (Engineering Requirement)

### 6.1 Strict JSON Schema (No Prose Outside JSON)

LLM MUST always return:
```json
{
  "review_scores": {
    "usage_satisfaction": 0.7,
    "perceived_value": 0.6,
    "decision_signal": "keep"
  },
  "confidence": 0.85,
  "explanation": {
    "usage_insight": "Moderate usage detected",
    "preference_alignment": "Aligns with quality preference",
    "final_judgement": "Good value match"
  }
}
```

**Rules:**
- ✅ Only valid JSON
- ❌ No additional text
- ❌ No undefined fields
- ✅ Numeric values must be 0–1
- ✅ `decision_signal` must be enum (`keep` | `unsure` | `cancel`)

### 6.2 Prompt Enforcement Pattern

System prompt MUST include:
```
CRITICAL: Return ONLY valid JSON. No markdown, no prose.

Schema:
{
  "review_scores": {
    "usage_satisfaction": number (0-1),
    "perceived_value": number (0-1),
    "decision_signal": "keep" | "unsure" | "cancel"
  },
  "confidence": number (0-1),
  "explanation": {
    "usage_insight": string (max 50 chars),
    "preference_alignment": string (max 50 chars),
    "final_judgement": string (max 50 chars)
  }
}
```

### 6.3 Parsing Fallback (Anti-Crash Requirement)

If JSON parsing fails:
```typescript
const FALLBACK_RESPONSE = {
  review_scores: {
    usage_satisfaction: 0.5,
    perceived_value: 0.5,
    decision_signal: 'unsure'
  },
  confidence: 0.3,
  explanation: {
    usage_insight: "Unable to analyze",
    preference_alignment: "Insufficient data",
    final_judgement: "Requires manual review"
  }
};

try {
  const parsed = JSON.parse(claudeResponse);
  validateSchema(parsed); // Throws if invalid
  return parsed;
} catch (error) {
  console.error('Claude JSON parse failed:', error);
  logErrorForDebugging(error, claudeResponse);
  return FALLBACK_RESPONSE; // Do NOT break UI
}
```

---

## 7. Consistent Explanation Logic (Trust & UX Layer)

### 7.1 Fixed Explanation Template (MANDATORY)

All explanations must follow:
1. **Usage Insight** (objective behavior)
2. **Preference Alignment** (persona + values)
3. **Final Judgement Reason** (clear logic)

Example:
```
Usage: Low engagement this month (2 sessions)
Preference Fit: High price sensitivity + low waste tolerance
Conclusion: Low value alignment → Recommend review or cancel
```

### 7.2 Consistency Requirement

LLM must NOT:
- ❌ Change reasoning structure across sessions
- ❌ Invent new explanation styles
- ❌ Provide random justifications

✅ Explanation must always align with the scoring framework.

**Implementation:**
```typescript
const EXPLANATION_TEMPLATE = `
Based on structured analysis:

Usage: {usage_pattern} ({objective_metrics})
Value Perception: {preference_match} ({persona_alignment})
Decision: {final_recommendation} ({confidence_level})

{action_suggestion}
`;
```

---

## 8. Role of Behavioral Patterns & Memory

### 8.1 Behavioral Patterns (Secondary Correction, ≤ 8%)

Used to detect **mismatch between claimed preference vs actual behavior**:

Examples:
- **Unused but kept subscriptions** → Lower waste_tolerance than claimed
- **Slow cancellation latency** → Higher decision_style delay
- **Trial-to-keep ratio** → True exploration_tendency

**Influence must remain capped (≤ 8%).**

```typescript
const detectPreferenceMismatch = (
  claimed: SetupPreferences,
  observed: BehavioralPatterns
): number => {
  let mismatchScore = 0;

  // Example: Claimed low waste tolerance but keeps unused subs
  if (claimed.waste_tolerance < 0.3 && observed.unused_keep_rate > 0.5) {
    mismatchScore += 0.03; // Small correction
  }

  // Cap total behavioral adjustment
  return Math.min(mismatchScore, 0.08);
};
```

### 8.2 Memory (Minimal Context Layer, ≤ 5%)

Allowed usage:
- Recent financial stress
- Recent behavior shifts
- Short-term context signals

**Memory influence must be small (≤ 5%) to prevent instability.**

```typescript
const applyMemoryContext = (
  baseScore: number,
  memory: EpisodicMemory[]
): number => {
  let adjustment = 0;

  // Example: Recent cancellation spree → Slightly lower threshold
  const recentCancellations = memory.filter(
    m => m.event_type === 'cancellation' &&
         isWithinDays(m.timestamp, 7)
  );

  if (recentCancellations.length >= 3) {
    adjustment -= 0.03; // Slight bias toward cancellation
  }

  // Cap memory influence
  return baseScore + Math.max(-0.05, Math.min(0.05, adjustment));
};
```

---

## 9. Role of LLM (Claude) in the System

### Claude SHOULD:
✅ Generate structured JSON outputs
✅ Personalize tone and wording
✅ Adapt follow-up questions within fixed dimensions
✅ Produce consistent explanations using template

### Claude SHOULD NOT:
❌ Freely determine final judgement logic
❌ Override deterministic scoring structure
❌ Invent new evaluation metrics
❌ Replace structured persona model

**Claude's role is to enhance UX, not replace logic.**

---

## 10. Implementation Plan

### Phase 1: Core Judgement Engine (P0)

**Files to Create:**
- `app/src/types/judgement.ts` - All judgement types
- `app/src/utils/judgementEngine.ts` - Deterministic scoring logic
- `app/src/config/setupQuestions.ts` - Structured question mappings
- `app/src/config/checkinQuestions.ts` - Fixed CheckIn dimensions

**Files to Modify:**
- `app/src/utils/claude.ts` - Strict JSON enforcement
- `app/src/screens/SetupFlowScreen.tsx` - Numeric mapping

**Key Implementation:**
```typescript
// app/src/types/judgement.ts
export interface ObjectiveData {
  usage_frequency: number; // 0-1
  cost_efficiency: number; // 0-1
  feature_utilization: number; // 0-1
}

export interface CheckInResponses {
  usage_satisfaction: number; // 0-1
  perceived_value: number; // 0-1
  decision_signal: 'keep' | 'unsure' | 'cancel';
}

export interface SetupPreferences {
  budget_tightness: number;
  price_sensitivity: number;
  waste_tolerance: number;
  exploration_tendency: number;
  quality_preference: number;
  decision_style: 'quick' | 'moderate' | 'deliberate';
}

export interface JudgementResult {
  final_score: number; // 0-1
  confidence: number; // 0-1
  recommendation: 'keep' | 'review' | 'cancel';
  explanation: {
    usage_insight: string;
    preference_alignment: string;
    final_judgement: string;
  };
  breakdown: {
    objective_contribution: number;
    checkin_contribution: number;
    setup_contribution: number;
    behavioral_adjustment: number;
    bigfive_adjustment: number;
  };
}
```

```typescript
// app/src/utils/judgementEngine.ts
export const calculateSubscriptionJudgement = (
  subscription: Subscription,
  objective: ObjectiveData,
  checkin: CheckInResponses,
  setup: SetupPreferences,
  behavioral: BehavioralPatterns,
  bigFive: BigFiveTraits
): JudgementResult => {
  // Objective score (30% - REDUCED from 40%)
  const objectiveScore = (
    objective.usage_frequency * 0.15 +
    objective.cost_efficiency * 0.15
    // REMOVED: objective.feature_utilization * 0.10
  );

  // CheckIn score (30%)
  const checkinScore = (
    checkin.usage_satisfaction * 0.15 +
    checkin.perceived_value * 0.15
  );

  // Setup preferences score (22.5%)
  const setupScore = calculateSetupContribution(setup, subscription) * 0.225;

  // Behavioral adjustment (CAPPED at 8%)
  const behavioralAdj = Math.min(
    calculateBehavioralAdjustment(behavioral, setup),
    0.08
  );

  // Big Five adjustment (CAPPED at 8%)
  const bigFiveAdj = Math.min(
    calculateBigFiveAdjustment(bigFive, setup),
    0.08
  );

  // Final score
  const finalScore = Math.max(0, Math.min(1,
    objectiveScore + checkinScore + setupScore + behavioralAdj + bigFiveAdj
  ));

  // Confidence calculation
  const confidence = calculateConfidence(checkin, behavioral);

  // Recommendation thresholds
  let recommendation: 'keep' | 'review' | 'cancel';
  if (finalScore >= 0.7) recommendation = 'keep';
  else if (finalScore >= 0.4) recommendation = 'review';
  else recommendation = 'cancel';

  // Generate explanation (using template)
  const explanation = generateExplanation(
    objective,
    checkin,
    setup,
    finalScore,
    recommendation
  );

  return {
    final_score: finalScore,
    confidence,
    recommendation,
    explanation,
    breakdown: {
      objective_contribution: objectiveScore,
      checkin_contribution: checkinScore,
      setup_contribution: setupScore,
      behavioral_adjustment: behavioralAdj,
      bigfive_adjustment: bigFiveAdj
    }
  };
};
```

### Phase 2: Setup Question Mapping (P0)

```typescript
// app/src/config/setupQuestions.ts
export const SETUP_QUESTIONS = [
  {
    id: 'budget_tightness',
    question: "How carefully do you track your monthly spending?",
    type: 'slider',
    options: [
      { label: "Very loosely", value: { budget_tightness: 0.2 } },
      { label: "Somewhat", value: { budget_tightness: 0.5 } },
      { label: "Very carefully", value: { budget_tightness: 0.9 } }
    ]
  },
  {
    id: 'waste_tolerance',
    question: "You discover an unused subscription. You feel:",
    type: 'multiple_choice',
    options: [
      { label: "😤 Very frustrated (cancel immediately)", value: { waste_tolerance: 0.1, price_sensitivity: 0.9 } },
      { label: "😕 Somewhat bothered (will review soon)", value: { waste_tolerance: 0.4, price_sensitivity: 0.6 } },
      { label: "🤷 Not too worried (keep it for now)", value: { waste_tolerance: 0.8, price_sensitivity: 0.3 } }
    ]
  },
  {
    id: 'exploration_tendency',
    question: "When you hear about a new service, you:",
    type: 'multiple_choice',
    options: [
      { label: "🔍 Research thoroughly first", value: { exploration_tendency: 0.3, decision_style: 'deliberate' } },
      { label: "🧪 Try it if it looks interesting", value: { exploration_tendency: 0.7, decision_style: 'moderate' } },
      { label: "⚡ Jump in quickly", value: { exploration_tendency: 0.9, decision_style: 'quick' } }
    ]
  },
  {
    id: 'quality_preference',
    question: "You prefer:",
    type: 'slider',
    options: [
      { label: "Many budget options", value: { quality_preference: 0.2, price_sensitivity: 0.8 } },
      { label: "Balanced choice", value: { quality_preference: 0.5, price_sensitivity: 0.5 } },
      { label: "Few premium services", value: { quality_preference: 0.9, price_sensitivity: 0.3 } }
    ]
  }
];
```

### Phase 3: Strict JSON Prompting (P0)

```typescript
// app/src/config/prompts.ts
export const CHECKIN_PROMPT = (
  subscription: Subscription,
  persona: SetupPreferences
) => `
You are generating a structured check-in review for a subscription.

CRITICAL: Return ONLY valid JSON matching this exact schema:
{
  "review_scores": {
    "usage_satisfaction": number between 0-1,
    "perceived_value": number between 0-1,
    "decision_signal": "keep" or "unsure" or "cancel"
  },
  "confidence": number between 0-1,
  "explanation": {
    "usage_insight": string (max 50 chars),
    "preference_alignment": string (max 50 chars),
    "final_judgement": string (max 50 chars)
  }
}

USER PERSONA (for tone only, not logic):
- Budget Tightness: ${persona.budget_tightness}
- Waste Tolerance: ${persona.waste_tolerance}
- Decision Style: ${persona.decision_style}

SUBSCRIPTION DATA:
- Name: ${subscription.name}
- Cost: $${subscription.cost}
- Usage: ${subscription.usage_score || 'unknown'}

TASK: Ask 2-3 structured questions covering:
1. Usage/satisfaction (map to usage_satisfaction: 0-1)
2. Value perception (map to perceived_value: 0-1)
3. Decision intent (map to decision_signal: keep/unsure/cancel)

Adapt wording to persona tone but DO NOT change structure.

Return ONLY JSON. No markdown. No prose.
`;
```

### Phase 4: CheckIn Screen Integration (P1)

```typescript
// app/src/screens/CheckInScreen.tsx

// Step 1: Generate questions (LLM)
const generateCheckInQuestions = async (
  subscription: Subscription,
  persona: SetupPreferences
): Promise<CheckInQuestions> => {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: CHECKIN_QUESTION_GENERATION_PROMPT(subscription, persona)
    }]
  });

  try {
    const parsed = JSON.parse(response.content[0].text);
    validateQuestionSchema(parsed); // Throws if invalid
    return parsed;
  } catch (error) {
    console.error('Question generation failed:', error);
    return FALLBACK_QUESTIONS; // Predefined safe default
  }
};

// Step 2: User answers → deterministic local scoring (NO LLM)
const handleCheckInComplete = async (
  subscription: Subscription,
  userAnswers: CheckInAnswers
) => {
  // Extract scores from user-selected options (deterministic)
  const scores = calculateCheckInScores(userAnswers);

  const persona = await getPersona(user.id);
  const objective = await calculateObjectiveData(subscription);
  const behavioral = await getBehavioralPatterns(user.id);
  const bigFive = persona.big_five_traits;

  // Deterministic judgement
  const result = calculateSubscriptionJudgement(
    subscription,
    objective,
    scores, // Deterministic scores from local calculation
    persona.setup_preferences,
    behavioral,
    bigFive
  );

  // Display result with breakdown
  setJudgementResult(result);

  // Save to database
  await saveCheckInResult(user.id, subscription.id, result);
};
```

### Phase 5: Audit Screen Structured Output (P1)

```typescript
// app/src/screens/AuditScreen.tsx
const handleAuditComplete = async (
  serviceName: string,
  cost: number,
  conversationHistory: ChatMessage[]
) => {
  const persona = await getPersona(user.id);

  // Get structured output from Claude
  const auditResult = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: AUDIT_PROMPT(persona.setup_preferences),
    messages: conversationHistory
  });

  // Parse with fallback
  let parsed: AuditJudgement;
  try {
    parsed = JSON.parse(auditResult.content[0].text);
    validateAuditSchema(parsed);
  } catch (error) {
    console.error('Audit JSON parse failed:', error);
    parsed = AUDIT_FALLBACK_RESPONSE;
  }

  // Calculate final score with bounded adjustments
  const finalJudgement = calculateAuditJudgement(
    parsed,
    persona.setup_preferences,
    persona.behavioral_patterns,
    persona.big_five_traits
  );

  return finalJudgement;
};
```

---

## 11. Testing & Validation

### 11.1 Weight Validation Tests

```typescript
describe('Judgement Weight Bounds', () => {
  test('Big Five influence never exceeds 10%', () => {
    const extremeBigFive = {
      openness: 1.0,
      conscientiousness: 1.0,
      extraversion: 1.0,
      agreeableness: 1.0,
      neuroticism: 1.0
    };

    const result = calculateSubscriptionJudgement(...args, extremeBigFive);
    expect(result.breakdown.bigfive_adjustment).toBeLessThanOrEqual(0.10);
  });

  test('Behavioral adjustment capped at 8%', () => {
    const extremeBehavioral = { /* extreme values */ };
    const result = calculateSubscriptionJudgement(...args, extremeBehavioral);
    expect(result.breakdown.behavioral_adjustment).toBeLessThanOrEqual(0.08);
  });

  test('Final score deterministic for same inputs', () => {
    const result1 = calculateSubscriptionJudgement(...args);
    const result2 = calculateSubscriptionJudgement(...args);
    expect(result1.final_score).toBe(result2.final_score);
  });
});
```

### 11.2 JSON Schema Validation

```typescript
describe('Claude JSON Output', () => {
  test('Always returns valid JSON', async () => {
    const response = await generateCheckInQuestion(...);
    expect(() => JSON.parse(response)).not.toThrow();
  });

  test('Schema matches expected structure', async () => {
    const response = await generateCheckInQuestion(...);
    const parsed = JSON.parse(response);

    expect(parsed.review_scores).toBeDefined();
    expect(parsed.review_scores.usage_satisfaction).toBeGreaterThanOrEqual(0);
    expect(parsed.review_scores.usage_satisfaction).toBeLessThanOrEqual(1);
    expect(['keep', 'unsure', 'cancel']).toContain(parsed.review_scores.decision_signal);
  });

  test('Fallback works on parse error', () => {
    const invalidJSON = "This is not JSON";
    const result = parseClaudeResponse(invalidJSON);
    expect(result).toEqual(FALLBACK_RESPONSE);
  });
});
```

---

## 12. Success Metrics

**Stability:**
- [ ] Same inputs → same score (deterministic)
- [ ] Big Five influence ≤ 10% in all cases
- [ ] JSON parse success rate > 99%

**Accuracy:**
- [ ] User agreement rate > 80% with recommendations
- [ ] False positive cancellations < 10%
- [ ] Explanation clarity rated > 4/5

**Performance:**
- [ ] CheckIn judgement calculated < 100ms
- [ ] Audit response time < 3 seconds
- [ ] Setup completion rate > 85%

---

## 13. Final System Design Goal

This system must be:
- ✅ **Personalized but stable**
- ✅ **Explainable** (not black-box)
- ✅ **Structured** (not purely generative)
- ✅ **Persona-adaptive** (not persona-dependent)
- ✅ **Robust** under cold start and evolving user behavior

**Primary Objective**: Deliver AI-driven, persona-aware subscription judgement that feels intelligent, consistent, and trustworthy while maintaining deterministic stability.

---

## 14. Technical Addendum: Production-Ready Specifications

This section provides implementation-ready mathematical formulas and operational definitions for all core components. All formulas use **proxy metrics** available without external APIs.

### 14.0 Utility Functions

#### Proper Half-Life Decay Function

```typescript
// ============================================
// UTILITY: Proper Half-Life Decay Function
// ============================================

/**
 * Calculates exponential decay with true half-life semantics.
 * At t = halfLifeDays, returns exactly 0.5.
 *
 * @param ageInDays - Time elapsed since event
 * @param halfLifeDays - Half-life parameter (time for 50% decay)
 * @returns Decay weight in range [0, 1]
 */
const halfLifeDecay = (ageInDays: number, halfLifeDays: number): number => {
  return Math.exp(-Math.LN2 * ageInDays / halfLifeDays);
};

// Verification:
// halfLifeDecay(0, 30) = 1.0     ✅
// halfLifeDecay(30, 30) = 0.5    ✅
// halfLifeDecay(60, 30) = 0.25   ✅
// halfLifeDecay(90, 30) = 0.125  ✅
```

**Why This Formula is Correct**:
- Standard formula: `exp(-age/k)` does NOT satisfy half-life definition
- At t=k, `exp(-k/k) = exp(-1) ≈ 0.368` (NOT 0.5!) ❌
- Correct formula: `exp(-ln(2) * age / halfLife)`
- At t=halfLife, `exp(-ln(2)) = 1/2 = 0.5` ✅

### 14.1 Objective Data Calculation (30% Weight)

**Problem**: No external API for usage tracking. Must infer from available data.

**Solution**: Proxy-based scoring using internal signals only.

#### 14.1.1 Usage Frequency Score (15% of total)

**Formula**:
```typescript
const calculateUsageFrequency = (subscription: Subscription): number => {
  const daysSinceLastUpdate = getDaysBetween(subscription.updated_at, new Date());
  const daysSinceCreation = getDaysBetween(subscription.created_at, new Date());

  // CORRECTED: Proper 7-day half-life decay
  const recencyScore = halfLifeDecay(daysSinceLastUpdate, 7);

  // Proxy: Age suggests established usage pattern
  const maturityBonus = Math.min(daysSinceCreation / 30, 1.0) * 0.2; // +0.2 after 30 days

  // Combine (0-1 range)
  const rawScore = Math.min(recencyScore + maturityBonus, 1.0);

  return rawScore;
};
```

**Rationale**:
- `updated_at` changes when user interacts with subscription record
- Exponential decay rewards recent activity
- Maturity bonus prevents penalizing new subscriptions

#### 14.1.2 Cost Efficiency Score (15% of total)

**Formula**:
```typescript
const calculateCostEfficiency = (
  subscription: Subscription,
  userBudget: number
): number => {
  // Proxy: Compare cost to budget percentage
  const budgetRatio = subscription.cost / userBudget;

  // Proxy: Absolute cost threshold (psychological anchors)
  const absoluteCostPenalty = subscription.cost > 50 ? 0.1 : 0; // -0.1 if >$50

  // Efficiency score (inverse relationship with cost)
  const efficiencyScore = Math.max(0, 1.0 - budgetRatio * 2); // Linear decay

  // Apply absolute penalty
  const finalScore = Math.max(0, efficiencyScore - absoluteCostPenalty);

  return Math.min(finalScore, 1.0);
};
```

**Rationale**:
- Budget ratio captures relative affordability
- Absolute threshold captures universal price sensitivity ($50 psychological barrier)
- Capped at 1.0 to prevent overflow

#### 14.1.3 Feature Utilization Score (REMOVED - Anti-Double-Counting)

**DECISION**: This metric has been **removed** from Objective scoring to prevent double-counting with CheckIn responses.

**Rationale**:
- `usage_satisfaction` from CheckIn already captures feature utilization
- Including it in both Objective (via proxy) and CheckIn layers violates bounded-weight constraints
- Objective layer must contain **only independent signals** (not derived from CheckIn data)

**Impact on weight distribution**:
- Objective score: 40% → **30%** (feature_utilization 10% removed)
- CheckIn: 30% (unchanged)
- Setup: 22.5% (unchanged)
- Behavioral: ≤8% (unchanged, capped)
- Big Five: ≤8% (unchanged, capped)
- **New total max**: 98.5% (within bounds ✅)

#### 14.1.4 Combined Objective Score

**Formula**:
```typescript
const calculateObjectiveScore = (
  subscription: Subscription,
  userBudget: number
  // REMOVED: checkInHistory parameter (was causing double-counting)
): number => {
  const usageFreq = calculateUsageFrequency(subscription);
  const costEff = calculateCostEfficiency(subscription, userBudget);

  // REMOVED: featureUtil calculation
  // const featureUtil = calculateFeatureUtilization(subscription, checkInHistory);

  // Weighted sum (reduced to 30% total)
  const objectiveScore = (
    usageFreq * 0.15 +
    costEff * 0.15
    // REMOVED: featureUtil * 0.10
  );

  return objectiveScore; // Range: 0-0.30 (reduced from 0-0.40)
};
```

---

### 14.2 Setup Preferences Calculation (20-25% Weight)

#### 14.2.1 Parameter Mapping: Direct vs Inferred

**Direct Parameters** (collected via questions):
- `budget_tightness` (0-1)
- `waste_tolerance` (0-1)
- `exploration_tendency` (0-1)
- `decision_style` (enum: 'quick' | 'moderate' | 'deliberate')

**Inferred Parameters** (calculated from direct):
- `price_sensitivity` = `1.0 - waste_tolerance`
- `quality_preference` = `(1.0 - exploration_tendency) * 0.7 + budget_tightness * 0.3`

**Boundary Rule**: Only 4 direct questions maximum. All other parameters must be inferred.

#### 14.2.2 Setup Contribution Formula

**Formula**:
```typescript
const calculateSetupContribution = (
  setup: SetupPreferences,
  subscription: Subscription
): number => {
  // Factor 1: Budget alignment (weight: 0.4)
  const budgetFit = setup.budget_tightness < 0.5 ? 1.0 : // Loose budget = high fit
    1.0 - (subscription.cost / 100) * setup.budget_tightness; // Tight budget = cost-sensitive

  // Factor 2: Waste tolerance impact (weight: 0.3)
  const wasteFit = setup.waste_tolerance; // High tolerance = forgiving score

  // Factor 3: Quality preference match (weight: 0.3)
  const qualityFit = subscription.cost > 30 ?
    setup.quality_preference : // Premium = quality preference matters
    1.0 - setup.quality_preference * 0.3; // Budget = quality preference penalizes

  // Weighted average
  const setupScore = (
    budgetFit * 0.4 +
    wasteFit * 0.3 +
    qualityFit * 0.3
  );

  return setupScore; // Range: 0-1 (will be scaled by 0.225 in final calc)
};
```

**Rationale**:
- Budget tightness affects cost tolerance
- Waste tolerance provides forgiveness
- Quality preference interacts with subscription tier

---

### 14.3 Behavioral Inference Logic (≤8% Weight)

**MVP-Level Implementation**: Track only 2 key behaviors.

#### 14.3.1 Behavior 1: Cancellation Latency

**Proxy**: Time between CheckIn "cancel" signal and actual cancellation.

**Formula**:
```typescript
const calculateCancellationLatency = (
  userId: string,
  subscriptionHistory: Subscription[]
): number => {
  const canceledSubs = subscriptionHistory.filter(s => s.status === 'canceled');

  if (canceledSubs.length === 0) return 0.5; // Neutral

  // Find CheckIn responses that signaled "cancel"
  const cancelSignals = canceledSubs.map(sub => {
    const lastCheckIn = getLastCheckIn(userId, sub.id);
    if (!lastCheckIn || lastCheckIn.decision_signal !== 'cancel') return null;

    const latencyDays = getDaysBetween(lastCheckIn.created_at, sub.updated_at);
    return latencyDays;
  }).filter(Boolean);

  if (cancelSignals.length === 0) return 0.5;

  const avgLatency = cancelSignals.reduce((a, b) => a + b, 0) / cancelSignals.length;

  // Convert to preference adjustment
  // Fast cancellation (< 7 days) = high conscientiousness
  // Slow cancellation (> 30 days) = low conscientiousness
  const adjustment = avgLatency < 7 ? 0.03 : avgLatency > 30 ? -0.03 : 0;

  return adjustment; // Range: -0.03 to +0.03
};
```

#### 14.3.2 Behavior 2: Subscription Churn Rate

**Proxy**: Ratio of canceled to total subscriptions.

**Formula**:
```typescript
const calculateChurnRate = (
  subscriptionHistory: Subscription[]
): number => {
  const totalSubs = subscriptionHistory.length;
  if (totalSubs === 0) return 0;

  const canceledCount = subscriptionHistory.filter(s => s.status === 'canceled').length;
  const churnRate = canceledCount / totalSubs;

  // High churn = explorer tendency
  // Low churn = conservative tendency
  const adjustment = churnRate > 0.5 ? 0.05 : churnRate < 0.2 ? -0.02 : 0;

  return adjustment; // Range: -0.02 to +0.05
};
```

#### 14.3.3 Combined Behavioral Adjustment

**Formula**:
```typescript
const calculateBehavioralAdjustment = (
  userId: string,
  subscriptionHistory: Subscription[]
): number => {
  const latencyAdj = calculateCancellationLatency(userId, subscriptionHistory);
  const churnAdj = calculateChurnRate(subscriptionHistory);

  const totalAdj = latencyAdj + churnAdj;

  // Hard cap at ±0.08
  return Math.max(-0.08, Math.min(0.08, totalAdj));
};
```

---

### 14.4 Confidence Score Calculation (CORRECTED)

**Problem with original implementation**:
- Data type mismatch: `episodic_memory` (generic event log) ≠ `CheckInResponse[]` (typed check-in data)
- No time decay: Old data weighted equally to fresh data → stale personas dominate
- Confidence only increases: User behavior changes ignored → gating becomes ineffective

**Solution**:
1. Properly separate data sources by type
2. Apply time windows (only count recent data)
3. Add effective confidence with decay over inactivity

#### Data Source Separation (Type Safety)

```typescript
// WRONG (old approach):
calculateConfidenceScore(
  persona.episodic_memory,        // Generic any[] - type unsafe
  user.subscriptions,
  setupCompleted
)

// CORRECT (new approach):
interface ConfidenceInputs {
  checkInHistory: CheckInResponse[];     // Typed check-in responses
  subscriptionHistory: Subscription[];   // Subscription records
  behavioralEvents: BehavioralEvent[];   // Behavioral signals
  setupCompleted: boolean;               // Setup completion flag
}

calculateConfidenceScore(inputs: ConfidenceInputs): number
```

#### Time-Windowed Confidence Calculation

```typescript
const calculateConfidenceScore = (
  inputs: ConfidenceInputs,
  timeWindowDays: number = 60 // Only count data within window
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

**Rationale for Time Windows**:
- CheckIn responses: 60-day window (user preferences change over ~2 months)
- Behavioral events: 90-day window (behavior patterns shift slower than feelings)
- Subscription history: No window (lifetime count reflects overall experience depth)

#### Effective Confidence with Decay

To prevent stale personas from breaking gating, introduce effective confidence that decays with inactivity:

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

**Why Effective Confidence Matters**:
- Prevents stale personas (6 months old) from dominating fresh CheckIn signals
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

**Usage (unchanged)**:
```typescript
const applyConfidenceGating = (
  adjustment: number,
  confidence: number,
  minConfidence: number = 0.5
): number => {
  if (confidence < minConfidence) {
    return adjustment * (confidence / minConfidence); // Scale down
  }
  return adjustment; // Full adjustment
};
```

**Rationale**:
- New users (low confidence) have soft signals dampened
- Established users (high confidence) get full adjustments
- Prevents unstable scores during cold start
- Time decay prevents stale personas from dominating

---

### 14.5 Cold Start Default Values

**Problem**: New users have no behavioral or CheckIn data.

**Solution**: Neutral defaults with slight optimism bias.

**Default Values**:
```typescript
const COLD_START_DEFAULTS: SetupPreferences = {
  budget_tightness: 0.5,       // Neutral
  price_sensitivity: 0.5,      // Neutral
  waste_tolerance: 0.5,        // Neutral
  exploration_tendency: 0.6,   // Slightly optimistic (encourage engagement)
  quality_preference: 0.5,     // Neutral
  decision_style: 'moderate'   // Balanced
};

const COLD_START_BIG_FIVE: BigFiveTraits = {
  openness: 0.5,
  conscientiousness: 0.5,
  extraversion: 0.5,
  agreeableness: 0.5,
  neuroticism: 0.5
};

const COLD_START_BEHAVIORAL: BehavioralPatterns = {
  cancellation_latency: 0,     // No data
  churn_rate: 0,               // No data
  adjustment: 0                // Zero influence
};

const COLD_START_CONFIDENCE = 0.3; // Setup completed but no history
```

**First-Time Judgement Behavior**:
- Objective score dominates (35-40%)
- CheckIn dominates (30%)
- Setup provides baseline (20-25%)
- Behavioral/Big Five have zero influence (confidence gating)

**After 3 CheckIns**:
- Confidence rises to ~0.4
- Behavioral adjustments start applying (scaled)

**After 10 CheckIns + 5 subscriptions**:
- Confidence reaches ~0.7
- Full behavioral and Big Five influence

---

### 14.6 Explanation Generation: Deterministic vs Hybrid

**Decision**: **Hybrid Approach with Deterministic Fallback**

**Rationale**:
- Deterministic alone = robotic, lacks warmth
- Pure LLM = inconsistent, expensive, slow
- Hybrid = best of both worlds

**Implementation**:

#### Primary Mode: Deterministic Template (Fast Path)

```typescript
const generateDeterministicExplanation = (
  finalScore: number,
  breakdown: JudgementBreakdown
): Explanation => {
  // Usage insight (objective)
  const usageInsight =
    breakdown.objective_contribution > 0.25 ? "Strong usage detected" :
    breakdown.objective_contribution > 0.15 ? "Moderate usage" :
    "Low usage detected";

  // Preference alignment (setup + behavioral)
  const preferenceMatch =
    breakdown.setup_contribution > 0.15 ? "Aligns well with your preferences" :
    breakdown.setup_contribution > 0.10 ? "Partially matches preferences" :
    "Limited preference alignment";

  // Final judgement
  const judgement =
    finalScore >= 0.7 ? "Strong value match - keep it" :
    finalScore >= 0.4 ? "Consider reviewing usage" :
    "Low value alignment - consider canceling";

  return {
    usage_insight: usageInsight,
    preference_alignment: preferenceMatch,
    final_judgement: judgement
  };
};
```

#### Fallback Mode: LLM Enhancement (When Needed)

**Trigger Conditions**:
- User explicitly requests detailed explanation
- First-time user (welcome experience)
- Confidence score < 0.5 (need more context)

**LLM Prompt**:
```typescript
const LLM_EXPLANATION_PROMPT = `
Generate a warm, concise explanation for this subscription judgement.

JUDGEMENT DATA:
- Final Score: ${finalScore}
- Objective: ${breakdown.objective_contribution}
- CheckIn: ${breakdown.checkin_contribution}
- Setup: ${breakdown.setup_contribution}

CONSTRAINT: Max 120 characters total across all fields.

Return JSON:
{
  "usage_insight": "...",
  "preference_alignment": "...",
  "final_judgement": "..."
}
`;
```

**Fallback Logic**:
```typescript
const generateExplanation = async (
  finalScore: number,
  breakdown: JudgementBreakdown,
  useLLM: boolean = false
): Promise<Explanation> => {
  if (!useLLM) {
    return generateDeterministicExplanation(finalScore, breakdown);
  }

  try {
    const llmResponse = await claude.messages.create({
      model: 'claude-haiku-4-20250514', // Fast model
      max_tokens: 200,
      messages: [{ role: 'user', content: LLM_EXPLANATION_PROMPT }]
    });

    const parsed = JSON.parse(llmResponse.content[0].text);
    return parsed;
  } catch (error) {
    console.warn('LLM explanation failed, using deterministic fallback');
    return generateDeterministicExplanation(finalScore, breakdown);
  }
};
```

**Performance**:
- Deterministic: <5ms (always available)
- LLM: ~500ms (Haiku) but only when triggered
- Fallback ensures no blocking

---

### 14.7 Time Decay Mechanism

**Purpose**: Prevent stale persona data from dominating fresh signals.

**Scope**: Apply ONLY to:
- CheckIn responses (decay old satisfaction scores)
- Behavioral adjustments (recent behavior weighs more)

**DO NOT apply to**:
- Setup preferences (user's baseline doesn't decay)
- Big Five traits (personality is stable)

#### 14.7.1 CheckIn Response Decay

**Formula**:
```typescript
const applyCheckInDecay = (
  checkInHistory: CheckInResponse[],
  subscription: Subscription
): number => {
  const relevantCheckIns = checkInHistory.filter(
    c => c.subscription_id === subscription.id
  );

  if (relevantCheckIns.length === 0) return 0.5; // Neutral

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

  const decayedScore = weightedScores.reduce((a, b) => a + b, 0) / totalWeight;

  return decayedScore; // Range: 0-1
};
```

**Parameters**:
- **Half-life**: 30 days (subscription context)
  - Rationale: Monthly billing cycle = 30-day relevance window
  - After 30 days, signal weight drops to 50%
  - After 90 days, weight drops to 12.5%

**Alternative Half-Life Options**:
- **14 days**: For aggressive decay (fast-changing services)
- **60 days**: For stable, long-term subscriptions (annual plans)
- **Adaptive**: Use `subscription.billing_cycle` as half-life parameter

#### 14.7.2 Behavioral Data Decay

**Formula**:
```typescript
const applyBehavioralDecay = (
  behavioralHistory: BehavioralEvent[],
  halfLifeDays: number = 60
): BehavioralPatterns => {
  const now = new Date();

  // Weight recent events more heavily
  const weightedEvents = behavioralHistory.map(event => {
    const ageInDays = getDaysBetween(event.timestamp, now);
    // CORRECTED: Proper half-life decay
    const weight = halfLifeDecay(ageInDays, halfLifeDays);

    return {
      event,
      weight
    };
  });

  // Calculate weighted averages for each pattern
  const totalWeight = weightedEvents.reduce((sum, e) => sum + e.weight, 0);

  // Example: Cancellation latency with decay
  const cancelEvents = weightedEvents.filter(e => e.event.type === 'cancellation');
  const avgLatency = cancelEvents.length > 0 ?
    cancelEvents.reduce((sum, e) => sum + e.event.latency_days * e.weight, 0) /
    cancelEvents.reduce((sum, e) => sum + e.weight, 0) :
    null;

  return {
    cancellation_latency: avgLatency || 0,
    // ... other patterns
  };
};
```

**Parameters**:
- **Half-life**: 60 days (behavioral context)
  - Rationale: Behavioral patterns change slower than feelings
  - Recent actions (last 2 months) heavily weighted
  - Old patterns (>6 months) nearly ignored

**Verification of Half-Life Formula**:
```typescript
// Test at key time points
expect(halfLifeDecay(0, 30)).toBe(1.0);      // At t=0, no decay
expect(halfLifeDecay(30, 30)).toBe(0.5);     // At t=halfLife, exactly 50%
expect(halfLifeDecay(60, 30)).toBe(0.25);    // At 2x halfLife, 25%
expect(halfLifeDecay(90, 30)).toBe(0.125);   // At 3x halfLife, 12.5%
```

---

### 14.8 Persona Update Frequency and Amplitude Limits

**Problem**: Prevent persona "flapping" (rapid changes causing instability).

**Solution**: Rate-limited updates with bounded amplitude.

#### 14.8.1 Update Frequency Rules

**Rule 1: Minimum Update Interval**
```typescript
const PERSONA_UPDATE_INTERVALS = {
  setup_preferences: Infinity,        // Never auto-update (user-set)
  big_five_traits: 7 * 24 * 60 * 60,  // 7 days (weekly max)
  behavioral_patterns: 24 * 60 * 60,  // 24 hours (daily max)
  episodic_memory: 0                  // Append-only (no rate limit)
};

const canUpdatePersona = (
  persona: UserPersona,
  updateType: keyof typeof PERSONA_UPDATE_INTERVALS
): boolean => {
  const minInterval = PERSONA_UPDATE_INTERVALS[updateType];
  const lastUpdate = new Date(persona.last_updated);
  const now = new Date();

  const elapsed = (now.getTime() - lastUpdate.getTime()) / 1000; // seconds

  return elapsed >= minInterval;
};
```

**Rule 2: Batch Updates**
```typescript
// Instead of updating after every CheckIn, batch weekly
const shouldTriggerPersonaUpdate = (
  userId: string,
  pendingCheckIns: CheckInResponse[]
): boolean => {
  const persona = await getPersona(userId);

  // Condition 1: At least 3 new CheckIns
  const newCheckInCount = pendingCheckIns.filter(
    c => c.created_at > persona.last_updated
  ).length;

  // Condition 2: 7 days since last update
  const daysSinceUpdate = getDaysBetween(persona.last_updated, new Date());

  return newCheckInCount >= 3 || daysSinceUpdate >= 7;
};
```

#### 14.8.2 Amplitude Limits (Per-Update Constraints)

**Prevent Large Jumps**:
```typescript
const applyAmplitudeLimit = (
  currentValue: number,
  newValue: number,
  maxDelta: number = 0.1 // Max 10% change per update
): number => {
  const delta = newValue - currentValue;

  // Clamp delta to max amplitude
  const clampedDelta = Math.max(-maxDelta, Math.min(maxDelta, delta));

  return currentValue + clampedDelta;
};

const updateBigFiveWithLimit = (
  current: BigFiveTraits,
  inferred: BigFiveTraits
): BigFiveTraits => {
  return {
    openness: applyAmplitudeLimit(current.openness, inferred.openness, 0.1),
    conscientiousness: applyAmplitudeLimit(current.conscientiousness, inferred.conscientiousness, 0.1),
    extraversion: applyAmplitudeLimit(current.extraversion, inferred.extraversion, 0.1),
    agreeableness: applyAmplitudeLimit(current.agreeableness, inferred.agreeableness, 0.1),
    neuroticism: applyAmplitudeLimit(current.neuroticism, inferred.neuroticism, 0.1)
  };
};
```

**Amplitude Limits by Type**:
| Parameter Type | Max Δ Per Update | Rationale |
|----------------|------------------|-----------|
| Big Five Traits | ±0.1 | Personality changes slowly |
| Behavioral Patterns | ±0.15 | Actions update faster than traits |
| Confidence Score | +0.05 only | Only increases (never decreases) |
| Setup Preferences | Manual only | User controls baseline |

#### 14.8.3 Smoothing Algorithm (Exponential Moving Average)

**Purpose**: Prevent single outlier CheckIn from skewing persona.

**Formula**:
```typescript
const updateWithEMA = (
  currentValue: number,
  newSignal: number,
  alpha: number = 0.3 // Smoothing factor
): number => {
  // EMA formula: new = alpha * signal + (1 - alpha) * current
  return alpha * newSignal + (1 - alpha) * currentValue;
};

// Example: Update waste tolerance based on CheckIn behavior
const updateWasteTolerance = (
  persona: UserPersona,
  checkIn: CheckInResponse
): number => {
  const current = persona.setup_preferences.waste_tolerance;

  // Infer from decision signal
  const signal = checkIn.decision_signal === 'cancel' ? 0.2 : // Low tolerance
                 checkIn.decision_signal === 'keep' ? 0.8 : // High tolerance
                 0.5; // Neutral

  // Apply EMA (30% new signal, 70% historical)
  const smoothed = updateWithEMA(current, signal, 0.3);

  // Apply amplitude limit
  return applyAmplitudeLimit(current, smoothed, 0.1);
};
```

**Parameters**:
- **Alpha (α)**: 0.3 (30% new data, 70% history)
  - Higher α = more reactive (0.5 = 50/50)
  - Lower α = more stable (0.1 = 10% new)
  - Recommended: 0.2-0.4 range for subscriptions

---

### 14.9 Complete Judgement Pipeline

**Full integration of all components**:

```typescript
const calculateFinalJudgement = async (
  subscription: Subscription,
  user: User
): Promise<JudgementResult> => {
  // 1. Load persona
  const persona = await getPersona(user.id);

  // CORRECTED: Properly typed data sources
  const confidenceInputs: ConfidenceInputs = {
    checkInHistory: await getCheckInHistory(user.id),
    subscriptionHistory: user.subscriptions,
    behavioralEvents: await getBehavioralEvents(user.id),
    setupCompleted: persona.setup_completed
  };

  const baseConfidence = calculateConfidenceScore(confidenceInputs, 60);
  const effectiveConfidence = getEffectiveConfidence(persona);

  // 2. Calculate objective score (30% - REDUCED from 40%)
  const objectiveScore = calculateObjectiveScore(
    subscription,
    user.monthly_budget
    // REMOVED: persona.episodic_memory (no longer needed)
  );

  // 3. Get CheckIn responses with decay (30%)
  const decayedCheckInScore = applyCheckInDecay(
    confidenceInputs.checkInHistory,
    subscription
  ) * 0.30;

  // 4. Calculate setup contribution (22.5%)
  const setupScore = calculateSetupContribution(
    persona.setup_preferences,
    subscription
  ) * 0.225;

  // 5. Calculate behavioral adjustment (≤8%, gated by confidence)
  const behavioralAdj = applyConfidenceGating(
    calculateBehavioralAdjustment(user.id, user.subscriptions),
    effectiveConfidence, // Use decayed confidence
    0.5 // Min confidence threshold
  );

  // 6. Calculate Big Five adjustment (≤8%, gated by confidence)
  const bigFiveAdj = applyConfidenceGating(
    calculateBigFiveAdjustment(persona.big_five_traits, persona.setup_preferences),
    effectiveConfidence, // Use decayed confidence
    0.5
  );

  // 7. Final score (bounded 0-1)
  const finalScore = Math.max(0, Math.min(1,
    objectiveScore + decayedCheckInScore + setupScore + behavioralAdj + bigFiveAdj
  ));

  // 8. Recommendation thresholds
  const recommendation: 'keep' | 'review' | 'cancel' =
    finalScore >= 0.7 ? 'keep' :
    finalScore >= 0.4 ? 'review' :
    'cancel';

  // 9. Generate explanation (deterministic by default)
  const breakdown = {
    objective_contribution: objectiveScore,
    checkin_contribution: decayedCheckInScore,
    setup_contribution: setupScore,
    behavioral_adjustment: behavioralAdj,
    bigfive_adjustment: bigFiveAdj
  };

  const explanation = await generateExplanation(
    finalScore,
    breakdown,
    confidence < 0.5 // Use LLM for new users
  );

  return {
    final_score: finalScore,
    confidence,
    recommendation,
    explanation,
    breakdown
  };
};
```

---

### 14.10 Testing Specifications

**Unit Tests Required**:

```typescript
describe('Objective Score Calculation', () => {
  test('Recent subscription gets high usage frequency', () => {
    const subscription = {
      updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      created_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000)  // 40 days ago
    };
    const score = calculateUsageFrequency(subscription);
    expect(score).toBeGreaterThan(0.7);
  });

  test('Old untouched subscription gets low score', () => {
    const subscription = {
      updated_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
      created_at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000)
    };
    const score = calculateUsageFrequency(subscription);
    expect(score).toBeLessThan(0.3);
  });

  test('Cost efficiency penalizes expensive subs', () => {
    const subscription = { cost: 75 };
    const score = calculateCostEfficiency(subscription, 100);
    expect(score).toBeLessThan(0.5); // Budget ratio penalty + absolute penalty
  });
});

describe('Weight Bounds Enforcement', () => {
  test('Big Five never exceeds 10%', () => {
    const extremeBigFive = {
      openness: 1.0,
      conscientiousness: 1.0,
      extraversion: 1.0,
      agreeableness: 1.0,
      neuroticism: 1.0
    };
    const adj = calculateBigFiveAdjustment(extremeBigFive, COLD_START_DEFAULTS);
    expect(adj).toBeLessThanOrEqual(0.10);
  });

  test('Behavioral adjustment capped at 8%', () => {
    const extremeBehavioral = {
      cancellation_latency: 100, // Extreme value
      churn_rate: 1.0
    };
    const adj = calculateBehavioralAdjustment(userId, extremeBehavioral);
    expect(adj).toBeLessThanOrEqual(0.08);
  });

  test('Confidence gating reduces adjustments for new users', () => {
    const adjustment = 0.08;
    const lowConfidence = 0.3;
    const gated = applyConfidenceGating(adjustment, lowConfidence, 0.5);
    expect(gated).toBeLessThan(adjustment);
    expect(gated).toBeCloseTo(adjustment * (0.3 / 0.5));
  });
});

describe('Time Decay', () => {
  test('Recent CheckIn weighs more than old', () => {
    const recentCheckIn = {
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      usage_satisfaction: 0.8,
      subscription_id: 'sub1'
    };
    const oldCheckIn = {
      created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      usage_satisfaction: 0.2,
      subscription_id: 'sub1'
    };

    const score = applyCheckInDecay([recentCheckIn, oldCheckIn], subscription);
    expect(score).toBeGreaterThan(0.6); // Recent dominates
  });
});

describe('Amplitude Limits', () => {
  test('Big Five update clamped to ±0.1', () => {
    const current = { openness: 0.5, /* ... */ };
    const inferred = { openness: 0.9, /* ... */ }; // Huge jump

    const updated = updateBigFiveWithLimit(current, inferred);
    expect(updated.openness).toBe(0.6); // 0.5 + 0.1 (clamped)
  });

  test('EMA smoothing prevents spikes', () => {
    const current = 0.5;
    const outlier = 1.0;

    const smoothed = updateWithEMA(current, outlier, 0.3);
    expect(smoothed).toBe(0.65); // 0.3 * 1.0 + 0.7 * 0.5
  });
});
```

---

### 14.11 Performance Benchmarks

**Target Performance**:
- Objective score calculation: <10ms
- Setup contribution: <5ms
- Behavioral adjustment: <20ms (database query)
- Big Five adjustment: <5ms
- Total judgement pipeline: <50ms
- Confidence calculation: <15ms
- Time decay (10 CheckIns): <30ms

**Total End-to-End**: <150ms (well within acceptable UX threshold)

**LLM Explanation (when triggered)**: ~500ms additional (Haiku)

---

### 14.12 Migration Path

**Phase 1**: Implement proxy-based objective scoring (no external dependencies)

**Phase 2**: Add confidence gating and cold start defaults

**Phase 3**: Implement time decay for CheckIn responses

**Phase 4**: Add amplitude limits and update frequency controls

**Phase 5**: Deploy deterministic explanation templates

**Phase 6**: Add optional LLM explanation enhancement (behind feature flag)

**Phase 7**: Monitor stability metrics and tune parameters

---

## Summary of Technical Addendum

**What This Provides**:
1. ✅ Proxy-based formulas (no external API required)
2. ✅ Clear direct vs inferred parameter boundaries
3. ✅ MVP-level behavioral logic (2 behaviors only)
4. ✅ Complete confidence score formula
5. ✅ Cold start default values
6. ✅ Hybrid explanation approach (deterministic + optional LLM)
7. ✅ Time decay mechanism (30-day half-life for CheckIns, 60-day for behavior)
8. ✅ Update frequency limits (7 days for traits, 24 hours for behavior)
9. ✅ Amplitude constraints (±0.1 per update)
10. ✅ Complete integration pipeline with code

**Implementation Readiness**: All formulas are directly codeable with no conceptual gaps.

**Stability Guarantees**:
- Bounded weights prevent override
- Confidence gating protects cold start
- Time decay prevents stale data dominance
- Amplitude limits prevent flapping
- Update frequency prevents instability

**Next Steps**: Begin Phase 1 implementation (proxy-based objective scoring).
