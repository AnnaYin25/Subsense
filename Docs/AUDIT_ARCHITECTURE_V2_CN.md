# Audit 系统架构 v2 — 接入规范（中文草稿）

> 基于 `audit-workbench-new/src/App.jsx`（Convo v5.7 / Adjuster v6.3）
> 本文档描述纯逻辑层，不涉及现有 app 实现

---

## 一、整体流程

```
用户发起 Audit
       │
       ▼
[Persona 注入] ──► [6-Stage 对话（Claude）] ──► [Slots 收集完成 / is_finished: true]
                                                       │
                                              ┌────────┴────────┐
                                              ▼                 ▼
                                     [Rule Score Engine]  [AI Adjuster（可选）]
                                      确定性，无 API 调用    语义修正层
                                              │                 │
                                              └────────┬────────┘
                                                       ▼
                                                 [Final Score]
                                                       │
                                                       ▼
                                              [Decision Layer]
                                       primary_decision + Delay override
                                                       │
                                                       ▼
                                              [DecisionResult 输出]
```

**两层打分说明：**
- **Rule Score**：纯函数计算，给定 slots 和 persona 参数，结果确定可复现
- **AI Adjuster**：读取完整对话文本，输出 `total_delta`，加到 rule score 上得最终分

---

## 二、数据结构定义

### 2.1 AuditSlots（对话收集的全部字段）

```typescript
interface AuditSlots {
  // Stage 1
  service_name: string
  price: number
  billing_cycle: 'monthly' | 'yearly'
  price_monthly: number               // yearly 时 = price / 12，取两位小数

  // Stage 2
  primary_motivation: string          // 原始描述摘要
  motivation_text: string             // 用户原始回答，全文保留
  motivation_clarity: 'scenario_specific' | 'problem_aware' | 'category_only' | 'none'
  forcing_function: 'academic' | 'work' | 'professional' | null

  // Stage 3
  history_status: 'first_time' | 'familiar' | 'cancelled' | 'upgrading' | 'free_trial'
  cancel_reason?: 'price' | 'low_usage' | 'found_alternative' | 'no_longer_needed' | 'other'
  cancel_text?: string                // cancel_reason=other 时的原始文字

  // Stage 4
  expected_frequency: 'daily' | 'most_days' | 'few_times' | 'weekly' | 'monthly' | 'rarely' | 'not_sure'
  usage_certainty?: 'conditional'     // 用户用条件式回答频率时设置（"如果效果好的话..."）

  // Stage 4.5（same_cat_subs 为空时跳过，字段不会被设置）
  overlap_level?: 'none' | 'some' | 'significant' | 'high' | 'not_sure'

  // Stage 5
  budget_feel: 'comfortable' | 'tight' | 'steep' | 'no_way' | 'not_sure'

  // Stage 6
  top_risk: 'none' | 'mandatory_use' | 'timeline_limited' | 'free_enough' |
            'forget_cancel' | 'interest_decay' | 'not_sure' | 'impulse' | 'other'
  additional_risk_note?: string       // "Something else..." 文字追问的原始回答
}
```

### 2.2 AuditPersona（注入对话和打分的 persona 参数）

```typescript
interface AuditPersona {
  name: string
  monthly_budget: number

  // 用于 Need Fit 乘数
  persona_alignment: number           // 0.7（弱）/ 1.0（中）/ 1.3（强）
  subscriber_type: 'balanced_user' | 'essentialist' | 'spontaneous' | 'explorer' | 'power_user'

  // 用于 Usage 乘数
  lifecycle_coeff: number             // 0.6–1.1

  // 用于 Overlap 计算
  same_cat_count: number              // 同类别已有订阅数量
  same_cat_avg_usage: number          // 同类别平均使用率 0–1
  existing_subs_count: number         // 所有现有订阅总数

  // 注入对话 prompt 的展示字段
  existing_subs: string               // 格式："Netflix, Spotify, ..."
  same_cat_subs: string               // 格式："Spotify, Apple Music"
  interest_tags: string[]

  // 可选，来自 check-in 数据
  checkin_sat?: string
  usage_trend?: string
}
```

### 2.3 Claude 每轮返回的 JSON 结构

```typescript
interface AuditTurnResponse {
  stage: string
  turn_index: number
  is_finished: boolean
  bubbles: string[]                   // 最多 2 条，确认/洞察，不含问题
  question: string
  ui: {
    input_mode: 'text' | 'options' | 'slider'
    allow_optional_note: boolean
    note_hint: string
    max_chars: number
    slider_labels?: string[]          // 仅 slider 模式时有
  }
  options: Array<{ id: string; label: string; value: string | number }>
  slots_delta: Partial<AuditSlots>
  missing_slots: string[]
  flags: {
    contradiction: boolean
    off_topic: boolean
    price_cycle_unclear: boolean
  }
  aha: {
    triggered: boolean
    bubbles: string[]                 // 最多 1 条，≤30 词，含 action hint
  }
}
```

