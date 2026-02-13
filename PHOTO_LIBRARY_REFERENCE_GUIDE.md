# 相册视频引用实施指南

## 🎯 需求：直接引用相册原视频，不复制文件

---

## 📊 技术方案对比

| 方案 | 是否复制 | 存储占用 | 实现难度 | 推荐指数 |
|------|---------|---------|---------|---------|
| **Web/PWA** | ✅ 必须复制 | 双份 | 简单 | ⭐⭐⭐ |
| **Capacitor + PHAsset** | ❌ 只存 ID | 单份 | 中等 | ⭐⭐⭐⭐⭐ |
| **原生 iOS** | ❌ 只存 ID | 单份 | 复杂 | ⭐⭐⭐⭐ |

---

## 🚀 推荐方案：Capacitor + 自定义插件

### 核心思路
1. 用户选择视频时，获取 **PHAsset ID**（不是文件）
2. 数据库只存储 **PHAsset ID**（几个字节）
3. 播放时，通过 **PHAsset ID** 读取原视频

---

## 📋 实施步骤

### 步骤 1: 安装 Capacitor

```bash
# 安装 Capacitor
npm install @capacitor/core @capacitor/cli
npm install @capacitor/ios

# 初始化
npx cap init

# 添加 iOS 平台
npm run build
npx cap add ios
```

---

### 步骤 2: 创建自定义插件

#### 创建插件目录结构
```
ios/App/App/Plugins/
└── PhotoLibraryPlugin/
    ├── PhotoLibraryPlugin.swift
    └── PhotoLibraryPlugin.m
```

#### PhotoLibraryPlugin.swift
```swift
import Foundation
import Capacitor
import Photos
import AVFoundation

@objc(PhotoLibraryPlugin)
public class PhotoLibraryPlugin: CAPPlugin {
    
    // 选择视频，返回 PHAsset ID
    @objc func pickVideo(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let picker = UIImagePickerController()
            picker.sourceType = .photoLibrary
            picker.mediaTypes = ["public.movie"]
            picker.delegate = self
            
            self.bridge?.viewController?.present(picker, animated: true)
            self.bridge?.saveCall(call)
        }
    }
    
    // 通过 PHAsset ID 获取视频 URL
    @objc func getVideoUrl(_ call: CAPPluginCall) {
        guard let assetId = call.getString("assetId") else {
            call.reject("Missing assetId")
            return
        }
        
        let fetchResult = PHAsset.fetchAssets(
            withLocalIdentifiers: [assetId],
            options: nil
        )
        
        guard let asset = fetchResult.firstObject else {
            call.reject("Asset not found")
            return
        }
        
        let options = PHVideoRequestOptions()
        options.isNetworkAccessAllowed = true
        options.deliveryMode = .highQualityFormat
        
        PHImageManager.default().requestAVAsset(
            forVideo: asset,
            options: options
        ) { avAsset, _, info in
            if let urlAsset = avAsset as? AVURLAsset {
                call.resolve([
                    "url": urlAsset.url.absoluteString,
                    "duration": asset.duration
                ])
            } else {
                call.reject("Failed to get video URL")
            }
        }
    }
    
    // 获取缩略图
    @objc func getThumbnail(_ call: CAPPluginCall) {
        guard let assetId = call.getString("assetId") else {
            call.reject("Missing assetId")
            return
        }
        
        let fetchResult = PHAsset.fetchAssets(
            withLocalIdentifiers: [assetId],
            options: nil
        )
        
        guard let asset = fetchResult.firstObject else {
            call.reject("Asset not found")
            return
        }
        
        let options = PHImageRequestOptions()
        options.deliveryMode = .highQualityFormat
        options.isNetworkAccessAllowed = true
        
        PHImageManager.default().requestImage(
            for: asset,
            targetSize: CGSize(width: 300, height: 300),
            contentMode: .aspectFill,
            options: options
        ) { image, _ in
            if let image = image,
               let data = image.jpegData(compressionQuality: 0.8) {
                let base64 = data.base64EncodedString()
                call.resolve(["thumbnail": base64])
            } else {
                call.reject("Failed to get thumbnail")
            }
        }
    }
    
    // 检查权限
    @objc func checkPermission(_ call: CAPPluginCall) {
        let status = PHPhotoLibrary.authorizationStatus()
        call.resolve(["status": status.rawValue])
    }
    
    // 请求权限
    @objc func requestPermission(_ call: CAPPluginCall) {
        PHPhotoLibrary.requestAuthorization { status in
            call.resolve(["status": status.rawValue])
        }
    }
}

// UIImagePickerController Delegate
extension PhotoLibraryPlugin: UIImagePickerControllerDelegate, UINavigationControllerDelegate {
    public func imagePickerController(
        _ picker: UIImagePickerController,
        didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey : Any]
    ) {
        picker.dismiss(animated: true)
        
        guard let call = self.bridge?.savedCall(withID: "pickVideo") else {
            return
        }
        
        if let asset = info[.phAsset] as? PHAsset {
            call.resolve([
                "assetId": asset.localIdentifier,
                "duration": asset.duration,
                "width": asset.pixelWidth,
                "height": asset.pixelHeight
            ])
        } else {
            call.reject("Failed to get asset")
        }
    }
    
    public func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        picker.dismiss(animated: true)
        
        if let call = self.bridge?.savedCall(withID: "pickVideo") {
            call.reject("User cancelled")
        }
    }
}
```

