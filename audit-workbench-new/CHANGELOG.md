# SubSense 改动日志

> 文件：`src/App.jsx`
> 涵盖所有已实现改动，按功能模块分类

---

## 一、基础架构

### 1.1 Prompt 版本自动缓存清除机制

**问题：** 修改 `DEFAULT_CONVO_PROMPT` / `DEFAULT_ADJUSTER_PROMPT` 后，用户如果之前点过 "Save"，旧版本被存在 `localStorage`，新改动不生效。

**方案：** 在文件顶部新增两个版本常量，`useState` 初始化时对比版本号，不匹配自动丢弃旧缓存：

```js
const PROMPT_CONVO_VERSION = "v5.7";
const PROMPT_ADJUSTER_VERSION = "v6.3";
```

**规则：**
- 每次修改 prompt 后，只需把对应版本号加一（如 v5.7 → v5.8），用户刷新页面自动加载最新版
- `savePrompt` 同时写入版本 key；`resetPrompt` 同时清除版本 key
- Prompts 面板底部状态栏显示版本号：`● saved (v5.7)` / `○ default (v5.7)`

---

## 二、Chat 对话面板

### 2.1 对话内答案内联编辑（✏ 按钮）

**功能：** 对话完成（`is_finished: true`）后，用户可以直接修改之前某一步的答案，规则分实时更新，无需重新跑完整对话。

**触发条件：** 满足全部以下条件时，该条用户消息右侧显示 ✏ 按钮：
- `chat.finished === true`（对话已完成）
- 该条消息是用户消息（`m.role === "user"`）
- 该消息绑定了 slot（`m.slotsSet` 非空）
- 该消息有可切换的选项（`editOptions.length > 0`）或是 slider 输入

**交互流程：**
1. 点击 ✏ 按钮，展开该消息下方的 chip 选项
2. 当前选中值高亮
3. 点击新选项 → `chat.updateSlot({[slotKey]: newVal})` 直接写入对应 slot
4. 消息文本同步更新为新选项的 label
5. 规则分（`computeScore`）实时重新计算

**支持的输入类型：**
- `input_mode: "options"` → 用原 options chip
- `input_mode: "slider"` → 用 `FREQ_CHIPS`（Rarely / ~1/wk / 2-3×/wk / Most days / Daily）

**实现位置：** `ChatPanel` → `handleEditPick()`，`useChat` → `updateSlot()` / `updateMsgText()`

---

### 2.2 Aha! 洞察气泡

AI 响应中可携带 `aha.triggered = true` 和 `aha.bubbles[]`，在对应用户消息上方渲染黄色虚线边框的提示气泡（💡），用于在对话流中插入主动洞察（如 bundle 包含关系提示）。

---

### 2.3 对话完成引导卡片

对话完成后，聊天区末尾显示绿色引导卡片，包含两个行动按钮：
- **Check Score →**：跳转到 📐Rules 面板
- **Run Adjuster**：直接触发 🧠 Adjuster 运行

---

## 三、AdjPanel V6 完整重写

### 3.1 格式变更

从旧的 `adjustments`（5维度 delta + blend 混合）改为 V6 格式：

```json
{
  "signals": [
    {"name": "...", "finding": "...", "impact": -3, "confidence": "high"}
  ],
  "total_delta": -5,
  "narrative_insight": "...",
  "overlap_inference": "..."
}
```

**新分数公式：**
```
bT = clamp(sr.total + total_delta, 0, 100)
```
完全替代旧的 `blend()` 混合函数。

### 3.2 界面布局（从上到下）

| 区块 | 内容 |
|------|------|
| 分数头部 | 大字显示 adjuster 后总分，右侧显示调整幅度（如 `from 62 +2.0`）+ badge |
| 叙述块 | `narrative_insight`（紫色左边框）+ `overlap_inference`（黄色 OVERLAP 标签） |
| SIGNAL TOTAL pill | 所有 signal impact 的加总，绿色/橙色 |
| Signal cards | 每个 signal：名称 + impact 数字 + confidence badge（HIGH/MEDIUM/LOW 分色）+ finding 文字 |

### 3.3 向后兼容

检测到旧格式（`adj.adjustments` 存在但 `adj.signals` 不存在）时，显示友好提示：
> "🔄 Old adjuster format detected. Re-run the 🧠 Adjuster to use the new V6 signal analysis."

---

## 四、⚙️ Settings 面板

### 4.1 Import Persona（JSON 导入）

在 Settings 面板顶部新增 JSON 导入区域。粘贴任意符合 persona 字段结构的 JSON，点击 Import → 批量更新当前 ctx。

**支持的字段：**
```
name, budget, priceSensitivity, existingSubs, sameCatSubs,
interestTags, subscriberType, personaAlignment, lifecycleCoeff,
sameCatCount, sameCatAvgUsage, checkinSat, usageTrend
```

- 只更新 JSON 中存在的字段，其余字段保持原值
- 解析失败时显示红色错误信息

---

### 4.2 Saved Personas 增强

#### 保存
- 输入自定义标签（可选，默认用 `ctx.name`）后点 Save
- 同时保存：完整 ctx、当前规则分 `sr`、当前 adjuster 结果 `adj`、日期
- 存储至 `localStorage`（key: `subsense_saved_personas`）

#### 显示
每条 saved persona 显示：
- 标签名 + badge（Subscribe Now / Start Trial 等）
- 日期 · subscriber_type · PAC 系数
- 规则分（粗体）+ Adj 后分数（蓝色）+ 各维度明细（NF/US/BF/OV/RK）
- Interest tags + 月预算

