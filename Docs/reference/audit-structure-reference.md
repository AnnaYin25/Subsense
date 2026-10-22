# Audit Screen — Complete Structure Reference
> Last updated: 2026-02-17 | Source of truth for understanding and modifying the Audit feature.

---

## File Map

| File | Role |
|---|---|
| `app/src/screens/AuditScreen.tsx` | Main screen: FSM, UI, all state, routing |
| `app/src/utils/claude.ts` | Claude API calls, system prompt, response parsing |
| `app/src/utils/auditScorer.ts` | Deterministic score calculator (no API calls) |
| `app/src/utils/alternativesGenerator.ts` | Rule-based alternatives + Claude fallback |
| `app/src/types/index.ts` | All shared types: `AuditSlots`, `AuditStage`, `AuditReport`, etc. |
| `app/src/screens/AddSubscriptionScreen.tsx` | Receives `prefillData` from Audit CTA |
| `app/src/navigation/RootNavigator.tsx` | Route type for `prefillData` param |

---

## 1. Data Types

### AuditStage (6 stages in order)
```typescript
type AuditStage =
  | 'service_price'      // Stage 1
  | 'motivation'         // Stage 2
  | 'expected_usage'     // Stage 3
  | 'friction_risk'      // Stage 4
  | 'budget_fit'         // Stage 5
  | 'overlap_decision';  // Stage 6
```

### AuditSlots (all slots collected during conversation)
```typescript
interface AuditSlots {
  // Stage 1
  service_name?: string;
  price?: number | 'not_sure';            // raw unnormalized price
  billing_cycle?: 'monthly' | 'yearly' | 'weekly' | 'not_sure';

  // Stage 2
  primary_motivation?: string;            // 'work' | 'entertainment' | 'health' | 'learning' | 'other'
  motivation_note?: string;               // optional free text

  // Stage 3
  expected_frequency?: 0 | 1 | 2.5 | 4.5 | 7 | 'not_sure'; // buckets only

  // Stage 4
  top_risk?: 'low_usage' | 'forget_cancel' | 'price' | 'overlap' | 'not_sure';

  // Stage 5
  budget_feel?: 'comfortable' | 'tight' | 'no_way' | 'not_sure';

  // Stage 6
  overlap_level?: 'none' | 'some' | 'significant' | 'high' | 'not_sure';

  // Client-derived (never set by Claude)
  price_monthly?: number;                 // normalized to /month; used by scorer

  // Pre-score gate
  additional_notes?: string;             // optional user addition before scoring
}
```

**Key rule:** `undefined` = slot never answered (blocks stage advance).
`'not_sure'` = user answered "I don't know" (counts as filled, but adds uncertainty penalty).

### Maybe\<T\>
```typescript
type Maybe<T> = T | 'not_sure';
```

---

## 2. FSM Stage Map

```
Stage 1  service_price    Required: service_name, price
Stage 2  motivation       Required: primary_motivation
Stage 3  expected_usage   Required: expected_frequency
Stage 4  friction_risk    Required: top_risk
Stage 5  budget_fit       Required: budget_feel
Stage 6  overlap_decision Required: overlap_level
```

Defined in `AuditScreen.tsx`:
```typescript
const REQUIRED_SLOTS_PER_STAGE: Record<AuditStage, (keyof AuditSlots)[]> = {
  service_price:    ['service_name', 'price'],
  motivation:       ['primary_motivation'],
  expected_usage:   ['expected_frequency'],
  friction_risk:    ['top_risk'],
  budget_fit:       ['budget_feel'],
  overlap_decision: ['overlap_level'],
};
```

**Stage advance rule:**
```typescript
function advanceStageIfReady(stage, slots) {
  const required = REQUIRED_SLOTS_PER_STAGE[stage];
  const allFilled = required.every(k => slots[k] !== undefined); // 'not_sure' ✓ undefined ✗
  if (!allFilled) return stage;
  return STAGE_ORDER[idx + 1] ?? stage;
}
```

