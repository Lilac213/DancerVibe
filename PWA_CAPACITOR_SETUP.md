# PWA 和 Capacitor iOS 改造完成指南

## ✅ 已完成的配置

### 1. PWA 配置
- ✅ [`public/manifest.json`](public/manifest.json) - PWA 清单文件
- ✅ [`public/sw.js`](public/sw.js) - Service Worker
- ✅ [`index.html`](index.html) - 添加了 PWA meta 标签
- ✅ [`vite.config.ts`](vite.config.ts) - 配置了 vite-plugin-pwa

### 2. Capacitor iOS 配置
- ✅ [`capacitor.config.ts`](capacitor.config.ts) - Capacitor 配置
- ✅ [`src/plugins/photoLibrary.ts`](src/plugins/photoLibrary.ts) - 相册插件 TypeScript 接口
- ✅ [`ios/App/App/Plugins/PhotoLibraryPlugin.swift`](ios/App/App/Plugins/PhotoLibraryPlugin.swift) - iOS 原生插件
- ✅ [`ios/App/App/Plugins/PhotoLibraryPlugin.m`](ios/App/App/Plugins/PhotoLibraryPlugin.m) - Objective-C 桥接
- ✅ [`ios/App/App/Info.plist.example`](ios/App/App/Info.plist.example) - iOS 权限配置示例

### 3. 类型定义
- ✅ [`types.ts`](types.ts) - 添加了 `videoAssetId` 等字段支持相册引用

### 4. Package.json
- ✅ [`package.json`](package.json) - 添加了 Capacitor 依赖和脚本

---

## 📋 下一步操作

### 步骤 1: 安装依赖

```bash
npm install
```

### 步骤 2: 创建应用图标

在 `public/icons/` 目录下放置以下图标：
- `icon-192x192.png`
- `icon-512x512.png`

参考：[`public/icons/README.md`](public/icons/README.md)

### 步骤 3: 测试 PWA

```bash
# 构建项目
npm run build

# 预览 PWA
npm run preview
```

在浏览器中访问，测试"添加到主屏幕"功能。

### 步骤 4: 初始化 Capacitor（可选，用于 iOS 打包）

```bash
# 初始化 Capacitor
npm run cap:init
# 按提示输入：
# App name: GrooveGrid
# App ID: com.groovegrid.app

# 添加 iOS 平台
npm run cap:add:ios

# 同步代码到 iOS
npm run cap:sync

# 在 Xcode 中打开
npm run cap:open:ios
```

### 步骤 5: 配置 iOS 权限

在 Xcode 中打开项目后：
1. 找到 `Info.plist` 文件
2. 复制 [`ios/App/App/Info.plist.example`](ios/App/App/Info.plist.example) 中的权限配置
3. 粘贴到实际的 `Info.plist` 中

### 步骤 6: 使用相册引用功能

在你的 React 组件中：

```typescript
import PhotoLibrary from './plugins/photoLibrary';

// 选择视频
const handlePickVideo = async () => {
  const result = await PhotoLibrary.pickVideo();
  const thumbnail = await PhotoLibrary.getThumbnail({ assetId: result.assetId });
  
  // 保存到数据库（只存 assetId，不占用额外空间）
  await saveDanceLog({
    videoAssetId: result.assetId,
    thumbnail: thumbnail.thumbnail,
    duration: result.duration
  });
};

// 播放视频
const handlePlayVideo = async (assetId: string) => {
  const result = await PhotoLibrary.getVideoUrl({ assetId });
  videoElement.src = result.url;
  videoElement.play();
};
```

---

## 🎯 功能说明

### PWA 功能
- ✅ 可添加到主屏幕
- ✅ 离线缓存
- ✅ 自动更新
- ✅ iOS 和 Android 通用

### Capacitor iOS 功能
- ✅ 相册视频引用（不复制文件，节省 50% 存储空间）
- ✅ 获取视频缩略图
- ✅ 权限管理
- ✅ 可上架 App Store

---

## 📊 存储空间对比

| 方案 | 10个视频(每个100MB) | 节省空间 |
|------|-------------------|---------|
| Web/PWA 复制 | 2000MB | - |
| Capacitor 引用 | 1001MB | **约50%** |

---

## 🔗 参考文档

- [PWA_IOS_GUIDE.md](PWA_IOS_GUIDE.md) - PWA 和 iOS 改造详细方案
- [PHOTO_LIBRARY_REFERENCE_GUIDE.md](PHOTO_LIBRARY_REFERENCE_GUIDE.md) - 相册引用实施指南
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - 部署指南

---

## ⚠️ 注意事项

1. **PWA 在 iOS 上的限制**：
   - 推送通知支持有限
   - 某些原生 API 无法访问
   - 需要用户手动"添加到主屏幕"

2. **Capacitor iOS 需要**：
   - macOS 系统
   - Xcode 开发工具
   - Apple Developer 账号（$99/年，用于上架 App Store）

3. **相册引用注意**：
   - 用户删除原视频后，引用会失效
   - 需要处理 iCloud 照片下载
   - 仅在 iOS 原生应用中可用

---

## 🚀 推荐实施顺序

1. **第一阶段（现在）**：PWA 改造
   - 快速上线
   - 用户可立即使用
   - 成本低

2. **第二阶段（1-2周后）**：Capacitor iOS
   - 上架 App Store
   - 实现相册引用
   - 节省存储空间

---

**配置已完成！请按照上述步骤安装依赖并测试。**