---

## 三、对话 System Prompt 注入模板

每轮对话都重新注入，将以下变量替换后作为 system prompt：

```
User: {name}
Monthly budget: ${monthly_budget}
Existing subscriptions: {existing_subs}
Same-category subscriptions: {same_cat_subs}
Interest tags: {interest_tags}
Subscriber type: {subscriber_type}
Persona alignment: {persona_alignment}   // 0.7=weak, 1.0=neutral, 1.3=strong
Current stage: {stage}
Turn index: {turn_index}
Price as % of budget: {budget_pct}       // = price_monthly / monthly_budget，未知时为 "unknown"
Check-in data: {checkin_summary}         // 来自 check-in 的 sat + trend，无数据时为 "none"
Collected slots:
{slots_json}                             // 当前所有已收集 slots 的 JSON
```

**`budget_pct` 计算规则：**
```
price_monthly 已知 && monthly_budget > 0
  → Math.round(price_monthly / monthly_budget * 100) + "%"
否则 → "unknown"
```

---

## 四、6-Stage 对话流程规范

### Stage 1 — service_id

| 项目 | 规则 |
|------|------|
| input_mode | `text`（首问） |
| 识别服务后 | 给出已知定价选项，最后一项必须是 "Different amount" |
| 价格帧定 | 来自 AI 知识库的价格用"可能已过时"的语气，不作为事实 |
| 必收 slots | `service_name`, `price`, `billing_cycle`, `price_monthly` |
| 特殊 flag | 给出价格但未说明周期 → `flags.price_cycle_unclear = true` |

**`price_monthly` 计算：**
```
billing_cycle = "monthly" → price_monthly = price
billing_cycle = "yearly"  → price_monthly = round(price / 12, 2)
```

---

### Stage 2 — motivation

| 项目 | 规则 |
|------|------|
| input_mode | `text`（不用 chips，让用户自由描述） |
| 追问条件 | 满足以下任一则追问一次："Can you give me a quick example of when you'd actually use it?" |

追问触发条件（满足任一）：
- (a) 回答 < 10 词，且没有命名具体活动、场景或 pain point
- (b) 只说了宽泛目标（"get more fit", "be productive"）没有 use-case
- (c) 回答与该服务类型的匹配性不明确

**不触发追问的例子：**
- "monitor my training" → fitness app，具体活动，不追问
- "track my marathon prep" → 具体活动，不追问
- "keep up with new releases" → streaming，不追问

**`motivation_clarity` 分类规则：**

| 值 | 判断标准 |
|----|---------|
| `scenario_specific` | 描述了具体时间/地点/工作流，**或**命名了直接对应该服务类型的具体活动 |
| `problem_aware` | 命名了 gap 或 pain point 但没有具体场景；**包含** consolidation 动机（"combine X and Y"、"all-in-one"）；**包含** feature-pull 动机（"want lossless audio"、"want ad-free"、"want offline"）|
| `category_only` | 只说了宽泛类别（"for work"、"for fun"、"to get fit"），无具体活动或 pain point |
| `none` | 说不清楚为什么 |

**`forcing_function` 检测：**

| 值 | 触发关键词 |
|----|----------|
| `academic` | "教授要求"、"professor requires"、"for class assignments"、"school requires" |
| `work` | "my job requires"、"work uses this"、"client needs"、"required for the project" |
| `professional` | "required for certification"、"industry standard"、"needed for my license" |
| `null` | 以上都不符合，不设置 |

> `forcing_function` 非 null → `motivation_clarity` 至少为 `scenario_specific`

**必收 slots：** `primary_motivation`, `motivation_text`, `motivation_clarity`，可选 `forcing_function`

---

### Stage 3 — history_check

input_mode: `options`

**选项（固定 5 个）：**

| id | label | value |
|----|-------|-------|
| new | Never tried it | `first_time` |
| familiar | Haven't tried it, but I've seen/heard about it | `familiar` |
| cancel | Tried it, cancelled | `cancelled` |
| upgrade | Currently using, want to upgrade | `upgrading` |
| trial | Used a free trial | `free_trial` |

**`familiar` 处理：** 评分等同 `first_time`，但**不追问**，直接存 `history_status: "familiar"`，表示用户有校准过的预期。

**`cancelled` 追问取消原因（5 选项，必须全部显示）：**

| id | label | value | 复发风险 |
|----|-------|-------|---------|
| price | Too expensive | `price` | 中（budget_feel 变好后可重评） |
| usage | Didn't use it enough | `low_usage` | **高**（习惯失败，同类情境易复发） |
| alt | Found something better | `found_alternative` | 低（主动重评） |
| need | Didn't need it anymore | `no_longer_needed` | **低**（情境已变，≠ low_usage） |
| other | Something else | `other` |  → 追问文字 |