**Finish guard:**
```typescript
function canFinish(turn, stage) {
  return turn >= 5 && stage === 'overlap_decision';
}
// FSM guarantees all prior slots are filled by the time overlap_decision is reached.
```

---

## 3. Claude Protocol

### What the client sends (every turn)
`buildContext()` → `AuditContext` injected into system prompt:
```typescript
{
  stage,                      // current FSM stage
  turn_index,                 // how many turns have passed
  slots,                      // all collected slots so far
  monthly_budget,             // from user profile
  persona: {
    price_sensitivity,        // from UserPersona.setup_preferences
    budget_tightness,
    waste_tolerance,
  },
  existing_subscriptions,     // [{ name, cost }]
  user_name,
}
```

### What Claude returns (ClaudeAuditResponse)
```typescript
{
  stage,                      // echoed back (client ignores for FSM)
  turn_index,                 // echoed back
  is_finished: false,         // always false — client decides when done
  bubbles: string[],          // 0–1 context messages (no questions inside)
  question: string,           // exactly one question
  ui: {
    input_mode: 'options' | 'text',  // never 'both'
    allow_optional_note: boolean,
    note_hint: string,
    max_chars: number,
  },
  options: AuditOption[],     // [{id, label, value}] — empty if input_mode='text'
  slots_delta: Partial<AuditSlots>,  // slots extracted from this user turn
  missing_slots: string[],    // required slots still undefined (NOT 'not_sure') — client recomputes this
  flags: {
    contradiction: boolean,   // new answer conflicts with prior slot
    off_topic: boolean,       // user went off-topic
    price_cycle_unclear: boolean, // price given without billing period
  },
  aha: {
    triggered: boolean,
    bubbles: string[],        // max 1, must include action hint
  },
}
```

### Claude Aha trigger conditions
Claude sets `aha.triggered = true` only when:
- `overlap_level === 'significant' || 'high'`
- `price > 8% of monthly_budget`
- `expected_frequency ≤ 1 AND top_risk === 'low_usage' || 'forget_cancel'`
- `flags.contradiction === true`

### Model + token budget
```typescript
model: 'claude-sonnet-4-20250514'
max_tokens: 800
```
To change the model or budget: edit `claude.ts` → `startAuditConversation` and `continueAuditConversation`.

---

## 4. Client FSM Logic (handleClaudeResponse)

Processing order every turn:

```
1.  setLastFlags(response.flags)
2.  if flags.off_topic
      → show rejection message, set uiMode='text', return (no slot merge, turn NOT incremented)
3.  if flags.price_cycle_unclear
      → merge slots_delta (raw price stored), show cycle recovery options, return
4.  merge slots_delta → newSlots
5.  normalize price_monthly (if price is a number AND billing_cycle is known and not 'not_sure')
6.  setCollectedSlots(newSlots)
7.  increment notSureCount by count of 'not_sure' values in delta
8.  check shouldShowAha → if allowed: setLastAhaTurn, setAhaTriggered(true)
9.  displayBubbles(response.bubbles [capped at 1], aha bubble if allowed)
10. compute actuallyMissing = REQUIRED_SLOTS_PER_STAGE[stageAtTime].filter(k => newSlots[k] === undefined)
      ↑ client recomputes this — does NOT trust Claude's missing_slots
11. if actuallyMissing.length > 0
      → show RECOVERY_QUESTIONS[actuallyMissing[0]], setUiMode, setTurnIndex+1, return
12. nextStage = advanceStageIfReady(stageAtTime, newSlots)
13. setCurrentStage(nextStage)
14. if canFinish(turn+1, nextStage)
      → store slots in pendingFinishSlotsRef
      → show "Anything to add?" message
      → setAwaitingFinalComment(true)
      → (do NOT call generateAndShowReport yet)
    else
      → questionToShow = (nextStage !== stageAtTime)
          ? RECOVERY_QUESTIONS[REQUIRED_SLOTS_PER_STAGE[nextStage][0]].question  ← key fix!
          : response.question
      → effectiveOptions = response.options if non-empty, else getDefaultOptionsForStage(nextStage)
      → setOptions(effectiveOptions), setUiMode
15. setTurnIndex(turn+1)
finally: setIsTyping(false)
```

