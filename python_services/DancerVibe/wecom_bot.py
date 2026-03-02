import os
import time
import requests
from pathlib import Path
import shutil
import json
import cv2
import numpy as np
from fastapi import FastAPI, Request, BackgroundTasks, HTTPException, Form, UploadFile, File
from fastapi.responses import FileResponse
from wechatpy import parse_message
from wechatpy.crypto import WeChatCrypto
from wechatpy.exceptions import InvalidSignatureException
from wechatpy.work import WeChatClient
from pydantic import BaseModel
from typing import Optional, Dict, Any
import re

try:
    from wechat_crawler import WeChatCrawler
except ImportError:
    from .wechat_crawler import WeChatCrawler

from extract_phoenix_timetable import (
    build_ocr, 
    run_ocr, 
    extract_global, 
    find_days, 
    find_time_rows, 
    build_cells, 
    save_to_db,
    sanitize,
    normalize_template_rules,
    parse_cell_content
)

# ================= 配置区域 =================
# 请在企业微信后台获取以下信息
CORP_ID = os.environ.get("WECOM_CORP_ID", "")        # 企业ID
SECRET = os.environ.get("WECOM_SECRET", "")          # 应用 Secret
AGENT_ID = int(os.environ.get("WECOM_AGENT_ID", "0")) # 应用 AgentID
TOKEN = os.environ.get("WECOM_TOKEN", "")            # 回调 Token
AES_KEY = os.environ.get("WECOM_AES_KEY", "")        # 回调 EncodingAESKey

DOWNLOAD_DIR = "downloaded_timetables"
if not os.path.exists(DOWNLOAD_DIR):
    os.makedirs(DOWNLOAD_DIR)

app = FastAPI()

# 初始化 OCR 引擎 (全局复用)
ocr_engine = build_ocr()

# 初始化企业微信客户端
client = WeChatClient(CORP_ID, SECRET)

# 初始化加解密工具
crypto = WeChatCrypto(TOKEN, AES_KEY, CORP_ID)

@app.get("/health")
async def health():
    return {"status": "ok"}

class RuleTestRequest(BaseModel):
    rule: Dict[str, Any]
    input: Dict[str, Any]

@app.post("/rules/test")
async def test_rules(payload: RuleTestRequest, request: Request):
    admin_token = os.environ.get("ADMIN_TOKEN", "")
    if admin_token and request.headers.get("x-admin-token") != admin_token:
        raise HTTPException(status_code=403, detail="Forbidden")
    rule = payload.rule or {}
    input_obj = payload.input or {}
    checks = []
    missing = []
    matched = True
    nodes = rule.get("nodes")
    if isinstance(nodes, list):
        for node in nodes:
            field = node.get("field")
            op = node.get("op")
            expected = node.get("value")
            actual = input_obj.get(field)
            passed = False
            if op == "equals":
                passed = str(actual) == str(expected)
            elif op == "contains":
                passed = str(expected) in str(actual)
            elif op == "regex":
                try:
                    passed = re.search(str(expected), str(actual)) is not None
                except Exception:
                    passed = False
            checks.append({
                "field": field,
                "op": op,
                "expected": expected,
                "actual": actual,
                "passed": passed
            })
        matched = all(item.get("passed") for item in checks)
    else:
        keys = list(rule.keys())
        missing = [k for k in keys if k not in input_obj]
        matched = len(missing) == 0
    return {"status": "ok", "matched": matched, "missing": missing, "checks": checks}

@app.get("/image")
async def get_image(path: str, request: Request):
    admin_token = os.environ.get("ADMIN_TOKEN", "")
    if admin_token and request.headers.get("x-admin-token") != admin_token:
        # Check token if provided
        pass 
    
    base_dirs = [Path("downloaded_article_images").resolve(), Path("downloaded_timetables").resolve()]
    try:
        file_path = Path(path).resolve()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid path")

    is_safe = False
    for base in base_dirs:
        try:
            if str(file_path).startswith(str(base)):
                is_safe = True
                break
        except Exception:
            continue
            
    if not is_safe:
         # Also allow relative paths from cwd for testing
         cwd = Path.cwd().resolve()
         if str(file_path).startswith(str(cwd)) and not ".." in path:
             is_safe = True
         else:
             raise HTTPException(status_code=403, detail="Forbidden path")

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Not Found")
    return FileResponse(str(file_path))

class CrawlRequest(BaseModel):
    url: str
    studio: Optional[str] = None
    branch: Optional[str] = None
    template_name: Optional[str] = None
    template_rules: Optional[dict] = None

