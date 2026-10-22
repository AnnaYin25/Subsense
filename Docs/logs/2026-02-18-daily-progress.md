# 🪄 开发日报（2026-02-18）

## 🗞️ 今日摘要

将 Watchlist 升级为独立的第一类订阅状态（pre-subscription status），与账单/日历/提醒系统完全隔离；新增自定义 Category 持久化功能；优化 Manager 筛选栏布局。

Upgraded Watchlist into a first-class pre-subscription status, fully isolated from billing, calendar, and reminder systems. Added persistent custom categories and polished the Manager filter bar.

---

## 📈 详细变更

### 📥 新增功能 / New Features

- **[types/index.ts] Watchlist 状态类型**
  `status` union 新增 `'watchlist'`：`'active' | 'paused' | 'cancelled' | 'watchlist'`

- **[AuditScreen] Watchlist 创建路径**
  Audit 推荐 watchlist 时以 `status: 'watchlist', isReminder: false, planName: 'Watchlist'` 创建条目，不再创建 paused 假订阅。

- **[ManagerScreen] Watchlist 筛选 Tab**
  新增第 4 个筛选 Tab "Watchlist"。`All` 过滤器排除 watchlist 条目（仅显示 active/paused）。Watchlist 卡片样式：75% 不透明度 + 3px 蓝色左边框。

- **[ManagerScreen] 筛选栏横向滚动**
  Filter 区域改用 `ScrollView horizontal` 包裹，按钮尺寸调整：高度 36px、横向 padding `spacing.md`、字号 10px，避免多 Tab 溢出屏幕。

- **[SubscriptionDetailScreen] Watchlist 展示模式**
  - 状态徽标升级为 3-way：ACTIVE（绿）/ PAUSED（灰）/ WATCHLIST（蓝）
  - Watchlist 条目隐藏：续费日期行、Days left 徽标、整个通知设置区
  - 操作按钮对 watchlist 显示 "Subscribe Now"，替换原先的 Pause/Resume
  - "Subscribe Now" → 状态改为 active → 自动跳转 Edit（两步激活：用户在 Edit 表单中确认真实续费日期）

- **[AddSubscriptionScreen] Watchlist 编辑限制**
  编辑 watchlist 条目时隐藏通知设置区（无有效账单周期，提醒无意义）。

- **[categoryManager.ts] 自定义 Category 持久化（新文件）**
  `getAllCategories()` / `addCustomCategory()` / `getCustomCategories()` — 使用 AsyncStorage，key `'custom_categories'`，JSON 数组持久化。

- **[AddSubscriptionScreen] 自定义 Category 输入**
  Category 选择区域新增自定义输入，交互模式与 Plan Name 自定义方式一致（芯片触发 TextInput）；保存时自动将新 category 持久化至 AsyncStorage。

- **[ManagerScreen] 动态加载 Category**
  移除硬编码 `const categories = [...]`，改为 `useEffect` + `getAllCategories()` 加载，支持展示用户自定义分类。

- **[database.ts] 函数签名更新**
  `getSubscriptionsByStatus` 的 `status` 参数类型新增 `'watchlist'`。

---

### 📤 问题修复 / Bug Fixes

- **[ManagerScreen] 自定义 Category 不显示**
  ManagerScreen 内有一行 `const categories = [...]` 局部变量遮蔽了组件 state，导致 `getAllCategories()` 的结果被丢弃。修复：删除该局部变量，直接使用 `useState` 中的 `categories` state。

---

## 🗄️ 数据库迁移（✅ 已执行 / Complete）

以下 SQL 已在 Supabase SQL 编辑器中执行（2026-02-18）：

```sql
-- 1. 扩展 status 约束以支持 'watchlist'
ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_status_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('active', 'paused', 'cancelled', 'watchlist'));

-- 2. 迁移旧有由 Audit 创建的 watchlist 行（plan_name='Watchlist' + status='paused'）
UPDATE subscriptions
SET status = 'watchlist', is_reminder = false
WHERE plan_name = 'Watchlist' AND status = 'paused' AND is_reminder = true;

-- 3. 移除 category 约束以支持自定义分类
ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_category_check;
```

---

## 📁 涉及文件

| 文件 | 类型 |
|---|---|
| `app/src/types/index.ts` | 修改 |
| `app/src/screens/AuditScreen.tsx` | 修改 |
| `app/src/screens/ManagerScreen.tsx` | 修改 |
| `app/src/screens/SubscriptionDetailScreen.tsx` | 修改 |
| `app/src/screens/AddSubscriptionScreen.tsx` | 修改 |
| `app/src/utils/database.ts` | 修改 |
| `app/src/utils/categoryManager.ts` | **新增** |
