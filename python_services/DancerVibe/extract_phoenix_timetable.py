import os
import re
from typing import Dict, List, Tuple, Optional

import numpy as np
from paddleocr import PaddleOCR


IMAGE_PATH = "tests/data/timetable_phoenix.png"
DET_MODEL_DIR = "models/ch_PP-OCRv3/det"
REC_MODEL_DIR = "models/ch_PP-OCRv3/rec"
CLS_MODEL_DIR = "models/ch_PP-OCRv3/cls"
REC_CHAR_DICT = "models/ch_PP-OCRv3/dict/timetable_dict.txt"

BRANCH_MAPPING = {
    "新天地": "新天地（复兴店）",
    "复兴中路": "新天地（复兴店）",
    "世纪大道": "世纪大道（九六店）",
    "中山公园": "中山公园（兆丰店）",
    "长寿路": "长寿路（长寿店）"
}

def is_address_line(text: str) -> bool:
    t = text.lower()
    # Check for strong address indicators
    if any(k in t for k in ["地址", "address", "add", "tel", "电话"]):
        return True
    # Check for road/street indicators combined with numbers usually
    if "路" in t or "号" in t or "弄" in t or "floor" in t or "room" in t:
        return True
    return False

def build_ocr() -> PaddleOCR:
    return PaddleOCR(
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=True,
        device="cpu",
    )


def run_ocr(ocr: PaddleOCR, image_path: str = IMAGE_PATH) -> List[Dict]:
    # Use standard PaddleOCR API
    result = ocr.ocr(image_path, cls=False)
    if not result or not result[0]:
        return []
    
    items: List[Dict] = []
    for line in result[0]:
        box = line[0]
        text = line[1][0]
        score = line[1][1]
        
        arr = np.array(box, dtype=float).reshape(-1, 2)
        xs = arr[:, 0]
        ys = arr[:, 1]
        x_min = min(xs)
        x_max = max(xs)
        y_min = min(ys)
        y_max = max(ys)
        x_center = (x_min + x_max) / 2.0
        y_center = (y_min + y_max) / 2.0
        height = y_max - y_min
        
        items.append(
            {
                "text": str(text),
                "score": float(score),
                "box": box,
                "x_center": x_center,
                "y_center": y_center,
                "x_min": x_min,
                "x_max": x_max,
                "y_min": y_min,
                "y_max": y_max,
                "height": height,
            }
        )
    return items


def extract_global(items: List[Dict]) -> Tuple[str, str, str]:
    if not items:
        return "", "", ""
    ys = [i["y_center"] for i in items]
    min_y = min(ys)
    max_y = max(ys)
    top_thresh = min_y + (max_y - min_y) * 0.3
    top_items = [i for i in items if i["y_center"] <= top_thresh]
    if not top_items:
        top_items = items
    
    studio_item = max(top_items, key=lambda i: i["height"])
    studio = studio_item["text"].strip()
    
    branch = ""
    below = [i for i in items if i["y_center"] > studio_item["y_center"]]
    
    # Strategy 1: Look for exact keywords in mapping
    for item in below:
        text = item["text"].strip()
        for key in BRANCH_MAPPING:
            if key in text:
                branch = BRANCH_MAPPING[key]
                break
        if branch:
            break
            
    # Strategy 2: If no keyword found, take the most likely item but filter out addresses
    if not branch and below:
        branch_item = min(below, key=lambda i: i["y_center"])
        raw_branch = branch_item["text"].strip()
        
        is_address = is_address_line(raw_branch)
        if not is_address:
            branch = raw_branch
        
        # Check mapping again just in case (redundant but safe)
        branch = BRANCH_MAPPING.get(branch, branch)
        
    month_candidates = [
        i for i in items if ("月" in i["text"] or "常规" in i["text"])
    ]
    month = month_candidates[0]["text"].strip() if month_candidates else ""
    return studio, branch, month


def find_days(items: List[Dict]) -> Dict[str, float]:
    day_labels = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
    positions: Dict[str, Dict] = {}
    for it in items:
        t = it["text"].upper()
        for d in day_labels:
            if d in t:
                if d not in positions or it["height"] > positions[d]["height"]:
                    positions[d] = it
    return {d: positions[d]["x_center"] for d in positions}




