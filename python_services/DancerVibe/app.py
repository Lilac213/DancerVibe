import os
import shutil
import time
import tempfile
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
import uvicorn
from timetable_ocr import TimetableOCR

DET_MODEL_DIR = "models/ch_PP-OCRv3/det"
REC_MODEL_DIR = "models/ch_PP-OCRv3/rec"
CLS_MODEL_DIR = "models/ch_PP-OCRv3/cls"
REC_CHAR_DICT = "models/ch_PP-OCRv3/dict/timetable_dict.txt"

use_gpu = os.environ.get("USE_PADDLE_GPU", "1") == "1"

ocr_engine = TimetableOCR(
    det_model_dir=DET_MODEL_DIR,
    rec_model_dir=REC_MODEL_DIR,
    cls_model_dir=CLS_MODEL_DIR,
    rec_char_dict_path=REC_CHAR_DICT if os.path.exists(REC_CHAR_DICT) else None,
    use_gpu=use_gpu,
    det_db_box_thresh=0.6,
    det_db_thresh=0.3,
)

app = FastAPI()


@app.post("/api/timetable")
async def recognize_timetable(file: UploadFile = File(...)):
    start = time.time()
    suffix = os.path.splitext(file.filename)[-1] or ".jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp_path = tmp.name
        shutil.copyfileobj(file.file, tmp)
    try:
        records = ocr_engine.recognize_timetable(tmp_path)
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
    elapsed = time.time() - start
    return JSONResponse({"elapsed_ms": int(elapsed * 1000), "items": records})


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