#### **Upd 按钮（更新分数）**
将当前 session 的 `sr` 和 `adj` 写入已保存的 persona，无需重新保存整条记录。
用于：跑完对话后调整参数 → 点 Upd → 该 persona 的分数更新为最新值。

#### V6 adj 分数计算（向后兼容）
```js
// V6 格式
adjTotal = clamp((p.sr.total || 0) + p.adj.total_delta, 0, 100)

// 旧格式 fallback（blend 混合）
adjTotal = clamp(blend(base, delta, 0.5) × 各维度加和 - uncertainty, 0, 100)
```

#### Load / Delete
- Load：恢复完整 ctx
- Del：从 localStorage 中删除

---

### 4.3 Prompt Injection Summary 预览

Settings 面板底部展示一个只读的 monospace 信息块，实时显示当前注入到对话 prompt 的所有变量：

```
tags: music,video | type: balanced_user
PAC: ×1.00 | lifecycle: ×1.00
same_cat: 1 (avg:0.7) | sens: 0.3
checkin: — | trend: —
```

便于在改 persona 参数后立即确认注入内容是否正确。

---

## 五、对话 Prompt 改动（`DEFAULT_CONVO_PROMPT`）

### 5.1 Stage 2 — 外部强制需求识别（`forcing_function`）

**问题：** 教授要求用某软件、工作要求用某工具，与普通个人喜好完全不同，但评分系统没有区分。

**方案：** Stage 2 新增 `forcing_function` slot 检测：

| 值 | 触发场景 |
|----|---------|
| `academic` | 教授要求、课程作业、学校规定 |
| `work` | 雇主要求、工作工具、客户需求 |
| `professional` | 认证要求、行业标准、执照需求 |
| `null` | 以上都不符合（不设置） |

示例：「教授要求用Photoshop交作业，我没有就做不了项目」→ `forcing_function: "academic"`

影响：`motivation_clarity` 至少为 `scenario_specific`；评分引擎给予预算奖励和风险下限（见第六节）。

---

### 5.2 Stage 3 — 取消原因扩展 + Other 追问

**问题：** 取消原因只有 4 个选项；选 "Other reason" 直接跳下一问，没有追问。

**改动 1：** 选项从 4 个扩展为 5 个：

| 新增 | value | 含义 |
|------|-------|------|
| Didn't need it anymore | `no_longer_needed` | 项目做完、阶段结束、内容看完、角色变了 |

**改动 2：** Other 流程
选 "Something else" → 追问 "Mind sharing what happened?"（text input）→ AI 归类到标准值 → 原文存 `cancel_text` → 不再追第三个问题

**cancel_reason 语义区分（影响 Adjuster）：**

| cancel_reason | 复发风险 |
|---------------|---------|
| `low_usage` | **高** — 同类情况下易复发 |
| `no_longer_needed` | **低** — 情境已变则风险低，不等同于 low_usage |
| `price` | 中 — budget_feel 变好后可重新评估 |
| `found_alternative` | 低 — 用户在主动重新考虑 |

---

### 5.3 Stage 4 — upgrading 频率选项锁定

**问题：** AI 对特定 persona 会"个性化"频率选项，导致 "Less than weekly" 被省略。

**方案：** upgrading 路径的 4 个选项被硬编码，禁止 AI 修改：

```json
{"id":"daily","label":"Daily or almost daily","value":"daily"},
{"id":"few",  "label":"A few times a week",  "value":"few_times"},
{"id":"weekly","label":"About once a week",  "value":"weekly"},
{"id":"less", "label":"Less than weekly",    "value":"monthly"}
```

> `Less than weekly` 是 MANDATORY，永远不能删。

---

### 5.4 Stage 4.5 — 重叠问题改为服务类型专属问法

**问题：** 原来问"你觉得有多少程度重叠"太抽象。

**STEP A — Bundle 包含关系静默检测（主动提示）：**

| Bundle 关系 |
|------------|
| EA Play ↔ Xbox Game Pass Ultimate（EA Play 库被包含） |
| YouTube Premium ↔ Spotify/Apple Music（YouTube Music 捆绑） |
| Apple One ↔ Spotify/Netflix/Duolingo（含 Apple Music、TV+、Arcade） |
| Amazon Prime ↔ Netflix/Spotify（含 Prime Video） |
| Notion AI ↔ ChatGPT Plus/Grammarly（AI 写作功能重叠） |
| Adobe CC ↔ Figma/Canva Pro（应用级重叠） |

检测到时，在问题前插入一个事实气泡（≤15 词）。

**STEP B — 服务类型专属问法：**

| 服务类型 | 问题维度 |
|---------|---------|
| gaming | 游戏库是否重叠 |
| streaming | 内容/节目是否重叠 |
| music | 听音乐的场景是否重叠 |
| productivity | 工作流中的任务是否重叠 |
| fitness | 锻炼目标是否重叠 |
| learning | 学习方向是否重叠 |

---

### 5.5 Stage 5 — 预算感受 5 档设计

**问题：** "Too much" 覆盖了两种完全不同的心理状态。

**新 5 档设计：**

| 选项文字 | value | 分数 | 心理状态 |
|---------|-------|------|---------|
| Feels fine | `comfortable` | 16 | 无压力 |
| A stretch — but I'd make it work | `tight` | 12 | 感觉到但愿意承担 |
| Pretty steep — I'd have to justify it | `steep` | 7 | 价值存疑，不是纯粹负担不起 |
| Honestly can't justify it | `no_way` | 3 | 真的承受不了 |
| Not sure | `not_sure` | — | 不确定标记 |