#### PhotoLibraryPlugin.m
```objc
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(PhotoLibraryPlugin, "PhotoLibrary",
    CAP_PLUGIN_METHOD(pickVideo, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getVideoUrl, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(getThumbnail, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(checkPermission, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(requestPermission, CAPPluginReturnPromise);
)
```

---

### 步骤 3: TypeScript 接口定义

创建 `src/plugins/photoLibrary.ts`：

```typescript
import { registerPlugin } from '@capacitor/core';

export interface PhotoLibraryPlugin {
  pickVideo(): Promise<{
    assetId: string;
    duration: number;
    width: number;
    height: number;
  }>;
  
  getVideoUrl(options: { assetId: string }): Promise<{
    url: string;
    duration: number;
  }>;
  
  getThumbnail(options: { assetId: string }): Promise<{
    thumbnail: string; // base64
  }>;
  
  checkPermission(): Promise<{ status: number }>;
  requestPermission(): Promise<{ status: number }>;
}

const PhotoLibrary = registerPlugin<PhotoLibraryPlugin>('PhotoLibrary');

export default PhotoLibrary;
```

---

### 步骤 4: 在 React 中使用

#### 选择视频
```typescript
import PhotoLibrary from '../plugins/photoLibrary';
import { saveDanceLog } from '../services/danceLogService';

const handlePickVideo = async () => {
  try {
    // 检查权限
    const permission = await PhotoLibrary.checkPermission();
    if (permission.status !== 3) { // 3 = authorized
      await PhotoLibrary.requestPermission();
    }
    
    // 选择视频
    const result = await PhotoLibrary.pickVideo();
    
    // 获取缩略图
    const thumbnail = await PhotoLibrary.getThumbnail({
      assetId: result.assetId
    });
    
    // 保存到数据库（只存 assetId，不存视频）
    await saveDanceLog({
      videoAssetId: result.assetId,
      thumbnail: thumbnail.thumbnail,
      duration: result.duration,
      width: result.width,
      height: result.height
    });
    
    console.log('视频引用已保存，未占用额外存储空间');
  } catch (error) {
    console.error('选择视频失败:', error);
  }
};
```

#### 播放视频
```typescript
const handlePlayVideo = async (assetId: string) => {
  try {
    // 通过 assetId 获取视频 URL
    const result = await PhotoLibrary.getVideoUrl({ assetId });
    
    // 播放视频
    const videoElement = document.getElementById('video') as HTMLVideoElement;
    videoElement.src = result.url;
    videoElement.play();
  } catch (error) {
    if (error.message === 'Asset not found') {
      alert('原视频已被删除，请重新选择');
    } else {
      console.error('播放视频失败:', error);
    }
  }
};
```

---

### 步骤 5: 更新数据库结构

#### Supabase 表结构
```sql
-- 添加 video_asset_id 字段
ALTER TABLE dance_logs
ADD COLUMN video_asset_id TEXT,
ADD COLUMN video_thumbnail TEXT,
ADD COLUMN video_duration REAL,
ADD COLUMN video_width INTEGER,
ADD COLUMN video_height INTEGER;

-- 如果是引用相册视频，video_url 可以为空
ALTER TABLE dance_logs
ALTER COLUMN video_url DROP NOT NULL;
```

