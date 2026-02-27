# 舞迹功能分阶段付费方案

## 🎯 产品策略

**前期（免费）**：引用用户相册中的视频（不占用云存储）
**后期（付费）**：用户可选择上传到云端（永久保存，跨设备同步）

---

## 📊 商业模式设计

### 阶段 1：免费期（前 6 个月）
- ✅ 用户可以添加舞迹记录
- ✅ 引用相册中的视频（PHAsset ID）
- ✅ 本地存储缩略图和元数据
- ✅ 只能在当前设备查看
- ⚠️ 如果删除相册视频，舞迹记录失效

### 阶段 2：付费期（6 个月后）
- 💰 提供"云端备份"功能
- ✅ 上传视频到 Supabase Storage
- ✅ 跨设备同步
- ✅ 永久保存，不受相册影响
- ✅ 可以分享给其他用户

---

## 🏗️ 技术架构设计

### 数据库结构

```sql
-- dance_logs 表
CREATE TABLE dance_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  
  -- 基础信息
  title TEXT,
  description TEXT,
  tags TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- 视频存储方式（两种模式）
  storage_type TEXT NOT NULL, -- 'local_reference' 或 'cloud_storage'
  
  -- 方式 1: 本地引用（免费）
  video_asset_id TEXT, -- PHAsset ID
  video_thumbnail TEXT, -- base64 缩略图
  
  -- 方式 2: 云端存储（付费）
  video_url TEXT, -- Supabase Storage URL
  video_size BIGINT, -- 文件大小（字节）
  
  -- 共同元数据
  video_duration REAL,
  video_width INTEGER,
  video_height INTEGER,
  
  -- 付费相关
  is_uploaded BOOLEAN DEFAULT FALSE,
  uploaded_at TIMESTAMP,
  upload_payment_id TEXT
);

-- 用户订阅表
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  
  -- 订阅类型
  plan_type TEXT NOT NULL, -- 'free', 'basic', 'pro'
  
  -- 存储配额
  storage_quota_mb INTEGER, -- 存储配额（MB）
  storage_used_mb INTEGER DEFAULT 0, -- 已使用（MB）
  
  -- 订阅状态
  status TEXT DEFAULT 'active', -- 'active', 'expired', 'cancelled'
  started_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  
  -- 支付信息
  payment_method TEXT,
  last_payment_at TIMESTAMP
);

-- 上传任务表（用于批量上传）
CREATE TABLE upload_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  dance_log_id UUID NOT NULL,
  
  -- 任务状态
  status TEXT DEFAULT 'pending', -- 'pending', 'uploading', 'completed', 'failed'
  progress INTEGER DEFAULT 0, -- 0-100
  
  -- 错误信息
  error_message TEXT,
  
  -- 时间戳
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);
```

---

## 💻 核心功能实现

### 1. 添加舞迹（免费模式）

```typescript
// services/danceLogService.ts

import PhotoLibrary from '../plugins/photoLibrary';
import { supabase } from './supabaseClient';

export const addDanceLog = async (data: {
  title: string;
  description?: string;
  tags?: string[];
}) => {
  try {
    // 1. 选择视频（获取 PHAsset ID）
    const video = await PhotoLibrary.pickVideo();
    
    // 2. 获取缩略图
    const thumbnail = await PhotoLibrary.getThumbnail({
      assetId: video.assetId
    });
    
    // 3. 保存到数据库（免费模式：只存引用）
    const { data: log, error } = await supabase
      .from('dance_logs')
      .insert({
        ...data,
        storage_type: 'local_reference',
        video_asset_id: video.assetId,
        video_thumbnail: thumbnail.thumbnail,
        video_duration: video.duration,
        video_width: video.width,
        video_height: video.height,
        is_uploaded: false
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return log;
  } catch (error) {
    console.error('添加舞迹失败:', error);
    throw error;
  }
};
```

---