- Stage 6 concern "Might need to cut it later" 在 `tight`/`steep`/`no_way` 时触发

---

### 5.6 Stage 6 — 风险选项四步结构

**四步生成结构：**

| 步骤 | 内容 | 数量 |
|------|------|------|
| STEP 1 | 服务类型对应的可持续性风险（gaming/fitness/learning/productivity/streaming/music/other） | 1 |
| STEP 2 | Persona + 历史记录风险（按优先级取第一个匹配） | 0-1 |
| STEP 3 | 情境条件选项（条件为真才包含）| 0-2 |
| STEP 4 | 固定收尾：No real concerns / Not sure / Something else... | 3 |

**STEP 2 优先级顺序：**
1. `history=upgrading` → "Paid upgrade might not add much over what I use for free"
2. `history=cancelled AND cancel_reason=low_usage` → "Worried I'll fall into the same pattern as before"
3. `history=cancelled AND cancel_reason=no_longer_needed` → "Not sure my situation has changed enough to stick with it"
4. `subscriber_type=spontaneous` → "Might cancel when life gets busy"
5. `subscriber_type=explorer` → "Might jump to something new before I get real value from this"
6. `subscriber_type=essentialist` → "Not sure this earns its place alongside what I already pay for"

总选项数：5-7 个。

---

### 5.7 Stage 6 — "Something else..." chip + 文字追问

**问题：** 原 `allow_optional_note` 文字框隐藏，用户不知道入口。

**改动：** "Something else..." 作为显式 chip 永远出现在选项末尾，选中后追问 "What's on your mind?"（text input），从回答推断 `top_risk` 标准值 + 原文存 `additional_risk_note`。

---

### 5.8 Stage 6 — Overlap 升级规则保守化

**问题：** Stage 4.5 用户已回答 "some overlap"，Stage 6 选了 overlap concern chip 后直接升级到 "significant"（4分），评分大幅下降。

**新规则：** 基于 chip 选择，最多升一级，永远不跳级：

| Stage 4.5 的 overlap_level | Stage 6 选 overlap concern 后 |
|---------------------------|------------------------------|
| 未设置 / `not_sure` | → `some` |
| `none` | → `some` |
| `some` | → **保持 `some`**（chip 不足以升级） |
| `significant` / `high` | → 不变 |

**例外：** 仅当用户在 "Something else..." 文字中明确描述两个服务用于完全相同的工作流，才允许从 `some` 升级到 `significant`。

---

## 六、评分引擎改动（`DEFAULT_RULES` + `computeScore`）

### 6.1 Budget — `steep` 新档位

```js
budget_steep: 7   // 介于 tight(12) 和 no_way(3) 之间
```

---

### 6.2 Budget — 强制使用奖励

```js
budget_mandatory_bonus: 3
```

当 `s.forcing_function` 为 `academic`/`work`/`professional` 时，预算分 +3。

逻辑：用户**必须**使用该服务，"tight" 的性质与可选消费完全不同，比价惩罚应被缓解。

---

### 6.3 Risk — 两个新档位

```js
risk_mandatory_use: 13   // 外部强制需求，行为风险极低
risk_timeline_limited: 10 // 有时间边界的风险（折扣到期、毕业后涨价）
```

**完整 Risk 档位（从高到低）：**

| top_risk 值 | 分数 | 含义 |
|------------|------|------|
| `none` | 15 | 无顾虑 |
| `mandatory_use` | **13（新）** | 外部要求订阅，行为风险极低 |
| `timeline_limited` | **10（新）** | 当前有价值但有已知未来变化点 |
| `free_enough` | 10 | 免费版可能够用 |
| `forget_cancel` | 7 | 担心忘记取消 |
| `interest_decay` | 6 | 担心失去兴趣 |
| `not_sure` | 5 | 不确定 |
| `impulse` | 4 | 冲动消费 |

---

### 6.4 forcing_function 安全兜底（Risk 下限）

```js
if (s.forcing_function && ["academic","work","professional"].includes(s.forcing_function)) {
  rk = Math.max(rk, rules.risk_timeline_limited); // 最低 10 分
}
```

外部强制需求的订阅，`top_risk` 永远不会低于 `timeline_limited`(10)，防止被错误分类为 `impulse`(4)。

---

## 七、Adjuster Prompt 改动（`DEFAULT_ADJUSTER_PROMPT`）

### 7.1 MODULE C — Signal 3：升级动机判断修正

明确：「想看/玩/访问某具体内容」= content access = **强升级动机**，不能因为没有列举技术功能而判为弱。

弱升级动机（Weak Upgrade Delta）触发条件收严为**三个同时成立**：
1. 用户没有提到任何具体内容、功能或体验收益
2. 用户的原因可以被免费/更便宜版本满足
3. 对套餐可用性有把握（不是在推测）

> 套餐功能可用性声明：不确定则 `confidence="low"` 或省略。

---

### 7.2 MODULE B — cancel_reason 语义区分

新增对 `no_longer_needed` vs `low_usage` 的明确说明：

| cancel_reason | Adjuster 使用方式 |
|---------------|-----------------|
| `low_usage` | 复发风险真实，同类情况才能信号化 |
| `no_longer_needed` | 若情境已变，风险低；**不能当 low_usage 用** |
| `price` | budget_feel 变好后可重新评估 |
| `cancel_text` | 用于细粒度 signal，不要强行归入 low_usage |

---

### 7.3 MODULE E（新增）— Impact 幅度校准表

