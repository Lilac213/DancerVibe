# DancerVibe 部署指南

## ✅ 已完成的工作

### 1. 代码迁移
- ✅ 创建了 NewAPI 客户端适配器 ([`services/newApiClient.ts`](services/newApiClient.ts))
- ✅ 重构了 Gemini 服务层 ([`services/geminiService.ts`](services/geminiService.ts))
- ✅ 更新了 Vite 配置 ([`vite.config.ts`](vite.config.ts))
- ✅ 配置了环境变量 ([`.env.local`](.env.local))
- ✅ 创建了 Vercel 配置文件 ([`vercel.json`](vercel.json))

### 2. Git 仓库
- ✅ 初始化了 Git 仓库
- ✅ 提交了所有代码变更

### 3. API 配置
- ✅ NewAPI 中转站 Base URL: `https://docs.newapi.pro`
- ✅ API Key: `sk-mQnV4bKXYX2sbQnz5NMuZSa6spIDMJhV7xRSfHNtLHKfY6sf`

---

## 🚀 部署到 Vercel

### 前置要求
1. 安装 Node.js (v18 或更高版本)
2. 注册 Vercel 账号 (https://vercel.com)

### 方式 A: 使用 Vercel CLI（推荐）

#### 步骤 1: 安装 Node.js
如果你的系统还没有安装 Node.js，请访问：
- macOS: https://nodejs.org/zh-cn/download/
- 或使用 Homebrew: `brew install node`

#### 步骤 2: 安装 Vercel CLI
```bash
npm install -g vercel
```

#### 步骤 3: 登录 Vercel
```bash
vercel login
```

#### 步骤 4: 部署项目
```bash
cd /Users/lilacfei/Desktop/DancerVibe
vercel
```

按照提示操作：
- Set up and deploy? **Y**
- Which scope? 选择你的账号
- Link to existing project? **N**
- What's your project's name? **dancer-vibe** (或其他名称)
- In which directory is your code located? **./**
- Want to override the settings? **N**

#### 步骤 5: 配置环境变量
```bash
vercel env add NEWAPI_BASE_URL
# 输入: https://docs.newapi.pro

vercel env add NEWAPI_API_KEY
# 输入: sk-mQnV4bKXYX2sbQnz5NMuZSa6spIDMJhV7xRSfHNtLHKfY6sf
```

选择环境：
- Production: **Y**
- Preview: **Y**
- Development: **Y**

#### 步骤 6: 生产部署
```bash
vercel --prod
```

---

### 方式 B: 使用 Vercel 网页控制台

#### 步骤 1: 推送到 GitHub（可选但推荐）
```bash
# 在 GitHub 上创建新仓库，然后执行：
git remote add origin https://github.com/你的用户名/dancer-vibe.git
git branch -M main
git push -u origin main
```

#### 步骤 2: 导入到 Vercel
1. 访问 https://vercel.com/new
2. 点击 "Import Git Repository"
3. 选择你的 GitHub 仓库
4. 或者点击 "Import Third-Party Git Repository" 直接导入

#### 步骤 3: 配置项目
- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

#### 步骤 4: 添加环境变量
在 "Environment Variables" 部分添加：

| Name | Value |
|------|-------|
| `NEWAPI_BASE_URL` | `https://docs.newapi.pro` |
| `NEWAPI_API_KEY` | `sk-mQnV4bKXYX2sbQnz5NMuZSa6spIDMJhV7xRSfHNtLHKfY6sf` |

确保选择所有环境：Production, Preview, Development

#### 步骤 5: 部署
点击 "Deploy" 按钮，等待构建完成。

---

## 🧪 本地测试（可选）

如果你想在部署前本地测试：

```bash
# 安装依赖
npm install

# 本地开发
npm run dev

# 构建测试
npm run build

# 预览构建结果
npm run preview
```

---

## ✅ 验证部署

部署完成后，访问 Vercel 提供的 URL（例如：`https://dancer-vibe.vercel.app`），测试以下功能：

### 核心功能检查清单
- [ ] 页面正常加载
- [ ] 用户登录/注册（Supabase）
- [ ] AI 对话助手
- [ ] 语音转文字功能
- [ ] 课表管理（添加/编辑/删除课程）
- [ ] 标签生成
- [ ] 周报/月报生成
- [ ] 视频上传功能

---

## 🔧 故障排查

### 问题 1: 构建失败
**可能原因**: 依赖安装失败
**解决方案**: 
```bash
rm -rf node_modules package-lock.json
npm install
```

### 问题 2: API 调用失败
**可能原因**: 环境变量未正确配置
**解决方案**: 
1. 检查 Vercel 控制台的环境变量设置
2. 确保 `NEWAPI_BASE_URL` 和 `NEWAPI_API_KEY` 都已设置
3. 重新部署项目

### 问题 3: Supabase 连接失败
**可能原因**: Supabase 配置问题
**解决方案**: 
检查 [`services/scheduleService.ts`](services/scheduleService.ts) 中的 Supabase URL 和 Key 是否正确。

### 问题 4: NewAPI 中转站返回错误
**可能原因**: API Key 无效或配额用尽
**解决方案**: 
1. 检查 API Key 是否正确
2. 访问 NewAPI 控制台检查配额
3. 查看浏览器控制台的详细错误信息

---

## 🧩 Phoenix 课表爬虫部署

### 运行方式
1. 进入目录：`/Users/lilacfei/Desktop/DancerVibe/python_services/crawler`
2. 安装依赖：
```bash
pip install -r requirements.txt
```
3. 配置环境变量（见 `.env.local.example`）
4. 手动执行一次：
```bash
python phoenix_schedule_crawler.py
```
5. 启用每周一 02:00 UTC 自动爬取：
```bash
ENABLE_SCHEDULER=1 python phoenix_schedule_crawler.py
```

### 邮件通知
需要设置 SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS 以及 EMAIL_FROM/EMAIL_TO。

### 产出路径
默认输出目录：`./data/phoenix/分店A|分店B|分店C|分店D`

---

## 📝 代码变更说明

### 新增文件
- **`services/newApiClient.ts`**: NewAPI 中转站客户端适配器
- **`vercel.json`**: Vercel 部署配置
- **`DEPLOYMENT_GUIDE.md`**: 本部署指南

### 修改文件
- **`services/geminiService.ts`**: 
  - 移除了 `@google/generative-ai` SDK 依赖
  - 使用 `newApiClient` 替代原 SDK
  - 保持了对外接口不变
  
- **`vite.config.ts`**: 
  - 更新环境变量注入配置
  - 从 `API_KEY` 改为 `NEWAPI_BASE_URL` 和 `NEWAPI_API_KEY`
  
- **`.env.local`**: 
  - 更新为 NewAPI 中转站配置

### 未修改文件
- 所有 React 组件保持不变
- Supabase 配置保持不变
- 其他服务层代码保持不变

---

## 🎯 下一步

1. **安装 Node.js**（如果还没有）
2. **选择部署方式**（CLI 或网页控制台）
3. **执行部署**
4. **验证功能**
5. **享受你的应用！** 🎉

---

## 📞 技术支持

如果遇到问题，可以：
1. 查看 Vercel 部署日志
2. 检查浏览器控制台错误
3. 查看 NewAPI 文档: https://docs.newapi.pro

---

**祝部署顺利！** 🚀
