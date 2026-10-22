# Audit Screen Enhancement Plan

## Context

The current Audit screen has several UX/UI issues that prevent it from delivering the deep, natural conversation experience needed for effective subscription assessment:

**Why this change is needed:**
- Users complete audits too quickly (3 questions) without proper evaluation
- Bot responses are too long and hard to read in single bubbles
- Input UX is confusing (options + text input shown simultaneously)
- Questions don't dive deep enough into user needs and budget fit
- Post-audit CTAs are generic and don't lead to actionable next steps
- Bottom navbar clutters the chat experience

**Intended outcome:**
- 3-5 minute conversation with 5-7 meaningful questions
- Natural conversation flow with multi-bubble responses
- Intuitive input (show options OR text input, not both)
- Deep dive questions following structured stages
- Actionable CTAs that lead to subscription tracking, reminders, or alternatives

---

## Implementation Plan

### Phase 1: UI Quick Fixes

#### 1.1 Reduce Input Box Height
**File:** `/Users/wanjiaruan/Desktop/sub/app/src/screens/AuditScreen.tsx`

Reduce input height from 56px to 48px for better proportions:

```typescript
// Line 878-895
chatInput: {
  flex: 1,
  height: 48,  // Changed from 56
  // ... rest unchanged
},
chatSendButton: {
  width: 48,   // Changed from 56
  height: 48,
  // ... rest unchanged
}
```

#### 1.2 Hide Bottom Navbar During Chat
**File:** `/Users/wanjiaruan/Desktop/sub/app/src/screens/AuditScreen.tsx`

Add useEffect to control tab bar visibility based on view mode:

```typescript
useEffect(() => {
  const shouldHide = ['chat', 'finalizing', 'report'].includes(viewMode);
  navigation.setOptions({
    tabBarStyle: shouldHide ? { display: 'none' } : undefined
  });
}, [viewMode, navigation]);
```

#### 1.3 Multi-Bubble Bot Responses
**New File:** `/Users/wanjiaruan/Desktop/sub/app/src/utils/messageSplitter.ts`

Create intelligent message splitter:
- Split on paragraph breaks (\n\n)
- Split on sentence boundaries if >200 chars
- Keep questions separate from statements
- Max 3 bubbles per response

Update message handling in `handleStartAudit` and `handleSendMessage`:
```typescript
for (const reply of response.botReplies) {
  const messageBubbles = splitBotMessage(reply);
  for (const bubble of messageBubbles) {
    await new Promise(resolve => setTimeout(resolve, 800));
    setMessages(prev => [...prev, { role: 'assistant', content: bubble }]);
  }
}
```

---

### Phase 2: Conversation Depth Enhancement

#### 2.1 Enhanced Claude System Prompt
**File:** `/Users/wanjiaruan/Desktop/sub/app/src/utils/claude.ts`

Redesign system prompt with 6 conversation stages:

**Stages:**
1. **INTRODUCTION** (Q1-2): Greet, ask what service, understand motivation
2. **NEED ASSESSMENT** (Q2-3): Why they want it, have they tried similar before
3. **USAGE ANALYSIS** (Q3-4): Realistic usage frequency, what might prevent regular use
4. **BUDGET FIT** (Q4-5): Budget percentage, trade-offs with other spending
5. **ALTERNATIVES** (Q5-6): Free/cheaper options, unique value proposition
6. **FINAL RECOMMENDATION** (Q7+): Only after 5+ meaningful exchanges

**Key prompt rules:**
- ONE question per response (never multiple)
- FOLLOW-UP on vague answers ("I need it for work" → "What specific work task?")
- SPLIT long responses into 2-3 short messages (max 2 sentences each)
- Provide 2-4 quick-reply options per question
- Set `isFinished: true` ONLY after reaching Stage 6 with 5+ questions

#### 2.2 Conversation Context Tracking
**File:** `/Users/wanjiaruan/Desktop/sub/app/src/screens/AuditScreen.tsx`

Add state to track conversation depth:
```typescript
const [conversationStage, setConversationStage] = useState<string>('introduction');
const [questionCount, setQuestionCount] = useState(0);
```

Pass to Claude API and update after each response.

Update `AuditContext` interface to include:
- `currentStage?: string`
- `questionCount?: number`