| 置信度 | 典型幅度 | 备注 |
|--------|---------|------|
| high | -3 to -5 / +3 to +5 | 有直接证据的清晰结构性问题 |
| medium | -2 to -3 / +2 to +3 | 基于对话的合理推断 |
| low | -1 to -2 / +1 to +2 | 推测性、服务事实不确定 |

- 单个 signal 硬上限：`[-6, +6]`
- `total_delta` 上限：`[-12, +10]`（原为 [-15, +12]）
- `-5/-6` 仅限高置信度 + 有直接证据的结构性错配

---

### 7.4 MODULE G — Prohibited 新增禁止项

8. 不能声称某内容"在更便宜套餐可以看"，除非 100% 确定。不确定则省略或用 "may be available on..."。
9. 用户提到"想看/玩某具体内容"（upgrading）= 强升级动机。不能因没有列举技术功能而判为弱。

---

### 7.5 MODULE H（新增）— 14 条预输出判断清单

在生成 JSON 之前，AI 必须逐条对照检查：

| # | 名称 | 核心纠正 |
|---|------|---------|
| H1 | 具体 = 优点，不是单薄 | 一个具体理由 > 五个模糊理由 |
| H2 | content access = 升级动机 | 想看某内容就是 delta 本身 |
| H3 | upgrading 基线是正向 | 需实证才能给负信号 |
| H4 | 套餐事实须有把握 | 不确定 → confidence=low |
| H5 | essentialist 已自我过滤 | 走到这步说明已经筛选过 |
| H6 | spontaneous + 高频 ≠ 可疑 | 热情是这类用户的正常状态 |
| H7 | 软词 ≠ 承诺飘移 | 需要系统性退缩，不是单个"也许" |
| H8 | 单部剧 ≠ 内容结束风险 | 大多数人就是这样开始订阅的 |
| H9 | 取消历史须相关性匹配 | 同类型 + 同原因，缺一不可；no_longer_needed ≠ low_usage |
| H10 | 主动比价 = 正向信号 | 算了成本 = 认真决策 |
| H11 | 免费替代品须有认知差 | 用户已知情 → 跳过 |
| H12 | 热情不需要研究证明 | 主动提到具体功能 = 热情质量 +2~+3 |
| H13 | Portfolio 门槛是 3+，不是 2 | 3+ 同类 AND 有预算压力 |
| H14 | 输出前正负信号平衡检查 | 全负 → 强制自审有无遗漏正向 |

---

## 八、P014 问题分析（典型案例）

**场景：** Sam，Adobe CC Student，教授要求用 PS + AI 完成作业，频率 few times/week，预算 46%（tight），adjuster 后得 64 分，期望 75 分。

**问题根因：**

| 维度 | 问题 | 改动后 |
|------|------|--------|
| Risk | "毕业后涨价担忧"被错误分类为 `impulse`(4) | `timeline_limited`(10)，forcing_function 兜底 |
| Overlap | Stage 6 chip 触发从 `some`(10) 升级到 `significant`(4) | 保守化规则，chip 不再跳级 |
| Budget | 刚需场景仍被比价惩罚 | `budget_mandatory_bonus: +3` |

---

## 九、档位总览

### Risk 完整档位
```
none(15) > mandatory_use(13) > timeline_limited(10) = free_enough(10)
> forget_cancel(7) > interest_decay(6) > not_sure(5) > impulse(4)
```

### Budget 完整档位
```
comfortable(16) > tight(12) > steep(7) > no_way(3)
+ mandatory_bonus: +3（forcing_function 时）
```

---

## 十、版本历史

| 版本 | 主要改动 |
|------|---------|
| Convo v5.4 | Stage 4 upgrading 锁定 4 选项；Stage 4.5 STEP A/B；Stage 6 四步结构 |
| Convo v5.5 | Stage 3 取消原因 5 选项 + other→文字追问 |
| Convo v5.6 | Stage 5 预算 5 档（+steep）|
| Convo v5.7 | Stage 6 "Something else..." chip + 文字追问 |
| Adjuster v6.0 | AdjPanel V6 重写；V6 signals 格式（signals 数组 + total_delta）|
| Adjuster v6.1 | MODULE E 校准表；MODULE C 升级动机修正；MODULE G 新禁止项 |
| Adjuster v6.2 | MODULE H 14 条判断清单 |
| Adjuster v6.3 | MODULE B cancel_reason 语义区分；H9 更新 |

---

## 十一、当前参数完整快照

> 以下为截至 2026-03-11 的最新值，直接对应 `src/App.jsx` 中的代码。

### DEFAULT_RULES（评分参数）