@app.post("/crawl-article")
async def crawl_article(request: CrawlRequest):
    url = request.url
    print(f"Received crawl request for: {url}")
    
    crawler = WeChatCrawler()
    download_dir = "downloaded_article_images"
    if not os.path.exists(download_dir):
        os.makedirs(download_dir)
        
    parsed_rules = normalize_template_rules(request.template_rules)
    image_paths = crawler.fetch_article_images(url, download_dir, parsed_rules.get("crawler_rules"))
    
    results = []
    for img_path in image_paths:
        print(f"Processing image: {img_path}")
        
        # 1. Pre-filter by file size and dimensions
        try:
            file_size_kb = os.path.getsize(img_path) / 1024
            # Heuristic: Timetables are usually large high-res images (> 500KB)
            # User wants 15-18 which are > 1200KB. Unwanted are < 500KB.
            if file_size_kb < 600:
                print(f"Skipping {img_path}: File size {file_size_kb:.2f}KB too small.")
                continue
                
            # Check dimensions (optional, but good for skipping banners)
            try:
                # Use cv2 to check dimensions
                img = cv2.imread(img_path)
                if img is None:
                    print(f"Skipping {img_path}: Could not read image.")
                    continue
                h, w = img.shape[:2]
                ratio = w / h if h > 0 else 0
                
                # Filter out landscape images (Ratio > 0.8) - Timetables are portrait
                # Timetables are usually tall (Ratio 0.4-0.6). Teacher photos are 0.8.
                if ratio > 0.65:
                    print(f"Skipping {img_path}: Ratio {ratio:.2f} > 0.65 (likely teacher photo or landscape)")
                    continue
                    
                # Filter out extremely long images (Ratio < 0.3) - e.g. combined long image
                if ratio < 0.3:
                     print(f"Skipping {img_path}: Too long/tall ratio {ratio:.2f} < 0.3")
                     continue
                     
            except Exception as e:
                 print(f"Error checking dimensions for {img_path}: {e}")
                 # Fallback to OCR if dimension check fails
        except Exception as e:
            print(f"Error checking file size for {img_path}: {e}")
            continue

        try:
            ocr_data = run_ocr(ocr_engine, img_path)
            
            # 2. Post-filter by content
            days = find_days(ocr_data)
            if len(days) < 3:
                print(f"Skipping {img_path}: Not enough days found ({len(days)}). Likely not a timetable.")
                continue
                
            studio, branch, month = extract_global(ocr_data)
            
            if request.studio:
                studio = request.studio
            if request.branch:
                branch = request.branch
                
            time_rows = find_time_rows(ocr_data)
            cells = build_cells(ocr_data, days, time_rows, studio, branch, month)
            
            preview = []
            for (time_label, day_label), items in cells.items():
                for course in parse_cell_content(items, parsed_rules):
                     preview.append({
                        "weekday": day_label,
                        "time_range": course.get("time_range") or time_label,
                        "teacher": course.get("teacher"),
                        "course": course.get("course"),
                        "style": course.get("style"),
                        "level": course.get("level"),
                        "raw_text": course.get("raw_text")
                    })
            
            if cells:
                save_to_db(cells, studio, branch, month, parsed_rules)
                
            results.append({
                "image_path": img_path,
                "studio": studio,
                "branch": branch,
                "month": month,
                "preview": preview,
                "ocr_status": "success"
            })
            
        except Exception as e:
            print(f"Error processing {img_path}: {e}")
            results.append({
                "image_path": img_path,
                "error": str(e),
                "ocr_status": "error"
            })
            
    return {"status": "success", "results": results}

