# CLAUDE.md - AI开发助手规则

```
# INPUT: 依赖什么
- Docs/progress.txt     (当前进度，session必读)
- Docs/lessons.md       (历史错误，session必读)
- 按需加载的文档         (见下方清单，不要全部读取)

# OUTPUT: 提供什么
- 高质量代码
- 更新的 progress.txt
- 必要时更新 lessons.md

# POS: 在系统中的地位
本文件是AI开发助手的操作手册，每次session必读
其他文档按需加载，不必全部读取
```

---

## 核心规则（最高优先级）

### 1. 称呼规则
**每次回复前必须使用"CEO"作为称呼。**

### 2. 决策确认
**遇到不确定的代码设计时，必须先询问CEO，不得直接行动。**

需要询问的情况：
- 设计文档中未明确的交互细节
- 多种技术方案可选时
- 需要添加新依赖时
- 发现文档中的潜在矛盾时

### 3. 不写兼容性代码
除非CEO主动要求，只写当前目标平台代码（iOS）。

---

## 项目概述

**项目名称：** SubSense - AI订阅管理器
**核心功能：** 订阅追踪 → AI审计 → 每周Check-in → 月度报告
**技术栈：** React Native 0.81.5 + Expo 54 + TypeScript + Supabase + Claude API
**平台：** iOS (Expo Go / EAS)
**样式系统：** StyleSheet — 使用 `app/src/styles/`（tokens.ts, common.ts, helpers.ts）

---

## 📚 文档清单（按需加载）

**不需要每次都读！** 只在需要时加载对应文档。位置：`Docs/`

### 业务逻辑类
- **PRD.md** — 产品需求，功能范围和验收标准
  - 何时读取：不确定某功能是否在范围内；理解产品目标

- **APP_FLOW.md** — 所有页面和交互逻辑
  - 何时读取：开发任何页面或交互时；不确定某状态的UI应如何展示

### 技术规范类
- **TECH_STACK.md** — 所有依赖锁定版本
  - 何时读取：需要安装新依赖时；不确定某库的版本

- **FRONTEND_GUIDELINES.md** — 设计系统（颜色/字体/间距/组件）
  - 何时读取：开发任何UI组件时；不确定颜色、间距、动画参数

- **BACKEND_STRUCTURE.md** — 数据库schema、RLS、API规范
  - 何时读取：处理Supabase查询时；修改数据结构时

### 执行计划类
- **IMPLEMENTATION_PLAN.md** — 分步构建顺序
  - 何时读取：不确定下一步做什么时；开始新Phase前

---

## 🚀 每次Session工作流

### Step 1：必读文件（2个）
```
1. Docs/progress.txt  — 了解当前进度和下一步
2. Docs/lessons.md    — 避免重复历史错误
```

### Step 2：确定当前任务
根据 progress.txt 确认：当前Phase？下一个任务是什么？

### Step 3：按需加载文档
只加载与当前任务相关的文档，不要全部读取。

示例：
```
当前任务：修改 CheckInScreen 的AI问题逻辑
需要加载：APP_FLOW.md（交互逻辑）、BACKEND_STRUCTURE.md（check_ins表结构）
不需要加载：PRD.md、TECH_STACK.md、FRONTEND_GUIDELINES.md
```

### Step 4：开始工作

### Step 5：完成后更新
- 更新 `Docs/progress.txt`
- 若遇到新问题或犯了错误，追加到 `Docs/lessons.md`

---

## 核心开发规则

### TypeScript
- 严格模式：始终启用
- 禁止 `any`，类型未知用 `unknown`
- 所有 interface 从 `app/src/types/index.ts` 导出和导入

### React Native 组件
- 只用函数组件 + Hooks，禁止 Class 组件
- Props 必须用 interface 定义类型

### 样式系统
```typescript
// ✅ 正确：使用 style tokens
import { colors, spacing, fontSize, borderRadius, shadows } from '@/styles';

const styles = StyleSheet.create({
  card: { padding: spacing.lg, borderRadius: borderRadius.xl }
});

// ❌ 错误：内联 style 或硬编码数值
<View style={{ padding: 16, backgroundColor: '#3B82F6' }}>
```

### Supabase 查询
```typescript
// ✅ 正确
try {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id);
  if (error) throw error;
  return data as Subscription[];
} catch (err) {
  console.error('Failed:', err);
  return [];
}
```

### Claude API 调用
- 所有 API 调用通过 `app/src/utils/` 工具文件封装
- 维护对话历史在组件 state
- 每次调用必须有错误 fallback（不能让用户看到崩溃）

---

## 关键限制（不能违反）

- **不 commit `.env`**
- **不引入 TECH_STACK.md 以外的依赖**（先询问CEO）
- **不修改产品核心逻辑**（先询问CEO）
- **新文件只创建在已有目录结构内**
- **所有 async 操作必须有 try-catch**

---

## 项目文件结构（实际）

```
sub/
├── app/
│   ├── src/
│   │   ├── screens/         # 所有页面
│   │   ├── contexts/        # AuthContext, SubscriptionContext
│   │   ├── navigation/      # RootNavigator, MainTabNavigator
│   │   ├── types/           # index.ts（所有类型集中在此）
│   │   ├── utils/           # database.ts, claude.ts, checkinLLM.ts 等
│   │   ├── styles/          # tokens.ts, common.ts, helpers.ts
│   │   └── hooks/
│   ├── .env                 # NEVER COMMIT
│   └── package.json
├── Docs/
│   ├── CLAUDE.md            # 本文件
│   ├── progress.txt
│   ├── lessons.md
│   └── [其他规范文档]
└── ui-reference/            # 原始UI参考（只读，勿修改）
```

---

## 优先级原则

遇到冲突时，按优先级决策：

1. **核心规则（称呼、决策确认）** > 其他规则
2. **用户体验** > 代码优雅
3. **iOS体验** > 通用兼容
4. **文档要求** > AI的假设

---

**文档版本：** V2.0
**最后更新：** 2026-03-02
**主要变更：**
- V2.0：重构为按需加载文档、加入Session工作流、CEO称呼、修正技术栈（RN 0.81.5/Expo 54/StyleSheet）、精简至核心规则、剥离lessons到独立文件
