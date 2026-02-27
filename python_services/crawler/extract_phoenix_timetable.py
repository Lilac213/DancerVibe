import re
from typing import Dict, List, Tuple, Optional, Any
import numpy as np
from paddleocr import PaddleOCR
try:
    from .data_manager import DataManager
except ImportError:
    from data_manager import DataManager

# 注意：IMAGE_PATH 现在通常作为参数传入
DEFAULT_IMAGE_PATH = "tests/data/timetable_phoenix.png"

# 模型配置 (如果需要本地模型)
DET_MODEL_DIR = "models/ch_PP-OCRv3/det"
REC_MODEL_DIR = "models/ch_PP-OCRv3/rec"
CLS_MODEL_DIR = "models/ch_PP-OCRv3/cls"
REC_CHAR_DICT = "models/ch_PP-OCRv3/dict/timetable_dict.txt"

BRANCH_MAPPING = {
    "新天地": "新天地（复兴店）",
    "世纪大道": "世纪广场（九六店）",
    "中山公园": "中山公园（兆丰店）",
    "长寿路": "长寿路（长寿店）"
}


def build_ocr() -> PaddleOCR:
    # 默认使用轻量级 Mobile 模型自动下载，适合 Railway 环境
    # 禁用方向分类器以避免模型加载错误
    # 调整 det_db_thresh 和 det_db_box_thresh 以提高小文本检测率
    # det_limit_side_len 设置为 2560 以支持高清大图
    return PaddleOCR(
        use_angle_cls=False,
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
        device="cpu",
        lang="ch",
        det_db_thresh=0.1,  # 降低阈值以检测更淡的文本
        det_db_box_thresh=0.3, # 降低框阈值
        det_limit_side_len=2560 # 提高图片处理分辨率上限
    )


def run_ocr(ocr: PaddleOCR, image_path: str = DEFAULT_IMAGE_PATH) -> List[Dict]:
    result = ocr.ocr(image_path, cls=False)
    if not result:
        return []
    res0 = result[0]
    lines = []
    for line in res0:
        box = line[0]
        text = line[1][0]
        score = line[1][1]
        lines.append((box, text, score))
    items: List[Dict] = []
    for box, text, score in lines:
        text = str(text)
        score = float(score)
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
                "text": text,
                "score": score,
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


def extract_global(items: List[Dict], config_studio: str = None, config_branch: str = None) -> Tuple[str, str, str]:
    if not items:
        return "", "", ""
    
    studio = config_studio
    branch = config_branch
    month = ""

    ys = [i["y_center"] for i in items]
    min_y = min(ys)
    max_y = max(ys)
    top_thresh = min_y + (max_y - min_y) * 0.3
    top_items = [i for i in items if i["y_center"] <= top_thresh]
    
    if not top_items:
        top_items = items
    
    # Try to find studio if not provided
    if not studio:
        studio_item = max(top_items, key=lambda i: i["height"])
        detected_text = studio_item["text"].strip()
        
        # Check if detected text is actually a branch
        mapped_branch = None
        for key, val in BRANCH_MAPPING.items():
            if key in detected_text:
                mapped_branch = val
                break
        
        if mapped_branch:
            # It's a branch!
            if not branch:
                branch = mapped_branch
            # Set default studio name
            studio = "Phoenix"
        else:
            # Assume it is studio
            studio = detected_text
    
    # Try to find branch if not provided
    if not branch:
        below = [i for i in items if i["y_center"] > (min([i["y_center"] for i in top_items]) if top_items else 0)]
        # Filter potential branch items (usually smaller than studio but prominent)
        # Simple heuristic: look for text in mapping or just take the next prominent line
        
        # Strategy 1: Look for exact keywords in mapping
        for item in below:
            text = item["text"].strip()
            for key in BRANCH_MAPPING:
                if key in text:
                    branch = BRANCH_MAPPING[key]
                    break
            if branch:
                break
        
        # Strategy 2: If no keyword found, take the most likely item (heuristic from before)
        if not branch and below:
            # Re-use previous logic but with mapping check
            branch_item = min(below, key=lambda i: i["y_center"])
            raw_branch = branch_item["text"].strip()
            # Check mapping again just in case
            branch = BRANCH_MAPPING.get(raw_branch, raw_branch)
            # Partial match check for mapping
            if branch == raw_branch:
                for key, val in BRANCH_MAPPING.items():
                    if key in raw_branch:
                        branch = val
                        break

    month_candidates = [
        i for i in items if ("月" in i["text"] or "常规" in i["text"] or "Schedule" in i["text"] or "SCHEDULE" in i["text"])
    ]
    if month_candidates:
        # 优先找包含数字的
        with_digits = [i for i in month_candidates if any(c.isdigit() for c in i["text"])]
        if with_digits:
            month = with_digits[0]["text"].strip()
        else:
            month = month_candidates[0]["text"].strip()
    else:
        # 如果没有关键词，尝试找底部最中间的文本
        if items:
            bottom_items = sorted(items, key=lambda i: i["y_center"], reverse=True)
            # 取最底部的几个
            candidates = bottom_items[:3]
            # 找最接近中间的
            img_width = max([i["x_max"] for i in items]) if items else 1000
            center_x = img_width / 2
            best = min(candidates, key=lambda i: abs(i["x_center"] - center_x))
            month = best["text"].strip()

    return studio or "", branch or "", month


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


