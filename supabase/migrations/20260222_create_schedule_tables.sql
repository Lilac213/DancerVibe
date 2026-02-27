-- 创建 studios 表
CREATE TABLE IF NOT EXISTS studios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  branch TEXT NOT NULL,
  logo_url TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, branch)
);

-- 创建 teachers 表
CREATE TABLE IF NOT EXISTS teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, -- 简单起见，名字全局唯一
  avatar_url TEXT,
  bio TEXT,
  default_style TEXT, -- 擅长风格
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建 schedules 表 (存储爬取的课表)
CREATE TABLE IF NOT EXISTS schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id UUID REFERENCES studios(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  course_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  style TEXT,
  level TEXT,
  raw_text TEXT, -- OCR 原始文本备份
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_schedules_studio_id ON schedules(studio_id);
CREATE INDEX IF NOT EXISTS idx_schedules_teacher_id ON schedules(teacher_id);
CREATE INDEX IF NOT EXISTS idx_schedules_course_date ON schedules(course_date);

-- 启用 RLS
ALTER TABLE studios ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

-- 简单的 RLS 策略：所有人可读，认证用户可写（或者仅限 service_role）
-- 这里为了方便前端读取，设置为所有人可读
CREATE POLICY "Studios are viewable by everyone" ON studios FOR SELECT USING (true);
CREATE POLICY "Teachers are viewable by everyone" ON teachers FOR SELECT USING (true);
CREATE POLICY "Schedules are viewable by everyone" ON schedules FOR SELECT USING (true);

-- 写入策略：仅限 authenticated (或者你可以限制为特定 role)
CREATE POLICY "Authenticated users can insert studios" ON studios FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert teachers" ON teachers FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert schedules" ON schedules FOR INSERT WITH CHECK (auth.role() = 'authenticated');
