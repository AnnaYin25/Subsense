# Check-In v2 Implementation Plan

**Date:** 2026-02-26
**Branch:** check_in
**Goal:** Upgrade Check-In from a disconnected UI mockup to a functioning personalized diagnostic engine per the v2 spec.

---

## Context

The current `CheckInScreen.tsx` has polished swipe UI and animations, but **never calls `submitCheckInFeedback`** — all user responses vanish into the void. The backend logic (`submitCheckInFeedback`, `updatePersonaPreferences`) already exists in `SubscriptionContext.tsx` and is correct.

The v2 spec (`checkin-v2-spec.docx`) upgrades the question logic: instead of fixed "usage/value" question sets for all swipe types, each action (Love/Unsure/Review) gets a distinct question flow, with Review using LLM-generated personalized questions.

---

## Critical Files

| File | Role |
|------|------|
| `app/src/screens/CheckInScreen.tsx` | Main UI — needs complete question flow redesign + backend wiring |
| `app/src/screens/CheckInScreen.simple.tsx` | Reference: has correct `recordFeedback` wiring pattern |
| `app/src/contexts/SubscriptionContext.tsx` | `submitCheckInFeedback()` (line 204), `updatePersonaPreferences()` (line 152) |
| `app/src/utils/database.ts` | `updateSubscription()` — writes usageScore/satisfactionScore |
| `app/src/types/index.ts` | `CheckInAction`, `CheckInResult`, `SetupPreferences` already defined |
| `app/src/screens/SubscriptionDetailScreen.tsx` | Phase 6: cancellation reason collection |

---

## Phase 1: Wire UI to Backend (Critical Baseline)
**Status:** [x] DONE (2026-02-26)
**Files:** `CheckInScreen.tsx` only
**Risk:** Low — pure wiring, no logic changes

### Changes:
1. Import `submitCheckInFeedback` from `useSubscriptions()`
2. Add `swipeAction` state: `useState<'love' | 'review' | 'unsure' | null>(null)`
3. On right swipe (love): set `swipeAction = 'love'`, call `submitCheckInFeedback({ subId, action: 'love', step1Reason: null, step2Reason: null })` before `nextCard()`
4. On left/down swipe: set `swipeAction` = 'review' or 'unsure', then enter question mode (existing flow)
5. On step2 selection (currently just calls `nextCard()`): call `submitCheckInFeedback({ subId, action: swipeAction, step1Reason: selectedReason, step2Reason: followUpChoice })` **then** `nextCard()`
6. Wrap call in try/catch; show no UI change on error (silent fail, data is best-effort)

### Verify:
- Swipe right on a sub → check ManagerScreen: usageScore +10, satisfactionScore +20
- Swipe left, pick reason, pick follow-up → Supabase `user_personas.setup_preferences` updates
- AT RISK badge appears after usageScore drops below 35

---

## Phase 2: Redesign Question Flows per V2 Spec
**Status:** [x] DONE (2026-02-26)
**Files:** `CheckInScreen.tsx`, `types/index.ts`
**Risk:** Medium — replaces existing question state machine

### New Question Flow State Machine:

**Love (1 fixed question):**
- Q: "最近用它最爽的一次是什么场景？"
- Options: `work_boost` 工作提效 / `relax` 放松娱乐 / `new_content` 发现新内容 / `habit` 就是习惯了
- After answer → call `submitCheckInFeedback` → `nextCard()`

**Unsure (2 fixed questions, sequential):**
- Q1: "你上次用它是今天、这几天、还是超过一周了？"
  - Options: `today` / `this_week` / `last_week` / `over_2_weeks`
- Q2 (always shown after Q1): "那次是主动打开的，还是看到通知才开的？"
  - Options: `active` 主动打开 / `passive` 看到通知才开
- After Q2 → call `submitCheckInFeedback` (q1Answer as step1Reason, q2Answer as step2Reason) → `nextCard()`

**Review (2 placeholder questions — v3 will use LLM generation):**
- Q1: "最近用得最多的是哪类场景？"
  - Options: `work` 工作/学习 / `entertainment` 娱乐休闲 / `utilities` 日常工具 / `social` 社交沟通
- Q2: "有没有想过降级或取消？"
  - Options: `cancel_soon` 想取消 / `downgrade` 考虑降级 / `keep_monitor` 先观察 / `undecided` 没想好