**`other` 处理流程：**
1. 追问一次 "Mind sharing what happened?"（input_mode: `text`）
2. AI 从回答归类到最近的标准值（price / low_usage / found_alternative / no_longer_needed / other）
3. 原文存 `cancel_text`
4. **不问第三个问题**，直接进下一 Stage

---

### Stage 4 — expected_usage

**Upgrading 路径（固定 4 选项，禁止 AI 修改顺序或内容）：**

| id | label | value（存入 expected_frequency）|
|----|-------|-----------------------------|
| daily | Daily or almost daily | `daily` |
| few | A few times a week | `few_times` |
| weekly | About once a week | `weekly` |
| less | Less than weekly *(MANDATORY)* | `monthly` |

> "Less than weekly" 必须存在，禁止根据 persona 删除。

**非 upgrading 路径：** input_mode: `slider`

Slider 数值 → 频率档位映射：

| slider 值 | expected_frequency |
|----------|--------------------|
| 0 | `rarely` |
| ~0.5 | `monthly` |
| 1 | `weekly` |
| 2.5 | `few_times` |
| 4.5 | `most_days` |
| 7 | `daily` |

Slider labels 按服务类型定制（streaming / tools / fitness / music）。

**文字/选项回答的频率推断规则（AI 需遵守）：**

| 情境 | 推断规则 |
|------|---------|
| 内容追随者（"catch every episode"）| 按内容更新频率推断：weekly 内容 → `few_times`，daily 内容 → `most_days` |
| 习惯驱动（"every commute"、"morning routine"）| `daily` 或 `most_days` |
| 被动/模糊（"when I remember"、"once in a while"）| `weekly` 或 `monthly` |
| "once or twice a month" | `monthly` |
| 模糊正向词（"frequently"、"often"、"a lot"）| 默认 `few_times`，**不得**推断为 `most_days` 或 `daily` |
| 条件式陈述（"if it works I'd use it daily"、"如果效果好的话"）| 降一档 + 存 `usage_certainty: "conditional"` |

**压缩规则：** motivation 文字已暗示明确频率（"每天上下班用"）→ 给出确认问法，不再给 slider。

---

### Stage 4.5 — overlap_check

**触发条件：** `same_cat_subs` 非空时，在 Stage 4 完成后、Stage 5 前插入。
**跳过条件：** `same_cat_subs` 为空或 "none"，或 `overlap_level` 已在前面被设置。

input_mode: `options`

**STEP A — Bundle 包含关系静默检测（触发时插入事实气泡 ≤15 词）：**

| Bundle 关系 |
|------------|
| EA Play ↔ Xbox Game Pass Ultimate（EA Play 库包含其中） |
| YouTube Premium ↔ Spotify / Apple Music（YouTube Music 捆绑） |
| Apple One ↔ Spotify / Netflix / Duolingo（含 Apple Music、TV+、Arcade）|
| Amazon Prime ↔ Netflix / Spotify（含 Prime Video） |
| Notion AI ↔ ChatGPT Plus / Grammarly（AI 写作功能重叠）|
| Adobe CC ↔ Figma / Canva Pro（应用级重叠）|

**STEP B — 服务类型专属问法：**

| 服务类型 | 问题维度 |
|---------|---------|
| gaming | 游戏库是否重叠 |
| streaming / video | 内容 / 节目是否重叠 |
| music | 听音乐的场景是否重叠 |
| productivity / writing | 工作流中的任务是否重叠 |
| fitness / wellness | 锻炼目标是否重叠 |
| learning | 学习方向是否重叠 |

**选项（固定 4 个）：**

| id | label | value |
|----|-------|-------|
| diff | Mostly different — they cover different things | `none` |
| some | Some overlap — but I'd use both differently | `some` |
| sig | Pretty similar — lots of overlap | `significant` |
| unsure | Honestly not sure | `not_sure` |

---

### Stage 5 — budget_feel

格式要求：必须引用价格和预算占比：
> "At $X/month — about Y% of your sub budget — how does that feel?"

在问题前插入进度气泡：
> "OK here's what I have — {service_name}, ${price}/month, for {motivation}. Almost there."

input_mode: `options`，**必须全部显示以下 5 个选项（含 steep）：**

| id | label | value | 规则分 | 心理含义 |
|----|-------|-------|--------|---------|
| ok | Feels fine | `comfortable` | 16 | 无压力 |
| tight | A stretch — but I'd make it work | `tight` | 12 | 感受到但愿意承担 |
| steep | Pretty steep — I'd have to justify it | `steep` | 7 | 价值存疑，不是负担不起 |
| noway | Honestly can't justify it | `no_way` | 3 | 真的承受不了 |
| unsure | Not sure | `not_sure` | — | 不确定 |

---

### Stage 6 — risk