### 2. 播放舞迹

```typescript
export const playDanceLog = async (log: DanceLog) => {
  try {
    if (log.storage_type === 'cloud_storage' && log.video_url) {
      // 云端视频：直接播放
      return log.video_url;
    } else if (log.storage_type === 'local_reference' && log.video_asset_id) {
      // 本地引用：通过 PHAsset ID 获取 URL
      const result = await PhotoLibrary.getVideoUrl({
        assetId: log.video_asset_id
      });
      return result.url;
    } else {
      throw new Error('视频不可用');
    }
  } catch (error) {
    if (error.message === 'Asset not found') {
      // 视频已被删除，提示用户
      throw new Error('原视频已被删除，建议上传到云端保存');
    }
    throw error;
  }
};
```

---

### 3. 检查用户订阅状态

```typescript
export const checkUserSubscription = async (userId: string) => {
  const { data, error } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error || !data) {
    // 新用户，创建免费订阅
    return {
      plan_type: 'free',
      storage_quota_mb: 0, // 免费用户无云存储配额
      storage_used_mb: 0,
      can_upload: false
    };
  }
  
  // 检查是否过期
  const isExpired = data.expires_at && new Date(data.expires_at) < new Date();
  
  return {
    plan_type: data.plan_type,
    storage_quota_mb: data.storage_quota_mb,
    storage_used_mb: data.storage_used_mb,
    can_upload: !isExpired && data.storage_quota_mb > data.storage_used_mb,
    is_expired: isExpired
  };
};
```

---

### 4. 上传到云端（付费功能）

```typescript
import { saveVideo } from './videoStorage';

export const uploadDanceLogToCloud = async (logId: string) => {
  try {
    // 1. 获取舞迹记录
    const { data: log, error: fetchError } = await supabase
      .from('dance_logs')
      .select('*')
      .eq('id', logId)
      .single();
    
    if (fetchError) throw fetchError;
    
    // 2. 检查是否已上传
    if (log.is_uploaded) {
      throw new Error('该舞迹已上传到云端');
    }
    
    // 3. 检查用户订阅
    const subscription = await checkUserSubscription(log.user_id);
    if (!subscription.can_upload) {
      throw new Error('存储空间不足，请升级订阅');
    }
    
    // 4. 获取原视频
    const videoUrl = await PhotoLibrary.getVideoUrl({
      assetId: log.video_asset_id
    });
    
    // 5. 读取视频文件
    const response = await fetch(videoUrl.url);
    const blob = await response.blob();
    const file = new File([blob], `dance_${logId}.mp4`, { type: 'video/mp4' });
    
    // 6. 创建上传任务
    const { data: task } = await supabase
      .from('upload_tasks')
      .insert({
        user_id: log.user_id,
        dance_log_id: logId,
        status: 'uploading'
      })
      .select()
      .single();
    
    // 7. 上传到 Supabase Storage
    const cloudUrl = await saveVideo(file, (progress) => {
      // 更新上传进度
      supabase
        .from('upload_tasks')
        .update({ progress })
        .eq('id', task.id);
    });
    
    // 8. 更新舞迹记录
    const { error: updateError } = await supabase
      .from('dance_logs')
      .update({
        storage_type: 'cloud_storage',
        video_url: cloudUrl,
        video_size: file.size,
        is_uploaded: true,
        uploaded_at: new Date().toISOString()
      })
      .eq('id', logId);
    
    if (updateError) throw updateError;
    
    // 9. 更新用户存储使用量
    const sizeMB = Math.ceil(file.size / 1024 / 1024);
    await supabase.rpc('increment_storage_used', {
      user_id: log.user_id,
      size_mb: sizeMB
    });
    
    // 10. 完成上传任务
    await supabase
      .from('upload_tasks')
      .update({
        status: 'completed',
        progress: 100,
        completed_at: new Date().toISOString()
      })
      .eq('id', task.id);
    
    return { success: true, cloudUrl };
  } catch (error) {
    console.error('上传失败:', error);
    throw error;
  }
};
```

