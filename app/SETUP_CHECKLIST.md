# Supabase 设置清单
## 从零开始的完整指南

---

## ✅ 第一步：创建 Supabase 项目

### 1.1 注册 Supabase 账号
- [ ] 访问：https://supabase.com
- [ ] 点击 "Start your project" 或 "Sign Up"
- [ ] 使用 GitHub 账号登录（推荐）或邮箱注册
- [ ] 完成注册流程

### 1.2 创建新项目
- [ ] 登录后，点击 "New Project"
- [ ] 选择组织（如果是首次使用，系统会提示创建组织）
  - Organization name: 随便填（如 "Personal" 或你的名字）
- [ ] 填写项目信息：
  - **Name:** `subscription-manager`
  - **Database Password:** 创建一个强密码（保存好！）
    - 建议：至少16位，包含大小写字母、数字、符号
    - 例如：`SubApp2026!Secure#Pass`
  - **Region:** 选择离你最近的（中国用户选 Asia Southeast (Singapore)）
  - **Pricing Plan:** Free（免费版足够用）
- [ ] 点击 "Create new project"
- [ ] ⏳ 等待 2-3 分钟（项目创建中...）

---

## ✅ 第二步：运行数据库 Schema

### 2.1 打开 SQL Editor
- [ ] 项目创建完成后，在左侧菜单找到 "SQL Editor"
- [ ] 点击 "+ New query"

### 2.2 复制粘贴 Schema
- [ ] 打开文件：`supabase-schema.sql`（在 app 目录下）
- [ ] 复制**整个文件的所有内容**（Cmd+A 全选，Cmd+C 复制）
- [ ] 粘贴到 SQL Editor 中（Cmd+V）
- [ ] 点击右下角 "Run" 按钮（或按 Cmd+Enter）
- [ ] 等待执行完成

### 2.3 验证结果
- [ ] 应该看到：✅ "Success. No rows returned"
- [ ] 点击左侧 "Table Editor"
- [ ] 应该看到 8 个表：
  - users
  - user_personas
  - subscriptions
  - subscription_price_history
  - assessments
  - weekly_checkins
  - checkin_responses
  - monthly_reports

---

## ✅ 第三步：获取 Supabase API Keys

### 3.1 找到 API 设置
- [ ] 点击左侧菜单最下方的 "Project Settings"（齿轮图标）
- [ ] 在设置菜单中点击 "API"

### 3.2 复制密钥
你需要复制两个值：

**A. Project URL**
- [ ] 找到 "Project URL" 部分
- [ ] 应该类似：`https://abcdefghijk.supabase.co`
- [ ] 点击右侧复制图标，保存到记事本

**B. Anon Public Key**
- [ ] 找到 "Project API keys" 部分
- [ ] 找到 "anon" 和 "public" 标签的那个 key
- [ ] 这是一个很长的字符串（通常以 `eyJ` 开头）
- [ ] 点击右侧复制图标，保存到记事本

⚠️ **注意：** 不要复制 "service_role" key（那个是后端专用的）

---

## ✅ 第四步：创建 Anthropic API Key

### 4.1 访问 Anthropic Console
- [ ] 访问：https://console.anthropic.com/
- [ ] 使用你的账号登录

### 4.2 创建新 API Key
- [ ] 在左侧菜单找到 "API Keys"
- [ ] 点击 "+ Create Key" 或 "Create new key"
- [ ] 填写信息：
  - **Name:** `subscription-manager-app`（或任何你喜欢的名字）
  - **Description:** (可选) "For iOS subscription manager app"
- [ ] 点击 "Create Key"
- [ ] ⚠️ **立即复制并保存这个 key**（以 `sk-ant-` 开头）
- [ ] 这个 key 只显示一次，关闭后无法再看到！

---

## ✅ 第五步：更新 .env 文件

### 5.1 打开 .env 文件
- [ ] 在 `app/` 目录下找到 `.env` 文件
- [ ] 用文本编辑器打开

### 5.2 填入你的密钥
替换成你刚才复制的真实值：

```env
EXPO_PUBLIC_SUPABASE_URL=https://你的项目ID.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ开头的那个很长的字符串
EXPO_PUBLIC_ANTHROPIC_API_KEY=sk-ant-开头的你的API-key
```

**示例（不要用这个！）：**
```env
EXPO_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...（很长）
EXPO_PUBLIC_ANTHROPIC_API_KEY=<your-anthropic-api-key>（很长）
```

### 5.3 保存文件
- [ ] 保存 `.env` 文件（Cmd+S）
- [ ] ⚠️ 确保这个文件在 `.gitignore` 中（已经配置好了）

---

## ✅ 第六步：测试连接

### 6.1 启动应用
在终端运行：
```bash
npm start
```

### 6.2 检查启动信息
- [ ] 应该看到 Metro bundler 启动
- [ ] 应该看到二维码（用于 Expo Go 扫描）
- [ ] **不应该**看到 "⚠️ Using placeholder Supabase credentials" 警告

### 6.3 在手机上测试（可选）
- [ ] 下载 "Expo Go" app（App Store）
- [ ] 扫描终端中的二维码
- [ ] 等待应用加载
- [ ] 应该能看到 Onboarding 页面

---

## ✅ 第七步：创建测试账号

### 7.1 在应用中注册
- [ ] 在 Onboarding 页面点击注册
- [ ] 输入邮箱和密码
- [ ] 点击 Sign Up

### 7.2 验证 Supabase 中的用户
- [ ] 回到 Supabase Dashboard
- [ ] 点击左侧 "Authentication" → "Users"
- [ ] 应该看到你刚才注册的用户出现在列表中
- [ ] 如果看到了，说明连接成功！🎉

---

## 🎉 完成！

如果所有步骤都打勾了，你现在有：

✅ Supabase 项目已创建
✅ 数据库 schema 已运行（8个表）
✅ Row Level Security 已启用
✅ API keys 已配置
✅ 应用可以连接数据库
✅ 认证功能正常工作

**下一步：** 开始使用真实数据替换 mock 数据！

---

## 🐛 常见问题

### 问题：SQL 运行失败
**解决方案：**
- 确保复制了**整个** `supabase-schema.sql` 文件
- 确保是在 SQL Editor 中运行，不是在其他地方
- 如果有错误，删除所有表，重新运行

### 问题：应用启动时报错 "Invalid Supabase URL"
**解决方案：**
- 检查 `.env` 文件是否保存
- 确保 URL 格式正确（`https://` 开头）
- 重启 Metro bundler（Ctrl+C，然后 `npm start`）

### 问题：注册时报错 "Unable to validate email address"
**解决方案：**
- 在 Supabase Dashboard
- 去 Authentication → Settings → Email Auth
- 确保 "Enable email confirmations" 是关闭的（开发阶段）

### 问题：Anthropic API 报错 "Invalid API Key"
**解决方案：**
- 确保 key 以 `sk-ant-` 开头
- 检查是否有额度（访问 console.anthropic.com）
- 重新创建一个新的 API key

---

## 📝 重要提醒

⚠️ **永远不要：**
- 把 `.env` 文件提交到 Git
- 在公开场合分享你的 API keys
- 把 API keys 写在代码里

✅ **应该做：**
- 定期更换 API keys（如果泄露）
- 在 Anthropic console 设置使用限制
- 备份你的 Supabase 数据库密码

---

**准备好了吗？开始第一步吧！** 🚀
