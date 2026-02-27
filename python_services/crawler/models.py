from sqlalchemy import Column, String, Date, ForeignKey, Text, UniqueConstraint, Time, func
from sqlalchemy.dialects.postgresql import UUID
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
