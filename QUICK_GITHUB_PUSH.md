# 快速推送到 GitHub 指南

## 第一步：创建 Personal Access Token

1. **登录 GitHub**，访问：https://github.com/settings/tokens/new

2. **填写信息**：
   - **Note**: `DancerVibe Deploy`
   - **Expiration**: 选择 `90 days` 或 `No expiration`
   - **Select scopes**: 勾选 `repo` (完整的仓库访问权限)

3. **点击底部的绿色按钮** "Generate token"

4. **复制生成的 token**（格式类似：`ghp_xxxxxxxxxxxxxxxxxxxx`）
   ⚠️ **重要**：这个 token 只显示一次，请立即复制保存！

---

## 第二步：推送代码到 GitHub

打开终端，执行以下命令：

```bash
# 1. 进入项目目录
cd /Users/lilacfei/Desktop/DancerVibe

# 2. 配置 Git 凭证助手（macOS）
git config --global credential.helper osxkeychain

# 3. 推送代码
git push -u origin main --force
```

**当提示输入用户名和密码时**：
- **Username**: `Lilac213`
- **Password**: 粘贴你刚才复制的 Personal Access Token（不是你的 GitHub 密码！）

---

## 第三步：验证推送成功

访问：https://github.com/Lilac213/DancerVibe

你应该能看到：
- ✅ 新文件：`services/newApiClient.ts`
- ✅ 新文件：`vercel.json`
- ✅ 新文件：`DEPLOYMENT_GUIDE.md`
- ✅ 更新的文件：`services/geminiService.ts`
- ✅ 最新提交信息

---

## 第四步：部署到 Vercel

### 方式 A：从 GitHub 导入（推荐）

1. 访问：https://vercel.com/new
2. 点击 "Import Git Repository"
3. 选择 `Lilac213/DancerVibe`
4. 配置环境变量：
   ```
   NEWAPI_BASE_URL = https://docs.newapi.pro
   NEWAPI_API_KEY = sk-mQnV4bKXYX2sbQnz5NMuZSa6spIDMJhV7xRSfHNtLHKfY6sf
   ```
5. 点击 "Deploy"

### 方式 B：使用 Vercel CLI

```bash
# 安装 Vercel CLI（需要先安装 Node.js）
npm install -g vercel

# 登录
vercel login

# 部署
vercel --prod
```

---

## 常见问题

**Q: 推送时提示 "Authentication failed"？**
A: 确保你粘贴的是 Personal Access Token，不是 GitHub 密码。

**Q: Token 在哪里粘贴？**
A: 在终端提示 "Password:" 时粘贴（粘贴时不会显示任何字符，这是正常的）。

**Q: 如何保存 Token 避免每次都输入？**
A: macOS 的 `osxkeychain` 会自动保存，第一次输入后就不需要再输入了。

**Q: 推送后 Vercel 会自动部署吗？**
A: 如果你在 Vercel 连接了 GitHub 仓库，推送后会自动触发部署。

---

## 完整命令（复制粘贴）

```bash
cd /Users/lilacfei/Desktop/DancerVibe
git config --global credential.helper osxkeychain
git push -u origin main --force
```

然后输入：
- Username: `Lilac213`
- Password: `你的Personal Access Token`

---

**就这么简单！** 🚀
