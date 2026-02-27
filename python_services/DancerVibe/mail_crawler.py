import imaplib
import email
import os
import time
from email.header import decode_header
from typing import List, Tuple
from extract_phoenix_timetable import main as run_ocr_pipeline, build_ocr, run_ocr, extract_global, find_days, find_time_rows, build_cells, save_to_db

# 配置你的邮箱信息
# 建议使用环境变量，或者在本地创建一个 .env 文件
IMAP_SERVER = os.environ.get("IMAP_SERVER", "imap.qq.com")
EMAIL_USER = os.environ.get("EMAIL_USER", "your_email@qq.com")
EMAIL_PASS = os.environ.get("EMAIL_PASS", "your_auth_code") # 注意是授权码，不是登录密码

DOWNLOAD_DIR = "downloaded_timetables"

from extract_phoenix_timetable import (
    build_ocr, 
    run_ocr, 
    extract_global, 
    find_days, 
    find_time_rows, 
    build_cells, 
    save_to_db,
    sanitize
)

class MailCrawler:
    def __init__(self):
        # 确保下载目录存在
        self.download_dir = "downloaded_timetables"
        if not os.path.exists(self.download_dir):
            os.makedirs(self.download_dir)
            
        # 确保模型目录存在，避免 OCR 报错
        # ...
        
        self.ocr_engine = build_ocr()

    def connect(self):
        try:
            self.mail = imaplib.IMAP4_SSL(IMAP_SERVER)
            self.mail.login(EMAIL_USER, EMAIL_PASS)
            print(f"Connected to {IMAP_SERVER} as {EMAIL_USER}")
        except Exception as e:
            print(f"Connection failed: {e}")
            raise e
            
    def fetch_unread_timetables(self):
        try:
            self.mail.select("inbox")
            
            # 搜索未读邮件 (UNSEEN)
            # 你也可以加主题过滤，例如: '(UNSEEN SUBJECT "课表")'
            status, messages = self.mail.search(None, 'UNSEEN')
            
            if status != "OK" or not messages[0]:
                print("No unread messages found.")
                return

            email_ids = messages[0].split()
            print(f"Found {len(email_ids)} unread emails.")
            
            for e_id in email_ids:
                try:
                    self.process_email(e_id)
                except Exception as e:
                    print(f"Error processing email {e_id}: {e}")
                    
        except Exception as e:
            print(f"Fetch failed: {e}")

    def process_email(self, email_id):
        # 使用 fetch 获取邮件内容
        # RFC822 是整个邮件的标准格式
        status, msg_data = self.mail.fetch(email_id, "(RFC822)")
        
        for response_part in msg_data:
            if isinstance(response_part, tuple):
                msg = email.message_from_bytes(response_part[1])
                
                # 解码主题
                subject_header = decode_header(msg["Subject"])[0]
                subject = subject_header[0]
                if isinstance(subject, bytes):
                    subject = subject.decode(subject_header[1] if subject_header[1] else "utf-8")
                
                print(f"Processing email: {subject}")
                
                # 简单过滤：如果主题不包含“课表”，跳过（可选）
                if "课表" not in subject and "Schedule" not in subject:
                    print(f"Skipping '{subject}' (Subject does not contain '课表' or 'Schedule')")
                    continue

                # 遍历附件
                for part in msg.walk():
                    if part.get_content_maintype() == 'multipart':
                        continue
                    if part.get('Content-Disposition') is None:
                        continue
                        
                    filename = part.get_filename()
                    if filename:
                        # 解码文件名
                        h = decode_header(filename)[0]
                        fname = h[0]
                        if isinstance(fname, bytes):
                            fname = fname.decode(h[1] if h[1] else 'utf-8')
                        
                        # 只下载图片
                        if fname.lower().endswith(('.png', '.jpg', '.jpeg')):
                            # 保存路径
                            safe_name = sanitize(fname) # 复用 sanitizier
                            timestamp = int(time.time())
                            save_path = os.path.join(self.download_dir, f"{timestamp}_{safe_name}")
                            
                            with open(save_path, 'wb') as f:
                                payload = part.get_payload(decode=True)
                                if payload:
                                    f.write(payload)
                            
                            print(f"Downloaded: {save_path}")
                            
                            # 调用 OCR 处理
                            self.process_image(save_path)

    def process_image(self, image_path):
        print(f"Starting OCR for {image_path}...")
        try:
            # 复用 extract_phoenix_timetable.py 的逻辑
            items = run_ocr(self.ocr_engine, image_path)
            
            # 提取全局信息
            studio, branch, month = extract_global(items)
            print(f"Detected: {studio} - {branch} ({month})")
            
            days = find_days(items)
            time_rows = find_time_rows(items)
            cells = build_cells(items, days, time_rows, studio, branch, month)
            
            # 存入数据库
            print(f"Saving to database...")
            save_to_db(cells, studio, branch, month)
            print("Successfully processed and saved.")
            
        except Exception as e:
            print(f"OCR failed for {image_path}: {e}")

    def close(self):
        try:
            self.mail.close()
            self.mail.logout()
        except:
            pass


if __name__ == "__main__":
    crawler = MailCrawler()
    try:
        crawler.connect()
        crawler.fetch_unread_timetables()
    finally:
        crawler.close()
