# lessons.md - 历史错误与解决方案

```
每次犯错或踩坑后追加到此文件
格式：日期 + 问题 + 原因 + 解决方案 + 新规则
session开始时必读，避免重复错误
```

---

## 2026-02-13 — TypeScript 类型导入路径

**问题：** 从单个文件导入 Subscription 类型导致 build 错误
**原因：** 类型定义散落在各文件，路径不一致
**解决方案：** 所有类型集中在 `app/src/types/index.ts`，统一从 `@/types` 导入
**规则：** 永远不从具体实现文件导入类型，只从 `@/types` 导入

---

## 2026-02-17 — AuditScreen 状态机

**问题：** Audit流程状态管理混乱，多个布尔值导致状态组合爆炸
**原因：** 用多个 `isLoading`、`isChat`、`isDone` 布尔值管理视图
**解决方案：** 改为 6阶段 FSM（`AuditPhase` enum）
**规则：** 多步骤流程用 enum 状态机，不用多个布尔值

---

## 2026-02-18 — Watchlist 设计误判

**问题：** 最初把 Watchlist 实现为 `status: 'paused', isReminder: true` 的变体
**原因：** 没有把 Watchlist 理解为独立的 pre-subscription 阶段
**解决方案：** 添加 `'watchlist'` 到 status union，独立处理 UI 和逻辑
**规则：** Watchlist 是未订阅阶段（无计费），不是 Paused 的变体

---

## 2026-03-03 — Audit 测试环境：先读 spec 再写代码

**问题：** 第一版 audit_scorer.py 基于 TypeScript 源码移植（v3逻辑），与 AUDIT_V4_SPEC.pdf 设计完全不同
**原因：** 没有先读 spec，直接从现有代码推断逻辑
**解决方案：** 用 `pdftotext`（需 `brew install poppler`）提取 PDF，完整阅读后全部重写
**规则：** 有 spec 文档时，永远先读 spec 再写代码，不从实现反推设计

---

## 2026-03-03 — Notebook 版本标注

**问题：** audit_notebook.ipynb 创建时基于 v3，之后 scorer/prompt 升级到 v4 但 notebook 未同步更新，导致常量名（`NEED_FIT_STRONG`）、slot字段名、max值（/25 vs /20）全部错误
**原因：** Notebook 和 Python 模块是分开创建的，升级模块时遗漏了 notebook
**解决方案：** notebook 所有引用模块常量的地方都用模块变量名（如 `scorer.NEED_FIT_SCENARIO_SPECIFIC`），不写魔法数字
**规则：** notebook 中引用 scorer 常量时只用 `scorer.XXX`，不硬编码数值，模块升级后 notebook 自动跟上

---

<!-- 在此追加新的 lesson，格式如上 -->
