# Audit Screen — Logic & Architecture Plan
> 2026-02-17 | Status: Implemented

---

## 1. 核心设计原则 Core Design Principles

**客户端拥有控制权，Claude 只提取信息。**
The client owns all control flow. Claude is a slot extractor only.

| 职责 Responsibility | 持有方 Owner |
|---|---|
| 阶段推进 Stage progression | **Client FSM** |
| 槽位提取 Slot extraction | **Claude** (`slots_delta`) |
| 缺失槽位恢复 Missing slot recovery | **Client** (local template, no API call) |
| 评分计算 Score calculation | **Client** (deterministic) |
| Aha 触发判断 | **Claude flags** + **Client enforces cooldown** |
| isFinished 守卫 | **Client** (`turn ≥ 5 && stage = overlap_decision`) |

---

## 2. 6阶段对话地图 Stage Map

```
Stage 1  service_price     必填槽: service_name, price
Stage 2  motivation        必填槽: primary_motivation
Stage 3  expected_usage    必填槽: expected_frequency
Stage 4  friction_risk     必填槽: top_risk
Stage 5  budget_fit        必填槽: budget_feel
Stage 6  overlap_decision  必填槽: overlap_level
```

**阶段推进规则 FSM Rule:**
- 必填槽全部 `!== undefined`（包括 `'not_sure'`）→ 升阶
- `'not_sure'` 视为"已回答"，不阻塞升阶，但进入 uncertainty scoring
- `undefined`（从未回答）→ 阻塞升阶，触发 recovery question

---

## 3. AuditSlots 槽位定义

```typescript
interface AuditSlots {
  // Stage 1
  service_name?: string;
  price?: Maybe<number>;                              // raw number or 'not_sure'
  billing_cycle?: Maybe<'monthly' | 'yearly' | 'weekly'>;
  // Stage 2
  primary_motivation?: string;                        // 'work' | 'entertainment' | 'health' | 'learning' | 'other'
  motivation_note?: string;
  // Stage 3
  expected_frequency?: Maybe<0 | 1 | 2.5 | 4.5 | 7>; // bucket values only
  // Stage 4
  top_risk?: Maybe<string>;                           // 'low_usage' | 'forget_cancel' | 'price' | 'overlap' | 'not_sure'
  // Stage 5
  budget_feel?: Maybe<'comfortable' | 'tight' | 'no_way'>;
  // Stage 6
  overlap_level?: Maybe<'none' | 'some' | 'significant' | 'high'>;
  // Client-derived (never set by Claude)
  price_monthly?: number;                             // normalized after billing_cycle confirmed
  // Post-audit user addition
  additional_notes?: string;
}

type Maybe<T> = T | 'not_sure';
```

**Price normalization rule:**
```
yearly  → price / 12
weekly  → price × 52 / 12
monthly → price (as-is)
```
`price_monthly` 仅在 `billing_cycle` 明确后由客户端计算，用于评分。Claude 永远不写 `price_monthly`。

---

## 4. Claude 协议 Protocol

### 每轮 Claude 必须返回的 JSON 字段

```typescript
interface ClaudeAuditResponse {
  stage: AuditStage;
  turn_index: number;
  is_finished: false;              // 始终 false，客户端决定何时结束
  bubbles: string[];               // 最多1条 context bubble，无问句
  question: string;                // 本轮唯一问题
  ui: {
    input_mode: 'options' | 'text'; // 永远不是 'both'
    allow_optional_note: boolean;
    note_hint: string;
    max_chars: number;
  };
  options: AuditOption[];          // [{id, label, value}]，text 模式时为 []
  slots_delta: Partial<AuditSlots>;// 本轮从用户回答中提取的槽值
  missing_slots: string[];         // 仍为 undefined 的必填槽（不含 not_sure）
  flags: {
    contradiction: boolean;
    off_topic: boolean;
    price_cycle_unclear: boolean;
  };
  aha: {
    triggered: boolean;
    bubbles: string[];             // 最多1条，必须含行动建议
  };
}
```

### 客户端不信任 Claude 的 missing_slots
客户端在合并 `slots_delta` 后自行计算：
```typescript
const actuallyMissing = REQUIRED_SLOTS_PER_STAGE[stage].filter(k => newSlots[k] === undefined);
```

---

## 5. 客户端 FSM 逻辑 Client FSM Logic

### handleClaudeResponse 处理顺序

```
1. setLastFlags(response.flags)
2. flags.off_topic → 显示拒绝消息，return
3. flags.price_cycle_unclear → 存 raw price，展示 cycle recovery，return
4. 合并 slots_delta → newSlots
5. 尝试归一化 price_monthly
6. 更新 notSureCount
7. 判断 Aha（cooldown + 每场最多1次）
8. displayBubbles(最多1条 context bubble + Aha)
9. 客户端计算 actuallyMissing
10. actuallyMissing > 0 → 展示 recovery question，return（不升阶）
11. advanceStageIfReady → nextStage
12a. canFinish → 展示"是否补充？"门控，等待用户
12b. 否 → 展示 question（升阶时用新阶段 recovery question），setOptions，setUiMode
13. setTurnIndex + 1
finally: setIsTyping(false)
```

