from typing import Dict, List, Any
try:
    from .rule_engine import RuleEngine
    from .entity_resolver import EntityResolver
    from .confidence_scorer import ConfidenceScorer
except ImportError:
    from rule_engine import RuleEngine
    from entity_resolver import EntityResolver
    from confidence_scorer import ConfidenceScorer

class TemplateParser:
    def __init__(self, rule_engine: RuleEngine, entity_resolver: EntityResolver, confidence_scorer: ConfidenceScorer):
        self.rules = rule_engine
        self.resolver = entity_resolver
        self.scorer = confidence_scorer

    def parse_cell(self, raw_lines: List[str], layout_config: Dict = None) -> Dict:
        """
        根据模板配置解析单元格内容
        layout_config: {
            "structure": "vertical",  # vertical (stack) or horizontal (inline)
            "fields_order": ["style", "teacher"], # 顺序
        }
        """
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

        # 尝试每一行进行实体匹配
        remaining_lines = []
        for line in clean_lines:
            # 尝试匹配课程/风格
            # 优先查库
            c_name, c_score = self.resolver.resolve_course(line)
            if c_score > 0.8:
                found_course = c_name
                course_score = c_score
                # TODO: Get style from course
                found_style = self.rules.map_style(c_name)
                continue
            
            # 尝试匹配老师
            t_name, t_score = self.resolver.resolve_teacher(line)
            if t_score > 0.8:
                found_teacher = t_name
                teacher_score = t_score
                continue
                
            # 规则兜底：如果没匹配到，看是否在预定义 Style 列表中
            style = self.rules.map_style(line)
            if style != "OTHER":
                found_style = style
                found_course = line
                course_score = 0.6 # 规则匹配分低一点
                continue
                
            remaining_lines.append(line)
            
        # 如果还有剩余文本，且缺少字段，尝试填空
        if remaining_lines:
            if not found_teacher:
                # 假设剩下的可能是老师
                found_teacher = " ".join(remaining_lines)
                teacher_score = 0.4 # 盲猜分
            elif not found_course:
                found_course = " ".join(remaining_lines)
                course_score = 0.4

        # 4. 计算置信度
        # OCR 分数暂时假设平均 0.9 (需从上层传入)
        ocr_avg = 0.9 
        eval_result = self.scorer.evaluate_cell({
            "ocr_confidence": ocr_avg,
            "teacher_match_score": teacher_score,
            "course_match_score": course_score,
            "time_range": True, # 上下文提供
            "weekday": True # 上下文提供
        })

        return {
            "course": found_course or "",
            "teacher": found_teacher or "",
            "style": found_style or "OTHER",
            "level": level,
            "raw_text": full_text,
            "confidence": eval_result["score"],
            "needs_review": eval_result["needs_review"]
        }
