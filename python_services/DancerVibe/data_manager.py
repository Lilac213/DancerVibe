from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base, Studio, Teacher, Course
from typing import Dict, List, Optional
import os

# 优先读取环境变量中的 DATABASE_URL (Railway 会自动提供)
# 如果是 postgres:// 开头（Heroku/Railway 旧格式），SQLAlchemy 需要改为 postgresql://
database_url = os.environ.get("DATABASE_URL", "sqlite:///./timetable.db")
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

class DataManager:
    def __init__(self, db_url=None):
        # 允许外部传入 db_url，否则使用全局配置
        self.engine = create_engine(db_url or database_url, echo=False)
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        
    def get_or_create_studio(self, name: str, branch: str) -> Studio:
        session = self.Session()
        try:
            studio = session.query(Studio).filter_by(name=name, branch=branch).first()
            if not studio:
                studio = Studio(name=name, branch=branch)
                session.add(studio)
                session.commit()
                session.refresh(studio)
            return studio
        finally:
            session.close()

    def get_or_create_teacher(self, name: str, style_hint: str = None) -> Teacher:
        session = self.Session()
        try:
            # 名字归一化：去掉两端空格，全大写
            clean_name = name.strip().upper()
            teacher = session.query(Teacher).filter_by(name=clean_name).first()
            if not teacher:
                teacher = Teacher(name=clean_name, default_style=style_hint)
                session.add(teacher)
                session.commit()
                session.refresh(teacher)
            elif style_hint and not teacher.default_style:
                # 更新风格提示
                teacher.default_style = style_hint
                session.commit()
            return teacher
        finally:
            session.close()

    def save_timetable(self, studio_name: str, branch_name: str, month_tag: str, 
                       courses_data: List[Dict]):
        """
        courses_data 格式应为：
        [
            {
                "weekday": "MON",
                "time_range": "18:30-19:30",
                "teacher": "A-BOMB",
                "style": "SWAG",
                "level": "⭐⭐",
                "raw_text": "..."
            },
            ...
        ]
        """
        session = self.Session()
        try:
            # 1. 获取舞室 ID
            studio = session.query(Studio).filter_by(name=studio_name, branch=branch_name).first()
            if not studio:
                # 必须先创建好舞室
                studio = Studio(name=studio_name, branch=branch_name)
                session.add(studio)
                session.flush()

            # 2. 批量处理课程
            for item in courses_data:
                # 老师名字归一化
                t_name = item.get("teacher", "").strip().upper()
                if not t_name: continue
                
                # 获取或创建老师
                teacher = session.query(Teacher).filter_by(name=t_name).first()
                if not teacher:
                    teacher = Teacher(name=t_name, default_style=item.get("style"))
                    session.add(teacher)
                    session.flush() # 获取 ID
                
                # 拆分时间段
                time_range = item.get("time_range", "")
                start_t, end_t = "", ""
                if "-" in time_range:
                    parts = time_range.split("-")
                    if len(parts) >= 2:
                        start_t, end_t = parts[0].strip(), parts[1].strip()

                # 创建课程记录
                course = Course(
                    studio_id=studio.id,
                    teacher_id=teacher.id,
                    month_tag=month_tag,
                    weekday=item.get("weekday"),
                    start_time=start_t,
                    end_time=end_t,
                    style=item.get("style"),
                    level=item.get("level"),
                    raw_text=item.get("raw_text")
                )
                session.add(course)
            
            session.commit()
            print(f"Successfully saved {len(courses_data)} courses for {studio_name}-{branch_name}")
            
        except Exception as e:
            session.rollback()
            print(f"Error saving timetable: {e}")
            raise e
        finally:
            session.close()

if __name__ == "__main__":
    # 测试代码
    dm = DataManager()
    s = dm.get_or_create_studio("Phoenix", "世纪大道")
    print(f"Studio ID: {s.id}")
    
    t = dm.get_or_create_teacher("A-BOMB", "SWAG")
    print(f"Teacher ID: {t.id}")
