from typing import Dict, List, Any
try:
    from .rule_engine import RuleEngine
    from .entity_resolver import EntityResolver
    from .confidence_scorer import ConfidenceScorer
    from .llm_service import LLMService
    from .models import AuditTask
except ImportError:
    from rule_engine import RuleEngine
    from entity_resolver import EntityResolver
    from confidence_scorer import ConfidenceScorer
    from llm_service import LLMService
    from models import AuditTask

class TemplateParser:
    def __init__(self, rule_engine: RuleEngine, entity_resolver: EntityResolver, confidence_scorer: ConfidenceScorer, session: Any = None):
        self.rules = rule_engine
        self.resolver = entity_resolver
        self.scorer = confidence_scorer
        self.llm = LLMService()
        self.session = session

    def parse_cell(self, raw_lines: List[str], layout_config: Dict = None) -> Dict:
        # ... (keep existing logic up to confidence calc)
        # 1. 预清洗
        clean_lines = [self.rules.clean_text(line) for line in raw_lines if line.strip()]
        full_text = " ".join(clean_lines)
        
        # 2. 提取难度 (Level)
        level = 0
        for line in raw_lines:
            lvl = self.rules.parse_difficulty(line)
            if lvl > level:
                level = lvl
        
        # 3. 实体识别 & 字段映射
        found_teacher = None
        teacher_score = 0.0
        found_course = None
        course_score = 0.0
        found_style = None

        remaining_lines = []
        for line in clean_lines:
            c_name, c_score = self.resolver.resolve_course(line)
            if c_score > 0.8:
                found_course = c_name
                course_score = c_score
                found_style = self.rules.map_style(c_name)
                continue
            
            t_name, t_score = self.resolver.resolve_teacher(line)
            if t_score > 0.8:
                found_teacher = t_name
                teacher_score = t_score
                continue
                
            style = self.rules.map_style(line)
            if style != "OTHER":
                found_style = style
                found_course = line
                course_score = 0.6
                continue
                
            remaining_lines.append(line)
            
        if remaining_lines:
            if not found_teacher:
                found_teacher = " ".join(remaining_lines)
                teacher_score = 0.4
            elif not found_course:
                found_course = " ".join(remaining_lines)
                course_score = 0.4

        # 4. 计算置信度
        ocr_avg = 0.9 
        eval_result = self.scorer.evaluate_cell({
            "ocr_confidence": ocr_avg,
            "teacher_match_score": teacher_score,
            "course_match_score": course_score,
            "time_range": True,
            "weekday": True
        })
        
        confidence = eval_result["score"]
        ai_suggestion = None
        
        # 5. LLM Intervention (0.5 <= confidence < 0.85)
        if 0.5 <= confidence < 0.85:
            print(f"Low confidence ({confidence}), calling LLM for: {full_text}")
            llm_result = self.llm.parse_course_info(full_text)
            if llm_result:
                # Update fields if LLM returns valid data
                if llm_result.get("course"): found_course = llm_result["course"]
                if llm_result.get("teacher"): found_teacher = llm_result["teacher"]
                if llm_result.get("style"): found_style = llm_result["style"]
                if llm_result.get("level"): level = llm_result["level"]
                
                ai_suggestion = llm_result
                # Boost confidence slightly after LLM fix
                confidence = min(confidence + 0.1, 0.9)

        # 6. Create Audit Task if still low confidence (< 0.85)
        if confidence < 0.85 and self.session:
            self._create_audit_task(full_text, {
                "course": found_course,
                "teacher": found_teacher,
                "style": found_style,
                "level": level
            }, confidence, ai_suggestion)

        return {
            "course": found_course or "",
            "teacher": found_teacher or "",
            "style": found_style or "OTHER",
            "level": level,
            "raw_text": full_text,
            "confidence": confidence,
            "needs_review": confidence < 0.85
        }

    def _create_audit_task(self, raw_text, parsed_data, confidence, ai_suggestion):
        try:
            task = AuditTask(
                source_type="crawler", # or manual_upload
                source_id=uuid.uuid4(), # Placeholder, should link to actual source
                task_type="entity_mapping",
                original_data={**parsed_data, "raw_text": raw_text},
                confidence_score=confidence,
                ai_suggestion=ai_suggestion,
                status="pending"
            )
            self.session.add(task)
            self.session.commit()
        except Exception as e:
            print(f"Failed to create audit task: {e}")
            self.session.rollback()

