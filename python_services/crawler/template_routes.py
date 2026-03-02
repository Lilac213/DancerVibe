from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import uuid
from datetime import datetime

try:
    from .data_manager import DataManager
    from .models import CrawlerTemplateV2, CrawlerTemplateConfig
except ImportError:
    from data_manager import DataManager
    from models import CrawlerTemplateV2, CrawlerTemplateConfig

router = APIRouter()

# --- Dependencies ---
def get_db():
    db = DataManager().get_session()
    try:
        yield db
    finally:
        db.close()

def require_admin(request: Request):
    token = request.headers.get("x-admin-token")
    expected = os.environ.get("ADMIN_TOKEN")
    if expected and token != expected:
        raise HTTPException(status_code=403, detail="Forbidden")

# --- Pydantic Models ---

class TemplateConfig(BaseModel):
    id: Optional[uuid.UUID]
    config_json: Dict[str, Any]
    created_at: Optional[datetime]
    
    class Config:
        orm_mode = True

class TemplateBase(BaseModel):
    template_code: str
    template_name: str
    studio: Optional[str]
    source_type: Optional[str]
    layout_type: Optional[str]
    version: Optional[str]
    status: Optional[str] = "active"

class TemplateCreate(TemplateBase):
    initial_config: Optional[Dict[str, Any]] = None

class TemplateUpdate(BaseModel):
    template_code: Optional[str]
    template_name: Optional[str]
    studio: Optional[str]
    source_type: Optional[str]
    layout_type: Optional[str]
    version: Optional[str]
    status: Optional[str]

class TemplateResponse(TemplateBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    latest_config: Optional[Dict[str, Any]] = None

    class Config:
        orm_mode = True

# --- Routes ---

@router.get("/", response_model=List[TemplateResponse], dependencies=[Depends(require_admin)])
def list_templates(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    # We want to efficiently list templates. 
    # For the list view, we might not need the full config, but let's see.
    templates = db.query(CrawlerTemplateV2).offset(skip).limit(limit).all()
    
    result = []
    for t in templates:
        # Fetch latest config for each template
        latest_config = db.query(CrawlerTemplateConfig)\
            .filter(CrawlerTemplateConfig.template_id == t.id)\
            .order_by(desc(CrawlerTemplateConfig.created_at))\
            .first()
            
        t_dict = TemplateResponse.from_orm(t)
        if latest_config:
            t_dict.latest_config = latest_config.config_json
        result.append(t_dict)
        
    return result

@router.get("/{template_id}", response_model=TemplateResponse, dependencies=[Depends(require_admin)])
def get_template(template_id: str, db: Session = Depends(get_db)):
    template = db.query(CrawlerTemplateV2).filter(CrawlerTemplateV2.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    latest_config = db.query(CrawlerTemplateConfig)\
        .filter(CrawlerTemplateConfig.template_id == template.id)\
        .order_by(desc(CrawlerTemplateConfig.created_at))\
        .first()
        
    t_dict = TemplateResponse.from_orm(template)
    if latest_config:
        t_dict.latest_config = latest_config.config_json
    return t_dict

@router.post("/", response_model=TemplateResponse, dependencies=[Depends(require_admin)])
def create_template(template: TemplateCreate, db: Session = Depends(get_db)):
    # Check if code exists
    existing = db.query(CrawlerTemplateV2).filter(CrawlerTemplateV2.template_code == template.template_code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Template code already exists")
    
    # Create Template
    db_template = CrawlerTemplateV2(
        template_code=template.template_code,
        template_name=template.template_name,
        studio=template.studio,
        source_type=template.source_type,
        layout_type=template.layout_type,
        version=template.version,
        status=template.status
    )
    db.add(db_template)
    db.flush() # get ID
    
    # Create Config if provided
    config_json = template.initial_config or {}
    db_config = CrawlerTemplateConfig(
        template_id=db_template.id,
        config_json=config_json
    )
    db.add(db_config)
    
    db.commit()
    db.refresh(db_template)
    
    t_dict = TemplateResponse.from_orm(db_template)
    t_dict.latest_config = config_json
    return t_dict

@router.put("/{template_id}", response_model=TemplateResponse, dependencies=[Depends(require_admin)])
def update_template(template_id: str, template_update: TemplateUpdate, db: Session = Depends(get_db)):
    db_template = db.query(CrawlerTemplateV2).filter(CrawlerTemplateV2.id == template_id).first()
    if not db_template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    update_data = template_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_template, key, value)
    
    db.commit()
    db.refresh(db_template)
    
    # Fetch latest config to return full object
    latest_config = db.query(CrawlerTemplateConfig)\
        .filter(CrawlerTemplateConfig.template_id == db_template.id)\
        .order_by(desc(CrawlerTemplateConfig.created_at))\
        .first()
        
    t_dict = TemplateResponse.from_orm(db_template)
    if latest_config:
        t_dict.latest_config = latest_config.config_json
    return t_dict

@router.put("/{template_id}/config", dependencies=[Depends(require_admin)])
def update_template_config(template_id: str, config: Dict[str, Any], db: Session = Depends(get_db)):
    # Create a NEW config entry (versioning)
    db_template = db.query(CrawlerTemplateV2).filter(CrawlerTemplateV2.id == template_id).first()
    if not db_template:
        raise HTTPException(status_code=404, detail="Template not found")
        
    new_config = CrawlerTemplateConfig(
        template_id=template_id,
        config_json=config
    )
    db.add(new_config)
    db.commit()
    
    return {"status": "ok", "config_id": str(new_config.id)}

@router.delete("/{template_id}", dependencies=[Depends(require_admin)])
def delete_template(template_id: str, db: Session = Depends(get_db)):
    db_template = db.query(CrawlerTemplateV2).filter(CrawlerTemplateV2.id == template_id).first()
    if not db_template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    db.delete(db_template)
    db.commit()
    return {"status": "deleted"}