**Critical: Why the question is replaced on stage advance**
Claude's `response.question` was written for the OLD stage. When the FSM advances, that question is wrong. The client substitutes the recovery question for the new stage's first required slot.

---

## 5. Recovery Questions

Fired locally (no API call) when a required slot is still `undefined`.
Defined in `AuditScreen.tsx` as `RECOVERY_QUESTIONS`:

| Slot | Input Mode | Question |
|---|---|---|
| `service_name` | text | "What's the name of the service you're considering?" |
| `price` | text | "What's the cost? (e.g. '15/month', '120/year', '5/week')" |
| `price_cycle_unclear` | options | "Just to confirm — is that per month, per year, or per week?" |
| `primary_motivation` | options | "What's the main reason you want it?" |
| `expected_frequency` | options | "How often would you realistically use it per week?" |
| `top_risk` | options | "What's the biggest thing that might make this a waste?" |
| `budget_feel` | options | "How does the price feel relative to your budget?" |
| `overlap_level` | options | "How much does it overlap with your current subscriptions?" |

**To modify a recovery question:** edit the `RECOVERY_QUESTIONS` object in `AuditScreen.tsx:68`.
**To add an option:** add `{ id, label, value }` to the relevant `options` array.

---

## 6. Price Normalization

`price_monthly` is calculated by the client (never by Claude) once both `price` and `billing_cycle` are known:

```typescript
function normalizePriceToMonthly(rawPrice, cycle) {
  switch (cycle) {
    case 'yearly':  return Math.round((rawPrice / 12) * 100) / 100;
    case 'weekly':  return Math.round((rawPrice * 52 / 12) * 100) / 100;
    case 'monthly': return rawPrice;
  }
}
```

`price_monthly` is what the scorer uses. If `price_cycle_unclear` flag fires, raw price is stored but `price_monthly` stays `undefined` until cycle is confirmed.

---

## 7. Input UI Mode Logic

Three mutually exclusive footer states (never rendered simultaneously):

```
Priority 1: awaitingFinalComment
  → TextInput ("Add context...") + SKIP button (or Send when text typed)

Priority 2: shouldShowText
  → TextInput ("Type your answer...") + Send button

Priority 3: options mode (default)
  → Option chips rendered in ScrollView
  → "Type my own answer" link in footer
```

`shouldShowText` is `true` when:
```typescript
const shouldShowText =
  currentStage === 'service_price' ||  // Stage 1 always uses text
  showTextInput ||                      // user tapped "Type my own answer"
  notSureCount >= 2 ||                  // user has said "not sure" twice or more
  lastFlags.contradiction;              // Claude flagged a contradiction
// ⚠️ price_cycle_unclear is intentionally excluded — cycle recovery uses option chips
```

**To change the "not_sure" threshold for auto-enabling text input:** change `>= 2` in `AuditScreen.tsx:258`.

---

## 8. Aha Moment Control

```typescript
const AHA_COOLDOWN_TURNS = 3;  // min turns between aha moments

function shouldShowAha(response, turn, stage, slots, budget) {
  if (!response.aha.triggered || response.aha.bubbles.length === 0) return false;
  if (ahaTriggered) return false;             // max 1 per audit session
  if (turn - lastAhaTurn < AHA_COOLDOWN_TURNS) return false;
  if (['service_price', 'motivation'].includes(stage)) {
    // Only trigger in early stages if price is extreme (>15% of budget)
    const price = typeof slots.price_monthly === 'number' ? slots.price_monthly : 0;
    if (price / (budget || 1) < 0.15) return false;
  }
  return true;
}
```

