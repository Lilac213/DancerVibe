# GitHub 推送指南

## 问题
推送到 GitHub 时遇到认证错误：
```
fatal: could not read Username for 'https://github.com': Device not configured
```

---

## 解决方案

### 方式 1: 使用 GitHub CLI（推荐，最简单）

#### 步骤 1: 安装 GitHub CLI
```bash
# macOS
brew install gh

# 或访问 https://cli.github.com/ 下载安装
```

#### 步骤 2: 登录 GitHub
```bash
gh auth login
```
按照提示操作：
- What account do you want to log into? **GitHub.com**
- What is your preferred protocol? **HTTPS**
- Authenticate Git with your GitHub credentials? **Yes**
- How would you like to authenticate? **Login with a web browser**

#### 步骤 3: 推送代码
```bash
cd /Users/lilacfei/Desktop/DancerVibe
git push -u origin main --force
```

---

### 方式 2: 使用 Personal Access Token

#### 步骤 1: 创建 Personal Access Token
1. 访问 https://github.com/settings/tokens
2. 点击 "Generate new token" → "Generate new token (classic)"
3. 设置：
   - Note: `DancerVibe Deployment`
   - Expiration: 选择有效期
   - 勾选 `repo` 权限
4. 点击 "Generate token"
5. **复制生成的 token**（只显示一次）

#### 步骤 2: 使用 Token 推送
```bash
cd /Users/lilacfei/Desktop/DancerVibe

# 方式 A: 在 URL 中包含 token（不推荐，会暴露在历史记录中）
git remote set-url origin https://你的token@github.com/Lilac213/DancerVibe.git
git push -u origin main --force

# 方式 B: 使用 Git Credential Helper（推荐）
git config --global credential.helper osxkeychain
git push -u origin main --force
# 在弹出的提示中：
# Username: Lilac213
# Password: 粘贴你的 Personal Access Token
```

---

### 方式 3: 使用 SSH（推荐，长期使用）

#### 步骤 1: 生成 SSH 密钥
```bash
# 检查是否已有 SSH 密钥
ls -al ~/.ssh

# 如果没有，生成新密钥
ssh-keygen -t ed25519 -C "你的邮箱@example.com"
# 按 Enter 使用默认路径
# 可以设置密码或直接按 Enter
```

#### 步骤 2: 添加 SSH 密钥到 GitHub
```bash
# 复制公钥
cat ~/.ssh/id_ed25519.pub
# 或
pbcopy < ~/.ssh/id_ed25519.pub
```

1. 访问 https://github.com/settings/keys
2. 点击 "New SSH key"
3. Title: `MacBook Pro`
4. Key: 粘贴刚才复制的公钥
5. 点击 "Add SSH key"

#### 步骤 3: 测试 SSH 连接
```bash
ssh -T git@github.com
# 应该看到: Hi Lilac213! You've successfully authenticated...
```

#### 步骤 4: 更改远程 URL 为 SSH
```bash
cd /Users/lilacfei/Desktop/DancerVibe
git remote set-url origin git@github.com:Lilac213/DancerVibe.git
git push -u origin main --force
```

---

### 方式 4: 使用 GitHub Desktop（最简单，图形界面）

#### 步骤 1: 下载安装
访问 https://desktop.github.com/ 下载安装

#### 步骤 2: 登录 GitHub
打开 GitHub Desktop，登录你的账号

#### 步骤 3: 添加本地仓库
1. File → Add Local Repository
2. 选择 `/Users/lilacfei/Desktop/DancerVibe`
3. 点击 "Add Repository"

#### 步骤 4: 推送
1. 在 GitHub Desktop 中，点击 "Publish repository"
2. 或者如果仓库已存在，点击 "Push origin"
3. 勾选 "Force push" 如果需要覆盖

---

## 推荐操作流程

**最简单的方式（GitHub CLI）**：

```bash
# 1. 安装 GitHub CLI
brew install gh

# 2. 登录
gh auth login

# 3. 推送
cd /Users/lilacfei/Desktop/DancerVibe
git push -u origin main --force
```

---

## 验证推送成功

推送成功后，访问：
https://github.com/Lilac213/DancerVibe

你应该能看到：
- ✅ 所有新文件（`services/newApiClient.ts`, `vercel.json` 等）
- ✅ 最新的提交信息
- ✅ 更新的代码

---

## 下一步：部署到 Vercel

推送成功后，你可以：

### 选项 1: 从 GitHub 导入到 Vercel
1. 访问 https://vercel.com/new
2. 选择 "Import Git Repository"
3. 选择 `Lilac213/DancerVibe`
4. 配置环境变量：
   - `NEWAPI_BASE_URL` = `https://docs.newapi.pro`
   - `NEWAPI_API_KEY` = `sk-mQnV4bKXYX2sbQnz5NMuZSa6spIDMJhV7xRSfHNtLHKfY6sf`
5. 点击 "Deploy"

### 选项 2: 使用 Vercel CLI
```bash
vercel --prod
```

---

## 常见问题

**Q: 我应该使用哪种方式？**
A: 
- 最简单：GitHub CLI 或 GitHub Desktop
- 最安全：SSH
- 临时使用：Personal Access Token

**Q: Force push 会删除远程的历史记录吗？**
A: 是的，`--force` 会覆盖远程仓库。如果你需要保留历史，去掉 `--force` 参数。

**Q: 推送后 Vercel 会自动部署吗？**
A: 如果你已经在 Vercel 连接了这个 GitHub 仓库，推送后会自动触发部署。

---

**建议：使用 GitHub CLI（方式 1）最简单快捷！**
