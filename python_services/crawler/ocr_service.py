import json
import logging
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from datetime import datetime, time
import re
import numpy as np

try:
    from .models import (
        OCRTask, CrawlerTemplateV2, CrawlerTemplateConfig, 
        ScheduleRaw, ScheduleStructured, CodeDictionary
    )
    from .extract_phoenix_timetable import run_ocr, build_ocr
except ImportError:
    from models import (
        OCRTask, CrawlerTemplateV2, CrawlerTemplateConfig, 
        ScheduleRaw, ScheduleStructured, CodeDictionary
    )
    from extract_phoenix_timetable import run_ocr, build_ocr

# Initialize OCR engine once
ocr_engine = build_ocr()
logger = logging.getLogger(__name__)

class OCRService:
    def __init__(self, db: Session):
        self.db = db

    def create_task(self, image_url: str, template_id: Optional[str] = None) -> OCRTask:
        """Create a new OCR task."""
        task = OCRTask(
            image_url=image_url,
            template_id=template_id,
            status='pending'
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        return task

    def process_task(self, task_id: str):
        """Execute the OCR task: OCR -> Template Match -> Parse -> Save."""
        task = self.db.query(OCRTask).filter(OCRTask.id == task_id).first()
        if not task:
            logger.error(f"Task {task_id} not found")
            return

        try:
            task.status = 'processing'
            self.db.commit()

            # 1. Run OCR
            image_path = task.image_url # Placeholder: ensure this is a local path
            ocr_results = run_ocr(ocr_engine, image_path)
            
            # Save Raw Results
            raw_text = "\n".join([item['text'] for item in ocr_results])
            raw_json = ocr_results
            
            schedule_raw = ScheduleRaw(
                task_id=task.id,
                raw_text=raw_text,
                raw_json=raw_json
            )
            self.db.add(schedule_raw)
            self.db.commit()

            # 2. Match Template (if not provided)
            template = None
            config = None
            
            if task.template_id:
                template = self.db.query(CrawlerTemplateV2).filter(CrawlerTemplateV2.id == task.template_id).first()
            
            if not template:
                template = self._match_template(raw_text)
                if template:
                    task.template_id = template.id
            
            if template:
                # Fetch latest config
                config_record = self.db.query(CrawlerTemplateConfig)\
                    .filter(CrawlerTemplateConfig.template_id == template.id)\
                    .order_by(CrawlerTemplateConfig.created_at.desc())\
                    .first()
                if config_record:
                    config = config_record.config_json

            # 3. Parse Data
            if config:
                structured_data = self._parse_with_config(ocr_results, config)
                
                # 4. Save Structured Data
                for item in structured_data:
                    schedule = ScheduleStructured(
                        task_id=task.id,
                        weekday=item.get('weekday'),
                        start_time=item.get('start_time'),
                        end_time=item.get('end_time'),
                        course=item.get('course'),
                        style=item.get('style'),
                        teacher=item.get('teacher'),
                        difficulty=item.get('difficulty'),
                        confidence_score=item.get('confidence_score', 0.0),
                        review_status='pending' if item.get('confidence_score', 1.0) < 0.8 else 'approved'
                    )
                    self.db.add(schedule)
                
                task.status = 'completed'
                # Simple average confidence for the task
                if structured_data:
                    avg_conf = sum(s.get('confidence_score', 0) for s in structured_data) / len(structured_data)
                    task.confidence_score = avg_conf
                else:
                    task.confidence_score = 0.0
            else:
                task.status = 'failed'
                task.confidence_score = 0.0
                logger.warning(f"No matching template found for task {task_id}")

            self.db.commit()

        except Exception as e:
            logger.error(f"Error processing task {task_id}: {str(e)}")
            task.status = 'failed'
            self.db.commit()

    def _match_template(self, raw_text: str) -> Optional[CrawlerTemplateV2]:
        """Match a template based on header keywords."""
        templates = self.db.query(CrawlerTemplateV2).filter(CrawlerTemplateV2.status == 'active').all()
        
        best_match = None
        max_score = 0
        
        for template in templates:
            # Get config
            config_record = self.db.query(CrawlerTemplateConfig)\
                .filter(CrawlerTemplateConfig.template_id == template.id)\
                .order_by(CrawlerTemplateConfig.created_at.desc())\
                .first()
            
            if not config_record:
                continue
                
            config = config_record.config_json
            page_structure = config.get('page_structure', {})
            header_keywords = page_structure.get('header_keywords', [])
            
            if not header_keywords:
                continue
                
            score = 0
            for keyword in header_keywords:
                if keyword in raw_text:
                    score += 1
            
            if score > max_score and score > 0:
                max_score = score
                best_match = template
                
        return best_match

    def _parse_with_config(self, ocr_results: List[Dict], config: Dict[str, Any]) -> List[Dict]:
        """
        Parse OCR results using the provided JSON config.
        Implements a Grid-based parsing strategy.
        """
        grid_structure = config.get('grid_structure', {})
        cell_structure = config.get('cell_structure', {})
        mapping_rules = config.get('mapping_rules', {})
        
        weekday_mapping = grid_structure.get('weekday_mapping', {})
        time_pattern = grid_structure.get('time_pattern', r"\d{1,2}:\d{2}")
        
        # 1. Identify Weekday Columns (Headers)
        weekday_headers = []
        for item in ocr_results:
            text = item['text']
            # Simple check if text matches any weekday key
            matched_day = None
            for day_key, day_val in weekday_mapping.items():
                if day_key in text: # naive check
                    matched_day = day_val
                    break
            if matched_day:
                weekday_headers.append({
                    'day': matched_day,
                    'x_center': item['x_center'],
                    'item': item
                })
        
        # Sort headers by x position
        weekday_headers.sort(key=lambda x: x['x_center'])
        
        # 2. Identify Time Rows (Headers)
        time_headers = []
        for item in ocr_results:
            text = item['text']
            if re.search(time_pattern, text):
                time_headers.append({
                    'time_text': text,
                    'y_center': item['y_center'],
                    'item': item
                })
        
        # Sort rows by y position
        time_headers.sort(key=lambda x: x['y_center'])
        
        if not weekday_headers or not time_headers:
            logger.warning("Could not find weekday or time headers")
            return []

        # 3. Define Grid Boundaries
        # Columns are defined by x ranges. 
        # Simple approach: mid-points between headers
        col_boundaries = []
        for i in range(len(weekday_headers) - 1):
            mid = (weekday_headers[i]['x_center'] + weekday_headers[i+1]['x_center']) / 2
            col_boundaries.append(mid)
            
        # Rows are defined by y ranges.
        row_boundaries = []
        for i in range(len(time_headers) - 1):
            mid = (time_headers[i]['y_center'] + time_headers[i+1]['y_center']) / 2
            row_boundaries.append(mid)
            
        # 4. Assign Items to Cells
        parsed_items = []
        
        # Iterate through time slots (rows)
        for r_idx, time_header in enumerate(time_headers):
            # Parse start/end time
            time_text = time_header['time_text']
            times = re.findall(r"(\d{1,2}:\d{2})", time_text)
            start_time_obj = None
            end_time_obj = None
            if len(times) >= 1:
                try:
                    start_time_obj = datetime.strptime(times[0], "%H:%M").time()
                except: pass
            if len(times) >= 2:
                try:
                    end_time_obj = datetime.strptime(times[1], "%H:%M").time()
                except: pass
            elif start_time_obj:
                # Assuming 1.5 hour duration if end time missing? Or just leave None
                pass

            y_min = 0 if r_idx == 0 else row_boundaries[r_idx-1]
            y_max = 99999 if r_idx == len(time_headers)-1 else row_boundaries[r_idx]
            
            # Iterate through weekdays (cols)
            for c_idx, day_header in enumerate(weekday_headers):
                x_min = 0 if c_idx == 0 else col_boundaries[c_idx-1]
                x_max = 99999 if c_idx == len(weekday_headers)-1 else col_boundaries[c_idx]
                
                # Find items in this cell
                cell_items = []
                for item in ocr_results:
                    # Check if item center is within bounds
                    # Also ignore the headers themselves
                    if item == time_header['item'] or item == day_header['item']:
                        continue
                        
                    if x_min <= item['x_center'] < x_max and y_min <= item['y_center'] < y_max:
                        cell_items.append(item)
                
                if not cell_items:
                    continue
                    
                # Sort by Y (top to bottom)
                cell_items.sort(key=lambda x: x['y_center'])
                
                # 5. Extract Content from Cell Items
                # Strategy: Concatenate all text and try to parse
                # Or use cell_structure rules (fields_order)
                
                # Simplified: First is Course, Last is Teacher (if 2 items)
                # If 3 items: Time, Course, Teacher?
                # Let's try to be smart based on content
                
                course_text = ""
                teacher_text = ""
                style_text = ""
                difficulty = 0
                
                full_text = "\n".join([it['text'] for it in cell_items])
                
                # Heuristic: Teacher often has "老师" or is a name (hard to detect without dictionary)
                # Course often is Uppercase English
                
                # Check for difficulty dots
                # Usually "." or "●"
                dot_count = full_text.count("●") + full_text.count("•")
                if dot_count > 0:
                    difficulty = dot_count
                
                # Simple extraction based on line count (fallback)
                lines = [it['text'] for it in cell_items]
                
                # Remove time strings from lines if they duplicate the row header
                lines = [l for l in lines if not re.search(r"\d{1,2}:\d{2}", l)]
                
                if len(lines) == 1:
                    course_text = lines[0]
                elif len(lines) >= 2:
                    # Assuming Course is first, Teacher is last
                    course_text = lines[0]
                    teacher_text = lines[-1]
                
                # Apply Mapping
                style_map = mapping_rules.get('course_to_style_mapping', {})
                # Try to find course in mapping
                # Clean course text first
                clean_course = course_text.strip().upper()
                
                # Direct match
                if clean_course in style_map:
                    style_text = style_map[clean_course]
                else:
                    # Partial match?
                    for key in style_map:
                        if key in clean_course:
                            style_text = style_map[key]
                            break
                            
                parsed_items.append({
                    "weekday": day_header['day'],
                    "start_time": start_time_obj,
                    "end_time": end_time_obj,
                    "course": course_text,
                    "teacher": teacher_text,
                    "style": style_text,
                    "difficulty": difficulty,
                    "confidence_score": 0.8 # Placeholder confidence
                })
                
        return parsed_items
