import cv2
import numpy as np
from typing import Any, Dict, List, Optional
try:
    from paddleocr import PaddleOCR
except Exception as e:
    PaddleOCR = None
    _import_error = e


class TimetableOCR:
    def __init__(
        self,
        det_model_dir: str,
        rec_model_dir: str,
        cls_model_dir: str,
        rec_char_dict_path: Optional[str] = None,
        use_gpu: bool = True,
        det_db_box_thresh: float = 0.55,
        det_db_thresh: float = 0.3,
    ) -> None:
        if PaddleOCR is None:
            raise RuntimeError(f"paddleocr 未安装或导入失败: {_import_error}")
        self.ocr = PaddleOCR(
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=True,
            device="gpu:0" if use_gpu else "cpu",
        )

    def preprocess(self, img: np.ndarray) -> np.ndarray:
        h, w = img.shape[:2]
        max_side = max(h, w)
        target = 1280
        if max_side > target:
            scale = target / float(max_side)
            new_w = int(w * scale)
            new_h = int(h * scale)
            img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        gray = cv2.fastNlMeansDenoising(gray, None, 15, 7, 21)
        blurred = cv2.GaussianBlur(gray, (3, 3), 0)
        binary = cv2.adaptiveThreshold(
            blurred,
            255,
            cv2.ADAPTIVE_THRESH_MEAN_C,
            cv2.THRESH_BINARY,
            15,
            5,
        )
        binary = cv2.cvtColor(binary, cv2.COLOR_GRAY2BGR)
        return binary

    def ocr_raw(self, image_path: str) -> Any:
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError("无法读取图像: " + image_path)
        img = self.preprocess(img)
        result = self.ocr.ocr(img, cls=True)
        return result

    def parse_timetable(self, ocr_result: Any) -> List[Dict[str, str]]:
        if not ocr_result:
            return []
        lines = ocr_result[0]
        cells: List[Dict[str, Any]] = []
        for line in lines:
            box = line[0]
            text = line[1][0]
            score = float(line[1][1])
            x_coords = [p[0] for p in box]
            y_coords = [p[1] for p in box]
            x_min = min(x_coords)
            x_max = max(x_coords)
            y_min = min(y_coords)
            y_max = max(y_coords)
            x_center = (x_min + x_max) / 2.0
            y_center = (y_min + y_max) / 2.0
            cells.append(
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
                }
            )
        cells.sort(key=lambda c: c["y_center"])
        row_groups: List[List[Dict[str, Any]]] = []
        row_threshold = 20.0
        for cell in cells:
            placed = False
            for row in row_groups:
                y_mean = sum(x["y_center"] for x in row) / len(row)
                if abs(cell["y_center"] - y_mean) <= row_threshold:
                    row.append(cell)
                    placed = True
                    break
            if not placed:
                row_groups.append([cell])
        for row in row_groups:
            row.sort(key=lambda c: c["x_center"])
        column_centers: List[float] = []
        col_threshold = 40.0
        for row in row_groups:
            for cell in row:
                x = cell["x_center"]
                matched_index = None
                for i, cx in enumerate(column_centers):
                    if abs(x - cx) <= col_threshold:
                        matched_index = i
                        break
                if matched_index is None:
                    column_centers.append(x)
                else:
                    column_centers[matched_index] = (column_centers[matched_index] + x) / 2.0
        column_centers.sort()
        column_count = len(column_centers)

        def get_column_index(x: float) -> int:
            distances = [abs(x - cx) for cx in column_centers]
            return int(np.argmin(distances)) if distances else 0

        grid: List[List[List[Dict[str, Any]]]] = []
        for row in row_groups:
            row_cells: List[List[Dict[str, Any]]] = [[] for _ in range(column_count or 1)]
            for cell in row:
                col_idx = get_column_index(cell["x_center"])
                row_cells[col_idx].append(cell)
            grid.append(row_cells)

        def join_cell_text(cells_in_cell: List[Dict[str, Any]]) -> str:
            if not cells_in_cell:
                return ""
            texts = [c["text"] for c in sorted(cells_in_cell, key=lambda c: c["x_center"])]
            return "".join(texts)

        if not grid:
            return []
        header_row = grid[0]
        header_texts = [join_cell_text(c) for c in header_row]
        header_mapping: Dict[int, str] = {}
        for idx, header in enumerate(header_texts):
            if not header:
                continue
            if "课程" in header or "科目" in header or "课程名称" in header:
                header_mapping[idx] = "course"
            elif "时间" in header or "上课时间" in header or "节次" in header:
                header_mapping[idx] = "time"
            elif "地点" in header or "教室" in header or "上课地点" in header:
                header_mapping[idx] = "location"
            elif "教师" in header or "老师" in header or "讲师" in header:
                header_mapping[idx] = "teacher"
            elif "星期" in header or "周" in header:
                header_mapping[idx] = "weekday"
        records: List[Dict[str, str]] = []
        for row in grid[1:]:
            record: Dict[str, str] = {}
            for col_idx, col_cells in enumerate(row):
                text = join_cell_text(col_cells)
                if not text:
                    continue
                key = header_mapping.get(col_idx)
                if not key:
                    continue
                if key in record:
                    record[key] = record[key] + " " + text
                else:
                    record[key] = text
            if record:
                if "course" not in record and "time" not in record:
                    continue
                records.append(record)
        return records

    def recognize_timetable(self, image_path: str) -> List[Dict[str, str]]:
        result = self.ocr_raw(image_path)
        return self.parse_timetable(result)