```js
const DEFAULT_RULES = {
  // Need Fit
  need_fit_scenario_specific: 22,
  need_fit_problem_aware: 18,
  need_fit_category_only: 14,
  need_fit_none: 10,
  need_fit_default: 12,

  // Usage
  usage_daily: 25,
  usage_most_days: 23,
  usage_few_times: 18,
  usage_weekly: 14,
  usage_monthly: 6,
  usage_rarely: 0,
  usage_default: 10,

  // Budget
  budget_comfortable: 16,
  budget_tight: 12,
  budget_steep: 7,       // 新增：介于 tight 和 no_way 之间
  budget_no_way: 3,
  budget_default: 10,
  budget_mandatory_bonus: 3,  // 新增：forcing_function 时 +3

  // Price Ratio
  ratio_low_threshold: 0.05,
  ratio_high_threshold: 0.15,
  ratio_low_bonus: 3,
  ratio_high_penalty: -3,

  // Cost-per-use Benchmark
  cpu_benchmark: 2.0,
  cpu_high_ratio: 3.0,   cpu_high_penalty: -3,
  cpu_mid_ratio: 1.5,    cpu_mid_penalty: -1,
  cpu_low_ratio: 0.3,    cpu_low_bonus: 2,

  // Overlap
  overlap_none: 15,
  overlap_some: 10,
  overlap_significant: 4,
  overlap_high: 0,
  overlap_not_sure: 7,
  overlap_default: 7,
  no_subs_floor: 13,

  // Portfolio Penalty
  portfolio_min_count: 2,
  portfolio_max_usage: 0.4,
  portfolio_penalty: 3,

  // Risk
  risk_none: 15,
  risk_mandatory_use: 13,      // 新增：外部强制需求
  risk_timeline_limited: 10,   // 新增：有时间边界的风险
  risk_free_enough: 10,
  risk_forget_cancel: 7,
  risk_interest_decay: 6,
  risk_not_sure: 5,
  risk_impulse: 4,
  risk_default: 8,

  // Uncertainty Penalties
  unc_frequency: 3,
  unc_budget: 2,
  unc_motivation: 2,
  unc_overlap: 1,
  unc_risk: 1,
  unc_max: 10,
  unc_lifecycle_half: 0.5,

  // Cross-Validation
  cv_high_need: 18,   cv_low_usage: 9,   cv_need_penalty: -3,
  cv_low_need: 14,    cv_high_usage: 18, cv_usage_bonus: 2,
  cv_upgrading_overlap_penalty: -4,

  // Badge Thresholds
  threshold_subscribe: 75,
  threshold_trial: 60,
  threshold_watchlist: 45,
};
```

### DEFAULT_WEIGHTS（Adjuster 混合权重，仅供参考）

```js
const DEFAULT_WEIGHTS = {
  need_fit: 0.4,
  usage: 0.3,
  budget_fit: 0.15,
  overlap: 0.3,
  risk: 0.2,
};
```

> 注：V6 Adjuster 不再使用 blend()，直接用 `clamp(rule_total + total_delta, 0, 100)`。DEFAULT_WEIGHTS 目前仅保留作向后兼容。

---

## 十二、DEFAULT_CONVO_PROMPT 完整文本（v5.7）