**To adjust:** change `AHA_COOLDOWN_TURNS` (line 58), the `0.15` threshold (line 248), or remove the per-audit limit `ahaTriggered` guard.

---

## 9. Scoring System

Implemented in `auditScorer.ts`. No API calls — entirely deterministic.

### Dimension breakdown

| Dimension | Max | Default when no slot | Notes |
|---|---|---|---|
| Need Fit | 25 | 12 (neutral) | Based on `primary_motivation` category |
| Expected Usage | 25 | 10 (pessimistic) | Mapped from `expected_frequency` bucket |
| Budget Fit | 25 | 12 (neutral) | `price_monthly / budget` ratio + `budget_feel` adjustment |
| Overlap | 15 | 7 (neutral) | From `overlap_level` |
| Risk | 10 | 5 (neutral) | From `top_risk` |
| Uncertainty Penalty | −10 max | 0 | −2 per `'not_sure'` slot |

### expected_frequency → score
```
0   (Rarely)   → 0 pts
1   (Once/wk)  → 10 pts
2.5 (2–3×/wk)  → 18 pts
4.5 (4–5×/wk)  → 23 pts
7   (Daily)    → 25 pts
```

### Budget Fit ratio thresholds (before `budget_feel` adjustment)
```
< 3%  of budget → 24 pts
< 6%            → 20 pts
< 10%           → 15 pts
< 15%           → 10 pts
≥ 15%           → 10 - ((ratio-0.15) * 50), min 0
```
Then `budget_feel` adds/subtracts: `comfortable +5`, `tight −3`, `no_way −10`.

### Top Risk → penalty
```
forget_cancel → −8 pts from risk score
low_usage     → −6 pts
price         → −5 pts
overlap       → −4 pts
not_sure      → −3 pts
```

### Recommendation mapping
```
score ≥ 70 AND uncertainty = 'low'   → subscribe_now
score ≥ 70 AND uncertainty ≠ 'low'  → start_trial  (uncertainty guard)
score 55–69                          → start_trial
score 40–54                          → watchlist
score < 40                           → alternative
uncertainty = 'high' (3+ not_sure)  → max: start_trial (never subscribe_now)
```

### Uncertainty level
```
0 not_sure slots → 'low'
1–2              → 'medium'
3+               → 'high'
```

**To adjust scoring weights or thresholds:** edit `auditScorer.ts`.

---

## 10. Pre-Score Gate ("Anything to add?")

Triggered when `canFinish()` returns true:

```
All 6 stages complete
  ↓
Bot: "That's all I need! Anything else you'd like me to factor in before I calculate your score?"
  ↓
┌─────────────────────┬───────────────────────────┐
│  User types nothing │  User types something     │
│  (SKIP button)      │  (Send button)            │
└──────────┬──────────┴──────────────┬────────────┘
           ↓                          ↓
   generateAndShowReport       slots + additional_notes
   (original slots)            → generateAndShowReport
           ↓                          ↓
              viewMode = 'finalizing' (2.8s)
                          ↓
              viewMode = 'report'
```

State involved:
- `awaitingFinalComment: boolean` — gate is open
- `finalCommentText: string` — user's typed text
- `pendingFinishSlotsRef: useRef<AuditSlots>` — slots frozen at canFinish point (useRef avoids stale closure)

`additional_notes` is surfaced in the report's Factors list as "Your Notes" (type: 'pass', no score impact).

---

## 11. Report Generation

`generateAndShowReport(slots)` in `AuditScreen.tsx:416`:

1. `setViewMode('finalizing')` — shows spinner screen (2.8s delay)
2. `calculateAuditScore(...)` → `ScoreResult`
3. `detectCategory(primary_motivation)` → `'Entertainment' | 'Productivity' | 'Utilities' | 'Health'`
4. `buildRecommendationText(type, uncertainty)` → human-readable string
5. `buildFactors(slots, scoreResult)` → array of `AuditFactor` cards
6. Assemble `AuditReport` object, push to `auditReports` state
7. `setViewMode('report')`