#### TypeScript 类型
```typescript
export interface DanceLog {
  id: string;
  user_id: string;
  
  // 方式 1: 上传的视频（Web/PWA）
  video_url?: string;
  
  // 方式 2: 引用相册视频（Capacitor iOS）
  video_asset_id?: string;
  video_thumbnail?: string;
  video_duration?: number;
  video_width?: number;
  video_height?: number;
  
  created_at: string;
}
```

---

### 步骤 6: 配置权限

在 `ios/App/App/Info.plist` 中添加：

```xml
<key>NSPhotoLibraryUsageDescription</key>
<string>需要访问相册来管理您的舞蹈视频</string>

<key>NSPhotoLibraryAddUsageDescription</key>
<string>需要保存视频到相册</string>
```

---

## 🎯 完整工作流程

### 用户选择视频
```
1. 用户点击"选择视频"
2. 弹出系统相册选择器
3. 用户选择视频
4. 获取 PHAsset ID（例如："ABC123-DEF456-GHI789"）
5. 生成缩略图（base64）
6. 保存到数据库：
   {
     video_asset_id: "ABC123-DEF456-GHI789",
     video_thumbnail: "data:image/jpeg;base64,...",
     video_duration: 15.5,
     video_width: 1920,
     video_height: 1080
   }
```

### 用户播放视频
```
1. 从数据库读取 video_asset_id
2. 调用 PhotoLibrary.getVideoUrl({ assetId })
3. 获取临时 URL（例如："file:///var/mobile/Media/..."）
4. 设置 video.src = url
5. 播放视频
```

---

## ⚠️ 注意事项

### 1. 视频被删除
```typescript
try {
  const url = await PhotoLibrary.getVideoUrl({ assetId });
} catch (error) {
  // 处理视频被删除的情况
  alert('原视频已被删除');
  // 从数据库中删除记录
  await deleteDanceLog(logId);
}
```

### 2. iCloud 照片
```swift
let options = PHVideoRequestOptions()
options.isNetworkAccessAllowed = true
options.progressHandler = { progress, error, stop, info in
    // 显示下载进度
    DispatchQueue.main.async {
        self.notifyListeners("downloadProgress", data: [
            "progress": progress
        ])
    }
}
```

### 3. 权限处理
```typescript
const checkAndRequestPermission = async () => {
  const { status } = await PhotoLibrary.checkPermission();
  
  if (status === 0) { // Not Determined
    await PhotoLibrary.requestPermission();
  } else if (status === 1 || status === 2) { // Denied or Restricted
    alert('请在设置中允许访问相册');
    // 打开设置
    Capacitor.Plugins.App.openUrl({ url: 'app-settings:' });
  }
};
```

---

## 📊 存储空间对比

### 场景：用户保存 10 个视频，每个 100MB

| 方案 | 相册占用 | 应用占用 | 总占用 |
|------|---------|---------|--------|
| **Web/PWA（复制）** | 1000MB | 1000MB | **2000MB** |
| **Capacitor（引用）** | 1000MB | ~1MB | **1001MB** |

**节省空间：约 50%**

---

## 🚀 部署流程

### 1. 开发阶段
```bash
# 构建 Web 应用
npm run build

# 同步到 iOS
npx cap sync

# 在 Xcode 中打开
npx cap open ios

# 在模拟器或真机上测试
```

### 2. 发布阶段
```bash
# 1. 在 Xcode 中配置签名
# 2. Archive
# 3. 上传到 App Store Connect
# 4. 提交审核
```

---

## 💡 建议

**分阶段实施**：

1. **第一阶段（现在）**：
   - 完成 Web/PWA 版本
   - 视频复制到应用存储
   - 快速上线

2. **第二阶段（1-2 周后）**：
   - 添加 Capacitor
   - 实现自定义插件
   - 支持相册引用
   - 节省存储空间

3. **第三阶段（优化）**：
   - 添加缓存策略
   - 优化加载速度
   - 处理边界情况

---

## 📖 参考资料

- [Capacitor 官方文档](https://capacitorjs.com/)
- [iOS PhotoKit 文档](https://developer.apple.com/documentation/photokit)
- [PHAsset 文档](https://developer.apple.com/documentation/photokit/phasset)

---

**需要我帮你实现这个自定义插件吗？**
