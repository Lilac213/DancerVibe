-- Original schema from db-schema.sql
create table if not exists public.crawl_items (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  studio text,
  branch text,
  config_id uuid,
  wechat_url text,
  image_path text,
  ocr_data jsonb,
  crawl_status text not null,
  ocr_status text not null,
  need_manual_upload boolean default false,
  error_message text,
  created_at timestamptz default now()
);

create index if not exists idx_crawl_items_config_id on public.crawl_items(config_id);
create index if not exists idx_crawl_items_created_at on public.crawl_items(created_at);

create table if not exists public.crawl_configs (
  id uuid primary key default gen_random_uuid(),
  studio text not null,
  branch text,
  wechat_url text not null,
  template_name text,
  enabled boolean default true,
  last_crawl_at timestamptz,
  last_crawl_status text,
  last_ocr_status text,
  fail_count int default 0,
  need_manual_upload boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_crawl_configs_studio_branch
  on public.crawl_configs(studio, branch);

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  studio text,
  branch text,
  name text not null,
  version int not null,
  is_current boolean default true,
  crawler_rules jsonb,
  ocr_rules jsonb,
  description text,
  created_at timestamptz default now()
);

create unique index if not exists idx_templates_name_version
  on public.templates(name, version);

-- New schema for extracted data (from python_services/crawler/models.py)

create table if not exists public.studios (
    id uuid primary key default gen_random_uuid(),
    name varchar(100) not null,
    branch varchar(100) not null,
    logo_url varchar(255),
    address varchar(255),
    constraint studios_name_branch_key unique (name, branch)
);

create table if not exists public.teachers (
    id uuid primary key default gen_random_uuid(),
    name varchar(100) not null unique,
    avatar_url varchar(255),
    bio text,
    default_style varchar(100)
);

create table if not exists public.schedules (
    id uuid primary key default gen_random_uuid(),
    studio_id uuid not null references public.studios(id),
    teacher_id uuid references public.teachers(id),
    course_date date not null,
    start_time time not null,
    end_time time not null,
    style varchar(100),
    level varchar(50),
    raw_text text,
    created_at timestamptz default now()
);

create index if not exists idx_schedules_studio_date on public.schedules(studio_id, course_date);