#### 2.3 Minimum Questions Enforcement
**File:** `/Users/wanjiaruan/Desktop/sub/app/src/utils/claude.ts`

Change constants:
```typescript
const MIN_QUESTIONS = 5;  // Changed from 3
const TARGET_DURATION_MINUTES = 4;
```

Update prompt to enforce minimum before allowing `isFinished: true`.

---

### Phase 3: Smart Input UX

#### 3.1 Conditional Input Display
**File:** `/Users/wanjiaruan/Desktop/sub/app/src/screens/AuditScreen.tsx`

Add state:
```typescript
const [showTextInput, setShowTextInput] = useState(false);
```

**Logic:**
- If `options.length > 0` AND `!showTextInput` → Show only option chips
- If `options.length === 0` OR `showTextInput` → Show text input
- Add "Type my own answer" button (dashed border) to toggle text input

**Implementation:**
```typescript
<View style={styles.chatFooter}>
  {/* Options chips (only when options exist and text input hidden) */}
  {options.length > 0 && !showTextInput && (
    <View style={styles.optionsContainer}>
      {options.map((option, idx) => (
        <Pressable key={idx} onPress={() => handleSendMessage(option)}>
          <Text>{option}</Text>
        </Pressable>
      ))}
    </View>
  )}

  {/* Text input (when no options OR user requested custom input) */}
  {(options.length === 0 || showTextInput) && (
    <View style={styles.inputRow}>
      <TextInput ... />
      <Pressable onPress={() => handleSendMessage(inputValue)}>...</Pressable>
    </View>
  )}

  {/* Toggle button (when options exist but input hidden) */}
  {options.length > 0 && !showTextInput && (
    <Pressable onPress={() => setShowTextInput(true)}>
      <Ionicons name="create-outline" />
      <Text>Type my own answer</Text>
    </Pressable>
  )}
</View>
```

---

### Phase 4: Actionable CTAs

#### 4.1 Dynamic CTA Based on Score
**File:** `/Users/wanjiaruan/Desktop/sub/app/src/screens/AuditScreen.tsx`

Create CTA configuration function:
```typescript
const getCTAConfig = (score: number) => {
  if (score >= 70) {
    return {
      primary: { text: 'Track This Subscription', action: 'add_subscription', color: colors.primary },
      secondary: { text: 'Start Another Audit', action: 'new_audit' }
    };
  } else if (score >= 50) {
    return {
      primary: { text: 'Set a Reminder', action: 'create_reminder', color: colors.warning },
      secondary: { text: 'Start Another Audit', action: 'new_audit' }
    };
  } else {
    return {
      primary: { text: 'Explore Alternatives', action: 'show_alternatives', color: colors.danger },
      secondary: { text: 'Start Another Audit', action: 'new_audit' }
    };
  }
};
```

#### 4.2 CTA Action Handlers

**High Score (70+): Track Subscription**
Navigate to AddSubscriptionScreen with prefilled data:
```typescript
navigation.navigate('AddSubscription', {
  prefillData: {
    name: selectedReport.service_name,
    cost: parseFloat(selectedReport.cost),
    category: selectedReport.category,
    nextRenewalDate: /* 30 days from now */
  }
});
```

**Fair Score (50-69): Create Reminder**
Add reminder-only subscription to database:
```typescript
await addSubscription({
  name: selectedReport.service_name,
  cost: parseFloat(selectedReport.cost),
  category: selectedReport.category,
  isReminder: true,
  status: 'paused',
  nextRenewalDate: /* 30 days from now */
});
```

**Poor Score (<50): Show Alternatives**
Display modal with alternative services using hybrid approach:
- **Primary**: Rule-based alternatives by category (fast, no API cost)
  - Entertainment → YouTube Premium Lite, Library + Hoopla
  - Productivity → Notion Free, Google Workspace
  - Utilities → (category-specific alternatives)
  - Health → (category-specific alternatives)
- **Fallback**: If no rule matches, call Claude API to generate personalized alternatives
- Display lower-cost or free options with brief reasoning

#### 4.3 Alternatives Generation System
**New File:** `/Users/wanjiaruan/Desktop/sub/app/src/utils/alternativesGenerator.ts`

Create hybrid alternatives generator:

