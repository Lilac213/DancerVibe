import os
import time
import requests
import json
from pathlib import Path
import shutil
from fastapi import FastAPI, Request, BackgroundTasks, HTTPException, Form, UploadFile, File
from fastapi.responses import FileResponse
from wechatpy import parse_message
from wechatpy.crypto import WeChatCrypto
from wechatpy.exceptions import InvalidSignatureException
from wechatpy.work import WeChatClient
from pydantic import BaseModel
from typing import List, Optional

try:
    from .wechat_crawler import WeChatCrawler
except ImportError:
    from wechat_crawler import WeChatCrawler

try:
    from .audit_routes import router as audit_router
except ImportError:
    from audit_routes import router as audit_router

try:
    from .template_routes import router as template_router
except ImportError:
    from template_routes import router as template_router

try:
    from .extract_phoenix_timetable import (
        build_ocr, 
        run_ocr, 
        extract_global, 
        find_days, 
        find_time_rows, 
        build_cells, 
        parse_cell_content,
        normalize_template_rules,
        save_to_db,
        sanitize
    )
except ImportError:
    from extract_phoenix_timetable import (
        build_ocr, 
        run_ocr, 
        extract_global, 
        find_days, 
        find_time_rows, 
        build_cells, 
        parse_cell_content,
        normalize_template_rules,
        save_to_db,
        sanitize
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

# 注册 Audit 路由
app.include_router(audit_router, prefix="/audit", tags=["audit"])
app.include_router(template_router, prefix="/templates", tags=["templates"])

# 初始化 OCR 引擎 (全局复用)
ocr_engine = build_ocr()

@app.get("/")
async def root():
    return {"message": "DancerVibe Crawler Service is running", "docs": "/docs"}

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/image")
async def get_image(path: str, request: Request):
    admin_token = os.environ.get("ADMIN_TOKEN", "")
    if admin_token and request.headers.get("x-admin-token") != admin_token:
        raise HTTPException(status_code=403, detail="Forbidden")
    base_dirs = [Path("downloaded_article_images").resolve(), Path("downloaded_timetables").resolve()]
    file_path = Path(path).resolve()
    if not any(str(file_path).startswith(str(base)) for base in base_dirs):
        raise HTTPException(status_code=403, detail="Forbidden")
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Not Found")
    return FileResponse(str(file_path))

# 初始化企业微信客户端
client = WeChatClient(CORP_ID, SECRET)

# 初始化加解密工具
# 注意：如果环境变量为空，WeChatCrypto 会报错，这里做个保护
if TOKEN and AES_KEY and CORP_ID:
    crypto = WeChatCrypto(TOKEN, AES_KEY, CORP_ID)
else:
    crypto = None
    print("Warning: WECOM config missing, bot callback will fail.")

@app.post("/ocr-image")
async def ocr_image(
    file: UploadFile = File(...),
    template_rules: str = Form(None),
    studio: str = Form(None),
    branch: str = Form(None)
):
    """
    Receives an image file, runs OCR, and returns the result.
    """
    temp_filename = f"temp_upload_{int(time.time())}_{file.filename}"
    temp_path = os.path.join("downloaded_article_images", temp_filename)
    
    # Ensure dir exists
    if not os.path.exists("downloaded_article_images"):
        os.makedirs("downloaded_article_images")
        
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    print(f"Received manual upload: {temp_path}")
    
    try:
        parsed_rules = None
        if template_rules:
            try:
                parsed_rules = normalize_template_rules(json.loads(template_rules))
            except Exception:
                parsed_rules = None
        # Run OCR
        ocr_data = run_ocr(ocr_engine, temp_path)
        
        # Extract info
        studio, branch, month = extract_global(ocr_data, studio, branch)
        days = find_days(ocr_data)
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
            try:
                save_to_db(cells, studio, branch, month, parsed_rules)
            except Exception as e:
                print(f"DB save failed for manual upload {temp_path}: {e}")
        
        return {
            "status": "success",
            "image_path": temp_path,
            "studio": studio,
            "branch": branch,
            "month": month,
            "ocr_data_count": len(ocr_data),
            "preview": preview
            # "ocr_data": ocr_data # Return full data if needed
        }
    except Exception as e:
        print(f"Error processing manual upload: {e}")
        return {"status": "error", "message": str(e)}

class CrawlRequest(BaseModel):
    url: str
    studio: Optional[str] = None
    branch: Optional[str] = None
    template_name: Optional[str] = None
    template_rules: Optional[dict] = None

@app.post("/crawl-article")
async def crawl_article(request: CrawlRequest):
    """
    Crawls a WeChat article for images and runs OCR on them.
    """
    url = request.url
    print(f"Received crawl request for: {url}")
    
    crawler = WeChatCrawler()
    # Download images to a temp folder
    download_dir = "downloaded_article_images"
    if not os.path.exists(download_dir):
        os.makedirs(download_dir)
        
    parsed_rules = normalize_template_rules(request.template_rules)
    image_paths = crawler.fetch_article_images(url, download_dir, parsed_rules.get("crawler_rules"))
    
    results = []
    
    for img_path in image_paths:
        print(f"Processing image: {img_path}")
        try:
            # Run OCR
            ocr_data = run_ocr(ocr_engine, img_path)
            
            # Extract info (try to see if it's a timetable)
            studio, branch, month = extract_global(ocr_data, request.studio, request.branch)
            if request.studio:
                studio = request.studio
            if request.branch:
                branch = request.branch
            days = find_days(ocr_data)
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
            # Persist to DB if it looks like a timetable
            if cells:
                try:
                    save_to_db(cells, studio, branch, month, parsed_rules)
                except Exception as e:
                    print(f"DB save failed for {img_path}: {e}")
            
            # Simple heuristic: if we found a month or studio, it's likely a timetable
            is_timetable = bool(preview) or bool(month) or bool(studio and branch) or len(ocr_data) > 50
            
            results.append({
                "image_path": img_path,
                "is_timetable": is_timetable,
                "studio": studio,
                "branch": branch,
                "month": month,
                "ocr_data_count": len(ocr_data),
                "preview": preview
                # We can choose to return full OCR data or just summary
                # "ocr_data": ocr_data 
            })
            
            # If it is a timetable, we might want to save it to DB immediately?
            # For now, just return the data to the caller (Node.js backend)
            
            # If it is a timetable, we might want to save it to DB immediately?
            # For now, just return the data to the caller (Node.js backend)
            
        except Exception as e:
            print(f"Error processing {img_path}: {e}")
            results.append({
                "image_path": img_path,
                "error": str(e)
            })
            
    return {"status": "success", "images": image_paths, "ocr_results": results}

@app.get("/wecom/callback")
async def verify_url(msg_signature: str, timestamp: str, nonce: str, echostr: str):
    """
    企业微信回调地址验证
    """
    if not crypto:
        raise HTTPException(status_code=500, detail="Server config missing")
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
    if not crypto:
        return "success"
        
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
            # reply_content = "正在识别课表，请稍候..."
        elif msg.type == 'text':
            pass
            # reply_content = f"收到文字：{msg.content}\n请发送课表图片。"
        else:
            pass
            # reply_content = "不支持的消息类型，请发送图片。"
            
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
        try:
            client.message.send_text(AGENT_ID, user_id, "图片下载成功，开始 OCR 识别...")
        except Exception as e:
            print(f"Failed to send start message: {e}")
        
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
        try:
            client.message.send_text(AGENT_ID, user_id, error_msg)
        except:
            pass

if __name__ == "__main__":
    import uvicorn
    # 从环境变量获取端口 (Railway 会自动注入 PORT)
    port = int(os.environ.get("PORT", 8000))
    # 启动服务
    uvicorn.run(app, host="0.0.0.0", port=port)
