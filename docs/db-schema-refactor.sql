-- Drop old specific dictionary tables
drop table if exists public.dict_courses;
drop table if exists public.dict_teachers;
drop table if exists public.dict_styles;
-- Keep changelog but maybe rename or reuse
drop table if exists public.dict_changelog;

-- Unified Dictionary Table
create table if not exists public.sys_dicts (
    id uuid primary key default gen_random_uuid(),
    category varchar(50) not null, -- 'course', 'teacher', 'style', 'studio', etc.
    key varchar(100) not null, -- Unique key within category, e.g. 'JAZZ'
    value jsonb not null, -- Stores label, alias, level, etc.
    sort_order int default 0,
    is_active boolean default true,
    
    created_time timestamptz default now(),
    created_person varchar(100),
    update_time timestamptz default now(),
    update_person varchar(100),
    
    constraint uq_sys_dicts_category_key unique (category, key)
);

create index if not exists idx_sys_dicts_category on public.sys_dicts(category);

-- Audit Tasks Table (For Manual Review)
create table if not exists public.audit_tasks (
    id uuid primary key default gen_random_uuid(),
    source_type varchar(50) not null, -- 'crawl_item', 'manual_upload'
    source_id uuid not null, -- Link to crawl_items.id
    task_type varchar(50) not null, -- 'ocr_correction', 'entity_mapping'
    
    status varchar(20) default 'pending', -- 'pending', 'approved', 'rejected'
    priority varchar(20) default 'medium',
    
    original_data jsonb, -- Snapshot of data before fix
    fixed_data jsonb, -- Data after manual fix
    
    confidence_score float, -- Why it needs audit
    ai_suggestion jsonb, -- LLM suggestion if any
    
    assigned_to varchar(100),
    created_at timestamptz default now(),
    resolved_at timestamptz,
    resolved_by varchar(100)
);

create index if not exists idx_audit_tasks_status on public.audit_tasks(status);