def sanitize(text: str) -> str:
    return text.strip().replace("\n", " ")

def normalize_template_rules(rules: Optional[Dict]) -> Dict:
    if not rules:
        rules = {}
    
    # Default crawler rules for Phoenix
    if "crawler_rules" not in rules:
        rules["crawler_rules"] = {}
        
    cr = rules["crawler_rules"]
    if "exclude_address" not in cr:
        cr["exclude_address"] = True
    if "take_last_n" not in cr:
        cr["take_last_n"] = 4
    if "min_ratio" not in cr:
        # data-ratio is h/w. Timetables are tall (h > w).
        # w/h in [0.3, 0.65] => h/w in [1.53, 3.33]
        cr["min_ratio"] = 1.5
    if "max_ratio" not in cr:
        cr["max_ratio"] = 3.5
        
    return rules





def find_time_rows(items: List[Dict]) -> List[Tuple[str, float]]:
    pattern = re.compile(r"\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}")
    rows: List[Tuple[str, float]] = []
    seen = set()
    for it in items:
        text = it["text"].replace(" ", "")
        if pattern.fullmatch(text) or pattern.search(text):
            label = it["text"].strip()
            if label not in seen:
                seen.add(label)
                rows.append((label, it["y_center"]))
    rows.sort(key=lambda r: r[1])
    return rows


def build_cells(
    items: List[Dict],
    days: Dict[str, float],
    time_rows: List[Tuple[str, float]],
    studio: str,
    branch: str,
    month: str,
) -> Dict[Tuple[str, str], List[Dict]]:
    time_labels = {r[0] for r in time_rows}
    day_texts = set()
    for d in days:
        day_texts.add(d)
    global_texts = set()
    if studio:
        global_texts.add(studio)
    if branch:
        global_texts.add(branch)
    if month:
        global_texts.add(month)
    cells: Dict[Tuple[str, str], List[Dict]] = {}
    if not days or not time_rows:
        return cells
    for it in items:
        text = it["text"].strip()
        if not text:
            continue
        t_upper = text.upper()
        if text in time_labels:
            continue
        if t_upper in day_texts:
            continue
        if any(g in text for g in global_texts):
            continue
        
        # Determine time slot (row)
        center_y = it["y_center"]
        closest_time = None
        min_dist = float("inf")
        for t_label, t_y in time_rows:
            dist = abs(center_y - t_y)
            if dist < min_dist:
                min_dist = dist
                closest_time = t_label
        
        # Determine day (column)
        center_x = it["x_center"]
        closest_day = None
        min_dist_x = float("inf")
        for d_label, d_x in days.items():
            dist = abs(center_x - d_x)
            if dist < min_dist_x:
                min_dist_x = dist
                closest_day = d_label
                
        if closest_time and closest_day:
            key = (closest_time, closest_day)
            if key not in cells:
                cells[key] = []
            cells[key].append(it)
            
    return cells

def sanitize(text: str) -> str:
    return text.strip().replace("\n", " ")

def normalize_template_rules(rules: Optional[Dict]) -> Dict:
    if not rules:
        rules = {}
    
    # Default crawler rules for Phoenix
    if "crawler_rules" not in rules:
        rules["crawler_rules"] = {}
        
    cr = rules["crawler_rules"]
    if "exclude_address" not in cr:
        cr["exclude_address"] = True
    if "take_last_n" not in cr:
        cr["take_last_n"] = 4
    if "min_ratio" not in cr:
        # data-ratio is h/w. Timetables are tall (h > w).
        # w/h in [0.3, 0.65] => h/w in [1.53, 3.33]
        cr["min_ratio"] = 1.5
    if "max_ratio" not in cr:
        cr["max_ratio"] = 3.5
        
    return rules

def parse_cell_content(items: List[Dict], rules: Dict = None) -> List[Dict]:
    # Simple heuristic parsing
    # Usually: Course Name, Teacher Name, Style/Level
    # This is highly dependent on the specific layout.
    # For now, just concatenate text as raw_text
    raw_text = " ".join([i["text"] for i in items])
    return [{
        "raw_text": raw_text,
        "course": raw_text, # Placeholder
        "teacher": "",      # Placeholder
        "style": "",        # Placeholder
        "level": ""         # Placeholder
    }]

