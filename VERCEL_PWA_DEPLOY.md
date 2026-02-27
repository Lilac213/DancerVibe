# 快速部署到 Vercel（无需本地 Node.js）

## 🚀 方法：通过 GitHub 部署到 Vercel

### 步骤 1: 推送代码到 GitHub

如果还没有推送到 GitHub，请按照 [`QUICK_GITHUB_PUSH.md`](QUICK_GITHUB_PUSH.md) 操作。

### 步骤 2: 连接 Vercel

1. 访问 https://vercel.com
2. 使用 GitHub 账号登录
3. 点击 "Add New..." → "Project"
4. 选择你的 GitHub 仓库（例如：`DancerVibe`）

### 步骤 3: 配置项目

Vercel 会自动检测到这是一个 Vite 项目，配置如下：

- **Framework Preset**: Vite ✅（自动检测）
- **Build Command**: `npm run build` ✅（自动填充）
- **Output Directory**: `dist` ✅（自动填充）
- **Install Command**: `npm install` ✅（自动填充）

### 步骤 4: 添加环境变量

在 "Environment Variables" 部分添加：

```
NEWAPI_BASE_URL = https://docs.newapi.pro
NEWAPI_API_KEY = sk-mQnV4bKXYX2sbQnz5NMuZSa6spIDMJhV7xRSfHNtLHKfY6sf
```

**重要**：确保选择所有环境（Production, Preview, Development）

### 步骤 5: 部署

点击 "Deploy" 按钮，等待 2-3 分钟。

### 步骤 6: 测试 PWA

部署完成后：
1. 访问 Vercel 提供的 URL（例如：`https://dancer-vibe.vercel.app`）
2. 在 iOS Safari 中打开
3. 点击分享按钮 → "添加到主屏幕"
4. 现在可以像原生 App 一样使用了！

---

## ✅ PWA 功能验证

部署后测试以下功能：

- [ ] 页面正常加载
- [ ] 可以"添加到主屏幕"
- [ ] 离线时仍可访问（Service Worker）
- [ ] 全屏显示（无浏览器地址栏）
- [ ] 所有功能正常工作

---

## 📱 iOS 测试步骤

1. 在 iPhone 的 Safari 中打开你的 Vercel URL
2. 点击底部的"分享"按钮
3. 向下滚动，找到"添加到主屏幕"
4. 点击"添加"
5. 在主屏幕上找到 GrooveGrid 图标
6. 点击打开，体验类似原生 App 的效果

---

## 🎯 下一步（可选）

如果需要上架 App Store，需要：
1. 安装 Node.js 和 Xcode（仅限 macOS）
2. 运行 `npm run cap:init` 初始化 Capacitor
3. 运行 `npm run cap:add:ios` 添加 iOS 平台
4. 在 Xcode 中打包并提交到 App Store

详细步骤见 [`PWA_CAPACITOR_SETUP.md`](PWA_CAPACITOR_SETUP.md)

---

## 🔗 相关文档

- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - 完整部署指南
- [PWA_CAPACITOR_SETUP.md](PWA_CAPACITOR_SETUP.md) - PWA 和 iOS 配置
- [GITHUB_PUSH_GUIDE.md](GITHUB_PUSH_GUIDE.md) - GitHub 推送指南

---

**现在就可以通过 GitHub + Vercel 部署并测试 PWA 功能了！**
