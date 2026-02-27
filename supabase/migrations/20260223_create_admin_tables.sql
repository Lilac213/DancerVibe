CREATE TABLE IF NOT EXISTS crawler_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  studio TEXT,
  branch TEXT,
  target_url TEXT,
  field_mapping JSONB DEFAULT '{}'::jsonb,
  update_frequency TEXT,
  exception_policy JSONB DEFAULT '{}'::jsonb,
  version INT NOT NULL DEFAULT 1,
  is_current BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crawler_rules_name ON crawler_rules(name);
CREATE INDEX IF NOT EXISTS idx_crawler_rules_studio ON crawler_rules(studio);

CREATE TABLE IF NOT EXISTS admin_operation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  detail JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_action ON admin_operation_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_operation_logs(created_at);

ALTER TABLE crawler_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_operation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Crawler rules are viewable by everyone" ON crawler_rules FOR SELECT USING (true);
CREATE POLICY "Admin logs are viewable by everyone" ON admin_operation_logs FOR SELECT USING (true);
