# SubSense Audit Framework — Architecture Reference

> 文档来源：`audit-workbench/src/App.jsx` 基础实现 + `CHANGELOG.md` 最新改动（Convo v5.7 / Adjuster v6.3）
> 目的：记录可迁移到 sub app 的 audit 核心逻辑，不涉及 workbench UI

---

## 一、整体架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    Audit Pipeline                           │
│                                                             │
│  Persona/Context   ──►  6-Stage Conversation  ──►  Slots   │
│                                    │                        │
│                                    ▼                        │
│                           Rule Score Engine                 │
│                         (computeScore, 确定性)              │
│                                    │                        │
│                                    ▼                        │
│                            AI Adjuster                      │
│                         (V6 signals format)                 │
│                                    │                        │
│                                    ▼                        │
│                       Final Score + Recommendation          │
└─────────────────────────────────────────────────────────────┘
```

两层打分机制：
- **Rule Score**：确定性计算，基于收集到的 slots，可重复、可调试
- **AI Adjuster**：语义层修正，读取完整对话，补捉规则引擎无法检测的细节

---

## 二、Persona / Context 注入

对话开始前，将用户 profile 注入 system prompt，影响评分系数：

| 字段 | 类型 | 作用 |
|------|------|------|
| `monthly_budget` | number | 预算基准，计算价格占比 |
| `existing_subs` | string | 现有订阅列表，检测重叠 |
| `same_cat_subs` | string | 同类订阅列表 |
| `interest_tags` | string[] | 兴趣标签，persona 对齐度参考 |
| `subscriber_type` | enum | `balanced_user` / `essentialist` / `spontaneous` / `explorer` |
| `persona_alignment` | 0.7–1.3 | 订阅倾向系数（弱/中/强），乘以 Need Fit |
| `lifecycle_coeff` | 0.6–1.1 | 生命周期系数（新/活跃/成熟），乘以 Usage |
| `same_cat_count` | number | 同类订阅数量，影响 Overlap 计算 |
| `same_cat_avg_usage` | 0–1 | 同类订阅平均使用率，触发 Portfolio 惩罚 |
| `checkin_sat` | string | 最近 check-in 满意度，注入对话上下文 |
| `usage_trend` | string | 使用趋势，Adjuster 参考 |

---

## 三、6-Stage 对话流程

AI 模型：`claude-sonnet-4-20250514`，max_tokens: 1000

每轮输出**严格 JSON**（不含散文），格式：

```json
{
  "stage": "string",
  "turn_index": number,
  "is_finished": false,
  "bubbles": ["最多 2 条确认/洞察文字"],
  "question": "当前问题",
  "ui": {
    "input_mode": "text|options|slider",
    "allow_optional_note": false,
    "slider_labels": []
  },
  "options": [{"id":"", "label":"", "value":""}],
  "slots_delta": {},
  "flags": {"contradiction": false, "price_cycle_unclear": false},
  "aha": {"triggered": false, "bubbles": []}
}
```

---

### Stage 1 — service_id

**目标：** 确认服务名、价格、计费周期

| Slot | 值示例 |
|------|--------|
| `service_name` | "Netflix" |
| `price` | 15.99 |
| `billing_cycle` | "monthly" / "yearly" |
| `price_monthly` | 计算后月费（yearly ÷ 12） |

- input_mode: `text`（首问），识别后给出已知定价选项（含 "Different amount"）
- 已知价格可能过时，表述为建议而非事实
- 无法识别服务则追问价格和计费周期
- 价格给出但未说明周期 → `flags.price_cycle_unclear = true`，追问

---

### Stage 2 — motivation

**目标：** 理解用户为什么想订阅；检测外部强制需求

- input_mode: `text`（不用 chip，让用户自由描述）
- 回答 <10 词或模糊时，追问一次："Can you give me a quick example of when you'd use it?"

**Slots 收集：**

| Slot | 枚举值 |
|------|--------|
| `primary_motivation` | 原始文本摘要 |
| `motivation_text` | 原始描述（必存） |
| `motivation_clarity` | `scenario_specific` / `problem_aware` / `category_only` / `none` |
| `forcing_function` | `academic` / `work` / `professional` / null |

**`forcing_function` 触发条件：**

| 值 | 触发场景 |
|----|---------|
| `academic` | 教授要求、课程作业、学校规定 |
| `work` | 雇主要求、工作工具、客户需求 |
| `professional` | 认证要求、行业标准、执照需求 |

> `forcing_function` 非 null 时，`motivation_clarity` 至少为 `scenario_specific`；
> 评分引擎给予预算奖励（+3）和风险下限（≥10）。

---

### Stage 3 — history_check

**目标：** 了解用户与该服务的历史关系

- input_mode: `options`
- 若 existing_subs 数据已显示历史，转为确认问法

**选项（固定 4 个）：**

| id | label | value |
|----|-------|-------|
| new | Never tried it | `first_time` |
| cancel | Tried it, cancelled | `cancelled` |
| upgrade | Currently using, want to upgrade | `upgrading` |
| trial | Used a free trial | `free_trial` |

**取消原因追问（5 个选项，若 `cancelled`）：**

| value | 含义 | 复发风险 |
|-------|------|---------|
| `price` | 太贵 | 中（budget_feel 变好后可重评） |
| `low_usage` | 没怎么用 | **高**（同类情况易复发） |
| `no_longer_needed` | 不再需要 | **低**（情境已变，≠ low_usage） |
| `found_alternative` | 找到替代品 | 低（用户主动重评） |
| `something_else` | 其他 | → 追问文字，存 `cancel_text` |

Slot: `history_status`、`cancel_reason`、`cancel_text`（可选）

---

### Stage 4 — expected_usage

**目标：** 确认使用频率

**压缩规则：** 若 motivation 描述已暗示频率（"每天上下班用"），直接给确认问法。

**Upgrading 路径（固定 4 选项，禁止 AI 修改）：**

| label | value |
|-------|-------|
| Daily or almost daily | `daily` |
| A few times a week | `few_times` |
| About once a week | `weekly` |
| Less than weekly *(MANDATORY)* | `monthly` |

**新订阅路径：** input_mode: `slider`

| 显示值 | expected_frequency |
|--------|-------------------|
| Rarely | 0 |
| Once/wk | 1 |
| 2-3x/wk | 2.5 |
| Most days | 4.5 |
| Daily | 7 |

Slider labels 按服务类型定制（streaming / tools / fitness / music）。

---

### Stage 4.5 — overlap_check（嵌入 Stage 4 后）

**目标：** 评估与已有订阅的内容/功能重叠

**STEP A — Bundle 包含关系静默检测（触发时插入事实气泡 ≤15 词）：**

| Bundle 关系 |
|------------|
| EA Play ↔ Xbox Game Pass Ultimate |
| YouTube Premium ↔ Spotify/Apple Music |
| Apple One ↔ Spotify/Netflix/Duolingo |
| Amazon Prime ↔ Netflix/Spotify |
| Notion AI ↔ ChatGPT Plus/Grammarly |
| Adobe CC ↔ Figma/Canva Pro |

**STEP B — 服务类型专属问法：**

| 服务类型 | 问题维度 |
|---------|---------|
| gaming | 游戏库重叠 |
| streaming | 内容/节目重叠 |
| music | 听音乐场景重叠 |
| productivity | 工作流任务重叠 |
| fitness | 锻炼目标重叠 |
| learning | 学习方向重叠 |

Slot: `overlap_level` — `none` / `some` / `significant` / `high` / `not_sure`

---

### Stage 5 — budget_feel

**目标：** 用户对价格的主观感受（5 档）

必须引用价格和预算占比：
> "At $X/month — about Y% of your sub budget — how does that feel?"

**5 档选项：**

| 选项文字 | value | 规则分 | 心理状态 |
|---------|-------|--------|---------|
| Feels fine | `comfortable` | 16 | 无压力 |
| A stretch — but I'd make it work | `tight` | 12 | 感受到但愿意承担 |
| Pretty steep — I'd have to justify it | `steep` | 7 | 价值存疑，不是纯负担不起 |
| Honestly can't justify it | `no_way` | 3 | 真的承受不了 |
| Not sure | `not_sure` | — | 不确定标记 |

> 触发 `tight`/`steep`/`no_way` 时，Stage 6 自动添加 "Might need to cut it later" 顾虑选项

---

### Stage 6 — risk

**目标：** 挖掘剩余顾虑，输出最终 recap

input_mode: `options`，总数 5-7 个

**四步生成结构：**

| 步骤 | 内容 | 数量 |
|------|------|------|
| STEP 1 | 服务类型对应的可持续性风险 | 1 |
| STEP 2 | Persona + 历史记录风险（优先级取第一匹配） | 0–1 |
| STEP 3 | 情境条件选项（条件为真才包含） | 0–2 |
| STEP 4 | 固定收尾：No real concerns / Not sure / Something else... | 3 |

**STEP 2 优先级：**

1. `history=upgrading` → "Paid upgrade might not add much over what I use for free"
2. `history=cancelled AND cancel_reason=low_usage` → "Worried I'll fall into the same pattern as before"
3. `history=cancelled AND cancel_reason=no_longer_needed` → "Not sure my situation has changed enough"
4. `subscriber_type=spontaneous` → "Might cancel when life gets busy"
5. `subscriber_type=explorer` → "Might jump to something new before I get real value"
6. `subscriber_type=essentialist` → "Not sure this earns its place alongside what I already pay for"

**"Something else..." chip 流程：**
选中后追问 "What's on your mind?"（text input），AI 推断 `top_risk` 标准值 + 原文存 `additional_risk_note`

**Overlap 升级规则（保守化）：**

Stage 6 选了 overlap concern chip，最多升一级，不跳级：

| Stage 4.5 `overlap_level` | Stage 6 chip 后 |
|--------------------------|----------------|
| 未设置 / `not_sure` | → `some` |
| `none` | → `some` |
| `some` | → 保持 `some` |
| `significant` / `high` | → 不变 |

> 例外：用户在 "Something else..." 文字中明确描述完全相同工作流，才允许从 `some` 升到 `significant`

---

## 四、Rule Score Engine（`computeScore`）

**确定性计算，不调用 AI，可独立运行**

### 分值分配

| 维度 | 满分 |
|------|------|
| Need Fit (NF) | 25 |
| Usage (US) | 25 |
| Budget Fit (BF) | 20 |
| Overlap (OV) | 15 |
| Risk (RK) | 15 |
| Uncertainty Penalty | -10（最大扣分） |
| **Total** | **100** |

---

### 4.1 Need Fit（max 25）

基础分 × `personaAlignment` 系数（0.7–1.3），capped at 25

| `motivation_clarity` | 基础分 |
|---------------------|--------|
| `scenario_specific` | 22 |
| `problem_aware` | 18 |
| `category_only` | 14 |
| `none` | 10 → 标记 uncertainty |
| default | 12 |

---

### 4.2 Usage（max 25）

基础分 × `lifecycleCoeff` 系数（0.6–1.1），capped at 25

| 条件 | 基础分 |
|------|--------|
| `history_status = upgrading` | 23（已验证使用） |
| freq ≥ 7/wk | 25（daily） |
| freq ≥ 4.5/wk | 23（most days） |
| freq ≥ 2.5/wk | 18（few times） |
| freq ≥ 1/wk | 10（weekly） |
| freq = 0 | 0（rarely） |
| `not_sure` | 10 → 标记 uncertainty |

---

### 4.3 Cross-Validation（NF ↔ US 交叉修正）

| 条件 | 修正 |
|------|------|
| NF > 18 且 US < 12 | NF − 3（高需求却低频，矛盾） |
| NF < 14 且 US > 18 | US + 2（低需求却高频，给予认可） |

---

### 4.4 Budget Fit（max 20）

**基础分（5 档）：**

| `budget_feel` | 分 |
|--------------|-----|
| `comfortable` | 16 |
| `tight` | 12 |
| `steep` | 7 |
| `no_way` | 3 |
| default | 10 |

**价格占比调整（基于 price_monthly / monthly_budget）：**

| 占比 | 调整 |
|------|------|
| < 5% | +3（价格极低） |
| > 15% | −3（价格偏高） |

**Cost-per-use 调整（基于 price_monthly 和频率）：**

```
cpu = price_monthly / (freq_per_week × 4.3) / benchmark(2.0)
```

| cpu 倍数 | 调整 |
|---------|------|
| > 3.0× | −3 |
| > 1.5× | −1 |
| < 0.3× | +2 |

**Forcing Function 奖励：**

```
if forcing_function in [academic, work, professional] → budget_fit + 3
```

---

### 4.5 Overlap（max 15）

| `overlap_level` | 分 |
|----------------|-----|
| `none` | 15 |
| `some` | 10 |
| `significant` | 4 |
| `high` | 0 |
| `not_sure` | 7 → 标记 uncertainty |
| default | 7 |

**Portfolio 惩罚：**
`same_cat_count ≥ 2` 且 `same_cat_avg_usage < 0.4` → Overlap − 3

**新用户保底：**
`existing_subs_count = 0` → Overlap = max(overlap, 13)

---

### 4.6 Risk（max 15）

| `top_risk` | 分 |
|-----------|-----|
| `none` | 15 |
| `mandatory_use` | 13（外部要求订阅） |
| `timeline_limited` | 10（有时间边界的顾虑） |
| `free_enough` | 10 |
| `forget_cancel` | 7 |
| `interest_decay` | 6 |
| `not_sure` | 5 → 标记 uncertainty |
| `impulse` | 4 |
| default | 8 |

**Forcing Function 下限保障：**

```
if forcing_function in [academic, work, professional] → risk = max(risk, 10)
```

---

### 4.7 Uncertainty Penalty（max −10）

每个 `not_sure` slot 的权重：

| Slot | 扣分 |
|------|------|
| `expected_frequency` | 3 |
| `budget_feel` | 2 |
| `motivation_clarity` | 2 |
| `overlap_level` | 1 |
| `top_risk` | 1 |

**历史用户减半：** `history_status` 为 `cancelled` / `upgrading` / `free_trial` 时，uncertainty × 0.5

不确定 slot 数（`not_sure_count`）决定 uncertainty_level：
- 0 → `low`
- 1–2 → `medium`
- 3+ → `high`

---

### 4.8 最终公式

```
total = clamp(NF + US + BF + OV + RK - uncertainty_penalty, 0, 100)
```

---

## 五、决策阈值与推荐结果

| 分数区间 | uncertainty_level | 推荐 |
|---------|-----------------|------|
| ≥ 70 | low | **Subscribe Now** |
| ≥ 55 | any | **Start Trial** |
| ≥ 40 | any | **Watchlist** |
| < 40 | any | **Consider Alternatives** |

> 历史版本阈值（App.jsx 基础版）：subscribe ≥75 / trial ≥60 / watchlist ≥45
> CHANGELOG 更新后：subscribe ≥70 / trial ≥55 / watchlist ≥40

---

## 六、Aha! 洞察触发器

对话过程中，以下条件触发一次性洞察气泡（≤30 词，含 action hint）：

| 条件 | 触发 |
|------|------|
| (a) Overlap 推断为 significant/high | 重叠提醒 |
| (b) price > 8% monthly_budget | 价格占比预警 |
| (c) freq ≤1 且 risk = forget_cancel 或 interest_decay | 低频高风险 |
| (d) slots 间矛盾（comfortable + 提到存钱等） | 矛盾提示 |
| (e) history = cancelled + cancel_reason = low_usage | 历史低频复发风险 |
| (f) risk = impulse | 冲动消费提醒 |

每次 audit 最多触发 **1 次**。

---

## 七、AI Adjuster（V6 格式）

**第二层评分，读取完整对话文本，输出 delta 修正**

### 输入（传入 Adjuster）

```
Rule Scores: { need_fit, usage, budget_fit, overlap, risk, total }
Persona: tags, subscriber_type, PAC, lifecycle, existing_subs, same_cat, checkin_sat, usage_trend
Slots: 全部已收集 slots
Conversation: 完整对话文本
```

### V6 输出格式

```json
{
  "signals": [
    {
      "name": "信号名称",
      "finding": "具体发现",
      "impact": -3,
      "confidence": "high|medium|low"
    }
  ],
  "total_delta": -5,
  "narrative_insight": "2-3 句报告用叙述",
  "overlap_inference": "功能重叠评估"
}
```

**最终分数：**
```
adjTotal = clamp(rule_total + total_delta, 0, 100)
```

### Impact 幅度校准

| 置信度 | 典型幅度 | 上限 |
|--------|---------|------|
| high | ±3 to ±5 | ±6 |
| medium | ±2 to ±3 | ±4 |
| low | ±1 to ±2 | ±2 |

`total_delta` 范围：`[-12, +10]`

### Adjuster 检测的信号类型（MODULE C）

1. **TONE** — 热情 vs 迟疑（"一直想要" vs "我猜"）
2. **MOTIVATION AUTHENTICITY** — 具体可信？行为一致？
3. **IMPLICIT FREQUENCY** — 动机暗示的频率（"每次通勤" = daily）
4. **SERVICE KNOWLEDGE** — 规则无法检测的功能重叠、免费替代品
5. **CONTRADICTIONS** — comfortable + 提省钱；no_overlap + 存在竞品；daily + 因 low_usage 取消
6. **CHECK-IN SIGNALS** — usage_trend 下降、低满意度

### 14 条预输出判断清单（MODULE H）

| # | 核心原则 |
|---|---------|
| H1 | 1 个具体理由 > 5 个模糊理由 |
| H2 | content access（想看某内容）= 升级动机 |
| H3 | upgrading 基线是正向，需实证才给负信号 |
| H4 | 套餐事实须有把握，不确定 → confidence=low |
| H5 | essentialist 走到这步已经自我过滤过 |
| H6 | spontaneous + 高频 ≠ 可疑 |
| H7 | 软词（"也许"）≠ 承诺飘移，需系统性退缩 |
| H8 | 单部剧 ≠ 内容结束风险 |
| H9 | 取消历史须"同类型 + 同原因"，缺一不可；`no_longer_needed ≠ low_usage` |
| H10 | 主动比价 = 正向信号（认真决策） |
| H11 | 免费替代品须有认知差，用户已知情则跳过 |
| H12 | 主动提到具体功能 = 热情质量 +2~+3 |
| H13 | Portfolio 门槛是 3+ 同类，不是 2 |
| H14 | 输出前正负信号平衡检查，全负须强制自审 |

### 禁止项（MODULE G + 扩展）

1. 不重复惩罚规则引擎已处理的信号
2. 不将礼貌用语计为正向评分信号
3. 不猜测服务信息（不确定 → confidence="low"）
4. budget_fit delta 上限 ±3
5. delta=0 是有效输出（reason: "Consistent with rule assessment"）
6. 不声称某内容在更便宜套餐可看，除非 100% 确定
7. 用户提到"想看/玩某具体内容"（upgrading）= 强升级动机

---

## 八、全部 Slots 汇总

| Slot | 来源 Stage | 类型 |
|------|-----------|------|
| `service_name` | 1 | string |
| `price` | 1 | number |
| `billing_cycle` | 1 | "monthly" / "yearly" |
| `price_monthly` | 1（计算） | number |
| `primary_motivation` | 2 | string |
| `motivation_text` | 2 | string（原始） |
| `motivation_clarity` | 2 | enum |
| `forcing_function` | 2 | enum / null |
| `history_status` | 3 | "first_time" / "cancelled" / "upgrading" / "free_trial" |
| `cancel_reason` | 3 | enum / null |
| `cancel_text` | 3 | string（原始，可选） |
| `expected_frequency` | 4 | number (sessions/wk) / "not_sure" |
| `overlap_level` | 4.5 | enum |
| `budget_feel` | 5 | enum |
| `top_risk` | 6 | enum |
| `additional_risk_note` | 6 | string（可选） |

---

## 九、迁移到 Sub App 的注意点

### 需要保留的核心逻辑

- `computeScore()` 函数（纯 JS，无依赖，可直接迁移）
- `DEFAULT_RULES` 常量（评分参数，可调）
- `DEFAULT_CONVO_PROMPT`（system prompt，注入 persona 变量后发给 Claude）
- `DEFAULT_ADJUSTER_PROMPT`（第二轮 AI prompt）
- Slot 收集结构
- Aha! 触发条件

### 主要架构差异（workbench vs app）

| 方面 | Workbench | Sub App |
|------|-----------|---------|
| Persona 来源 | 手动 Settings 面板输入 | 从 Supabase user profile 读取 |
| 对话 UI | Web chat panel | React Native `AuditScreen.tsx` |
| 评分展示 | Rules 面板 + Adjuster 面板 | `ReportScreen.tsx` |
| 数据持久化 | localStorage | Supabase |
| API Key | 用户自输入 | 走 backend proxy（不暴露给前端） |
| Inline edit | 对话内 ✏ 按钮修改 slot | 可选：Review 页面重新 pick |

### 推荐迁移顺序

1. `computeScore` + `DEFAULT_RULES` → `utils/auditScorer.ts`（已有基础版，需补齐 v5.7 参数）
2. Convo prompt → `utils/claude.ts` system prompt 替换
3. Adjuster prompt → `utils/claude.ts` 新增 `runAdjuster()` 函数
4. Slot 类型定义 → TypeScript interface
5. Decision thresholds → `ReportScreen.tsx` 结果展示逻辑

---

*文档生成时间：2026-03-11*
*对应版本：Convo v5.7 / Adjuster v6.3*
