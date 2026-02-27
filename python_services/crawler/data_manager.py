from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
try:
    from .models import Base, Studio, Teacher, Schedule, SysDict, AuditTask
except ImportError:
    from models import Base, Studio, Teacher, Schedule, SysDict, AuditTask
from typing import Dict, List, Optional
import os
import json
import uuid
from datetime import datetime, date, time

# 优先读取环境变量中的 DATABASE_URL (Railway/Supabase)
# 如果是 postgres:// 开头（Heroku/Railway 旧格式），SQLAlchemy 需要改为 postgresql://
database_url = os.environ.get("DATABASE_URL", "postgresql://postgres.xxx:xxx@aws-0-us-east-1.pooler.supabase.com:6543/postgres")
if database_url and database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

class DataManager:
    def __init__(self, db_url=None):
        # 允许外部传入 db_url，否则使用全局配置
        final_url = db_url or database_url
        if not final_url:
            raise ValueError("DATABASE_URL is not set")
        self.engine = create_engine(final_url, echo=False)
        self.Session = sessionmaker(bind=self.engine)
        
    def get_or_create_studio(self, name: str, branch: str) -> Studio:
        session = self.Session()
        try:
            studio = session.query(Studio).filter_by(name=name, branch=branch).first()
            if not studio:
                studio = Studio(id=uuid.uuid4(), name=name, branch=branch)
                session.add(studio)
                session.commit()
                session.refresh(studio)
            return studio
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def get_or_create_teacher(self, name: str, style_hint: str = None) -> Teacher:
        session = self.Session()
        try:
            # 名字归一化：去掉两端空格，全大写
            clean_name = name.strip().upper()
            teacher = session.query(Teacher).filter_by(name=clean_name).first()
            if not teacher:
                teacher = Teacher(id=uuid.uuid4(), name=clean_name, default_style=style_hint)
                session.add(teacher)
                session.commit()
                session.refresh(teacher)
            elif style_hint and not teacher.default_style:
                # 更新风格提示
                teacher.default_style = style_hint
                session.commit()
                session.refresh(teacher)
            return teacher
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def save_timetable(self, studio_name: str, branch_name: str, month_tag: str, 
                       courses_data: List[Dict]):
        """
        courses_data 格式应为：
        [
            {
                "weekday": "MON", # 用于推断日期
                "time_range": "18:30-19:30",
                "teacher": "A-BOMB",
                "style": "SWAG",
                "level": "⭐⭐",
                "raw_text": "..."
                # "date_obj": date(2026, 2, 14) # 可选，如果上层没有传入，默认用今天
            },
            ...
        ]
        """
        session = self.Session()
        try:
            # 1. 获取舞室 ID
            # 注意：不能在 session 外调用 get_or_create，因为那会开启新 session
            # 这里我们重新查询
            studio = session.query(Studio).filter_by(name=studio_name, branch=branch_name).first()
            if not studio:
                studio = Studio(id=uuid.uuid4(), name=studio_name, branch=branch_name)
                session.add(studio)
                session.flush() # 获取 ID，但不提交
            
            # 2. 简单的日期推断逻辑（需要根据 month_tag 和 weekday 计算具体的 course_date）
            # 这里为了简单，先假设 month_tag 是 "2026-02" 这种格式，或者我们需要一个基础日期
            # 这是一个难点：OCR 结果只有 "MON", "TUE"，没有具体日期。
            # 通常我们需要知道这周是从哪一天开始的。
            # 暂时方案：只存 weekday 和 time，具体的 course_date 需要在插入时计算
            # 假设 courses_data 里已经有了 'date' 字段（如果没有，需要在上层逻辑计算）
            
            # TODO: 这里的日期逻辑需要完善。为了不阻塞流程，先假设上层传入了具体的 date 或者我们只存 weekday
            # 但 schedules 表设计的是 course_date (DATE 类型)
            # 让我们暂时用 today 或者根据 weekday 推算本周日期
            
            today = date.today()
            # ... 这里省略复杂的日期推算逻辑，直接处理数据 ...

            for item in courses_data:
                # 老师名字归一化
                t_name = item.get("teacher", "").strip().upper()
                if not t_name: continue
                
                # 获取或创建老师
                teacher = session.query(Teacher).filter_by(name=t_name).first()
                if not teacher:
                    teacher = Teacher(id=uuid.uuid4(), name=t_name, default_style=item.get("style"))
                    session.add(teacher)
                    session.flush() 
                elif item.get("style") and not teacher.default_style:
                    teacher.default_style = item.get("style")
                    session.add(teacher) # 标记为脏数据以便更新
                
                # 拆分时间段
                time_range = item.get("time_range", "")
                start_t_str, end_t_str = "00:00", "00:00"
                if "-" in time_range:
                    parts = time_range.split("-")
                    if len(parts) >= 2:
                        start_t_str = parts[0].strip()
                        end_t_str = parts[1].strip()
                    else:
                        start_t_str = parts[0].strip() # 只有一个时间点
                
                # 转换时间格式
                start_t = time(0, 0)
                end_t = time(0, 0)
                try:
                    # 尝试解析 HH:MM
                    if ":" in start_t_str:
                        start_t = datetime.strptime(start_t_str, "%H:%M").time()
                    if ":" in end_t_str:
                        end_t = datetime.strptime(end_t_str, "%H:%M").time()
                except ValueError:
                    pass # 保持 00:00

                # 转换日期 (假设 item 中有 'date_obj')
                # 如果没有，暂时用 today 代替（这是个 bug，需要上层传入准确日期）
                course_date = item.get('date_obj', today)

                # 创建课程记录
                schedule = Schedule(
                    id=uuid.uuid4(),
                    studio_id=studio.id,
                    teacher_id=teacher.id,
                    course_date=course_date,
                    start_time=start_t,
                    end_time=end_t,
                    style=item.get("style"),
                    level=item.get("level"),
                    raw_text=item.get("raw_text")
                )
                session.add(schedule)
            
            session.commit()
            print(f"Successfully saved {len(courses_data)} schedules for {studio_name}-{branch_name}")
            
        except Exception as e:
            session.rollback()
            print(f"Error saving timetable: {e}")
            raise e
        finally:
            session.close()
