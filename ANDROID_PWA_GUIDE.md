# 安卓 PWA 使用指南

## 安卓用户如何安装 DancerVibe PWA

### 方法 1: Chrome 浏览器（推荐）

1. **打开应用**
   - 在 Chrome 浏览器中访问：`https://your-domain.vercel.app`

2. **安装提示**
   - Chrome 会自动显示"添加到主屏幕"横幅
   - 点击"安装"或"添加"

3. **手动安装**（如果没有自动提示）
   - 点击右上角 ⋮ 菜单
   - 选择"添加到主屏幕"或"安装应用"
   - 点击"安装"

4. **启动应用**
   - 在主屏幕找到 DancerVibe 图标
   - 点击即可全屏启动，体验类似原生应用

### 方法 2: 其他浏览器

**Samsung Internet:**
- 点击菜单 → "添加页面到" → "主屏幕"

**Firefox:**
- 点击菜单 → "安装" 或 "添加到主屏幕"

**Edge:**
- 点击菜单 → "添加到手机"

## 安卓 PWA 功能

✅ **已支持的功能：**
- 离线访问（Service Worker）
- 添加到主屏幕
- 全屏显示（无浏览器地址栏）
- 推送通知（如果启用）
- 后台同步
- 相机访问
- 视频上传和播放
- 本地存储

⚠️ **限制：**
- 无法访问 iOS 特有的相册元数据（拍摄时间/地点）
- 部分高级相机功能可能受限

## 开发者配置

当前配置已优化安卓体验：

### 1. Manifest 配置
```json
{
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#000000",
  "background_color": "#ffffff"
}
```

### 2. HTML Meta 标签
```html
<meta name="mobile-web-app-capable" content="yes">
<meta name="application-name" content="DancerVibe">
<meta name="theme-color" content="#000000">
```

### 3. Service Worker
- 已配置缓存策略
- 支持离线访问
- 文件位置：`public/sw.js`

## 测试安卓 PWA

### 使用 Chrome DevTools

1. **打开 DevTools**
   - F12 或右键 → 检查

2. **切换到移动模式**
   - 点击设备工具栏图标（Ctrl+Shift+M）
   - 选择安卓设备

3. **测试 PWA 功能**
   - Application 标签 → Manifest
   - 检查 Service Worker 状态
   - 测试离线模式

### 真机测试

1. **USB 调试**
   ```bash
   # 启动开发服务器
   npm run dev -- --host
   
   # 在安卓设备上访问
   # http://你的电脑IP:5173
   ```

2. **部署测试**
   - 部署到 Vercel
   - 在安卓设备上访问线上地址
   - 测试安装和功能

## 优化建议

### 1. 添加截图（可选）
在 `manifest.json` 中添加：
```json
"screenshots": [
  {
    "src": "/screenshots/home.png",
    "sizes": "540x720",
    "type": "image/png"
  }
]
```

### 2. 添加快捷方式（可选）
```json
"shortcuts": [
  {
    "name": "新建舞迹",
    "url": "/?action=new-log",
    "icons": [{ "src": "/icons/icon-192x192.png", "sizes": "192x192" }]
  }
]
```

### 3. 检测安装状态
```javascript
// 检测是否已安装
if (window.matchMedia('(display-mode: standalone)').matches) {
  console.log('应用已安装');
}

// 监听安装事件
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  // 保存事件，稍后显示自定义安装按钮
});
```

## 常见问题

### Q: 为什么没有"添加到主屏幕"提示？
- 确保使用 HTTPS（Vercel 自动提供）
- 确保有有效的 manifest.json
- 确保有 Service Worker
- 某些浏览器需要用户交互后才显示

### Q: 安装后图标不显示？
- 检查 icon 路径是否正确
- 确保图标尺寸符合要求（192x192, 512x512）
- 清除浏览器缓存重试

### Q: 如何卸载 PWA？
- 长按应用图标 → 卸载/删除
- 或在设置 → 应用中卸载

### Q: PWA 和原生应用有什么区别？
- PWA 无需通过应用商店下载
- PWA 更新自动，无需手动更新
- PWA 占用空间更小
- 某些原生功能可能受限

## 分发方式

### 1. 直接分享链接
```
https://your-domain.vercel.app
```
用户访问后可自行安装

### 2. 二维码
生成网站二维码，用户扫码访问

### 3. 社交媒体
在微信、微博等平台分享链接

### 4. Google Play（可选）
使用 TWA (Trusted Web Activity) 将 PWA 打包上架 Google Play

## 下一步

如需将 PWA 打包为原生安卓应用：
1. 使用 Capacitor（已配置）
2. 构建 APK：`npx cap build android`
3. 上传到 Google Play Console

---

当前配置已完全支持安卓用户，无需额外修改即可使用。
