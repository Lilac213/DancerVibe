from typing import Dict, List, Optional, Tuple
from fuzzywuzzy import process, fuzz
from sqlalchemy.orm import Session
try:
    from .models import SysDict
except ImportError:
    from models import SysDict

class EntityResolver:
    def __init__(self, session: Session):
        self.session = session
        self._cache = {
            "teacher": {}, # key -> {id, value}
            "course": {},
            "style": {}
        }
        self._load_cache()

    def _load_cache(self):
        # 预加载所有 active 字典
        items = self.session.query(SysDict).filter_by(is_active=True).all()
        for item in items:
            cat = item.category
            if cat in self._cache:
                self._cache[cat][item.key] = item.value

    def resolve_teacher(self, name: str) -> Tuple[Optional[str], float]:
        """
        返回 (匹配到的老师Key, 置信度)
        """
        if not name:
            return None, 0.0
            
        teachers = list(self._cache["teacher"].keys())
        if not teachers:
            return None, 0.0
            
        # 1. 精确匹配
        if name in self._cache["teacher"]:
            return name, 1.0
            
        # 2. Alias 匹配 (遍历所有 alias)
        for key, val in self._cache["teacher"].items():
            aliases = val.get("alias", "").split(",")
            if name in [a.strip() for a in aliases if a.strip()]:
                return key, 1.0
                
        # 3. 模糊匹配
        best_match, score = process.extractOne(name, teachers, scorer=fuzz.token_sort_ratio)
        return best_match, score / 100.0

    def resolve_course(self, name: str) -> Tuple[Optional[str], float]:
        if not name:
            return None, 0.0
            
        courses = list(self._cache["course"].keys())
        if not courses:
            return None, 0.0
            
        # 1. 精确匹配
        if name in self._cache["course"]:
            return name, 1.0
            
        # 2. Alias 匹配
        for key, val in self._cache["course"].items():
            aliases = val.get("alias", "").split(",")
            if name in [a.strip() for a in aliases if a.strip()]:
                return key, 1.0
                
        # 3. 模糊匹配
        best_match, score = process.extractOne(name, courses, scorer=fuzz.token_sort_ratio)
        return best_match, score / 100.0

    def get_style_mapping(self) -> Dict[str, str]:
        # 返回 Course -> Style 的映射字典
        # 优先用 course 的 main_style，或者根据 style 字典推断
        mapping = {}
        for key, val in self._cache["course"].items():
            # 假设 course value 里有个 style 字段，或者根据 category
            # 这里简化：直接返回 course key
            pass
        return {}
