from sqlalchemy import Column, String, Date, ForeignKey, Text, UniqueConstraint, Time, func, Integer, Boolean, DateTime, Float
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, declarative_base
import uuid

Base = declarative_base()

class Studio(Base):
    __tablename__ = 'studios'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    branch = Column(String(100), nullable=False)
    logo_url = Column(String(255))
    address = Column(String(255))
    
    __table_args__ = (UniqueConstraint('name', 'branch', name='studios_name_branch_key'),)
    
    schedules = relationship("Schedule", back_populates="studio")

class Teacher(Base):
    __tablename__ = 'teachers'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False, unique=True)
    avatar_url = Column(String(255))
    bio = Column(Text)
    default_style = Column(String(100))
    
    schedules = relationship("Schedule", back_populates="teacher")

class Schedule(Base):
    __tablename__ = 'schedules'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    studio_id = Column(UUID(as_uuid=True), ForeignKey('studios.id'), nullable=False)
    teacher_id = Column(UUID(as_uuid=True), ForeignKey('teachers.id'), nullable=True)
    
    course_date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    
    style = Column(String(100))
    level = Column(String(50))
    raw_text = Column(Text)
    
    studio = relationship("Studio", back_populates="schedules")
    teacher = relationship("Teacher", back_populates="schedules")

# Dictionary Models
class SysDict(Base):
    __tablename__ = 'sys_dicts'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category = Column(String(50), nullable=False)
    key = Column(String(100), nullable=False)
    value = Column(JSONB, nullable=False)
    
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    
    created_time = Column(DateTime(timezone=True), default=func.now())
    created_person = Column(String(100))
    update_time = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())
    update_person = Column(String(100))
    
    __table_args__ = (UniqueConstraint('category', 'key', name='uq_sys_dicts_category_key'),)

class AuditTask(Base):
    __tablename__ = 'audit_tasks'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_type = Column(String(50), nullable=False)
    source_id = Column(UUID(as_uuid=True), nullable=False)
    task_type = Column(String(50), nullable=False)
    
    status = Column(String(20), default='pending')
    priority = Column(String(20), default='medium')
    
    original_data = Column(JSONB)
    fixed_data = Column(JSONB)
    
    confidence_score = Column(Float)
    ai_suggestion = Column(JSONB)
    
    assigned_to = Column(String(100))
    created_at = Column(DateTime(timezone=True), default=func.now())
    resolved_at = Column(DateTime(timezone=True))
    resolved_by = Column(String(100))
