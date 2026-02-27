import os
import pytest

try:
    import cv2  # noqa: F401
    from paddleocr import PaddleOCR  # noqa: F401
    from timetable_ocr import TimetableOCR
    deps_ok = True
except Exception:
    deps_ok = False

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
DET_MODEL_DIR = os.path.join(BASE_DIR, "models/ch_PP-OCRv3/det")
REC_MODEL_DIR = os.path.join(BASE_DIR, "models/ch_PP-OCRv3/rec")
CLS_MODEL_DIR = os.path.join(BASE_DIR, "models/ch_PP-OCRv3/cls")
REC_CHAR_DICT = os.path.join(BASE_DIR, "models/ch_PP-OCRv3/dict/timetable_dict.txt")


@pytest.mark.skipif(not deps_ok, reason="paddleocr 或依赖未安装")
def test_import_and_init():
    engine = TimetableOCR(
        det_model_dir=DET_MODEL_DIR,
        rec_model_dir=REC_MODEL_DIR,
        cls_model_dir=CLS_MODEL_DIR,
        rec_char_dict_path=REC_CHAR_DICT if os.path.exists(REC_CHAR_DICT) else None,
        use_gpu=False,
    )
    assert engine is not None


@pytest.mark.skipif(not deps_ok, reason="paddleocr 或依赖未安装")
def test_sample_images_if_exists():
    engine = TimetableOCR(
        det_model_dir=DET_MODEL_DIR,
        rec_model_dir=REC_MODEL_DIR,
        cls_model_dir=CLS_MODEL_DIR,
        rec_char_dict_path=REC_CHAR_DICT if os.path.exists(REC_CHAR_DICT) else None,
        use_gpu=False,
    )
    data_dir = os.path.join(BASE_DIR, "tests", "data")
    if not os.path.isdir(data_dir):
        pytest.skip("缺少测试样例图片目录 tests/data")
    imgs = []
    for name in os.listdir(data_dir):
        if name.lower().endswith((".jpg", ".jpeg", ".png")):
            imgs.append(os.path.join(data_dir, name))
    if not imgs:
        pytest.skip("tests/data 下无图片")
    for img in imgs:
        records = engine.recognize_timetable(img)
        assert isinstance(records, list)
        if records:
            assert any(("course" in r or "time" in r) for r in records)

