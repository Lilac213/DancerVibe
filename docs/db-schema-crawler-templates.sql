-- Create Crawler Templates Table
CREATE TABLE crawler_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    studio VARCHAR(100) NOT NULL,
    source_type VARCHAR(50) NOT NULL,
    version VARCHAR(20) DEFAULT 'v1',
    status VARCHAR(20) DEFAULT 'active',
    auto_field_detection BOOLEAN DEFAULT FALSE,
    layout_config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Crawler Template Rules Table
CREATE TABLE crawler_template_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES crawler_templates(id) ON DELETE CASCADE,
    rule_type VARCHAR(50) NOT NULL,
    rule_content JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster lookup by studio
CREATE INDEX idx_crawler_templates_studio ON crawler_templates(studio);
CREATE INDEX idx_crawler_templates_status ON crawler_templates(status);