---

### 5. 批量上传功能

```typescript
export const batchUploadDanceLogs = async (logIds: string[]) => {
  const results = [];
  
  for (const logId of logIds) {
    try {
      const result = await uploadDanceLogToCloud(logId);
      results.push({ logId, success: true, ...result });
    } catch (error) {
      results.push({ logId, success: false, error: error.message });
    }
  }
  
  return results;
};
```

---

## 🎨 UI/UX 设计

### 舞迹列表界面

```typescript
// components/DanceLogView.tsx

const DanceLogCard = ({ log }: { log: DanceLog }) => {
  const [subscription, setSubscription] = useState(null);
  
  useEffect(() => {
    checkUserSubscription(user.id).then(setSubscription);
  }, []);
  
  return (
    <div className="dance-log-card">
      {/* 缩略图 */}
      <img src={log.video_thumbnail} alt={log.title} />
      
      {/* 存储状态标识 */}
      {log.storage_type === 'local_reference' && (
        <div className="storage-badge local">
          📱 本地引用
        </div>
      )}
      
      {log.storage_type === 'cloud_storage' && (
        <div className="storage-badge cloud">
          ☁️ 云端保存
        </div>
      )}
      
      {/* 标题和描述 */}
      <h3>{log.title}</h3>
      <p>{log.description}</p>
      
      {/* 操作按钮 */}
      <div className="actions">
        <button onClick={() => playDanceLog(log)}>
          播放
        </button>
        
        {/* 上传到云端按钮（仅本地引用显示） */}
        {log.storage_type === 'local_reference' && !log.is_uploaded && (
          <button 
            onClick={() => handleUploadToCloud(log.id)}
            disabled={!subscription?.can_upload}
          >
            {subscription?.can_upload ? '☁️ 上传到云端' : '🔒 升级订阅'}
          </button>
        )}
      </div>
      
      {/* 提示信息 */}
      {log.storage_type === 'local_reference' && (
        <p className="hint">
          ⚠️ 本地引用模式：如果删除相册中的原视频，此记录将失效
        </p>
      )}
    </div>
  );
};
```

---

### 付费升级界面

```typescript
const UpgradeModal = ({ onClose }: { onClose: () => void }) => {
  return (
    <div className="upgrade-modal">
      <h2>升级到云端存储</h2>
      
      <div className="plans">
        {/* 基础版 */}
        <div className="plan">
          <h3>基础版</h3>
          <p className="price">¥9.9/月</p>
          <ul>
            <li>✅ 5GB 云存储空间</li>
            <li>✅ 跨设备同步</li>
            <li>✅ 永久保存</li>
            <li>✅ 可分享给好友</li>
          </ul>
          <button onClick={() => handleSubscribe('basic')}>
            立即订阅
          </button>
        </div>
        
        {/* 专业版 */}
        <div className="plan pro">
          <div className="badge">推荐</div>
          <h3>专业版</h3>
          <p className="price">¥29.9/月</p>
          <ul>
            <li>✅ 50GB 云存储空间</li>
            <li>✅ 跨设备同步</li>
            <li>✅ 永久保存</li>
            <li>✅ 可分享给好友</li>
            <li>✅ AI 动作分析</li>
            <li>✅ 高清视频导出</li>
          </ul>
          <button onClick={() => handleSubscribe('pro')}>
            立即订阅
          </button>
        </div>
      </div>
      
      <p className="note">
        💡 前 6 个月免费使用本地引用模式，随时可升级
      </p>
    </div>
  );
};
```

---

## 📱 用户体验流程

### 新用户流程
```
1. 下载应用
2. 注册账号（免费）
3. 添加舞迹 → 选择相册视频 → 保存（本地引用）
4. 查看舞迹列表 → 看到"本地引用"标识
5. 6 个月后 → 收到升级提示
```

