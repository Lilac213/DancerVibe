import schedule
import time
import os
from mail_crawler import MailCrawler

def job():
    print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Starting scheduled crawl...")
    crawler = MailCrawler()
    try:
        crawler.connect()
        crawler.fetch_unread_timetables()
    except Exception as e:
        print(f"Job failed: {e}")
    finally:
        crawler.close()
    print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Job finished.")

if __name__ == "__main__":
    # 配置你的邮箱信息
    if not os.environ.get("EMAIL_PASS"):
        print("Warning: EMAIL_PASS environment variable not set.")
        print("Please export EMAIL_USER and EMAIL_PASS before running.")
    
    # 示例：每周一早上 10:00 查一次
    schedule.every().monday.at("10:00").do(job)
    
    # 示例：每 10 分钟查一次
    # schedule.every(10).minutes.do(job)
    
    print("Scheduler started. Press Ctrl+C to exit.")
    
    # 立即运行一次以便测试
    job()
    
    while True:
        schedule.run_pending()
        time.sleep(60)
