-- V2 Database Schema for Crawler Template System (PostgreSQL Adapted)
-- This replaces the previous crawler_templates structure with a more robust, versioned system.

-- 1. Crawler Template Table (Core Info)
CREATE TABLE crawler_templates_v2 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_code VARCHAR(100) UNIQUE NOT NULL,
    template_name VARCHAR(200) NOT NULL,
    studio VARCHAR(100),
    source_type VARCHAR(50),
    layout_type VARCHAR(50),
    version VARCHAR(20),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Crawler Template Config Table (Full JSON Configuration)
CREATE TABLE crawler_template_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES crawler_templates_v2(id) ON DELETE CASCADE,
    config_json JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. OCR Task Table (Job Tracking)
CREATE TABLE ocr_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_url VARCHAR(500),
    template_id UUID REFERENCES crawler_templates_v2(id),
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
    confidence_score DECIMAL(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Schedule Raw Table (Raw OCR Output)
CREATE TABLE schedule_raw (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES ocr_tasks(id) ON DELETE CASCADE,
    raw_text TEXT,
    raw_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Schedule Structured Table (Parsed Result)
CREATE TABLE schedule_structured (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES ocr_tasks(id) ON DELETE CASCADE,
    weekday INT,
    start_time TIME,
    end_time TIME,
    course VARCHAR(200),
    style VARCHAR(100),
    teacher VARCHAR(100),
    difficulty INT,
    confidence_score DECIMAL(5,2),
    review_status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Code Dictionary Table (Global Dictionary)
CREATE TABLE code_dictionary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code_type VARCHAR(50) NOT NULL, -- e.g. course_style, teacher_alias
    code_key VARCHAR(200) NOT NULL, -- e.g. "JAZZ FUNK"
    code_value VARCHAR(200) NOT NULL, -- e.g. "JAZZ"
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Review Log Table (Audit Trail)
CREATE TABLE review_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES schedule_structured(id) ON DELETE CASCADE,
    field_name VARCHAR(100),
    old_value VARCHAR(200),
    new_value VARCHAR(200),
    reviewer VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Performance
CREATE INDEX idx_crawler_templates_v2_code ON crawler_templates_v2(template_code);
CREATE INDEX idx_ocr_tasks_status ON ocr_tasks(status);
CREATE INDEX idx_schedule_structured_task_id ON schedule_structured(task_id);
CREATE INDEX idx_code_dictionary_type_key ON code_dictionary(code_type, code_key);