```typescript
// Rule-based alternatives database
const ALTERNATIVES_RULES: Record<string, Alternative[]> = {
  Entertainment: [
    { name: 'YouTube Premium Lite', cost: 'Free - $7/mo', reason: 'Ad-free videos at lower cost' },
    { name: 'Library + Hoopla', cost: 'Free', reason: 'Free streaming with library card' },
    { name: 'Tubi', cost: 'Free', reason: 'Ad-supported streaming' }
  ],
  Productivity: [
    { name: 'Notion Free', cost: 'Free', reason: 'Personal use is free forever' },
    { name: 'Google Workspace', cost: '$6/mo', reason: 'More affordable for basic needs' },
    { name: 'Obsidian', cost: 'Free', reason: 'Local-first note-taking' }
  ],
  Utilities: [
    { name: '1Password Families', cost: '$5/mo', reason: 'Cheaper when split with family' },
    { name: 'Bitwarden', cost: 'Free - $10/yr', reason: 'Open-source password manager' }
  ],
  Health: [
    { name: 'Nike Training Club', cost: 'Free', reason: 'Free workout programs' },
    { name: 'YouTube Fitness', cost: 'Free', reason: 'Thousands of free workout videos' }
  ]
};

export async function generateAlternatives(
  serviceName: string,
  category: string,
  cost: number
): Promise<Alternative[]> {
  // Step 1: Try rule-based alternatives
  const ruleAlternatives = ALTERNATIVES_RULES[category];

  if (ruleAlternatives && ruleAlternatives.length > 0) {
    return ruleAlternatives.slice(0, 3); // Return top 3
  }

  // Step 2: Fallback to Claude API
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Suggest 3 cheaper or free alternatives to ${serviceName} (currently $${cost}/mo, category: ${category}). Format as JSON array: [{"name": "...", "cost": "...", "reason": "..."}]`
      }]
    });

    const content = response.content[0].text;
    const parsed = JSON.parse(content);
    return parsed;
  } catch (error) {
    console.error('Failed to generate alternatives:', error);
    // Ultimate fallback
    return [{
      name: 'Free alternatives available',
      cost: 'Free',
      reason: 'Search online for free options in this category'
    }];
  }
}
```

#### 4.4 Update AddSubscriptionScreen
**File:** `/Users/wanjiaruan/Desktop/sub/app/src/screens/AddSubscriptionScreen.tsx`

Update route params type:
```typescript
type RootStackParamList = {
  AddSubscription: {
    subscriptionId?: string;
    prefillData?: {
      name: string;
      cost: number;
      category: string;
      nextRenewalDate: string;
    };
  };
};
```

Initialize form with prefill data if provided:
```typescript
const prefillData = route.params?.prefillData;
const [name, setName] = useState(prefillData?.name || existingSub?.name || '');
const [cost, setCost] = useState(prefillData?.cost.toString() || ...);
// ... etc
```

---

## Critical Files to Modify

1. **AuditScreen.tsx** - Main UI changes, state management, CTA logic, navbar hiding
2. **claude.ts** - Enhanced prompts, conversation stages, minimum questions
3. **messageSplitter.ts** (NEW) - Intelligent response chunking utility
4. **alternativesGenerator.ts** (NEW) - Hybrid alternatives generation (rules + Claude fallback)
5. **AddSubscriptionScreen.tsx** - Prefill data integration
6. **types/index.ts** - Update AuditContext interface

---

## Verification & Testing

### Manual Testing Flow:

1. **Start New Audit**
   - Verify navbar hides when entering chat
   - Check input box height is reduced (48px)

2. **Conversation Flow**
   - Confirm 5-7 questions asked before completion
   - Verify questions follow 6 stages in order
   - Check bot responses split into multiple bubbles (max 3)
   - Ensure each response is <3 sentences per bubble

3. **Input UX**
   - Verify options show WITHOUT text input
   - Tap "Type my own answer" → text input appears
   - Send custom message → input hides, options reappear

4. **Report & CTAs**
   - **High score (75)**: Tap "Track This Subscription" → AddSubscriptionScreen with prefilled data
   - **Fair score (60)**: Tap "Set a Reminder" → Reminder created, alert shown
   - **Poor score (35)**: Tap "Explore Alternatives" → Modal with alternatives shown

5. **Navigation**
   - Tap "Start Another Audit" → Returns to home, navbar reappears
   - Close report → Returns to home, navbar reappears

### Expected Conversation Quality:
- **Question depth**: Each question should probe deeper based on previous answer
- **Natural flow**: Questions should feel conversational, not robotic
- **Budget awareness**: Must reference user's budget percentage
- **Follow-ups**: Vague answers should trigger follow-up questions

---

## Implementation Notes

### Response Format from Claude
Expect JSON responses:
```json
{
  "isFinished": false,
  "botReplies": ["Short message 1", "Short message 2"],
  "options": ["Option A", "Option B", "Option C"],
  "stage": "usage_analysis"
}
```

Final response (after 5+ questions):
```json
{
  "isFinished": true,
  "botReplies": ["Final summary"],
  "report": {
    "name": "Netflix",
    "score": 75,
    "status": "Good",
    "recommendation": "...",
    "factors": [...]
  }
}
```

### Fallback Strategies
- If Claude returns malformed JSON → Parse as plain text, continue conversation
- If conversation stalls → Provide default follow-up question
- If stage tracking fails → Continue with generic questions

### Performance Considerations
- Message splitting happens client-side (no extra API calls)
- Tab bar hiding uses React Navigation's built-in API (no performance impact)
- CTA logic is purely client-side (instant response)

---

## Success Criteria

✅ Average conversation: 5-7 questions (was 3)
✅ Average duration: 3-5 minutes (was <2 minutes)
✅ Bot responses: 2-3 bubbles per turn (was 1 long bubble)
✅ Input clarity: Options OR input shown (not both)
✅ Navbar hidden: During chat/report (currently always visible)
✅ Actionable CTAs: 3 distinct paths based on score (was 1 generic button)
✅ Conversation depth: Follow structured 6-stage progression (was random questions)

Recommend Plan: Pre-Subscription Audit（平衡版）—Bounded + Personalized + Actionable
0) 核心定位（必须统一）

Audit 是 pre-subscription 决策：目标是“要不要开始订阅 / 先试用 / 先等等 / 看替代”，不是 review subscription，因此 不使用 usage snapshot 作为主要输入。

对话必须 bounded 在 subscription management：价格、预算占比、预期使用、重叠、风险（忘取消/年付锁）、替代方案、提醒与试用策略。其它话题必须拒绝并拉回。

1) 目标体验与约束

目标时长：3–5 分钟

轮数：5–7 轮有效问答

输入方式：选项为主 + 少量短输入

全程最多 2 次短输入（≤80字）

其余轮次用 options/slider/chips 降低退出率

Bot 输出：multi-bubble（每轮 1–2 条 bubbles，每条 ≤2 句），避免长段落

2) 对话结构（6 Stage，一阶段一核心问句）

每轮只问 一个主问题，但允许“可选补充一句”作为次要输入（不算第二个问题）。

Stage 1 — Service & Price Capture（文本）

问：你想订哪个服务？价格/周期大概是多少？

UI：text（必要）

Slot：service_name, price, billing_cycle

Stage 2 — Motivation / Job-to-be-done（选项 + 可选补充）

问：你主要想用它解决什么？（工作/学习/娱乐/健身/效率… + “其他”）

UI：options + optional_note

Slot：primary_motivation, motivation_note_optional

Stage 3 — Expected Usage（slider/档位）

问：你预计每周会用几次？（0 / 1 / 2–3 / 4–5 / 6+）

UI：slider/options

Slot：expected_frequency

Stage 4 — Friction & Risk（选项）

问：最可能让你“订了但不值”的原因是什么？（没时间/没场景/忘记取消/年付锁/已有替代/价格压力）

UI：options

Slot：top_risk

Stage 5 — Budget Fit（选项，必须引用用户预算）

系统已知：monthly_budget + persona（price_sensitivity等）

问：按你预算，它大概占 X%，你感觉？（舒服/勉强/不太行）

UI：options

Slot：budget_feel

Stage 6 — Overlap & Decision（选项 + 最终输出）

系统已知：已有订阅列表

问：它和你现有订阅重叠程度？（无/一点/明显/很高）+ 若“很高”可直接引导替代或停

UI：options

Slot：overlap_level

输出：score + recommendation（subscribe_now / start_trial / watchlist / set_reminder / alternative）

3) Input UX 规则（解决“选项+输入框同时出现”的不直观）

Claude 每轮在 JSON 里明确 ui.input_mode：

options：只显示 chips（默认）

slider：显示滑条/档位

text：显示输入框（仅 Stage1 必要 + 其它最多再触发 1 次）

当 options 存在时：默认只显示 options

额外提供 “Type my own answer（可选）” 开关 → 展开短输入（≤80字）

发送后自动收起，回到 options

4) Aha Moment 机制（不要每轮触发，必须有触发条件）

不建议每轮都 Aha，会变成噪音；建议只在“检测到关键矛盾/风险”才触发，最多 1–2 条 bubble。

触发条件（任一满足即可）：

Overlap ≥70%（用户选“很高重叠”或匹配到已有订阅/免费替代）

预算压力显著（price/monthly_budget > 8% 或用户选“不太行”且 price_sensitivity 高）

低使用概率（频率≤1/周 且风险=没时间/没场景）

高取消风险（忘记取消/年付锁/冲动订阅）

自相矛盾（说“很需要”但频率=0/不确定）

Aha 输出格式（固定短句）：

洞察一句：指出冲突/浪费点

行动一句：给下一步（trial+reminder / watchlist / alternative）

5) Claude 输出协议（JSON Only，确保可控 + 防滥用）

每轮 Claude 返回 JSON（无 prose/markdown）：

{
  "stage": "budget_fit",
  "turn_index": 5,
  "is_finished": false,
  "bubbles": ["短消息1", "短消息2"],
  "question": "这一轮只问一个问题",
  "ui": {
    "input_mode": "options",
    "allow_optional_note": true,
    "note_hint": "可选：补充一句（≤80字）",
    "max_chars": 80
  },
  "options": ["舒服", "勉强", "不太行", "不确定"],
  "expected_slots": ["budget_feel", "budget_note_optional"],
  "aha": { "triggered": false, "bubbles": [] }
}


Final turn（is_finished=true）必须包含：

{
  "is_finished": true,
  "report": {
    "service_name": "...",
    "price": 0,
    "billing_cycle": "monthly",
    "score": 0,
    "recommendation": "start_trial",
    "top_factors": [{"factor":"...","direction":"down"}],
    "aha": "可选：若触发才给一句",
    "next_actions": [
      {"cta":"start_trial","label":"先试用+自动提醒"},
      {"cta":"watchlist","label":"先等等"},
      {"cta":"alternative","label":"看替代"}
    ]
  }
}

6) Score & Recommendation（pre-subscription 专用）

不要用 usage snapshot。建议 score 由以下维度组成（可以 deterministic 本地算，Claude只提供 slots/理由）：

Need Fit（动机是否清晰且强相关）

Expected Usage（频率与场景明确度）

Budget Fit（预算占比 + 用户舒适度 + persona price_sensitivity 微调）

Overlap（与已有订阅/免费替代重叠）

Risk（忘取消/年付锁/冲动订阅）

推荐映射：

score >= 70 → subscribe_now（若风险高则优先 start_trial + set_reminder）

55–69 → start_trial

40–54 → watchlist（等折扣/等场景明确）

< 40 → alternative

7) Post-Audit CTA（必须可行动、可闭环）

根据 recommendation 直接给按钮：

subscribe_now → “Track this subscription now”

start_trial → “Start trial + Auto reminder to cancel”

watchlist → “Set reminder + Re-audit later”

alternative → “See 3 alternatives”

（可选）“Start another audit”

8) UI/体验补丁（你已提到的痛点，优先级建议）

P0（立刻修）：

输入框高度过高 → 调小

进入 chat/report 隐藏 navbar

多 bubble（分段显示）

options 与 text input 不同时出现

P1（提升完成率/质量）：

6-stage 流程 + 5–7轮 minimum enforcement

“可选补充一句”机制（不强迫输入）

Aha gated 触发（避免噪音）

report 的 next actions 直达闭环

9) Claude 需要遵守的边界提示（防滥用）

非订阅决策问题一律拒绝，并引导回 audit：
“我只能帮助完成订阅决策审核。你想审核哪个订阅？”

these are some recommendations plan idea for this audit. please take this into consideration as well and regenerate a plan or if you need further information please let me know