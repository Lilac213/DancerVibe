# Supabase 音乐识别部署指南

## 快速部署步骤

### 1. 安装 Supabase CLI

```bash
npm install -g supabase
```

### 2. 登录 Supabase

```bash
supabase login
```

### 3. 创建/链接项目

**如果还没有项目**：
1. 访问 https://supabase.com/dashboard
2. 点击 "New Project"
3. 记录下项目的 URL 和 Project Ref

**链接到项目**：
```bash
supabase link --project-ref your-project-ref
```

### 4. 创建数据库表

在 Supabase Dashboard 的 SQL Editor 中运行：

```sql
-- 创建 songs 表
CREATE TABLE IF NOT EXISTS songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  cover_url TEXT,
  acrcloud_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_songs_acrcloud_id ON songs(acrcloud_id);

-- 创建 videos 表
CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  video_url TEXT,
  song_id UUID REFERENCES songs(id) ON DELETE SET NULL,
  confidence FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_videos_user_id ON videos(user_id);
CREATE INDEX idx_videos_song_id ON videos(song_id);

-- 启用 RLS
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- Songs 策略
CREATE POLICY "Songs viewable by everyone" ON songs FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert songs" ON songs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Videos 策略
CREATE POLICY "Users view own videos" ON videos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own videos" ON videos FOR INSERT WITH CHECK (auth.uid() = user_id);
```

### 5. 部署 Edge Function

```bash
cd /Users/lilacfei/Desktop/DancerVibe
supabase functions deploy identify-music
```

### 6. 配置环境变量

在 `.env.local` 文件中添加：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

获取 anon key：
1. 访问 Supabase Dashboard
2. Settings > API
3. 复制 "anon public" key

### 7. 测试

```bash
npm run dev
```

上传视频，系统会自动识别音乐并填充到"舞曲/内容"字段。

## ACRCloud 配置

已在 Edge Function 中配置：
- Host: `identify-cn-north-1.acrcloud.cn`
- Access Key: `b7dec7d529aa70616fccfb58aad3435e`
- Project: `dancervibe` (8091)

## 文件结构

```
DancerVibe/
├── supabase/
│   ├── functions/
│   │   └── identify-music/
│   │       ├── index.ts          # Edge Function 代码
│   │       └── deno.json          # Deno 配置
│   ├── migrations/
│   │   └── 20260214_create_music_tables.sql  # 数据库迁移
│   └── config.toml                # Supabase 配置
├── services/
│   ├── musicRecognitionService.ts # 前端音乐识别服务
│   └── songService.ts             # 歌曲缓存服务
└── .env.local                     # 环境变量
```

## 故障排查

**Edge Function 部署失败**：
```bash
# 查看日志
supabase functions logs identify-music
```

**音乐识别不工作**：
1. 检查 `.env.local` 中的 Supabase URL 和 Key
2. 检查浏览器控制台错误
3. 确认 Edge Function 已部署成功

**数据库表创建失败**：
- 在 Supabase Dashboard 的 SQL Editor 中手动运行 SQL
- 检查是否有权限问题
