from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import shutil
import os
import uuid
from datetime import datetime

try:
    from .data_manager import DataManager
    from .ocr_service import OCRService
    from .models import OCRTask
except ImportError:
    from data_manager import DataManager
    from ocr_service import OCRService
    from models import OCRTask

router = APIRouter()

def get_db():
    db = DataManager().get_session()
    try:
        yield db
    finally:
        db.close()

class TaskCreate(BaseModel):
    image_url: Optional[str]
    template_id: Optional[str]

class TaskResponse(BaseModel):
    id: uuid.UUID
    status: str
    image_url: Optional[str]
    template_id: Optional[uuid.UUID]
    confidence_score: Optional[float]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True

@router.get("/tasks", response_model=List[TaskResponse])
def list_tasks(skip: int = 0, limit: int = 50, status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(OCRTask)
    if status:
        query = query.filter(OCRTask.status == status)
    
    tasks = query.order_by(OCRTask.created_at.desc()).offset(skip).limit(limit).all()
    return tasks

@router.post("/tasks", response_model=TaskResponse)
def create_task(
    background_tasks: BackgroundTasks,
    image_url: Optional[str] = None,
    template_id: Optional[str] = None,
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    service = OCRService(db)
    
    # Handle File Upload if provided
    if file:
        # Save to temp/upload dir
        upload_dir = "uploads"
        if not os.path.exists(upload_dir):
            os.makedirs(upload_dir)
        
        file_path = os.path.join(upload_dir, f"{uuid.uuid4()}_{file.filename}")
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        image_url = file_path # Use local path for now
    
    if not image_url:
        raise HTTPException(status_code=400, detail="Either image_url or file must be provided")

    task = service.create_task(image_url, template_id)
    
    # Schedule background processing
    background_tasks.add_task(service.process_task, str(task.id))
    
    return task

@router.get("/tasks/{task_id}", response_model=TaskResponse)
def get_task(task_id: str, db: Session = Depends(get_db)):
    task = db.query(OCRTask).filter(OCRTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@router.get("/tasks/{task_id}/results")
def get_task_results(task_id: str, db: Session = Depends(get_db)):
    task = db.query(OCRTask).filter(OCRTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    return {
        "raw": [r.raw_json for r in task.raw_results],
        "structured": [
            {
                "weekday": s.weekday,
                "start_time": str(s.start_time) if s.start_time else None,
                "end_time": str(s.end_time) if s.end_time else None,
                "course": s.course,
                "teacher": s.teacher,
                "style": s.style,
                "difficulty": s.difficulty,
                "confidence": s.confidence_score
            } for s in task.structured_results
        ]
    }
