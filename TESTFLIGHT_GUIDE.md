# TestFlight 部署指南

## 前置要求

1. **Apple Developer 账号**（$99/年）
   - 访问 https://developer.apple.com
   - 注册并支付年费

2. **Xcode**（Mac 必需）
   - 从 App Store 下载最新版 Xcode

3. **App Store Connect 访问权限**
   - 访问 https://appstoreconnect.apple.com

## 步骤 1: 准备 iOS 项目

```bash
# 1. 同步 Capacitor
npx cap sync ios

# 2. 打开 Xcode 项目
npx cap open ios
```

## 步骤 2: 配置 Xcode 项目

### 2.1 设置 Bundle Identifier
1. 在 Xcode 中选择项目根节点
2. 选择 Target "App"
3. 在 "General" 标签页中设置：
   - **Bundle Identifier**: `com.yourcompany.dancervibe`（必须唯一）
   - **Version**: `1.0.0`
   - **Build**: `1`

### 2.2 配置签名
1. 在 "Signing & Capabilities" 标签页
2. 勾选 "Automatically manage signing"
3. 选择你的 Team（Apple Developer 账号）

### 2.3 设置部署目标
- **Deployment Target**: iOS 13.0 或更高

## 步骤 3: 在 App Store Connect 创建应用

1. 访问 https://appstoreconnect.apple.com
2. 点击 "我的 App" → "+" → "新建 App"
3. 填写信息：
   - **平台**: iOS
   - **名称**: DancerVibe
   - **主要语言**: 简体中文
   - **Bundle ID**: 选择你在 Xcode 中设置的 Bundle ID
   - **SKU**: dancervibe（唯一标识符）
   - **用户访问权限**: 完全访问权限

## 步骤 4: 构建并上传到 App Store Connect

### 4.1 Archive 构建
1. 在 Xcode 中选择设备目标为 "Any iOS Device (arm64)"
2. 菜单栏：Product → Archive
3. 等待构建完成（可能需要几分钟）

### 4.2 上传到 App Store Connect
1. Archive 完成后会自动打开 Organizer 窗口
2. 选择刚才的 Archive
3. 点击 "Distribute App"
4. 选择 "App Store Connect"
5. 选择 "Upload"
6. 保持默认选项，点击 "Next"
7. 等待上传完成

## 步骤 5: 配置 TestFlight

### 5.1 等待处理
- 上传后需要等待 Apple 处理（通常 5-15 分钟）
- 在 App Store Connect → TestFlight 中查看状态

### 5.2 添加测试信息
1. 进入 App Store Connect → TestFlight
2. 选择你的构建版本
3. 填写 "测试信息"：
   - **测试详情**: 描述这个版本的功能
   - **反馈邮箱**: 你的邮箱
   - **营销 URL**: 可选
   - **隐私政策 URL**: 可选

### 5.3 提交审核（首次需要）
- 首次 TestFlight 需要 Apple 审核（通常 24-48 小时）
- 后续版本无需审核，可立即测试

## 步骤 6: 邀请测试用户

### 方法 1: 内部测试（最多 100 人）
1. App Store Connect → TestFlight → 内部测试
2. 点击 "+" 添加内部测试员
3. 输入测试员的 Apple ID 邮箱
4. 他们会收到邮件邀请

### 方法 2: 外部测试（最多 10,000 人）
1. App Store Connect → TestFlight → 外部测试
2. 创建测试组
3. 添加测试员或生成公开链接
4. 分享链接给测试用户

### 方法 3: 公开链接（推荐）
1. 创建外部测试组
2. 启用 "公开链接"
3. 复制链接分享给任何人
4. 用户点击链接即可加入测试

## 步骤 7: 测试用户安装

测试用户需要：
1. 在 App Store 下载 "TestFlight" 应用
2. 打开邀请邮件或公开链接
3. 在 TestFlight 中接受邀请
4. 点击 "安装" 下载你的应用

## 常见问题

### Q: 构建失败怎么办？
- 检查 Bundle ID 是否正确
- 确保所有证书和配置文件有效
- 查看 Xcode 错误日志

### Q: 上传后看不到构建？
- 等待 5-15 分钟让 Apple 处理
- 检查邮件是否有错误通知
- 确认构建版本号没有重复

### Q: TestFlight 审核被拒？
- 确保应用符合 Apple 审核指南
- 提供清晰的测试说明
- 如有登录功能，提供测试账号

### Q: 如何更新测试版本？
1. 在 Xcode 中增加 Build 号（如 1 → 2）
2. 重新 Archive 并上传
3. 新版本会自动推送给测试用户

## 快速命令参考

```bash
# 同步并打开 Xcode
npx cap sync ios && npx cap open ios

# 查看当前 Bundle ID
grep -A 1 "CFBundleIdentifier" ios/App/App/Info.plist

# 增加 Build 号（手动在 Xcode 中修改更安全）
```

## 注意事项

1. **版本号管理**
   - Version: 用户可见版本（如 1.0.0）
   - Build: 内部构建号（每次上传必须递增）

2. **隐私权限**
   - 确保 Info.plist 中有所有权限说明
   - 相册访问、相机访问等

3. **测试周期**
   - 每个 TestFlight 构建有效期 90 天
   - 到期前需要上传新版本

4. **反馈收集**
   - 测试用户可以在 TestFlight 中截图反馈
   - 在 App Store Connect 中查看反馈

## 下一步

完成 TestFlight 测试后，可以：
1. 收集用户反馈并改进
2. 准备正式发布到 App Store
3. 提交 App Store 审核（需要更多信息和截图）

---

需要帮助？查看 Apple 官方文档：
- https://developer.apple.com/testflight/
- https://help.apple.com/app-store-connect/