input_mode: `options`，总选项数 5–7 个

**四步生成结构（按顺序）：**

**STEP 1 — 服务类型可持续性风险（必须且只取一个）：**

| 服务类型 | 选项文字 |
|---------|---------|
| gaming | "Might not find enough games I want in the library" |
| fitness / wellness | "Might struggle to stay consistent" |
| learning | "Might not follow through on the courses" |
| productivity tools | "Might not build the habit to use it" |
| streaming / video | "Might cancel once I finish what I want to watch" |
| music | "Might not use it enough over what I already have" |
| other | "Might lose interest over time" |

> `history=cancelled` 或 `free_trial` 时，STEP 1 选项放最前面。

**STEP 2 — Persona + 历史风险（取第一个匹配，最多 1 个）：**

| 条件（按优先级） | 选项文字 |
|----------------|---------|
| `history=upgrading` | "Paid upgrade might not add much over what I use for free" |
| `history=cancelled` AND `cancel_reason=low_usage` | "Worried I'll fall into the same pattern as before" |
| `history=cancelled` AND `cancel_reason=no_longer_needed` | "Not sure my situation has changed enough to stick with it" |
| `subscriber_type=spontaneous` | "Might cancel when life gets busy" |
| `subscriber_type=explorer` | "Might jump to something new before I get real value from this" |
| `subscriber_type=essentialist` | "Not sure this earns its place alongside what I already pay for" |

**STEP 3 — 情境条件选项（条件为真才加入，最多取 2 个）：**

| 条件 | 选项文字 |
|------|---------|
| `same_cat_subs` 非空 | "Might overlap with services I already have" |
| `budget_feel` 为 tight / steep / no_way | "Might need to cut it later" |
| `motivation_clarity` 为 category_only / none | "Not sure I really need it" |
| 已知有免费版存在 | "Free version might be enough" |

> 超过 2 个条件触发时，取最相关的 2 个。

**STEP 4 — 固定收尾（必须按此顺序）：**
1. "No real concerns" → `top_risk: "none"`
2. "Not sure" → `top_risk: "not_sure"`
3. "Something else..." → `value: "other"`

**"Something else..." 流程：**
1. 追问 "What's on your mind?"（input_mode: `text`）
2. 从回答推断 `top_risk` 标准值（forget_cancel / interest_decay / impulse / free_enough / not_sure / other）
3. 原文存 `additional_risk_note`
4. **不问第三个问题**，直接给 recap 并完成

**Overlap concern 处理：**
- 选了任何表达 overlap 顾虑的选项 → `top_risk` 映射为 `"free_enough"`（overlap 维度已在 Stage 4.5 捕获，不重复惩罚）
- `overlap_level` 升级规则（最多升一档，不跳级）：

| 当前 overlap_level | 选了 overlap chip 后 |
|-------------------|---------------------|
| 未设置 / `not_sure` | → `some` |
| `none` | → `some` |
| `some` | → 保持 `some` |
| `significant` / `high` | → 不变 |

> 例外：用户在 "Something else..." 文字中**明确描述**两个服务用于完全相同工作流，才允许从 `some` 升到 `significant`。

**Stage 6 完成后：** 给出 ≤40 词的对话 recap，引用用户具体细节，然后 `is_finished: true`。

---

## 五、Rule Score Engine

**纯函数，不调用 API，给定相同输入永远返回相同结果。**

### 5.1 评分参数（DEFAULT_RULES）

```typescript
const RULES = {
  // Need Fit
  need_fit_scenario_specific: 22,
  need_fit_problem_aware:     18,
  need_fit_category_only:     14,
  need_fit_none:              10,
  need_fit_default:           12,

  // Usage
  usage_daily:      25,
  usage_most_days:  23,
  usage_few_times:  18,
  usage_weekly:     14,   // ← v2 新值（旧版 10）
  usage_monthly:    6,    // ← v2 新增档位
  usage_rarely:     0,
  usage_default:    10,

  // Budget
  budget_comfortable:      16,  // ← v2 新值（旧版 18）
  budget_tight:            12,  // ← v2 新值（旧版 10）
  budget_steep:            7,   // ← v2 新增档位
  budget_no_way:           3,
  budget_default:          10,
  budget_mandatory_bonus:  3,   // ← v2 新增（forcing_function 奖励）

  // Budget ratio
  ratio_low_threshold:  0.05,
  ratio_high_threshold: 0.15,
  ratio_low_bonus:      3,
  ratio_high_penalty:  -3,

  // Cost-per-use
  cpu_benchmark:    2.0,
  cpu_high_ratio:   3.0,   cpu_high_penalty:  -3,
  cpu_mid_ratio:    1.5,   cpu_mid_penalty:   -1,
  cpu_low_ratio:    0.3,   cpu_low_bonus:      2,

  // Overlap
  overlap_none:        15,
  overlap_some:        10,
  overlap_significant:  4,
  overlap_high:         0,
  overlap_not_sure:     7,
  overlap_default:      7,
  no_subs_floor:       13,
  portfolio_min_count:  2,
  portfolio_max_usage:  0.4,
  portfolio_penalty:    3,

  // Risk
  risk_none:             15,
  risk_mandatory_use:    13,  // ← v2 新增
  risk_timeline_limited: 10,  // ← v2 新增
  risk_free_enough:      10,
  risk_forget_cancel:     7,
  risk_interest_decay:    6,
  risk_not_sure:          5,
  risk_impulse:           4,
  risk_default:           8,

  // Cross-validation
  cv_high_need:                18,
  cv_low_usage:                 9,   // ← v2 新值（旧版 12）
  cv_need_penalty:             -3,
  cv_low_need:                 14,
  cv_high_usage:               18,
  cv_usage_bonus:               2,
  cv_upgrading_overlap_penalty: -4,  // ← v2 新增

  // Uncertainty
  unc_frequency:     3,
  unc_budget:        2,
  unc_motivation:    2,
  unc_overlap:       1,
  unc_risk:          1,
  unc_max:          10,
  unc_lifecycle_half: 0.5,

  // Decision thresholds
  threshold_subscribe: 75,
  threshold_trial:     60,
  threshold_watchlist: 45,
}
```