- After Q2 → call `submitCheckInFeedback` → `nextCard()`

### State changes:
- Removed `questionType: 'usage' | 'value'`
- Added `questionFlow: 'love' | 'unsure' | 'review' | null`
- Added `q1Answer: string | null` to track Q1 selection for conditional Q2
- All 3 swipe directions enter question mode (right = love, no longer instant fly-off)

### Verify:
- Love swipe shows 1-question screen, then auto-advances
- Unsure shows Q1, then Q2, then advances
- Review shows placeholder Q1/Q2

---

## Phase 3: CheckInLog Storage + DB Migration
**Status:** [x] DONE (code side — DB migration pending)
**Files:** `database.ts`, `SubscriptionContext.tsx`, `types/index.ts` + Supabase migration
**Risk:** Medium — requires DB schema change

### New Supabase table (run manually in Supabase SQL editor):
```sql
CREATE TABLE check_ins (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  sub_id uuid REFERENCES subscriptions NOT NULL,
  created_at timestamptz DEFAULT now(),
  action text CHECK (action IN ('love', 'review', 'unsure')),
  q1_answer text,
  q2_answer text,
  dive_deeper text  -- free text, max 500 chars
);

-- RLS
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their check-ins" ON check_ins
  FOR ALL USING (auth.uid() = user_id);
```

### New subscription columns (run manually):
```sql
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS last_used_recency text,  -- 'today'|'this_week'|'last_week'|'over_2_weeks'
  ADD COLUMN IF NOT EXISTS usage_type text,          -- 'active'|'passive'
  ADD COLUMN IF NOT EXISTS retention_anchor text;    -- future use
```

### Code changes (done):
1. `CheckInLog` type added to `types/index.ts`
2. Optional `lastUsedRecency`, `usageType`, `retentionAnchor` added to `Subscription` type
3. `insertCheckInLog(log: CheckInLog)` added to `database.ts` — silently fails if table missing
4. `mapSubscriptionFromDB` updated to map new columns
5. `updateSubscription` updated to write new columns
6. `SubscriptionContext.tsx > submitCheckInFeedback`: calls `insertCheckInLog` + updates `lastUsedRecency`/`usageType` for unsure action

### Verify:
- After check-in, `check_ins` table has new row with correct action/q1/q2
- `last_used_recency` column on subscription updates correctly for unsure flow

---

## Phase 4: Review LLM Question Generation
**Status:** [x] DONE (2026-02-26)
**Files:** `CheckInScreen.tsx`, new `app/src/utils/checkinLLM.ts`
**Risk:** Medium-High — LLM call with structured output

### New utility `checkinLLM.ts`:
```typescript
interface ReviewQuestions {
  valueType: string;
  q1: { text: string; options: { key: string; label: string }[] };
  q2Map: Record<string, { text: string; options: { key: string; label: string }[] }>;
}

async function generateReviewQuestions(
  subscription: { name: string; price: number; billingCycle: string },
  persona: SetupPreferences,
  recentHistory: CheckInLog[]  // last 3 entries from check_ins table
): Promise<ReviewQuestions>
```

- Use Claude haiku-4-5 (fast + cheap) for question generation
- System prompt: enforce JSON output schema, friend tone, no "为什么" phrasing
- If persona `price_sensitivity > 0.7`, ensure price-related option in Q1 or Q2
- Add 3s timeout with fallback to hardcoded questions on failure
- Parse response with JSON.parse; validate required keys before using

### CheckInScreen changes:
- When user selects Review: show loading spinner, call `generateReviewQuestions`, then render dynamic Q1
- Q2 rendered dynamically from `q2Map[q1Answer]`
- Store `valueType` + raw keys in CheckInLog

### Verify:
- Review swipe on Netflix shows content-related questions
- Review swipe on Adobe CC shows tool-capability questions
- High price_sensitivity persona → at least one price option in generated questions
- LLM timeout → falls back gracefully to hardcoded questions

---

## Phase 5: Session Summary Report
**Status:** [x] DONE (2026-02-26)
**Files:** `CheckInScreen.tsx`, new `app/src/utils/checkinSummary.ts`
**Risk:** Medium — second LLM call + new UI screen

### Replace "All Caught Up" screen with LLM summary:

