from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import json
from datetime import datetime

try:
    from .data_manager import DataManager
    from .models import AuditTask
except ImportError:
    from data_manager import DataManager
    from models import AuditTask

router = APIRouter()

def get_db():
    db = DataManager().get_session()
    try:
        yield db
    finally:
        db.close()

def require_admin(request: Request):
    admin_token = os.environ.get("ADMIN_TOKEN", "")
    if admin_token and request.headers.get("x-admin-token") != admin_token:
        raise HTTPException(status_code=403, detail="Forbidden")

@router.get("/tasks", dependencies=[Depends(require_admin)])
def list_tasks(status: str = "pending", limit: int = 50, db: Session = Depends(get_db)):
    tasks = db.query(AuditTask).filter(AuditTask.status == status)\
        .order_by(AuditTask.confidence_score.asc())\
        .limit(limit).all()
    return tasks

@router.get("/tasks/{task_id}", dependencies=[Depends(require_admin)])
def get_task(task_id: str, db: Session = Depends(get_db)):
    task = db.query(AuditTask).filter(AuditTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@router.post("/tasks/{task_id}/resolve", dependencies=[Depends(require_admin)])
def resolve_task(task_id: str, fixed_data: dict, db: Session = Depends(get_db)):
    task = db.query(AuditTask).filter(AuditTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    task.fixed_data = fixed_data
    task.status = "approved"
    task.resolved_at = datetime.now()
    task.resolved_by = "admin" # TODO: Get actual user
    
    # TODO: Sync back to source (e.g. update Schedule table)
    
    db.commit()
    return {"status": "ok"}