### 5.2 computeScore 伪代码

```
function computeScore(slots, rules, persona):

  ns = {}  // not_sure flags

  // ── Need Fit (max 25) ──────────────────────────────────────────
  nf = rules.need_fit_default
  switch slots.motivation_clarity:
    "scenario_specific" → nf = rules.need_fit_scenario_specific
    "problem_aware"     → nf = rules.need_fit_problem_aware
    "category_only"     → nf = rules.need_fit_category_only
    "none"              → nf = rules.need_fit_none; ns.motivation = true
  nf = clamp(nf × persona.persona_alignment, 0, 25)

  // ── Usage (max 25) ────────────────────────────────────────────
  us = rules.usage_default
  freq = slots.expected_frequency
  switch freq:
    "daily"      → us = rules.usage_daily
    "most_days"  → us = rules.usage_most_days
    "few_times"  → us = rules.usage_few_times
    "weekly"     → us = rules.usage_weekly
    "monthly"    → us = rules.usage_monthly
    "rarely"     → us = rules.usage_rarely
    "not_sure"   → ns.frequency = true
  if slots.usage_certainty == "conditional":
    ns.frequency = true               // 条件式频率也计入不确定
  us = clamp(us × persona.lifecycle_coeff, 0, 25)

  // ── Cross-Validation ──────────────────────────────────────────
  cvN  = 0
  cvU  = 0
  cvUO = 0
  if nf > rules.cv_high_need AND us < rules.cv_low_usage:
    cvN = rules.cv_need_penalty       // 高需求 + 低频 → NF -3
  if nf < rules.cv_low_need AND us > rules.cv_high_usage:
    cvU = rules.cv_usage_bonus        // 低需求 + 高频 → US +2
  if slots.history_status == "upgrading" AND
     slots.overlap_level in ["significant", "high"]:
    cvUO = rules.cv_upgrading_overlap_penalty  // upgrading + 高重叠 → US -4
  nf = clamp(nf + cvN, 0, 25)
  us = clamp(us + cvU + cvUO, 0, 25)

  // ── Budget Fit (max 20) ───────────────────────────────────────
  bf = rules.budget_default
  switch slots.budget_feel:
    "comfortable" → bf = rules.budget_comfortable
    "tight"       → bf = rules.budget_tight
    "steep"       → bf = rules.budget_steep
    "no_way"      → bf = rules.budget_no_way
    "not_sure"    → ns.budget = true

  // 价格占比调整
  pm  = slots.price_monthly
  bgt = persona.monthly_budget
  if pm > 0 AND bgt > 0:
    r = pm / bgt
    if r < rules.ratio_low_threshold:  bf = clamp(bf + rules.ratio_low_bonus, 0, 20)
    if r > rules.ratio_high_threshold: bf = clamp(bf + rules.ratio_high_penalty, 0, 20)

  // Cost-per-use 调整
  if pm >= 3 AND slots.expected_frequency:
    mu = freq_to_monthly_uses(slots.expected_frequency) // × 4.3 周/月
    if mu > 0:  // rarely → mu=0，跳过（防止 divide-by-zero）
      cpu = pm / mu / rules.cpu_benchmark
      if cpu > rules.cpu_high_ratio: bf = clamp(bf + rules.cpu_high_penalty, 0, 20)
      elif cpu > rules.cpu_mid_ratio: bf = clamp(bf + rules.cpu_mid_penalty, 0, 20)
      elif cpu < rules.cpu_low_ratio: bf = clamp(bf + rules.cpu_low_bonus, 0, 20)

  // Forcing function 奖励
  if slots.forcing_function in ["academic", "work", "professional"]:
    bf = clamp(bf + rules.budget_mandatory_bonus, 0, 20)

  // ── Overlap (max 15) ──────────────────────────────────────────
  ov = rules.overlap_default
  switch slots.overlap_level:
    "none"        → ov = rules.overlap_none
    "some"        → ov = rules.overlap_some
    "significant" → ov = rules.overlap_significant
    "high"        → ov = rules.overlap_high
    "not_sure"    → ov = rules.overlap_not_sure; ns.overlap = true

  // Portfolio 惩罚
  if persona.same_cat_count >= rules.portfolio_min_count AND
     persona.same_cat_avg_usage < rules.portfolio_max_usage:
    ov = max(0, ov - rules.portfolio_penalty)

  // 无现有订阅保底
  if persona.existing_subs_count == 0:
    ov = max(ov, rules.no_subs_floor)

  // ── Risk (max 15) ─────────────────────────────────────────────
  rk = rules.risk_default
  switch slots.top_risk:
    "none"             → rk = rules.risk_none
    "mandatory_use"    → rk = rules.risk_mandatory_use
    "timeline_limited" → rk = rules.risk_timeline_limited
    "free_enough"      → rk = rules.risk_free_enough
    "forget_cancel"    → rk = rules.risk_forget_cancel
    "interest_decay"   → rk = rules.risk_interest_decay
    "impulse"          → rk = rules.risk_impulse
    "not_sure"         → rk = rules.risk_not_sure; ns.risk = true
    "other"            → rk = rules.risk_default   // AI 无法归类时，静默 fallback 到 default(8)

  // Forcing function 下限
  if slots.forcing_function in ["academic", "work", "professional"]:
    rk = max(rk, rules.risk_timeline_limited)   // 最低 10 分

  // ── Uncertainty Penalty (max 10) ──────────────────────────────
  unc = 0; nsc = 0
  if ns.frequency:  unc += rules.unc_frequency; nsc++
  if ns.budget:     unc += rules.unc_budget;    nsc++
  if ns.motivation: unc += rules.unc_motivation; nsc++
  if ns.overlap:    unc += rules.unc_overlap;   nsc++
  if ns.risk:       unc += rules.unc_risk;      nsc++

  // 有历史经验 → uncertainty 减半
  had = slots.history_status in ["cancelled","upgrading","free_trial","familiar"]
  if had: unc = unc × rules.unc_lifecycle_half

  unc = min(rules.unc_max, unc)

  // ── Total ─────────────────────────────────────────────────────
  total = clamp(nf + us + bf + ov + rk - unc, 0, 100)

  uncertainty_level = nsc == 0 ? "low" : nsc <= 2 ? "medium" : "high"

  return {
    need_fit:            round(nf, 1),
    usage:               round(us, 1),
    budget_fit:          round(bf, 1),
    overlap:             round(ov, 1),
    risk:                round(rk, 1),
    uncertainty_penalty: round(unc, 1),
    total:               round(total, 1),
    not_sure_count:      nsc,
    uncertainty_level,
    cv_need_adj:         cvN,
    cv_usage_adj:        cvU,
    cv_upgrading_overlap_adj: cvUO,
    had_before:          had,
  }
```

