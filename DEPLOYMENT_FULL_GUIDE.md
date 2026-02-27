# DancerVibe 全栈部署指南 (Railway + Supabase + Vercel)

本指南将帮助你将 DancerVibe 的三个核心组件部署到云端：
1. **Python 爬虫服务** (FastAPI + PaddleOCR) -> **Railway**
2. **Admin 后端** (Node.js + Express) -> **Railway**
3. **Admin 前端** (React + Vite) -> **Vercel**
4. **数据库** (PostgreSQL) -> **Supabase**

---

## 🛠 准备工作

请确保你已拥有以下账号：
- [GitHub](https://github.com/) (代码托管)
- [Supabase](https://supabase.com/) (数据库)
- [Railway](https://railway.app/) (后端服务托管)
- [Vercel](https://vercel.com/) (前端托管)
- [企业微信管理后台](https://work.weixin.qq.com/) (获取 Bot 配置)

---

## 第一步：数据库设置 (Supabase)

1. **创建项目**：
   - 登录 Supabase，创建一个新项目（Organization 选择你的账号，Region 选择离你近的，如 Singapore 或 Tokyo）。
   - 设置数据库密码（**请务必记下来**）。

2. **获取连接信息**：
   - 进入 **Project Settings** -> **Database** -> **Connection string**。
   - 复制 **URI** (Mode: Transaction) -> 类似于 `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`。
   - **注意**：你需要将 `[password]` 替换为你刚才设置的真实密码。我们将此称为 `DATABASE_URL`。

3. **获取 API 密钥**：
   - 进入 **Project Settings** -> **API**。
   - 复制 **Project URL** -> `SUPABASE_URL`。
   - 复制 **service_role secret** (不是 anon public) -> `SUPABASE_SERVICE_KEY`。**注意：Service Role Key 拥有最高权限，请勿泄露给前端。**

4. **初始化数据库表**：
   - 进入 **SQL Editor**。
   - 点击 **New Query**。
   - 复制项目根目录下 `docs/db-schema-full.sql` 的内容并粘贴。
   - 点击 **Run** 执行，确保所有表创建成功。

---

## 第二步：部署 Python 爬虫服务 (Railway)

1. **新建项目**：
   - 登录 Railway，点击 **New Project** -> **Deploy from GitHub repo**。
   - 选择你的 DancerVibe 仓库。

2. **配置服务**：
   - 点击刚刚创建的服务卡片，进入 **Settings**。
   - **Root Directory**: 输入 `python_services/crawler` (这是关键，告诉 Railway Dockerfile 在哪里)。
   - **Service Name**: 建议改为 `crawler-service`。

3. **配置环境变量 (Variables)**：
   - 点击 **Variables** 标签页，添加以下变量：
     - `DATABASE_URL`: 填入第一步获取的 Supabase Connection String (确保密码已替换)。
     - `ADMIN_TOKEN`: 设置一个自定义密钥（例如 `my-secret-token-123`），用于后端服务之间的鉴权。
     - `WECOM_CORP_ID`: 企业微信 CorpID。
     - `WECOM_SECRET`: 企业微信应用 Secret。
     - `WECOM_AGENT_ID`: 企业微信应用 AgentID。
     - `WECOM_TOKEN`: 企业微信回调 Token。
     - `WECOM_AES_KEY`: 企业微信回调 EncodingAESKey。
     - `PORT`: Railway 会自动注入，**不需要**手动设置，但代码已适配。

4. **生成域名**：
   - 点击 **Settings** -> **Networking** -> **Generate Domain**。
   - 记下生成的域名（例如 `crawler-production.up.railway.app`），这将是 `PYTHON_SERVICE_URL` 的基础（需要加上 `https://`）。

5. **部署**：
   - Railway 会自动检测 Dockerfile 并开始构建。
   - **注意**：由于包含 PaddleOCR 和 OpenCV，构建可能需要几分钟。如果遇到内存不足错误，请尝试升级 Railway 套餐或联系支持，但通常 Docker 构建能通过。

---

## 第三步：部署 Admin 后端 (Railway)

1. **添加新服务**：
   - 在同一个 Railway 项目中，点击 **New** -> **GitHub Repo**。
   - 再次选择 DancerVibe 仓库。

2. **配置服务**：
   - 进入新服务的 **Settings**。
   - **Root Directory**: 输入 `admin-backend`。
   - **Service Name**: 建议改为 `admin-backend`。
   - **Start Command**: `node server.js` (或者保持默认，Railway 会读取 package.json 的 start 脚本)。

3. **配置环境变量 (Variables)**：
   - `SUPABASE_URL`: 第一步获取的 Project URL。
   - `SUPABASE_SERVICE_KEY`: 第一步获取的 service_role key。
   - `PYTHON_SERVICE_URL`: 第二步生成的 Python 服务域名（例如 `https://crawler-production.up.railway.app`）。
   - `FRONTEND_URL`: 第四步生成的前端域名（例如 `https://dancer-vibe.vercel.app`），用于 CORS 跨域配置。如果不设置，默认为 `*`（允许所有来源）。
   - `ADMIN_TOKEN`: 与 Python 服务设置的保持一致（例如 `my-secret-token-123`）。
   - `CRAWL_POLL_INTERVAL_MS`: `600000` (可选，默认 10 分钟轮询一次)。

4. **生成域名**：
   - 点击 **Settings** -> **Networking** -> **Generate Domain**。
   - 记下生成的域名（例如 `backend-production.up.railway.app`），这将用于前端调用。

---

## 第四步：部署 Admin 前端 (Vercel)

1. **新建项目**：
   - 登录 Vercel，点击 **Add New...** -> **Project**。
   - 导入 DancerVibe 仓库。

2. **配置构建**：
   - **Framework Preset**: 选择 **Vite**。
   - **Root Directory**: 点击 Edit，选择 `admin-frontend`。

3. **配置环境变量**：
   - 展开 **Environment Variables**。
   - 添加 `VITE_API_BASE_URL`，值为第三步生成的 Node 后端域名（例如 `https://backend-production.up.railway.app`）。

4. **部署**：
   - 点击 **Deploy**。
   - 等待构建完成，你将获得前端访问地址。

---

## ✅ 验证部署

1. **访问前端**：打开 Vercel 生成的网址。
2. **测试登录/数据**：如果页面能加载且不报错，说明前端已连接到 Node 后端。
3. **测试 OCR/爬虫**：
   - 在 Admin 后台尝试手动上传一张课表图片。
   - 如果能成功识别并显示结果，说明：
     - 前端 -> Node 后端 (OK)
     - Node 后端 -> Python 爬虫 (OK)
     - Python 爬虫 -> Supabase (OK)
     - Node 后端 -> Supabase (OK)

## ⚠️ 常见问题

- **Railway 构建失败**：检查 `python_services/crawler/Dockerfile`。PaddleOCR 依赖较多系统库，如果 Railway 报错内存不足（OOM），可能需要付费升级或优化 Dockerfile（例如使用更轻量的基础镜像，但目前已经是 `slim`）。
- **数据库连接错误**：检查 `DATABASE_URL` 是否正确，是否包含了密码，且没有特殊字符导致解析失败（特殊字符需 URL 编码）。
- **跨域 (CORS) 问题**：如果前端报错 CORS，请检查 `admin-backend/server.js` 中的 CORS 设置，确保允许 Vercel 的域名访问。
