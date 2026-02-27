# ✅ Supabase 配置完成指南

你的项目已经配置好环境变量：

## 已完成配置

✅ **环境变量** - [`.env.local`](.env.local:1) 已更新
- Supabase URL: `https://tpkruofcrdlcqzdsdmyq.supabase.co`
- Anon Key: 已配置

## 🔧 剩余手动步骤（2步）

### 步骤 1: 创建数据库表（2分钟）

访问 SQL Editor：
https://supabase.com/dashboard/project/tpkruofcrdlcqzdsdmyq/sql/new

复制粘贴以下 SQL 并点击 "Run"：

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

CREATE INDEX IF NOT EXISTS idx_songs_acrcloud_id ON songs(acrcloud_id);
CREATE INDEX IF NOT EXISTS idx_songs_created_at ON songs(created_at DESC);

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

CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_song_id ON videos(song_id);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC);

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

### 步骤 2: 部署 Edge Function（3分钟）

访问 Edge Functions：
https://supabase.com/dashboard/project/tpkruofcrdlcqzdsdmyq/functions

1. 点击 "Create a new function"
2. 函数名称: `identify-music`
3. 复制粘贴 [`supabase/functions/identify-music/index.ts`](supabase/functions/identify-music/index.ts:1) 的全部内容
4. 点击 "Deploy function"

## 🎉 完成后测试

```bash
npm run dev
```

上传视频，系统会自动识别音乐并填充到"舞曲/内容"字段！

## 📋 功能说明

- ✅ 课堂时间推断优化（拍摄时间找最近半点作为结束时间，支持自定义课时长度）
- ✅ 相册拍摄日期自动带入
- ✅ ACRCloud 音乐识别（中国节点）
- ✅ IndexedDB 缓存优化
- ✅ 自动填充歌曲信息

## 🔍 验证部署

测试 Edge Function：
```bash
curl https://tpkruofcrdlcqzdsdmyq.supabase.co/functions/v1/identify-music
```

查看数据库表：
https://supabase.com/dashboard/project/tpkruofcrdlcqzdsdmyq/editor

## 💡 提示

- SQL 执行后会看到 "Success. No rows returned"
- Edge Function 部署后状态应为 "Active"
- 首次识别可能需要 3-5 秒