**`freq_to_monthly_uses` 辅助函数：**
```
daily      → 7  × 4.3 = 30.1
most_days  → 4.5× 4.3 = 19.35
few_times  → 2.5× 4.3 = 10.75
weekly     → 1  × 4.3 = 4.3
monthly    → 0.25×4.3 = 1.075
rarely     → 0
```

### 5.3 Score → Primary Decision 映射

`computeScore` 只负责算分，不负责最终行动建议。分数先映射为 `primary_decision`：

```
final_score ≥ 75 → subscribe
final_score ≥ 60 → trial
final_score ≥ 45 → watchlist
final_score < 45 → alternative
```

> `final_score = clamp(rule_total + adjuster_delta, 0, 100)`
> AI Adjuster 未运行时，`final_score = rule_total`

---

### 5.4 Decision Layer — Timing / Delay Override

**设计原则：** Score system 判断 value / fit；Decision layer 判断 action / timing。
两层分开，互不干扰。Delay 不是新的评分维度，只是最终行动建议层的一个 outcome。

#### 返回类型

```typescript
interface DecisionResult {
  primary_decision:    'subscribe' | 'trial' | 'watchlist' | 'alternative'
  final_recommendation: 'subscribe' | 'trial' | 'watchlist' | 'alternative' | 'delay'
  timing_suggestion:   string | null
  delay_triggered:     boolean
}
```

> **调用时机：** 仅在对话 `is_finished: true` 之后调用。对话未完成时 `top_risk` 可能为 undefined，不应提前触发 Decision Layer。