def parse_text_rules(text: str) -> Dict[str, Any]:
    rules: Dict[str, Any] = {}
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if ":" in line:
            key, val = line.split(":", 1)
        elif "=" in line:
            key, val = line.split("=", 1)
        else:
            continue
        key = key.strip().lower()
        val = val.strip()
        if "," in val:
            rules[key] = [v.strip() for v in val.split(",") if v.strip()]
        else:
            low = val.lower()
            if low in ["true", "false"]:
                rules[key] = low == "true"
            else:
                try:
                    if "." in val:
                        rules[key] = float(val)
                    else:
                        rules[key] = int(val)
                except ValueError:
                    rules[key] = val
    return rules


def normalize_template_rules(template_rules: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not template_rules:
        return {}
    if not isinstance(template_rules, dict):
        return {}
    crawler_rules = template_rules.get("crawler_rules") or {}
    ocr_rules = template_rules.get("ocr_rules") or {}
    if isinstance(crawler_rules, dict) and crawler_rules.get("text"):
        crawler_rules = {**crawler_rules, **parse_text_rules(str(crawler_rules.get("text")))}
    if isinstance(ocr_rules, dict) and ocr_rules.get("text"):
        ocr_rules = {**ocr_rules, **parse_text_rules(str(ocr_rules.get("text")))}
    return {"crawler_rules": crawler_rules, "ocr_rules": ocr_rules}


def regex_first(patterns: Any, text: str) -> str:
    if not patterns:
        return ""
    if isinstance(patterns, str):
        patterns = [patterns]
    for p in patterns:
        try:
            m = re.search(p, text, re.IGNORECASE)
            if m:
                if m.groupdict():
                    return next(iter(m.groupdict().values()))
                if m.groups():
                    return m.group(1)
                return m.group(0)
        except re.error:
            continue
    return ""


def apply_text_normalize(text: str, rules: Dict[str, Any]) -> str:
    remove_chars = rules.get("remove_chars")
    if isinstance(remove_chars, str):
        remove_chars = [remove_chars]
    if remove_chars:
        for ch in remove_chars:
            text = text.replace(ch, "")
    if rules.get("uppercase"):
        text = text.upper()
    if rules.get("strip"):
        text = text.strip()
    return text


def analyze_course_block_with_rules(items: List[Dict], rules: Dict[str, Any]) -> Dict:
    full_text = "\n".join([i["text"] for i in items])
    ocr_rules = rules.get("ocr_rules") or {}
    teacher = regex_first(ocr_rules.get("teacher_regex") or ocr_rules.get("teacher"), full_text)
    time_range = regex_first(ocr_rules.get("time_regex") or ocr_rules.get("time"), full_text)
    course = regex_first(ocr_rules.get("course_regex") or ocr_rules.get("course"), full_text)
    style = regex_first(ocr_rules.get("style_regex") or ocr_rules.get("style"), full_text)
    level = regex_first(ocr_rules.get("level_regex") or ocr_rules.get("level"), full_text)

    if ocr_rules.get("teacher_uppercase"):
        teacher = teacher.upper()
    teacher = apply_text_normalize(teacher, ocr_rules)
    course = apply_text_normalize(course, ocr_rules)
    style = apply_text_normalize(style, ocr_rules)
    level = apply_text_normalize(level, ocr_rules)

    if not teacher or not course or not style:
        fallback = analyze_course_block(items)
        teacher = teacher or fallback.get("teacher")
        style = style or fallback.get("style")
        level = level or fallback.get("level")
        if not course:
            course = fallback.get("style")

    return {
        "teacher": teacher,
        "style": style,
        "course": course,
        "level": level,
        "time_range": time_range,
        "raw_text": full_text
    }


def parse_cell_content(cell_items: List[Dict], template_rules: Optional[Dict[str, Any]] = None) -> List[Dict]:
    """
    解析单元格内容，支持一个格子内有多节课的情况。
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
                if template_rules:
                    courses.append(analyze_course_block_with_rules(current_course_items, template_rules))
                else:
                    courses.append(analyze_course_block(current_course_items))
            current_course_items = [item]
        else:
            current_course_items.append(item)
        last_y = item["y_center"]
    
    if current_course_items:
        if template_rules:
            courses.append(analyze_course_block_with_rules(current_course_items, template_rules))
        else:
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
            
    # 基于位置的识别策略：通常是 课程 -> 老师 或 老师 -> 课程
    # Phoenix 模板通常是：
    # Style (e.g. JAZZ)
    # Teacher (e.g. 老师名)
    #
    # 或者有时同一行： Style Teacher
    
    if len(clean_lines) >= 2:
        # 假设第一行是课程/风格，第二行是老师
        # 这里做一个简单的启发式判断：
        # 如果第一行匹配到了风格关键词，那么它就是风格，第二行大概率是老师
        # 如果第一行没有匹配到风格，但第二行匹配到了风格，那么第一行可能是老师（少见）
        
        line0 = clean_lines[0]
        line1 = clean_lines[1]
        
        is_style0 = any(s in line0.upper() for s in styles)
        is_style1 = any(s in line1.upper() for s in styles)
        
        if is_style0:
            found_style = line0
            found_teacher = " ".join(clean_lines[1:]) # 剩余的都是老师
        elif is_style1:
            # 第一行不是风格，第二行是风格 -> 第一行可能是老师？或者第一行是杂讯
            # 这种情况下比较危险，保守起见，还是认为第一行是 Course
            # 但 Phoenix 课表通常 Style 在上
            found_style = line1
            found_teacher = line0
        else:
            # 都没有匹配到风格，默认第一行 Style，第二行 Teacher
            found_style = line0
            found_teacher = " ".join(clean_lines[1:])
            
    elif len(clean_lines) == 1:
        line = clean_lines[0]
        # 只有一行，尝试分割
        # 如果包含空格，可能 "Style Teacher"
        if " " in line:
            parts = line.split(" ")
            # 检查第一部分是否是风格
            if any(s in parts[0].upper() for s in styles):
                found_style = parts[0]
                found_teacher = " ".join(parts[1:])
            else:
                # 默认全都是 Style (因为有些 Style 有空格如 Jazz Funk)
                # 或者全都是 Teacher?
                # 优先匹配 Style
                is_style = any(s in line.upper() for s in styles)
                if is_style:
                    found_style = line
                else:
                    found_teacher = line
        else:
             # 没有空格
            is_style = any(s in line.upper() for s in styles)
            if is_style:
                found_style = line
            else:
                found_teacher = line

    return {
        "teacher": found_teacher,
        "style": found_style,
        "course": found_style, # Course usually same as style in this context
        "level": level,
        "raw_text": full_text
    }


def save_to_db(
    cells: Dict[Tuple[str, str], List[Dict]], 
    studio: str, 
    branch: str, 
    month: str,
    template_rules: Optional[Dict[str, Any]] = None
) -> None:
    dm = DataManager()
    all_courses_data = []
    
    for (time_label, day_label), items in cells.items():
        # 解析单元格内的课程（可能有多节）
        courses = parse_cell_content(items, template_rules)
        
        for c in courses:
            c_data = c.copy()
            c_data["weekday"] = day_label
            c_data["time_range"] = c.get("time_range") or time_label
            all_courses_data.append(c_data)
            
    if all_courses_data:
        dm.save_timetable(studio, branch, month, all_courses_data)


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