@app.post("/ocr-image")
async def ocr_image(
    file: UploadFile = File(...),
    template_rules: str = Form(None),
    studio: str = Form(None),
    branch: str = Form(None)
):
    temp_filename = f"temp_upload_{int(time.time())}_{file.filename}"
    temp_path = os.path.join("downloaded_article_images", temp_filename)
    if not os.path.exists("downloaded_article_images"):
        os.makedirs("downloaded_article_images")
        
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    try:
        parsed_rules = None
        if template_rules:
            try:
                parsed_rules = normalize_template_rules(json.loads(template_rules))
            except Exception:
                pass
        
        ocr_data = run_ocr(ocr_engine, temp_path)
        ex_studio, ex_branch, ex_month = extract_global(ocr_data)
        
        final_studio = studio if studio else ex_studio
        final_branch = branch if branch else ex_branch
        month = ex_month
        
        days = find_days(ocr_data)
        time_rows = find_time_rows(ocr_data)
        cells = build_cells(ocr_data, days, time_rows, final_studio, final_branch, month)
        
        preview = []
        for (time_label, day_label), items in cells.items():
            for course in parse_cell_content(items, parsed_rules):
                preview.append({
                    "weekday": day_label,
                    "time_range": course.get("time_range") or time_label,
                    "teacher": course.get("teacher"),
                    "course": course.get("course"),
                    "style": course.get("style"),
                    "level": course.get("level"),
                    "raw_text": course.get("raw_text")
                })
        
        if cells:
            save_to_db(cells, final_studio, final_branch, month, parsed_rules)
            
        return {
            "status": "success",
            "image_path": temp_path,
            "studio": final_studio,
            "branch": final_branch,
            "month": month,
            "preview": preview
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/wecom/callback")
async def verify_url(msg_signature: str, timestamp: str, nonce: str, echostr: str):
    """
    企业微信回调地址验证
    """
    try:
        decrypted_echostr = crypto.check_signature(
            msg_signature,
            timestamp,
            nonce,
            echostr
        )
        return int(decrypted_echostr) # 必须返回解密后的原文
    except InvalidSignatureException:
        raise HTTPException(status_code=403, detail="Invalid Signature")

@app.post("/wecom/callback")
async def receive_message(
    request: Request, 
    msg_signature: str, 
    timestamp: str, 
    nonce: str,
    background_tasks: BackgroundTasks
):
    """
    接收企业微信推送的消息
    """
    body = await request.body()
    try:
        # 1. 解密消息
        decrypted_xml = crypto.decrypt_message(
            body,
            msg_signature,
            timestamp,
            nonce
        )
        
        # 2. 解析 XML 消息
        msg = parse_message(decrypted_xml)
        
        # 3. 处理不同类型的消息
        if msg.type == 'image':
            # 收到图片，放入后台任务处理，避免阻塞回复
            background_tasks.add_task(handle_image_message, msg)
            reply_content = "正在识别课表，请稍候..."
        elif msg.type == 'text':
            reply_content = f"收到文字：{msg.content}\n请发送课表图片。"
        else:
            reply_content = "不支持的消息类型，请发送图片。"
            
        # 4. 构建被动回复 (可选，这里简单回复文本)
        # 企业微信推荐直接调用 API 主动发送消息，被动回复限制较多
        # 这里为了简单，我们先不返回 XML 回复，而是让后台任务处理完后主动推送结果
        return "success"
        
    except InvalidSignatureException:
        raise HTTPException(status_code=403, detail="Invalid Signature")
    except Exception as e:
        print(f"Error: {e}")
        return "success" # 即使出错也返回 success 避免企业微信重试

def handle_image_message(msg):
    """
    后台任务：下载图片 -> OCR -> 入库 -> 推送结果
    """
    user_id = msg.source
    media_id = msg.media_id
    
    try:
        # 1. 获取图片 URL
        # 企业微信没有直接给 URL，需要用 media_id 下载
        # WeChatClient 会自动处理 AccessToken
        response = client.media.download(media_id)
        
        # 2. 保存图片
        timestamp = int(time.time())
        filename = f"{timestamp}_{media_id}.jpg"
        save_path = os.path.join(DOWNLOAD_DIR, filename)
        
        with open(save_path, "wb") as f:
            f.write(response.content)
            
        print(f"Downloaded image to {save_path}")
        
        # 3. 执行 OCR
        # 通知用户开始识别
        client.message.send_text(AGENT_ID, user_id, "图片下载成功，开始 OCR 识别...")
        
        items = run_ocr(ocr_engine, save_path)
        studio, branch, month = extract_global(items)
        
        if not studio:
            client.message.send_text(AGENT_ID, user_id, "⚠️ 识别失败：未找到舞室名称，请确认图片清晰度。")
            return
            
        # 4. 数据解析与入库
        days = find_days(items)
        time_rows = find_time_rows(items)
        cells = build_cells(items, days, time_rows, studio, branch, month)
        
        save_to_db(cells, studio, branch, month)
        
        # 5. 反馈结果
        reply = f"✅ 识别成功！\n舞室：{studio}\n分店：{branch}\n月份：{month}\n\n数据已入库。"
        client.message.send_text(AGENT_ID, user_id, reply)
        
    except Exception as e:
        error_msg = f"❌ 处理出错：{str(e)}"
        print(error_msg)
        client.message.send_text(AGENT_ID, user_id, error_msg)

if __name__ == "__main__":
    import uvicorn
    # 从环境变量获取端口 (Railway 会自动注入 PORT)
    port = int(os.environ.get("PORT", 8000))
    # 启动服务
    uvicorn.run(app, host="0.0.0.0", port=port)