#### 伪代码

```
function getPrimaryDecision(score):
  if score >= 75: return 'subscribe'
  if score >= 60: return 'trial'
  if score >= 45: return 'watchlist'
  return 'alternative'

function getDecisionResult(finalScore, slots) -> DecisionResult:
  primary = getPrimaryDecision(finalScore)

  // 前提：对话已完成（is_finished: true），slots.top_risk 有值
  timingIssue = (slots.top_risk === "timeline_limited")

  // ── Case 1: 高分 + 时机问题 → pure Delay ──────────────────────
  // fit 没问题，问题完全在时机
  if finalScore >= 65 AND timingIssue:
    return {
      primary_decision:     primary,           // 'subscribe' 或 'trial'
      final_recommendation: 'delay',
      timing_suggestion:    delayMessage(primary),
      delay_triggered:      true,
    }

  // ── Case 2: 中等分 + 时机问题 → Watchlist + timing modifier ───
  // fit 本身还不够强，同时时机也不对（两个问题并存）
  if finalScore >= 45 AND finalScore < 65 AND timingIssue:
    return {
      primary_decision:     'watchlist',
      final_recommendation: 'watchlist',
      timing_suggestion:    "The fit isn't quite there yet — and the timing adds another reason to wait. Worth revisiting when both conditions change.",
      delay_triggered:      true,
    }

  // ── Default ────────────────────────────────────────────────────
  return {
    primary_decision:     primary,
    final_recommendation: primary,
    timing_suggestion:    null,
    delay_triggered:      false,
  }
```

#### 触发矩阵

| `finalScore` | `top_risk` | `final_recommendation` | `delay_triggered` | 语义 |
|-------------|------------|------------------------|-------------------|------|
| ≥ 75 | `timeline_limited` | `delay` | true | fit 强，纯时机问题 |
| 60–74 | `timeline_limited` | `delay` | true | fit 不错，纯时机问题 |
| 45–59 | `timeline_limited` | `watchlist` | **true** | fit + timing 双重问题 |
| ≥ 75 | 其他 | `subscribe` | false | — |
| 60–74 | 其他 | `trial` | false | — |
| 45–59 | 其他 | `watchlist` | false | — |
| < 45 | 任意 | `alternative` | false | 永不触发 Delay |

#### timing_suggestion 文案

| 场景 | `timing_suggestion` |
|------|---------------------|
| `delay` + primary=`subscribe` | "This looks like a strong fit overall — the main question is timing. Worth revisiting once this limited-term phase passes." |
| `delay` + primary=`trial` | "There's real value here, but it may make more sense to start when you'll actually have time to use it." |
| `watchlist` + `delay_triggered` | "The fit isn't quite there yet — and the timing adds another reason to wait. Worth revisiting when both conditions change." |

#### 约束

- Delay 不进入任何评分维度
- Delay 不改变 `primary_decision`（保留供后续分析）
- `final_score < 45` 时永远不触发（输出 `alternative`）
- `delay_triggered` 和 `final_recommendation` 是独立信号：Watchlist 可以携带 `delay_triggered: true`

---

## 六、AI Adjuster

### 6.1 触发时机

Rule Score 完成后，用户主动触发（或对话完成后自动触发），进行第二轮 AI 调用。

### 6.2 输入（单次 API 调用）

```
System prompt: DEFAULT_ADJUSTER_PROMPT（见 6.4）

User message:
  ## RULE SCORES
  { need_fit, usage, budget_fit, overlap, risk, uncertainty_penalty, total }

  ## PERSONA
  tags: {interest_tags}
  type: {subscriber_type}
  PAC:  {persona_alignment}
  lifecycle: {lifecycle_coeff}
  existing_subs: {existing_subs}
  same_cat: {same_cat_count} (avg: {same_cat_avg_usage})
  checkin_sat: {checkin_sat | "N/A"}
  usage_trend: {usage_trend | "N/A"}

  ## SLOTS
  {完整 slots JSON}

  ## CONVERSATION
  {完整对话历史，role: content 格式}

  Return adjustments JSON.
```

### 6.3 Adjuster 输出格式（V6）

```typescript
interface AdjusterResult {
  signals: Array<{
    name: string              // 2-4 词信号名称
    finding: string           // 1-2 句，必须引用对话中具体的词或选择
    impact: number            // 单个信号范围 [-6, +6]
    confidence: 'high' | 'medium' | 'low'
  }>
  total_delta: number         // 所有 impact 之和，硬性范围 [-12, +10]
  narrative_insight: string   // 2-3 句报告用叙述
  overlap_inference: string   // 功能重叠评估，无则省略
}
```

**最终分数：**
```
final_score = clamp(rule_total + total_delta, 0, 100)
```

### 6.4 Adjuster System Prompt 核心原则摘要

