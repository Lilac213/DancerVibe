# Supabase 快速部署指南

你的项目 ref: `tpkruofcrdlcqzdsdmyq`
项目 URL: `https://tpkruofcrdlcqzdsdmyq.supabase.co`

## 步骤 1: 创建数据库表

1. 访问 https://supabase.com/dashboard/project/tpkruofcrdlcqzdsdmyq/editor
2. 点击左侧 "SQL Editor"
3. 点击 "New query"
4. 复制粘贴以下 SQL 并点击 "Run"：

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
CREATE INDEX idx_songs_created_at ON songs(created_at DESC);

-- 创建 videos 表
CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  video_url TEXT,
  song_id UUID REFERENCES songs(id) ON DELETE SET NULL,
  confidence FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_videos_user_id ON videos(user_id);
CREATE INDEX idx_videos_song_id ON videos(song_id);
CREATE INDEX idx_videos_created_at ON videos(created_at DESC);

-- 启用 RLS
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- Songs 策略
CREATE POLICY "Songs viewable by everyone" ON songs FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert songs" ON songs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Videos 策略
CREATE POLICY "Users view own videos" ON videos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own videos" ON videos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own videos" ON videos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own videos" ON videos FOR DELETE USING (auth.uid() = user_id);
```

## 步骤 2: 部署 Edge Function

### 方式 1: 使用 Supabase Dashboard（推荐）

1. 访问 https://supabase.com/dashboard/project/tpkruofcrdlcqzdsdmyq/functions
2. 点击 "Create a new function"
3. 函数名称: `identify-music`
4. 复制粘贴 `supabase/functions/identify-music/index.ts` 的内容
5. 点击 "Deploy function"

### 方式 2: 使用 CLI

```bash
# 安装 Supabase CLI（如果还没安装）
brew install supabase/tap/supabase

# 登录
supabase login

# 链接项目
supabase link --project-ref tpkruofcrdlcqzdsdmyq

# 部署函数
supabase functions deploy identify-music
```

## 步骤 3: 获取 API Key

1. 访问 https://supabase.com/dashboard/project/tpkruofcrdlcqzdsdmyq/settings/api
2. 复制 "anon public" key
3. 更新 `.env.local` 文件中的 `VITE_SUPABASE_ANON_KEY`

## 步骤 4: 测试

```bash
npm run dev
```

上传视频，系统会自动识别音乐！

## 验证部署

测试 Edge Function：
```bash
curl -X POST https://tpkruofcrdlcqzdsdmyq.supabase.co/functions/v1/identify-music \
  -F "audio=@test-audio.m4a"
```

## ACRCloud 配置

已配置：
- Host: `identify-cn-north-1.acrcloud.cn`
- Access Key: `b7dec7d529aa70616fccfb58aad3435e`
- Project: `dancervibe` (8091)

## 故障排查

**Edge Function 404**:
- 确认函数已部署成功
- 检查函数名称是否为 `identify-music`

**音乐识别失败**:
- 检查浏览器控制台错误
- 确认 `.env.local` 中的 URL 和 Key 正确
- 查看 Edge Function 日志: https://supabase.com/dashboard/project/tpkruofcrdlcqzdsdmyq/logs/edge-functions