### buildFactors logic
Generates a factor card for each non-null slot with context:

| Slot | Factor title | risk/pass logic |
|---|---|---|
| `expected_frequency` | Expected Usage | `< 2.5` → risk |
| `budget_feel` | Budget Comfort | `comfortable` → pass |
| `overlap_level` | Overlap with Existing Subs | `significant`/`high` → risk |
| `top_risk` | Identified Risk | always risk (pre-built label text) |
| uncertainty_level ≠ 'low' | Uncertainty | always risk |
| `additional_notes` | Your Notes | always pass |

### detectCategory keyword matching
```typescript
function detectCategory(motivation) {
  if includes 'entert'/'movie'/'music'/'game' → 'Entertainment'
  if includes 'health'/'fitness'/'workout'    → 'Health'
  if includes 'work'/'productivity'/'tool'/'learn' → 'Productivity'
  default → 'Utilities'
}
```
**To add a keyword:** edit `AuditScreen.tsx:981`.

---

## 12. CTA Actions

| recommendation_type | Button label | Action |
|---|---|---|
| `subscribe_now` | Track This Subscription | `navigate('AddSubscription', { prefillData: { name, cost, category, nextRenewalDate } })` |
| `start_trial` | Start Trial + Set Reminder | `addSubscription({ status: 'paused', isReminder: true, planName: 'Trial', iconEmoji: '⏳' })` |
| `watchlist` | Save to Watchlist | `addSubscription({ status: 'paused', isReminder: true, planName: 'Watchlist', iconEmoji: '👀' })` |
| `alternative` | See 3 Alternatives | opens `showAlternativesModal`, calls `generateAlternatives(name, category, cost)` |

Secondary CTA: **Start Another Audit** → `handleReset()` → all state cleared, `viewMode = 'home'`, tab bar reappears.

### prefillData fields sent to AddSubscriptionScreen
```typescript
{
  name: report.service_name,
  cost: parseFloat(report.cost.replace(/[^0-9.]/g, '')),
  category: report.category,
  nextRenewalDate: nextMonthISO(),  // 30 days from today
}
```

---

## 13. State Variables Reference

| Variable | Type | Purpose |
|---|---|---|
| `viewMode` | `'home' \| 'chat' \| 'finalizing' \| 'report'` | Which screen to render |
| `currentStage` | `AuditStage` | Current FSM stage |
| `turnIndex` | `number` | Counts each round-trip (used in canFinish guard) |
| `collectedSlots` | `AuditSlots` | All slots merged so far |
| `messages` | `ChatMessage[]` | Full conversation for display + API history |
| `options` | `AuditOption[]` | Current option chips |
| `inputValue` | `string` | Text input controlled value |
| `isTyping` | `boolean` | Shows typing indicator, disables input |
| `uiMode` | `'options' \| 'text'` | Tracks Claude's intended mode |
| `showTextInput` | `boolean` | User manually toggled "Type my own" |
| `notSureCount` | `number` | Cumulative count of 'not_sure' choices |
| `lastFlags` | `ClaudeAuditResponse['flags']` | Flags from last Claude response |
| `lastAhaTurn` | `number` | Turn of last aha (cooldown tracking) |
| `ahaTriggered` | `boolean` | Per-audit aha limit (max 1) |
| `awaitingFinalComment` | `boolean` | Pre-score gate is open |
| `finalCommentText` | `string` | User text in final comment input |
| `pendingFinishSlotsRef` | `useRef<AuditSlots>` | Slots frozen at canFinish (avoids stale closure) |
| `auditReports` | `AuditReport[]` | All past reports (session-only, not persisted) |
| `selectedReport` | `AuditReport \| null` | Report currently shown |
| `showAlternativesModal` | `boolean` | Alternatives bottom sheet |
| `alternatives` | `Alternative[]` | Results from alternativesGenerator |

---

## 14. Where to Modify What