**MODULE B — 规则已处理的内容（不重复计分）：**
- motivation_clarity 分层 × persona_alignment
- 频率档位 × lifecycle_coeff
- budget_feel × 价格占比 × cost-per-use
- overlap_level 自报 + portfolio 惩罚
- top_risk 用户选项
- Cross-validation 调整
- Uncertainty 惩罚
- cancel_reason 含义区分（`no_longer_needed ≠ low_usage`）

**MODULE C — 8 类信号（规则检测不到的）：**

| # | 信号类型 | 描述 |
|---|---------|------|
| 1 | Commitment Authenticity | 用户实际听起来有多真诚？果断 vs 反复犹豫 |
| 2 | Expectation-Reality Gap | 用户对服务功能的预期是否准确？ |
| 3 | Upgrade Delta Quality | 付费版相比免费版实际增加了什么？ |
| 4 | Switching Friction & Lock-in | 迁移成本高低（双向）|
| 5 | Portfolio Coherence | 订阅组合是否清晰合理 vs 臃肿？|
| 6 | Behavioral Pattern Signals | 历史、取消原因、计划的行为规律 |
| 7 | Life-stage & Timing Fit | 是否处于生活变动期？时机风险？|
| 8 | Enthusiasm Quality | 是否有正向信号（有研究、主动提具体功能）？|

**MODULE E — Impact 幅度校准：**

| 置信度 | 典型幅度 | 说明 |
|--------|---------|------|
| high | ±3 to ±5 | 有直接证据的结构性问题 |
| medium | ±2 to ±3 | 基于对话的合理推断 |
| low | ±1 to ±2 | 推测性，服务事实不确定 |

- 单个 signal 硬上限：[-6, +6]
- total_delta 上限：[-12, +10]
- `total_delta = 0` 是完全有效的输出

**MODULE G — 9 条禁止项：**
1. 不重复惩罚规则已处理的信号
2. 不将礼貌用语计为评分信号
3. 不猜测服务信息，不确定 → `confidence="low"`
4. finding 必须引用对话中具体词语或选择，不能泛泛而谈
5. 正向信号和负向信号同等重要，不默认负向
6. `total_delta = 0` 是有效输出
7. 找不到 2 个真正新信号时，1 个强信号 + narrative 解释即可
8. 不声称某内容在更便宜套餐可以看，除非 100% 确定
9. 用户提到"想看/玩某具体内容"（upgrading）= content access = 强升级动机

---

## 七、Aha! 触发条件

每次 audit **最多触发 1 次**，条件满足时在对话中插入洞察气泡（≤30 词 + action hint）：

| 触发条件 | 说明 |
|---------|------|
| `overlap_level` 推断为 significant / high | 重叠预警 |
| `price_monthly > monthly_budget × 8%` | 价格占比过高 |
| `expected_frequency ≤ 1/wk` AND `top_risk` 为 forget_cancel 或 interest_decay | 低频高风险组合 |
| `flags.contradiction = true` | 前后答案矛盾 |
| `history_status = cancelled` AND `cancel_reason = low_usage` | 历史低频复发风险 |
| `top_risk = impulse` | 冲动消费信号 |

---

## 八、对话样式规则

**确认气泡（必须）：** 每次 AI 回复的第一个 bubble 必须以 1-3 词确认开头：
> "Got it." / "Makes sense." / "$10.99 — noted." / "Fair enough."

**回复结构限制：** 每轮最多 2 个 bubbles + 1 个 question，不超过 3 个文字块。

**情绪适配：**
- 正向回答（comfortable / none / daily）→ 可加一句温暖备注
- 负向/敏感回答（no_way / impulse / interest_decay）→ 保持尊重，不开玩笑

**禁用短语：**
"Based on your/our assessment/analysis"、"Aligns with your preferences"、
"Taking into account"、"It's worth noting that"、"Comprehensive"、
"Optimize your subscription portfolio"、"Make an informed decision"

---

## 九、分值维度汇总

| 维度 | 满分 | 关键参数 |
|------|------|---------|
| Need Fit | 25 | motivation_clarity × persona_alignment |
| Usage | 25 | expected_frequency × lifecycle_coeff |
| Budget Fit | 20 | budget_feel + 价格占比 + cpu + forcing_function bonus |
| Overlap | 15 | overlap_level + portfolio 惩罚 + 无订阅保底 |
| Risk | 15 | top_risk + forcing_function 下限 |
| Uncertainty Penalty | -10（最多）| not_sure 数量 × 权重，历史用户减半 |
| **Rule Total** | **100** | |
| AI Adjuster Delta | [-12, +10] | signals 之和 |
| **Final Score** | **100** | clamp(rule_total + delta, 0, 100) |
| **Decision Layer** | — | final_score → primary_decision；Delay override 独立判断 |

---

*草稿版本：2026-03-11 / 基于 Convo v5.7 + Adjuster v6.3*