def save_to_db(cells: Dict, studio: str, branch: str, month: str, rules: Dict = None):
    # This function would use DataManager to save
    # But since DataManager is in another file, we might need to import it inside or pass it.
    # For now, let's just print or do nothing if not available.
    pass



def find_time_rows(items: List[Dict]) -> List[Tuple[str, float]]:
    pattern = re.compile(r"\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}")
    rows: List[Tuple[str, float]] = []
    seen = set()
    for it in items:
        text = it["text"].replace(" ", "")
        if pattern.fullmatch(text) or pattern.search(text):
            label = it["text"].strip()
            if label not in seen:
                seen.add(label)
                rows.append((label, it["y_center"]))
    rows.sort(key=lambda r: r[1])
    return rows


def build_cells(
    items: List[Dict],
    days: Dict[str, float],
    time_rows: List[Tuple[str, float]],
    studio: str,
    branch: str,
    month: str,
) -> Dict[Tuple[str, str], List[Dict]]:
    time_labels = {r[0] for r in time_rows}
    day_texts = set()
    for d in days:
        day_texts.add(d)
    global_texts = set()
    if studio:
        global_texts.add(studio)
    if branch:
        global_texts.add(branch)
    if month:
        global_texts.add(month)
    cells: Dict[Tuple[str, str], List[Dict]] = {}
    if not days or not time_rows:
        return cells
    for it in items:
        text = it["text"].strip()
        if not text:
            continue
        t_upper = text.upper()
        if text in time_labels:
            continue
        if t_upper in day_texts:
            continue
        if text in global_texts:
            continue
        nearest_row = min(time_rows, key=lambda r: abs(it["y_center"] - r[1]))
        row_label = nearest_row[0]
        nearest_day = min(days.items(), key=lambda kv: abs(it["x_center"] - kv[1]))[0]
        key = (row_label, nearest_day)
        if key not in cells:
            cells[key] = []
        cells[key].append(it)
    return cells


def sanitize(name: str) -> str:
    return name.strip().replace(" ", "").replace("\n", "")


def to_markdown(
    cells: Dict[Tuple[str, str], List[Dict]],
    time_rows: List[Tuple[str, float]],
    days: Dict[str, float],
) -> str:
    ordered_days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
    header = ["时间段"] + ordered_days
    lines: List[str] = []
    lines.append("|" + "|".join(header) + "|")
    sep = "|" + "|".join(["---"] * len(header)) + "|"
    lines.append(sep)
    for label, _ in time_rows:
        row_cells: List[str] = [label]
        for d in ordered_days:
            key = (label, d)
            if key in cells:
                items = sorted(cells[key], key=lambda it: it["y_center"])
                texts = [it["text"].strip() for it in items if it["text"].strip()]
                cell_text = "\n".join(texts)
            else:
                cell_text = ""
            cell_text = cell_text.replace("|", "\\|")
            row_cells.append(cell_text)
        lines.append("|" + "|".join(row_cells) + "|")
    return "\n".join(lines)


from data_manager import DataManager

def parse_cell_content(cell_items: List[Dict]) -> List[Dict]:
    """
    解析单元格内容，支持一个格子内有多节课的情况。
    简单策略：
    1. 按 y 坐标排序
    2. 如果两行文字距离较远，视为分隔
    3. 在每节课的块内，尝试识别：
       - 星级 (包含⭐/🌟/★)
       - 时间段 (如 12:00-13:00) - 但通常时间段在左侧列，这里可能是具体的微调时间
       - 老师名 (通常是英文或特定中文)
       - 风格 (JAZZ, SWAG, 编舞...)
    
    返回结构：
    [
      {
        "teacher": "A-BOMB",
        "style": "SWAG",
        "level": "⭐⭐",
        "raw_text": "..."
      },
      ...
    ]
    """
    if not cell_items:
        return []
    
    # 按 y 排序
    sorted_items = sorted(cell_items, key=lambda i: i["y_center"])
    
    # 简单聚类：如果 y 距离超过阈值，视为新的一节课
    # 阈值取平均字符高度的 1.5 倍
    avg_height = sum(i["height"] for i in sorted_items) / len(sorted_items)
    thresh = avg_height * 1.5
    
    courses = []
    current_course_items = []
    last_y = sorted_items[0]["y_center"]
    
    for item in sorted_items:
        if item["y_center"] - last_y > thresh:
            # 新课
            if current_course_items:
                courses.append(analyze_course_block(current_course_items))
            current_course_items = [item]
        else:
            current_course_items.append(item)
        last_y = item["y_center"]
    
    if current_course_items:
        courses.append(analyze_course_block(current_course_items))
        
    return courses

