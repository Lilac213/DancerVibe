from typing import Dict, List, Optional
import numpy as np

class ConfidenceScorer:
    """
    置信度计算模型：
    Final Score = 0.5 * OCR_Score + 0.3 * Entity_Score + 0.2 * Rule_Score
    """
    
    def calculate(self, 
                  ocr_score: float, 
                  entity_match_score: float, 
                  is_time_valid: bool, 
                  is_weekday_valid: bool) -> float:
        
        # 规则分：如果时间格式对、星期对，得满分
        rule_score = 0.0
        if is_time_valid: rule_score += 0.5
        if is_weekday_valid: rule_score += 0.5
        
        final_score = (0.5 * ocr_score) + (0.3 * entity_match_score) + (0.2 * rule_score)
        return round(final_score, 3)

    def evaluate_cell(self, cell_data: Dict) -> Dict:
        """
        评估单个单元格的解析质量
        """
        ocr_conf = cell_data.get("ocr_confidence", 0.0)
        
        # 实体匹配分
        teacher_match = cell_data.get("teacher_match_score", 0.0)
        course_match = cell_data.get("course_match_score", 0.0)
        entity_score = (teacher_match + course_match) / 2.0 if (teacher_match or course_match) else 0.5
        
        # 规则分
        time_valid = bool(cell_data.get("time_range"))
        weekday_valid = bool(cell_data.get("weekday"))
        
        score = self.calculate(ocr_conf, entity_score, time_valid, weekday_valid)
        
        return {
            "score": score,
            "needs_review": score < 0.85,
            "needs_llm": 0.5 <= score < 0.85
        }
