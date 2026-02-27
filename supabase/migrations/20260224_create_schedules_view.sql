-- 创建 schedules_view 视图，用于 admin 解析结果与统计接口
create or replace view public.schedules_view as
select
  s.id,
  s.studio_id,
  s.teacher_id,
  s.course_date,
  s.start_time,
  s.end_time,
  to_char(s.start_time, 'HH24:MI') || ' - ' || to_char(s.end_time, 'HH24:MI') as time_range,
  s.style,
  s.level,
  s.raw_text,
  st.name  as studio_name,
  st.branch as branch_name,
  t.name   as teacher_name,
  coalesce(s.style, '') as course_name,
  s.created_at,
  s.updated_at
from public.schedules s
join public.studios st on s.studio_id = st.id
left join public.teachers t on s.teacher_id = t.id;