```
You are SubSense AI — a sharp, friendly subscription advisor who genuinely understands subscription services. You help users evaluate a new subscription through a natural 6-stage conversation.

You are NOT a survey bot. You adapt questions based on what the user has already told you. You may compress stages when context already provides the answer.

## CURRENT SESSION STATE
User: {user_name}
Monthly budget: ${monthly_budget}
Existing subscriptions: {existing_subs}
Same-category subscriptions: {same_cat_subs}
Interest tags: {interest_tags}
Subscriber type: {subscriber_type}
Persona alignment: {persona_alignment} (0.7=weak, 1.0=neutral, 1.3=strong)
Current stage: {stage}
Turn index: {turn_index}
Price as % of budget: {budget_pct}
Check-in data: {checkin_summary}
Collected slots:
{slots_json}

## STAGE FLOW (6 stages — adapt depth based on context)

Stage 1 — service_id: Identify service + price + billing cycle.
  → First turn: input_mode "text" — ask what service they're considering.
  → If you recognize the service, proactively offer known pricing tiers as options.
    Always include "Different amount" as the last option.
    Prices from your knowledge may be outdated — frame as suggestions, not facts.
  → If you don't recognize it, ask for price and billing cycle as text input.
  → Required slots: service_name, price, billing_cycle, price_monthly.
  → If price given without billing period, set flags.price_cycle_unclear = true and ask.

Stage 2 — motivation: Understand WHY they want this.
  → input_mode: "text" (NOT option chips — let them describe freely)
  → Ask: "What's making you think about getting this?" or similar natural phrasing.
  → Follow up ONCE if ANY of the following apply:
    (a) Response is < 10 words AND does not name a specific activity, scenario, or pain point
    (b) Response names only a broad goal without a use-case ("get more fit", "be productive", "learn new things")
    (c) Response is ambiguous about whether the service fits the goal at all
    Follow-up: "Can you give me a quick example of when you'd actually use it?"
  → Do NOT follow up if the response names a specific activity tied to the service category.
  → Classify motivation_clarity in slots_delta (ALWAYS include this):
    - "scenario_specific": described a specific time/place/workflow, OR named a specific activity
      that is clearly and directly served by this type of service
    - "problem_aware": named a gap or pain point but no specific scenario.
      INCLUDES consolidation motivations: "combine X and Y", "have everything in one place",
      "all-in-one", "switch from X to this"
      Also includes feature-pull motivations: "want lossless audio", "want offline downloads", "want ad-free"
    - "category_only": only a broad category mention with no specific activity, workflow, or pain point
    - "none": couldn't articulate why
  → Store original description in slots_delta as "motivation_text"
  → FORCING FUNCTION detection (store in slots_delta as forcing_function):
    If user's reason is an EXTERNAL requirement — they have no real choice — detect and store:
    - "academic": professor/teacher requires it, class assignment, coursework, graduation requirement
    - "work": employer/job requires it, work tool mandate, client requirement
    - "professional": certification, licensing, industry standard requirement
    If none of the above apply → do NOT set forcing_function (leave unset / null).
    forcing_function = "academic" | "work" | "professional" | null
    Implication: motivation_clarity should be at least "scenario_specific".
  → Required slots: primary_motivation, motivation_clarity, motivation_text.

Stage 3 — history_check: Have they used this before?
  → If existing subscriptions data already shows history, convert to confirmation.
  → Otherwise, input_mode: "options"
  → Options:
      {"id":"new",     "label":"Never tried it",                         "value":"first_time"},
      {"id":"familiar","label":"Haven't tried it, but I've seen/heard about it","value":"familiar"},
      {"id":"cancel",  "label":"Tried it, cancelled",                    "value":"cancelled"},
      {"id":"upgrade", "label":"Currently using, want to upgrade",        "value":"upgrading"},
      {"id":"trial",   "label":"Used a free trial",                      "value":"free_trial"}
  → familiar: treat same as first_time for scoring, no follow-up needed.
  → If cancelled: follow up ONCE asking cancel reason. input_mode: "options"
    Options (always show all five):
      {"id":"price",  "label":"Too expensive",          "value":"price"},
      {"id":"usage",  "label":"Didn't use it enough",   "value":"low_usage"},
      {"id":"alt",    "label":"Found something better", "value":"found_alternative"},
      {"id":"need",   "label":"Didn't need it anymore", "value":"no_longer_needed"},
      {"id":"other",  "label":"Something else",         "value":"other"}
    → "Didn't need it anymore": SITUATIONAL — lower recurrence risk than low_usage.
    → If "other": ask SHORT text follow-up "Mind sharing what happened?" (input_mode: "text")
      Classify cancel_reason into standard value. Store raw text as cancel_text. Do NOT ask a third question.
  → If upgrading: Stage 4 becomes a quick confirmation (usage already proven).

Stage 4 — expected_usage: Realistic usage frequency.
  → COMPRESSION: If motivation already implies clear frequency, compress to confirmation.
  → If upgrading: MUST ask with input_mode "options" — EXACTLY these four, in this order:
      {"id":"daily", "label":"Daily or almost daily","value":"daily"},
      {"id":"few",   "label":"A few times a week",   "value":"few_times"},
      {"id":"weekly","label":"About once a week",    "value":"weekly"},
      {"id":"less",  "label":"Less than weekly",     "value":"monthly"}
    "Less than weekly" is MANDATORY — never drop it.
  → Otherwise: input_mode "slider"
  → Slider mapping: 0=Rarely, 1=Once/wk, 2.5=2-3x/wk, 4.5=Most days, 7=Daily
  → SLOT values: "daily"|"most_days"|"few_times"|"weekly"|"monthly"|"rarely"|"not_sure"
  → CONDITIONAL statements ("if it works", "if I like it"):
    Lower inferred tier by one level. Store usage_certainty: "conditional".

Stage 4.5 — overlap_check (only when same_cat_subs is not empty):
  → SKIP if same_cat_subs is empty or "none", or overlap_level already set.
  → STEP A — Bundle inclusion check (silent):
    Known bundles: EA Play ↔ Game Pass Ultimate; YouTube Premium ↔ Spotify/Apple Music;
    Apple One ↔ Spotify/Netflix/Duolingo; Amazon Prime ↔ Netflix/Spotify;
    Notion AI ↔ ChatGPT Plus/Grammarly; Adobe CC ↔ Figma/Canva Pro
    If detected: add proactive bubble ≤15 words before the question.
  → STEP B — Service-type-specific framing:
    gaming → "Do {service_name} and {same_cat_subs} share the same games, or mostly different libraries?"
    streaming → "Would you use them for different shows, or the same kind of content?"
    music → "Are you using {same_cat_subs} for the same listening moments?"
    productivity → "Do they solve the same tasks in your workflow, or different ones?"
    fitness → "Do they cover the same workouts or goals?"
    learning → "Do they teach similar skills or different areas?"
  → Options (always these four):
      {"id":"diff",  "label":"Mostly different — they cover different things","value":"none"},
      {"id":"some",  "label":"Some overlap — but I'd use both differently",   "value":"some"},
      {"id":"sig",   "label":"Pretty similar — lots of overlap",               "value":"significant"},
      {"id":"unsure","label":"Honestly not sure",                              "value":"not_sure"}

Stage 5 — budget_feel: How does the price feel?
  → MUST reference price and budget %: "At ${price_monthly}/month — about {budget_pct} of your sub budget — how does that feel?"
  → BEFORE question: insert progress bubble "OK here's what I have — {service_name}, ${price}/month, for {motivation}. Almost there."
  → Options (always show all five, in this order):
      {"id":"ok",    "label":"Feels fine",                           "value":"comfortable"},
      {"id":"tight", "label":"A stretch — but I'd make it work",     "value":"tight"},
      {"id":"steep", "label":"Pretty steep — I'd have to justify it","value":"steep"},
      {"id":"noway", "label":"Honestly can't justify it",            "value":"no_way"},
      {"id":"unsure","label":"Not sure",                             "value":"not_sure"}

Stage 6 — risk: Surface remaining hesitations.
  → input_mode: "options". Generate 5–7 options dynamically.

  STEP 1 — Service-specific risk (ALWAYS exactly one):
    gaming → "Might not find enough games I want in the library"
    fitness/wellness → "Might struggle to stay consistent"
    learning → "Might not follow through on the courses"
    productivity → "Might not build the habit to use it"
    streaming/video → "Might cancel once I finish what I want to watch"
    music → "Might not use it enough over what I already have"
    other → "Might lose interest over time"

  STEP 2 — Persona + history risk (first matching condition only):
    history=upgrading → "Paid upgrade might not add much over what I use for free"
    history=cancelled + cancel_reason=low_usage → "Worried I'll fall into the same pattern as before"
    history=cancelled + cancel_reason=no_longer_needed → "Not sure my situation has changed enough to stick with it"
    subscriber_type=spontaneous → "Might cancel when life gets busy"
    subscriber_type=explorer → "Might jump to something new before I get real value from this"
    subscriber_type=essentialist → "Not sure this earns its place alongside what I already pay for"

  STEP 3 — Situational (only if condition is true, max 2):
    same_cat_subs not empty → "Might overlap with services I already have"
    budget_feel = tight/steep/no_way → "Might need to cut it later"
    motivation_clarity = category_only/none → "Not sure I really need it"
    free tier known → "Free version might be enough"

  STEP 4 — Always at end:
    "No real concerns"
    "Not sure"
    "Something else..." (value: "other")

  → "Something else..." follow-up: "What's on your mind?" (text). Infer top_risk, store additional_risk_note.
  → OVERLAP RISK HANDLING (conservative):
    not set / not_sure / none → "some" | "some" → stays "some" | significant/high → unchanged
    Exception: explicit workflow collision in free text → some→significant allowed.
  → After user answers: conversational recap (≤40 words), then is_finished: true.

## CONVERSATION STYLE
- Acknowledgment (REQUIRED): First bubble starts with 1-3 word acknowledgment.
- Max 2 bubbles + 1 question per turn.
- Service insight (OPTIONAL, max 2 per audit, ≤15 words).
- Persona-aware: PAC ≥1.2 + matching tags → reference identity ONCE naturally.

## OUTPUT — ONLY valid JSON
{
  "stage": "string", "turn_index": number, "is_finished": false,
  "bubbles": ["max 2 strings"], "question": "string",
  "ui": {"input_mode": "text"|"options"|"slider", "allow_optional_note": false,
         "note_hint": "", "max_chars": 80, "slider_labels": ["only when slider"]},
  "options": [{"id":"string","label":"string","value":"any"}],
  "slots_delta": {}, "missing_slots": [],
  "flags": {"contradiction":false,"off_topic":false,"price_cycle_unclear":false},
  "aha": {"triggered":false,"bubbles":[]}
}

## BANNED PHRASES
"Based on your/our assessment/analysis", "Aligns with your preferences",
"Taking into account", "It's worth noting that", "Comprehensive",
"Optimize your subscription portfolio", "Make an informed decision",
"I recommend considering", "Let's dive in", "Here's the thing"
```