### 付费用户流程
```
1. 点击"上传到云端"按钮
2. 看到订阅选项（基础版/专业版）
3. 选择订阅并支付
4. 自动上传视频到云端
5. 舞迹状态变为"云端保存"
6. 可以跨设备访问
```

---

## 💰 定价策略建议

| 套餐 | 价格 | 存储空间 | 适合人群 |
|------|------|---------|---------|
| **免费版** | ¥0 | 0GB（仅本地引用） | 轻度用户 |
| **基础版** | ¥9.9/月 | 5GB | 业余舞者 |
| **专业版** | ¥29.9/月 | 50GB | 专业舞者/老师 |
| **年费版** | ¥299/年 | 100GB | 舞蹈工作室 |

---

## 🎯 转化策略

### 触发付费的时机

1. **6 个月后自动提示**
   ```typescript
   const checkUpgradePrompt = async (user: User) => {
     const accountAge = Date.now() - new Date(user.created_at).getTime();
     const sixMonths = 6 * 30 * 24 * 60 * 60 * 1000;
     
     if (accountAge > sixMonths && !user.has_subscription) {
       showUpgradeModal();
     }
   };
   ```

2. **视频被删除时提示**
   ```typescript
   try {
     await playDanceLog(log);
   } catch (error) {
     if (error.message.includes('已被删除')) {
       showUpgradeModal({
         message: '原视频已被删除！升级到云端存储，永久保存您的舞迹'
       });
     }
   }
   ```

3. **分享功能限制**
   ```typescript
   const shareDanceLog = async (logId: string) => {
     const log = await getDanceLog(logId);
     
     if (log.storage_type === 'local_reference') {
       showUpgradeModal({
         message: '升级到云端存储后，即可分享给好友'
       });
       return;
     }
     
     // 生成分享链接
     const shareUrl = generateShareUrl(logId);
     navigator.share({ url: shareUrl });
   };
   ```

---

## 📊 数据分析指标

### 关键指标

```typescript
// 转化率分析
const analytics = {
  // 用户留存
  retention_6months: 0, // 6 个月留存率
  
  // 付费转化
  free_to_paid_rate: 0, // 免费转付费率
  upgrade_trigger: {
    auto_prompt: 0, // 自动提示触发
    video_deleted: 0, // 视频删除触发
    share_feature: 0, // 分享功能触发
  },
  
  // 存储使用
  avg_videos_per_user: 0, // 平均每用户视频数
  avg_storage_used_mb: 0, // 平均存储使用量
  
  // 收入
  mrr: 0, // 月度经常性收入
  arpu: 0, // 平均每用户收入
};
```

---

## 🚀 实施计划

### 第一阶段：基础功能（1-2 周）
- [x] 完成 NewAPI 迁移和部署
- [ ] 实现 Capacitor iOS 打包
- [ ] 实现 PhotoLibrary 自定义插件
- [ ] 实现本地引用模式

### 第二阶段：付费功能（1-2 周）
- [ ] 实现订阅系统
- [ ] 实现云端上传功能
- [ ] 实现批量上传
- [ ] 集成支付（微信支付/支付宝）

### 第三阶段：优化体验（1 周）
- [ ] 添加上传进度显示
- [ ] 添加存储空间管理
- [ ] 添加数据分析
- [ ] 优化转化流程

---

## 💡 建议

**立即行动**：
1. 先完成 GitHub 推送和 Vercel 部署（Web 版本）
2. 然后实现 Capacitor iOS 打包
3. 实现本地引用模式（免费功能）
4. 6 个月后再上线付费功能

**优势**：
- ✅ 快速验证产品市场契合度
- ✅ 积累用户基础
- ✅ 收集用户反馈
- ✅ 优化付费转化策略

---

需要我帮你实现这些功能吗？我们可以从哪个部分开始？