def analyze_course_block(items: List[Dict]) -> Dict:
    """
    分析一个课程块内的文本，提取 teacher, style, level
    """
    full_text = "\n".join([i["text"] for i in items])
    
    # 提取星级
    level = ""
    star_chars = ["⭐", "🌟", "★", "☆", "●", "•", "0"] # OCR有时把圆点识别为0
    level_parts = []
    for char in full_text:
        if char in star_chars:
            level_parts.append("⭐")
    if level_parts:
        level = "".join(level_parts)
    
    # 简单的关键词提取策略
    # 假设：
    # 1. 包含 "编舞", "JAZZ", "SWAG", "HIPHOP", "HEELS", "LOCKING", "POPPING" 等的是风格
    # 2. 剩下的可能是老师名字
    
    styles = ["JAZZ", "SWAG", "HIPHOP", "URBAN", "HEELS", "LOCKING", "POPPING", "HOUSE", "AFRO", "K-POP", "CHOREO", "编舞", "基本功", "水系", "MV", "COVER", "LYRICAL", "GIRLS"]
    
    found_style = ""
    found_teacher = ""
    
    lines = [i["text"].strip() for i in items]
    
    # 过滤掉星级字符行
    clean_lines = []
    for line in lines:
        # 去掉星级字符
        line_clean = "".join([c for c in line if c not in star_chars]).strip()
        if line_clean:
            clean_lines.append(line_clean)
            
    # 尝试识别风格和老师
    for line in clean_lines:
        line_upper = line.upper()
        is_style = False
        for s in styles:
            if s in line_upper:
                if found_style:
                    found_style += " " + line # 可能是 "JAZZ FUNK"
                else:
                    found_style = line
                is_style = True
                break
        
        if not is_style:
            # 假设非风格行就是老师
            # 排除掉太短的标点误识别
            if len(line) > 1 or line.isalpha():
                if found_teacher:
                    found_teacher += " " + line
                else:
                    found_teacher = line

    return {
        "teacher": found_teacher,
        "style": found_style,
        "level": level,
        "raw_text": full_text
    }

def save_to_db(
    cells: Dict[Tuple[str, str], List[Dict]], 
    studio: str, 
    branch: str, 
    month: str
) -> None:
    dm = DataManager()
    all_courses_data = []
    
    for (time_label, day_label), items in cells.items():
        # 解析单元格内的课程（可能有多节）
        courses = parse_cell_content(items)
        
        for c in courses:
            c_data = c.copy()
            c_data["weekday"] = day_label
            c_data["time_range"] = time_label
            all_courses_data.append(c_data)
            
    if all_courses_data:
        dm.save_timetable(studio, branch, month, all_courses_data)
<<<<<<< HEAD:extract_phoenix_timetable.py


def main() -> None:
    ocr = build_ocr()
    items = run_ocr(ocr)
    studio, branch, month = extract_global(items)
    days = find_days(items)
    time_rows = find_time_rows(items)
    cells = build_cells(items, days, time_rows, studio, branch, month)
    
    # 1. 打印 Markdown 用于预览
    filename = f"{sanitize(studio)}_{sanitize(branch)}_{sanitize(month)}.xlsx"
    markdown = to_markdown(cells, time_rows, days)
    print(filename)
    print()
    print(markdown)
    
    # 2. 存入数据库
    print(f"\nSaving to database: {studio} - {branch}...")
    save_to_db(cells, studio, branch, month)
    print("Done.")



if __name__ == "__main__":
    main()
=======
>>>>>>> b798c2a (Sync crawler scripts from crawlSchedule):python_services/crawler/extract_phoenix_timetable.py
