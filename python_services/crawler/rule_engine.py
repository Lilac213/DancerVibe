import re
from typing import Dict, Optional, List, Any
from difflib import SequenceMatcher

class RuleEngine:
    def __init__(self):
        # 预定义映射 (后续可从数据库加载)
        self.weekday_mapping = {
            "MON": 1, "TUE": 2, "WED": 3, "THU": 4, "FRI": 5, "SAT": 6, "SUN": 7,
            "周一": 1, "周二": 2, "周三": 3, "周四": 4, "周五": 5, "周六": 6, "周日": 7
        }
        self.difficulty_mapping = {"●": 1, "●●": 2, "●●●": 3, "★": 1, "★★": 2, "★★★": 3}
        
        # 基础风格映射 (建议从数据库加载)
        self.style_mapping = {
            "JAZZ": "JAZZ", "HIPHOP": "HIPHOP", "KPOP": "K-POP", 
            "URBAN": "URBAN", "HEELS": "HEELS", "CHOREOGRAPHY": "CHOREOGRAPHY"
        }

    def parse_weekday(self, text: str) -> Optional[int]:
        text_upper = text.upper()
        for key, val in self.weekday_mapping.items():
            if key in text_upper:
                return val
        return None

    def parse_time_range(self, text: str) -> Optional[str]:
        # 匹配 HH:MM-HH:MM
        match = re.search(r"(\d{1,2}:\d{2})\s*[-~]\s*(\d{1,2}:\d{2})", text)
        if match:
            return f"{match.group(1)}-{match.group(2)}"
        return None

    def parse_difficulty(self, text: str) -> int:
        # 统计 ● 或 ★ 的数量
        dots = text.count("●") + text.count("★")
        if dots > 0:
            return min(dots, 5) # 上限5
        return 0

    def map_style(self, course_name: str, db_styles: Dict[str, str] = None) -> str:
        # 优先使用数据库字典
        mapping = db_styles if db_styles else self.style_mapping
        course_upper = course_name.upper()
        
        # 1. 精确匹配
        if course_upper in mapping:
            return mapping[course_upper]
            
        # 2. 包含匹配
        for key, style in mapping.items():
            if key in course_upper:
                return style
                
        return "OTHER"

    def clean_text(self, text: str) -> str:
        # 去除特殊字符，保留中文、英文、数字、冒号、连字符
        return re.sub(r'[^\w\s:\-\u4e00-\u9fa5]', '', text).strip()