**Done screen redesign:**
```
🎉  这周做完了！

⚠️ 需要留意（LLM生成诊断）
  • Adobe CC — 你在用免费功能付 Pro 的钱，值得重新评估
  • Spotify — 最近3周都是通知触发使用，依赖度下降

✓ 状态良好
  Notion · Netflix · GitHub Copilot
```

### `checkinSummary.ts`:
1. Build `SubSummary[]` from session's check-in results:
   - `recentTrend`: compare current action vs last 2 stored check_ins (improving/stable/declining)
   - `lastAction`: current session's action
   - `keySignal`: q1Answer or q2Answer (whichever is most meaningful)
   - `flagged`: true if action === 'review' OR usageScore < 35
2. Call Claude with `SubSummary[]` + persona, request structured JSON output
3. Enforce output schema: `{ flagged: [{subId, name, note}], healthy: [string] }`
4. Display result in done screen

### Verify:
- After reviewing all subs, done screen shows LLM summary (not just checkmark)
- Flagged subs match those with review/low-score actions
- Healthy subs list correct

---

## Phase 6: Cancellation Reason Collection
**Status:** [x] DONE (2026-02-26)
**Files:** `SubscriptionDetailScreen.tsx`, `database.ts`, `types/index.ts`
**Risk:** Low — isolated to one screen

### When user cancels a subscription (changes status to 'cancelled'):

1. Show modal: "为什么取消这个订阅？"
2. Options (single select):
   - `too_expensive` 太贵了
   - `not_using` 用得太少
   - `found_alternative` 找到替代品
   - `no_longer_need` 不再需要
   - `trial_ended` 试用到期
3. Save as `cancellation_reason` in subscriptions table

### DB migration:
```sql
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancellation_reason text;
```

### Verify:
- Cancel a subscription → reason modal appears
- Choose reason → subscription updated with reason in Supabase
- Skip (user dismisses modal) → no reason recorded, cancellation still proceeds

---

## Phase 7: Dive Deeper
**Status:** [x] DONE (2026-02-26)
**Files:** `CheckInScreen.tsx`, `database.ts`
**Risk:** Low — additive to existing done flow

### After Q2 completion (for Review and Unsure), show two options:
- **下一个订阅** (primary) → `nextCard()`
- **继续聊这个** (secondary, ghost button)

### Dive Deeper flow:
- Expand: show free text input below the Q2 result
- Placeholder: "有什么具体想说的？（可选）"
- Max 500 chars (enforced by TextInput `maxLength`)
- Submit button → save to `check_ins.dive_deeper` column → `nextCard()`
- User can also skip by tapping "下一个订阅"

### Data handling for free text:
- Store raw text (≤500 chars) in `check_ins.dive_deeper`
- In SubSummary generation, include dive_deeper as `keySignal` if present (takes priority over q2Answer)
- Do not send dive_deeper text to question-generation LLM (only to summary LLM)

### Verify:
- After Q2, two buttons appear
- Tap "继续聊这个" → text input expands inline
- Type + submit → `check_ins.dive_deeper` populated in Supabase
- Skip → dive_deeper is null in DB

---

## Implementation Order

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 (independent) → Phase 7
   ✅         ✅         ✅          ✅          □           □                  □
 wiring    flows    DB+logging   LLM Q    summary+LLM   cancel reason    dive deeper
```

Phases 1-4: DONE (2026-02-26)
Phase 5: LLM session summary — next
Phase 6: Fully independent, can be done anytime
Phase 7: Additive to Phase 2/3

---

## Lessons Learned

### L1: v1 question keys (English strings) vs v2 keys (short slug codes)
- v1 used full English strings as reasons: `"Too expensive"`, `"Not using enough"`
- v2 uses short slug keys: `work_boost`, `today`, `active`, `cancel_soon`
- `submitCheckInFeedback` persona bump logic matches against v1 strings → bumps won't fire for v2 keys
- **Decision:** acceptable for now; persona bumps from action type (love/review/unsure) still apply. Update per-reason bumps in a later pass.

### L2: right swipe changed behavior in v2
- v1: right swipe = instant card fly-off, no question shown
- v2: right swipe = enter love question flow (spring back, show Q)
- `triggerAction('love')` now calls `enterQuestionMode('love')` instead of triggering animation

### L3: DB migrations are manual
- `insertCheckInLog` silently fails (console.warn) if `check_ins` table doesn't exist
- Code is forward-compatible: run the SQL migrations at any time to activate logging
