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

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_songs_acrcloud_id ON songs(acrcloud_id);
CREATE INDEX IF NOT EXISTS idx_songs_created_at ON songs(created_at DESC);

-- 创建 videos 表（如果需要在 Supabase 存储视频元数据）
CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  video_url TEXT,
  song_id UUID REFERENCES songs(id) ON DELETE SET NULL,
  confidence FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_song_id ON videos(song_id);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC);

-- 启用 RLS (Row Level Security)
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- Songs 表策略：所有人可读，认证用户可写
CREATE POLICY "Songs are viewable by everyone" ON songs
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert songs" ON songs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Videos 表策略：用户只能访问自己的视频
CREATE POLICY "Users can view own videos" ON videos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own videos" ON videos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own videos" ON videos
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own videos" ON videos
  FOR DELETE USING (auth.uid() = user_id);
