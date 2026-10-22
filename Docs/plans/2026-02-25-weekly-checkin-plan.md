# Weekly Check-In Module: Design & Implementation Plan

**Date:** 2026-02-25
**Status:** Core logic implemented; UI-backend wiring incomplete
**Branch:** check_in

---

## Development Rules

1. **Describe before you code** — Before writing any code, describe your approach and wait for approval. If requirements are unclear, ask questions first.
2. **Three-file limit per task** — If a task requires modifying more than three files, stop and break it into smaller subtasks.
3. **List risks after writing code** — After submitting code, list potential issues and suggest test cases to cover those scenarios.
4. **Reproduce before fixing bugs** — When a bug is found, first write a test that reliably reproduces it, then fix until the test passes.
5. **Update rules after every correction** — After each correction, append a new rule to the Lessons Learned section at the bottom of this file to prevent recurrence.

---

## Strategic Role

The Weekly Check-In is not a feedback form. It is the **behavioral data engine** that powers SubSense's AI personalization loop:

- **Persona evolution** — each session nudges `setup_preferences` based on revealed behavior
- **Subscription risk scoring** — `usageScore` and `satisfactionScore` drive AT RISK / REVIEW badges in ManagerScreen
- **Waste detection** — low-usage patterns surface proactive cancel/pause recommendations
- **Audit calibration** — accumulated preferences influence how AuditScreen weights cost vs quality tradeoffs

Without Check-In data, SubSense is a static tracker. With it, SubSense becomes a system that *learns the user*.

---

## Current Implementation Status

### What's built

| Layer | Location | Status |
|---|---|---|
| Swipe UI + question flow | `CheckInScreen.tsx` | Built |
| `submitCheckInFeedback()` — scoring + persona update | `SubscriptionContext.tsx:204` | Built |
| `updatePersonaPreferences()` — delta merge + DB write | `SubscriptionContext.tsx:152` | Built |
| Risk badges in ManagerScreen | `ManagerScreen.tsx` | Built |

### The Gap: UI is not wired to the logic

`CheckInScreen.tsx` never calls `submitCheckInFeedback`. All question selections terminate with `nextCard()` — no data is written.

```
User swipes left → step1 question → step2 follow-up → nextCard()
                                                        ^
                                          submitCheckInFeedback() should be called here
```

This is the **primary engineering task**.

---

## Learning Loop (Already Implemented in Context)

`submitCheckInFeedback(result: CheckInResult)` in `SubscriptionContext.tsx` does:

1. **Subscription scoring** — adjusts `usageScore` / `satisfactionScore` based on swipe action:
   - `love` → +10 usage, +20 satisfaction
   - `review` → −20 usage, −25 satisfaction
   - `unsure` → −10 usage, −10 satisfaction

2. **Persona preference drift** — maps step1/step2 reasons to additive deltas on `setup_preferences`:
   - `"Too expensive"` → `price_sensitivity +0.12`, `budget_tightness +0.08`
   - `"Not using enough"` → `waste_tolerance −0.10`, `budget_tightness +0.06`
   - `"Found alternative"` → `exploration_tendency +0.06`, `quality_preference +0.04`
   - Step2 reasons (price spikes, content quality, overlaps) layer on top

3. **All values clamped to [0, 1]** and written back to `user_personas.setup_preferences`

4. **Local state updated immediately** — optimistic update before DB confirmation

### Pattern detection (to be added as derived logic)

| Observed behavior | Detected pattern | System response |
|---|---|---|
| `usageScore < 35` for 3+ consecutive sessions | Waste candidate | Elevate to AT RISK, suggest cancel |
| `satisfactionScore` high + `usageScore` < 30 | Emotional attachment | Softer language in prompts, no hard push |
| `budget_tightness > 0.7` + monthlySpend > budget | Budget pressure | Trigger spend alert in Report |

---

## Wiring Task: Connect CheckInScreen to Context

### What needs to change in `CheckInScreen.tsx`

1. Import `submitCheckInFeedback` from `useSubscriptions()`
2. Add state to track swipe action: `const [swipeAction, setSwipeAction] = useState<'love' | 'review' | 'unsure' | null>(null)`
3. Capture action on swipe/button press before transitioning to question mode
4. On step2 selection (currently just calls `nextCard()`), call:

```typescript
await submitCheckInFeedback({
  subId: currentSub.id,
  action: swipeAction,
  step1Reason: selectedReason,
  step2Reason: followUpChoice,
});
nextCard();
```

5. For `love` swipes (no question flow), call with `step1Reason: null, step2Reason: null`

### Implementation constraints

- All mutations must go through `useSubscriptions()` — never call `database.ts` directly
- Runtime fields are camelCase: `usageScore`, `satisfactionScore` (not snake_case)
- Local state is already updated optimistically in `submitCheckInFeedback` — no extra setState needed in screen

---

## Persona Drift Detection

`updatePersonaPreferences` merges incremental deltas into the stored `setup_preferences` JSON. Over multiple check-ins, this creates natural drift:

**Example trajectory:**
```
Initial: waste_tolerance = 0.6  (self-reported: "I don't mind unused subs")
Week 1:  "Not using enough" selected  → −0.10 → 0.50
Week 3:  "Not using enough" again     → −0.10 → 0.40
Week 5:  "Too many subs" step2        → −0.05 → 0.35
Result:  System learns user has low waste tolerance despite self-report
```

This behavioral override of self-reported preferences is the core AI value proposition of the module.

---

## Success Metrics

### Short-term (session quality)
- Check-in completion rate (% of active subs reviewed per session)
- Step2 engagement rate (did users answer both questions vs drop at step1)
- Score distribution variance (are scores differentiating, or all clustering at 50?)

### Mid-term (behavioral impact)
- Reduction in AT RISK subscriptions retained past 4 weeks
- Delta between initial `setup_preferences` and current (drift magnitude)
- % of `review` actions that lead to cancellation/pause within 30 days

### Long-term (system accuracy)
- Audit recommendation acceptance rate (do Check-In-informed audits get followed?)
- Persona prediction alignment (qualitative: do users feel the recommendations understand them?)

---

## Adaptive Questioning (Future Enhancement)

Current: fixed 4-option question sets for `usage` and `value` flows.

Target behavior:

| Condition | Adaptation |
|---|---|
| Same step1 reason 3 weeks in a row | Skip step1, go straight to step2 with pre-filled reason |
| `usageScore` consistently high (>70) | Show positive reinforcement only, skip drill-down |
| `satisfactionScore` dropped sharply | Add "What changed?" as additional step |
| New subscription (<30 days) | Softer questions, no cancel suggestions |

Requires reading `checkin_responses` history per subscription — currently stored in DB but not queried in UI.

---

## Files to Modify

| File | Change |
|---|---|
| `app/src/screens/CheckInScreen.tsx` | Wire swipe actions + question selections to `submitCheckInFeedback` |
| `app/src/contexts/SubscriptionContext.tsx` | Add consecutive low-score flagging (optional) |
| `app/src/types/index.ts` | No changes needed — `CheckInResult` already defined |

---

## Verification Steps

1. Swipe right on a subscription → `usageScore`/`satisfactionScore` should increase; check in ManagerScreen
2. Select "Too expensive" + any step2 → check Supabase `user_personas.setup_preferences`: `price_sensitivity` should have increased
3. AT RISK badge should appear in ManagerScreen after `usageScore` drops below 35
4. Repeat "Not using enough" 3 times across sessions → `waste_tolerance` should drift downward in DB
