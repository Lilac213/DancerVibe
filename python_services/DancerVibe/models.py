from sqlalchemy import Column, Integer, String, Date, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()

class Studio(Base):
    __tablename__ = 'studios'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)  # 舞室品牌，如 Phoenix
    branch = Column(String(100), nullable=False)  # 分店，如 世纪大道
    
    # 唯一约束：同一个品牌的分店名不能重复
    __table_args__ = (UniqueConstraint('name', 'branch', name='uix_studio_branch'),)
    
    courses = relationship("Course", back_populates="studio")

class Teacher(Base):
    __tablename__ = 'teachers'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False, unique=True)  # 老师名字，全局唯一
    default_style = Column(String(100))  # 默认风格，可为空
    
    courses = relationship("Course", back_populates="teacher")

class Course(Base):
    __tablename__ = 'courses'
    
    id = Column(Integer, primary_key=True)
    studio_id = Column(Integer, ForeignKey('studios.id'), nullable=False)
    teacher_id = Column(Integer, ForeignKey('teachers.id'), nullable=False)
    
    month_tag = Column(String(50)) # 原始月份标签，如 "二月常规"
    weekday = Column(String(10))   # MON, TUE...
    start_time = Column(String(20)) # 18:30
    end_time = Column(String(20))   # 19:30
    
    style = Column(String(100))    # 本节课风格
    level = Column(String(50))     # 星级/难度
    
    raw_text = Column(Text)        # OCR 原始文本备份
    
    studio = relationship("Studio", back_populates="courses")
    teacher = relationship("Teacher", back_populates="courses")

    # 索引：常用查询字段
    # __table_args__ = (Index('idx_course_time', 'weekday', 'start_time'),)