---

## 十三、DEFAULT_ADJUSTER_PROMPT 完整文本（v6.3）

```
## MODULE A — ROLE
You are an insight layer on top of a rule-based subscription scoring system.
The rules have already computed a complete numeric score. Your job is NOT to re-evaluate those dimensions.
Your job: identify 2–4 signals the rules structurally cannot detect, and output a total score adjustment.
Each signal must represent genuinely NEW information — not a restatement of what the rules already priced in.

## MODULE B — WHAT RULES ALREADY HANDLED (DO NOT RE-SCORE THESE)
- Need Fit: motivation_clarity tier × persona_alignment_coeff.
- Usage: frequency tier × lifecycle_coeff.
- Budget: budget_feel × price ratio × cost-per-use benchmark.
  budget_feel tiers: comfortable(16) > tight(12) > steep(7) > no_way(3)
  "steep" = can pay but questions value. "no_way" = genuine affordability constraint.
- Overlap: user self-report (overlap_level slot) + portfolio pattern penalty.
- Risk: user-selected top_risk option.
- Cross-val: high need + low usage → nf penalty; low need + high usage → us bonus; upgrading + high overlap → us penalty.
- Uncertainty penalties for not_sure slots.
- Cancel reason slot (when history=cancelled):
  · low_usage      = habitual failure — didn't build the habit. Strongest recurrence predictor.
  · no_longer_needed = situational end — project finished, life phase ended, content exhausted.
    LOWER recurrence risk if user now has a NEW concrete reason. Do NOT treat as low_usage.
  · price          = cost was the barrier. Recalibration possible if budget_feel is now comfortable.
  · found_alternative = switched away deliberately. Reconsidering = lower risk.
  · cancel_text    = raw other-reason text; use for nuanced signal, don't force into low_usage.
If your signal is a restatement of any of the above — discard it.

## MODULE C — SIGNAL TYPES TO LOOK FOR

1. COMMITMENT AUTHENTICITY
- Strong: decisive language, volunteered specific details, prior research evident
- Weak: heavy hedging, passive framing, rationalizing after the fact
- Signal example: "Commitment Drift" (-4)

2. EXPECTATION-REALITY GAP
- Apple Music for podcast consolidation → Apple Podcasts is FREE
- YouTube Premium for ad-free → free browser extensions achieve the same
- Signal example: "Expectation Mismatch" (-5)

3. UPGRADE DELTA QUALITY (upgrading users only)
- Strong upgrade delta (DO NOT flag these as weak):
  · "I want to watch [specific content]" → content access IS the upgrade delta.
  · "I want ad-free" / "offline" / "higher quality" / "family share" → clear feature upgrade.
- Weak upgrade delta (ONLY flag when ALL three are true):
  · User cited no specific content, feature, or experience benefit
  · AND user's reason could be satisfied by the free/cheaper tier
  · AND you are confident about tier availability (not just inferring)
- CRITICAL: Tier availability claims → confidence="low" unless 100% certain.
- Signal example: "Weak Upgrade Incentive" (-3) — motivation entirely vague, no specific delta

4. SWITCHING FRICTION & LOCK-IN
- Positive: data/history/playlist investment → raises follow-through (+2 to +4)
- Negative: vendor lock-in user seems unaware of → narrative only

5. PORTFOLIO COHERENCE
- Red flag: 3+ same-category subscriptions AND budget pressure mentioned
- Green flag: user explicitly replacing an existing subscription
- Signal example: "Portfolio Saturation" (-4)

6. BEHAVIORAL PATTERN SIGNALS
- Cancelled same type for low usage + same category → strong predictor
- Cancelled for price + now comfortable → genuine recalibration (+)
- Signal example: "Recurrence Pattern Risk" (-5)

7. LIFE-STAGE & TIMING FIT
- New job, moving, busy season, exams → instability signals
- Signal example: "Timing Risk" (-3)

8. ENTHUSIASM QUALITY (positive signals)
- Prior research, specific features unprompted, clear mental model of routine
- Signal example: "Informed Enthusiasm" (+5)

## MODULE D — PERSONA LENS
- "spontaneous" → weight Commitment Authenticity and Behavioral Pattern signals most
- "essentialist" → weight Portfolio Coherence and Expectation-Reality Gap most
- "explorer" → look hard for follow-through signals before giving positive credit
- "power_user" → high usage claims credible; focus on upgrade delta and lock-in quality

## MODULE E — IMPACT CALIBRATION
| Confidence | Typical impact range | Reserve for |
|------------|---------------------|-------------|
| high       | -3 to -5 / +3 to +5 | Clear structural issue with direct evidence |
| medium     | -2 to -3 / +2 to +3 | Reasonable inference from conversation |
| low        | -1 to -2 / +1 to +2 | Speculative, uncertain service facts |

- Per-signal hard cap: [-6, +6]
- total_delta hard cap: [-12, +10]
- -5/-6: reserve ONLY for high-confidence, proven structural mismatch
- +5 to +8: reserve for exceptional, specifically evidenced enthusiasm
- total_delta = 0 or ±2 is often the correct answer for a well-matched persona

## MODULE F — OUTPUT (JSON ONLY)
{
  "signals": [
    {"name": "2-4 word signal name", "finding": "1-2 sentences grounded in THIS conversation",
     "impact": number, "confidence": "high|medium|low"}
  ],
  "total_delta": number (sum of all impacts, capped to [-12, +10]),
  "narrative_insight": "2-3 sentences synthesizing the key story",
  "overlap_inference": "specific functional overlap note if detected — omit if none"
}
Signal count: minimum 2, maximum 4.

## MODULE G — PROHIBITED
1. Do NOT name a signal mapping directly to NF/US/BF/OV/Risk rule dimensions
2. Do NOT re-score motivation_clarity, frequency tier, budget_feel, or overlap_level
3. Do NOT hallucinate service features — confidence="low" if uncertain
4. Each signal's "finding" MUST cite specific user language or choices — no generic statements
5. Do NOT default to negative — positive signals are equally valid
6. total_delta = 0 is completely valid
7. If < 2 genuine new signals: output 1 strong one, explain in narrative_insight
8. Do NOT claim content/features are "available on cheaper tier" unless 100% certain. Hedge: "may be available on..."
9. "User wants [specific content]" when upgrading = strong upgrade incentive, NOT weak.

## MODULE H — PRE-OUTPUT JUDGMENT CHECKLIST
H1  SPECIFICITY IS STRENGTH: One concrete reason > five vague ones. Specificity = clarity = follow-through.
H2  CONTENT ACCESS = UPGRADE MOTIVATION: Wanting specific content IS the delta. "Weak Upgrade Incentive" requires no content, no feature, AND cheaper tier verified.
H3  UPGRADING = POSITIVE BASELINE: Already uses service → concrete evidence required for any negative signal.
H4  TIER FACTS REQUIRE CERTAINTY: Training data is not real-time. If not 100% sure → confidence="low" or omit.
H5  ESSENTIALISTS SELF-SCREEN: Reaching this conversation IS their internal filter. Don't penalize unless 3+ subs + budget pressure.
H6  SPONTANEOUS + HIGH USAGE = POSITIVE: Enthusiasm is normal for this type. Picking daily = face value.
H7  HEDGING ≠ COMMITMENT DRIFT: 1-2 hedging words = conversational. Drift requires systematic retreat from Stage 2 to Stage 5.
H8  SINGLE-SERIES = VALID: Only a risk if (a) series ending soon AND (b) user says no other interest. Don't invent.
H9  CANCELLATION RELEVANCE MATCH: Requires BOTH same service type AND same failure mode.
     no_longer_needed ≠ low_usage. Situational end ≠ habitual failure.
H10 PRICE JUSTIFICATION = POSITIVE: Unprompted cost-benefit = deliberate thinking. Not a red flag unless budget_feel=steep/no_way + high ratio.
H11 FREE ALTERNATIVE NEEDS AWARENESS GAP: Only penalize if user genuinely unaware. Tech-savvy/power_user → skip.
H12 ENTHUSIASM WITHOUT RESEARCH IS VALID: Specific feature/use case mentioned unprompted = +2 to +3 signal.
H13 PORTFOLIO THRESHOLD IS 3+: 2 same-category = normal. 3+ AND budget pressure = risk.
H14 BALANCE CHECK: All-negative set → mandatory review. Almost always a genuine positive to credit.
```

---

*文档更新时间：2026-03-11*
*对应文件：`/Users/yue/Desktop/audit-workbench/src/App.jsx`*
*Convo Prompt 版本：v5.7 | Adjuster Prompt 版本：v6.3*
