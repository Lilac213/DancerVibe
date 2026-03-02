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

class CrawlerTemplate(Base):
    __tablename__ = 'crawler_templates'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    studio = Column(String(100), nullable=False)
    source_type = Column(String(50), nullable=False) # image, wechat_article, etc.
    version = Column(String(20), default='v1')
    
    status = Column(String(20), default='active') # active, inactive
    auto_field_detection = Column(Boolean, default=False)
    
    # JSON field for storing basic config like header_keywords to allow quick filtering
    layout_config = Column(JSONB, default={}) 
    
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())
    
    rules = relationship("CrawlerTemplateRule", back_populates="template", cascade="all, delete-orphan")

class CrawlerTemplateRule(Base):
    __tablename__ = 'crawler_template_rules'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_id = Column(UUID(as_uuid=True), ForeignKey('crawler_templates.id'), nullable=False)
    
    rule_type = Column(String(50), nullable=False) # header_rule, layout_rule, cell_rule, field_rule
    rule_content = Column(JSONB, nullable=False)
    
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())
    
    template = relationship("CrawlerTemplate", back_populates="rules")

# --- V2 Models (User Requested) ---

class CrawlerTemplateV2(Base):
    __tablename__ = 'crawler_templates_v2'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_code = Column(String(100), unique=True, nullable=False)
    template_name = Column(String(200), nullable=False)
    studio = Column(String(100))
    source_type = Column(String(50))
    layout_type = Column(String(50))
    version = Column(String(20))
    status = Column(String(20), default='active')
    
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())
    
    # Relationship to Config (One-to-One or One-to-Many depending on history, here assumes One-to-Many but usually we fetch latest)
    configs = relationship("CrawlerTemplateConfig", back_populates="template", cascade="all, delete-orphan")
    ocr_tasks = relationship("OCRTask", back_populates="template")

class CrawlerTemplateConfig(Base):
    __tablename__ = 'crawler_template_configs'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_id = Column(UUID(as_uuid=True), ForeignKey('crawler_templates_v2.id'), nullable=False)
    config_json = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), default=func.now())
    
    template = relationship("CrawlerTemplateV2", back_populates="configs")

class OCRTask(Base):
    __tablename__ = 'ocr_tasks'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    image_url = Column(String(500))
    template_id = Column(UUID(as_uuid=True), ForeignKey('crawler_templates_v2.id'), nullable=True)
    status = Column(String(50), default='pending')
    confidence_score = Column(Float)
    created_at = Column(DateTime(timezone=True), default=func.now())
    
    template = relationship("CrawlerTemplateV2", back_populates="ocr_tasks")
    raw_results = relationship("ScheduleRaw", back_populates="task", cascade="all, delete-orphan")
    structured_results = relationship("ScheduleStructured", back_populates="task", cascade="all, delete-orphan")

class ScheduleRaw(Base):
    __tablename__ = 'schedule_raw'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(UUID(as_uuid=True), ForeignKey('ocr_tasks.id'), nullable=False)
    raw_text = Column(Text)
    raw_json = Column(JSONB)
    created_at = Column(DateTime(timezone=True), default=func.now())
    
    task = relationship("OCRTask", back_populates="raw_results")

class ScheduleStructured(Base):
    __tablename__ = 'schedule_structured'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(UUID(as_uuid=True), ForeignKey('ocr_tasks.id'), nullable=False)
    
    weekday = Column(Integer)
    start_time = Column(Time)
    end_time = Column(Time)
    course = Column(String(200))
    style = Column(String(100))
    teacher = Column(String(100))
    difficulty = Column(Integer)
    
    confidence_score = Column(Float)
    review_status = Column(String(50), default='pending')
    created_at = Column(DateTime(timezone=True), default=func.now())
    
    task = relationship("OCRTask", back_populates="structured_results")
    review_logs = relationship("ReviewLog", back_populates="schedule", cascade="all, delete-orphan")

class CodeDictionary(Base):
    __tablename__ = 'code_dictionary'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code_type = Column(String(50), nullable=False)
    code_key = Column(String(200), nullable=False)
    code_value = Column(String(200), nullable=False)
    status = Column(String(20), default='active')
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

class ReviewLog(Base):
    __tablename__ = 'review_logs'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    schedule_id = Column(UUID(as_uuid=True), ForeignKey('schedule_structured.id'), nullable=False)
    field_name = Column(String(100))
    old_value = Column(String(200))
    new_value = Column(String(200))
    reviewer = Column(String(100))
    created_at = Column(DateTime(timezone=True), default=func.now())
    
    schedule = relationship("ScheduleStructured", back_populates="review_logs")
