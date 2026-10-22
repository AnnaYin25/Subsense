# 🪄 开发日报（2026-02-17）

## 🗞️ 今日摘要

完成 Audit Screen 全面重构：从浅层3问对话升级为6阶段结构化 FSM 对话，实现客户端确定性评分、智能输入切换、Aha 频次控制及"补充信息"门控，并修复10+个关键 Bug。

Completed full overhaul of Audit Screen: upgraded from a shallow 3-question chat to a 6-stage FSM-driven conversation with deterministic client-side scoring, smart input switching, Aha cooldown, and a pre-score "anything to add?" gate — plus 10+ critical bug fixes.

---

## 📈 详细变更

### 📥 新增功能 / New Features

- **[AuditScreen] 6阶段 FSM 对话引擎**
  客户端持有 `currentStage` 作为单一真相来源，Claude 只负责槽位提取（`slots_delta`），不再控制阶段推进。阶段顺序：service_price → motivation → expected_usage → friction_risk → budget_fit → overlap_decision。

- **[auditScorer.ts] 确定性评分系统（新文件）**
  5维度评分（need_fit/usage/budget_fit/overlap/risk），总分0–100，每个 `not_sure` 槽位 -2 分，uncertainty_level 为 high 时自动降级推荐结果至 start_trial / watchlist。

- **[alternativesGenerator.ts] 替代品生成器（新文件）**
  规则库（Entertainment/Productivity/Utilities/Health）优先，无匹配时 Claude haiku 兜底。

- **[messageSplitter.ts] 消息分割器（新文件）**
  段落/句子边界切分，最多3气泡，尾部疑问句单独一泡。

- **[AuditScreen] "是否补充信息"门控（pre-score gate）**
  6阶段完成后不直接跳转评分，bot 先问："Anything else you'd like me to factor in?" — 用户可 Skip（直接出分）或输入补充文本后再出分。补充内容写入 `slots.additional_notes`，在报告 Factors 展示。

- **[AuditScreen] 可执行 CTA（4种）**
  | 推荐类型 | CTA 行为 |
  |---|---|
  | subscribe_now | 导航至 AddSubscription（预填名称/金额/分类） |
  | start_trial | 创建 paused 提醒订阅 |
  | watchlist | 创建 watchlist 条目 |
  | alternative | 打开替代品 Modal |

- **[AddSubscriptionScreen] prefillData 路由参数支持**
  从 Audit 报告一键跳转至 AddSubscription 并自动填充 name/cost/category/nextRenewalDate。

- **[types/index.ts] 新增类型**
  `AuditStage` / `Maybe<T>` / `AuditSlots`（含 `additional_notes`）/ `AuditOption {id,label,value}` / `AuditRecommendationType` / 更新 `AuditFactor` & `AuditReport`。

---

### 📤 问题修复 / Bug Fixes

- **[AuditScreen] Tab bar 无法隐藏**
  `navigation.getParent().setOptions()` 错误地作用于 root stack；改为 `navigation.setOptions()` 直接作用于 tab navigator。

- **[AuditScreen] 阶段切换后输入区域消失**
  Claude 为旧阶段（text mode）回应时 `response.options = []`，FSM 升阶后 `options` 为空导致 footer 完全空白。修复：`getDefaultOptionsForStage(nextStage)` 兜底填充新阶段默认选项。

- **[AuditScreen] 升阶后显示错误阶段的问题**
  FSM 升阶时 Claude 的 `response.question` 属于旧阶段。修复：`nextStage !== stageAtTime` 时改用新阶段的 recovery question。

- **[AuditScreen] price_cycle_unclear 时强制显示文字输入**
  `lastFlags.price_cycle_unclear` 加入 `shouldShowText` 导致 cycle 恢复时展示 text input 而非选项 chips。修复：从 `shouldShowText` 中移除该 flag，cycle 恢复始终用 options。

- **[AuditScreen] 每轮重复显示问题**
  `displayBubbles()` 内部同时展示了 `response.question`，missing_slots recovery 也展示了自己的 question，导致每轮双问。修复：`displayBubbles` 只显示 context bubbles，question 在外层单独展示。

- **[AuditScreen] Claude 的 missing_slots 包含当轮已填充的槽位**
  Claude 有时在 `missing_slots` 中列出同轮 `slots_delta` 已填充的槽位，触发多余的 recovery。修复：客户端在合并 delta 后自行计算 `actuallyMissing`，不再信任 Claude 的 missing_slots。

- **[AuditScreen] Aha moment 每轮触发**
  `AHA_COOLDOWN_TURNS` 从 2 升为 3，新增 `ahaTriggered` 布尔值限制整场审计最多触发 1 次 Aha。

- **[AuditScreen] 评分界面跳转过快，最后一句话未读完**
  旧逻辑 300ms 后直接进入 finalizing。修复：改为展示"是否补充"门控，用户主动 Skip 或提交后才触发评分流程。

- **[AuditScreen] isTyping 卡死 / 无退出窗口**
  所有异步 API 调用无 try/catch，异常时 `isTyping` 永远为 true。修复：全部包裹 `try/finally { setIsTyping(false) }`。

- **[AuditScreen] Chat 过于冗长**
  `displayBubbles` 最多显示 2 条 context bubble。修复：改为 1 条。

- **[AuditScreen] Footer 下方留白过多**
  `chatFooter` 的 `paddingTop` 从 `spacing.sm` 降为 `spacing.xs`，`paddingBottom` 去掉多余的 `spacing.md`，仅保留 `insets.bottom`。