### canFinish 守卫
```typescript
const canFinish = (turn: number, stage: AuditStage): boolean =>
  turn >= 5 && stage === 'overlap_decision';
// FSM 保证到达 overlap_decision 时所有前序阶段槽位已填（含 not_sure）
```

---

## 6. 评分系统 Scoring System

| 维度 Dimension | 满分 Max | not_sure/undefined 默认 |
|---|---|---|
| Need Fit（motivation 清晰度） | 25 | 12（中性） |
| Expected Usage（频率桶） | 25 | 10（略悲观） |
| Budget Fit（价格比 + feel） | 25 | 12（中性） |
| Overlap（与现有订阅重叠） | 15 | 7（中性） |
| Risk（cancel/lock-in） | 10 | 5（中性） |
| Uncertainty Penalty | -10 max | -2 per not_sure |

**expected_frequency 桶值映射：**
```
0 (Rarely)   → 0 pts
1 (Once/wk)  → 10 pts
2.5 (2-3×)   → 18 pts
4.5 (4-5×)   → 23 pts
7 (Daily)    → 25 pts
not_sure     → 10 pts + uncertainty penalty
```

**推荐结果映射：**
```
score ≥ 70 AND uncertainty = 'low'  → subscribe_now
score ≥ 55                          → start_trial
score ≥ 40                          → watchlist
score < 40                          → alternative
high uncertainty                    → 最高 start_trial，不给 subscribe_now
```

---

## 7. Progressive Text Disclosure

```typescript
const shouldShowText =
  currentStage === 'service_price' ||  // Stage 1 始终文字输入
  showTextInput ||                      // 用户手动点击"Type my own"
  notSureCount >= 2 ||                  // 用户选了2次以上 Not sure
  lastFlags.contradiction;              // Claude 检测到矛盾
// price_cycle_unclear 不在此列：cycle recovery 始终用 option chips
```

Footer 逻辑（**互斥，永不同时显示**）：
1. `awaitingFinalComment` → 文字输入 + Skip/Send 按钮
2. `shouldShowText` → 文字输入 + Send 按钮
3. 否则 → option chips（在 ScrollView 内）+ "Type my own" 链接（在 footer）

---

## 8. Aha Moment 控制

```typescript
function shouldShowAha(...): boolean {
  if (!response.aha.triggered || response.aha.bubbles.length === 0) return false;
  if (ahaTriggered) return false;          // 每场最多1次
  if (turn - lastAhaTurn < 3) return false; // cooldown 3 turns
  if (stage ∈ ['service_price', 'motivation']) {
    if (price_monthly / budget < 0.15) return false; // 早期阶段只在价格极端时触发
  }
  return true;
}
```

---

## 9. Recovery Questions（本地模板，无 API 调用）

| 槽位 Slot | 输入模式 | 说明 |
|---|---|---|
| service_name | text | 自由输入，不给品牌示例 |
| price | text | 提示格式 "15/month, 120/year" |
| price_cycle_unclear | options | Per month / Per year / Per week / Not sure |
| primary_motivation | options | Work / Entertainment / Health / Learning / Other |
| expected_frequency | options | 0/1/2.5/4.5/7/not_sure |
| top_risk | options | low_usage / forget_cancel / price / overlap / not_sure |
| budget_feel | options | comfortable / tight / no_way / not_sure |
| overlap_level | options | none / some / significant / high / not_sure |

**升阶时问题修正（关键 bug fix）：**
当 `nextStage !== stageAtTime`（FSM 在当轮升阶），Claude 的 `response.question` 属于旧阶段。
客户端改用新阶段的 recovery question：
```typescript
const questionToShow = (nextStage !== stageAtTime)
  ? RECOVERY_QUESTIONS[REQUIRED_SLOTS_PER_STAGE[nextStage][0]]?.question
  : response.question;
```

---

## 10. "是否补充" 门控 Pre-Score Gate

```
所有6阶段完成
    ↓
Bot: "That's all I need! Anything else you'd like me to factor in?"
    ↓
┌─────────────────┬──────────────────┐
│   Skip（空输入）  │  Submit（有文字）  │
└────────┬────────┴────────┬─────────┘
         ↓                  ↓
  generateAndShowReport  enhanced slots
  (original slots)       + additional_notes
         ↓                  ↓
              finalizing → report
```

`additional_notes` 在报告的 Factors 列表中以 "Your Notes" 展示，不影响数值评分。

---

## 11. CTA 行为映射

| recommendation_type | CTA Label | 行为 |
|---|---|---|
| subscribe_now | Track This Subscription | `navigate('AddSubscription', { prefillData: {name, cost, category, nextRenewalDate} })` |
| start_trial | Start Trial + Set Reminder | `addSubscription({ status: 'paused', isReminder: true, planName: 'Trial' })` |
| watchlist | Save to Watchlist | `addSubscription({ status: 'paused', isReminder: true, planName: 'Watchlist' })` |
| alternative | See 3 Alternatives | 打开 Modal，`generateAlternatives(name, category, cost)` |

次要 CTA：**Start Another Audit** → reset 所有状态，tab bar 恢复显示。