| What you want to change | Where to edit |
|---|---|
| Add a new FSM stage | `STAGE_ORDER` + `REQUIRED_SLOTS_PER_STAGE` in `AuditScreen.tsx`, add slot to `AuditSlots` in `types/index.ts`, update `RECOVERY_QUESTIONS`, update `buildSystemPrompt` stage map in `claude.ts` |
| Change recovery question text or options | `RECOVERY_QUESTIONS` in `AuditScreen.tsx:68` |
| Change scoring weights | `auditScorer.ts` — each dimension has inline comments |
| Change recommendation thresholds (e.g. score ≥ 70) | `auditScorer.ts:164–175` |
| Change Aha cooldown or per-stage budget threshold | `AHA_COOLDOWN_TURNS` (line 58) and `0.15` threshold (line 248) in `AuditScreen.tsx` |
| Change when text input auto-appears | `shouldShowText` computed at `AuditScreen.tsx:255` |
| Change Claude's persona / tone / rules | `buildSystemPrompt()` in `claude.ts:65` |
| Change the "anything to add?" gate message | `AuditScreen.tsx:385` |
| Change CTA labels or button colors | `getCTAConfig()` in `AuditScreen.tsx:1059` |
| Change what happens when user taps a CTA | `handlePrimaryCTA()` in `AuditScreen.tsx:563` |
| Change the finalizing screen delay | `await new Promise(r => setTimeout(r, 2800))` in `generateAndShowReport` |
| Change report factor card text | `buildFactors()` in `AuditScreen.tsx:999` |
| Change recommendation text ("looks promising…") | `buildRecommendationText()` in `AuditScreen.tsx:987` |
| Change category detection keywords | `detectCategory()` in `AuditScreen.tsx:978` |
| Add a new slot to the report | Add to `AuditSlots` in `types/index.ts`, extract in Claude system prompt, handle in `buildFactors` |
| Change Claude model or token limit | `claude.ts:309` and `claude.ts:338` |
| Change number of bubbles shown | `bubbles.slice(0, 1)` in `displayBubbles()` → change `1` |

---

## 15. Flow Diagram

```
handleStartAudit()
  │
  ├─ reset all state
  ├─ setViewMode('chat')
  └─ startAuditConversation(ctx) → handleClaudeResponse()
                                         │
                                    Each user input
                                         │
                              handleSendMessage(text)
                                         │
                              continueAuditConversation(history, ctx)
                                         │
                              handleClaudeResponse(response, slotsAtTime, stageAtTime, turn)
                                         │
                              ┌──────────────────────┐
                              │ off_topic?            │ → rejection message, return
                              │ price_cycle_unclear?  │ → cycle recovery, return
                              │ merge slots_delta     │
                              │ normalize price       │
                              │ update notSureCount   │
                              │ check aha             │
                              │ displayBubbles        │
                              │ compute actuallyMissing│
                              │ missing? → recovery   │ → return
                              │ advanceStage          │
                              │ canFinish?            │ → awaitingFinalComment gate
                              │ show question/options │
                              └──────────────────────┘
                                         │
                              awaitingFinalComment = true
                                         │
                              ┌──────────────────────┐
                              │ Skip                 │ handleSkipToScore()
                              │ Submit               │ handleSubmitFinalComment()
                              └──────────────────────┘
                                         │
                              generateAndShowReport(slots)
                                         │
                              viewMode = 'finalizing' (2.8s)
                                         │
                              calculateAuditScore() [deterministic]
                                         │
                              build AuditReport
                                         │
                              viewMode = 'report'
                                         │
                              ┌──────────────────────┐
                              │ subscribe_now → navigate AddSubscription
                              │ start_trial   → addSubscription(paused reminder)
                              │ watchlist     → addSubscription(watchlist)
                              │ alternative   → generateAlternatives modal
                              └──────────────────────┘
                                         │
                              "Start Another Audit" → handleReset() → viewMode='home'
```
