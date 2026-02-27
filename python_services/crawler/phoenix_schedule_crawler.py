import os
import re
import json
import time
import hashlib
import smtplib
import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np
import requests
from lxml import html
from apscheduler.schedulers.background import BackgroundScheduler


@dataclass
class BranchConfig:
    code: str
    name: str


@dataclass
class MonthConfig:
    xpath: str
    image_indices: List[int]
    fallback_urls: List[str]


def clean_url(url: str) -> str:
    return url.strip().strip("`").strip()


def now_ts() -> str:
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def image_dimensions(data: bytes) -> Tuple[int, int]:
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return 0, 0
    h, w = img.shape[:2]
    return int(w), int(h)


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def fetch_html(url: str, timeout: int = 15, retries: int = 3) -> str:
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    last_error = None
    for _ in range(retries):
        try:
            resp = requests.get(url, headers=headers, timeout=timeout)
            resp.raise_for_status()
            return resp.text
        except Exception as e:
            last_error = e
            time.sleep(1)
    raise RuntimeError(str(last_error))


def extract_image_urls_from_xpath(page_html: str, xpath_expr: str) -> List[str]:
    tree = html.fromstring(page_html)
    nodes = tree.xpath(xpath_expr)
    urls = []
    for node in nodes:
        if isinstance(node, str):
            u = node
        else:
            u = node.get("data-src") or node.get("data-original") or node.get("src") or ""
        u = u.strip()
        if u:
            urls.append(u)
    return urls


def extract_images_in_js_content(page_html: str) -> List[str]:
    tree = html.fromstring(page_html)
    nodes = tree.xpath('//*[@id="js_content"]//img')
    urls = []
    for node in nodes:
        u = node.get("data-src") or node.get("data-original") or node.get("src") or ""
        u = u.strip()
        if u:
            urls.append(u)
    return urls


def guess_image_urls(page_html: str) -> List[str]:
    tree = html.fromstring(page_html)
    sections = tree.xpath('//*[@id="js_content"]//section')
    candidates: List[Tuple[int, int, List[str]]] = []
    keywords = ("课表", "课程", "常规", "schedule", "timetable")
    for idx, sec in enumerate(sections):
        imgs = sec.xpath(".//img")
        if len(imgs) < 4:
            continue
        text = " ".join(sec.xpath(".//text()")).strip()
        score = 0
        for kw in keywords:
            if kw.lower() in text.lower():
                score += 1
        urls = []
        for img in imgs:
            u = img.get("data-src") or img.get("data-original") or img.get("src") or ""
            u = u.strip()
            if u:
                urls.append(u)
        if urls:
            candidates.append((score, idx, urls))
    def is_address_context(text: str) -> bool:
        if not text:
            return False
        t = text.lower()
        return any(k in t for k in ("地址", "门店地址", "校区地址", "电话", "联系电话", "contact", "tel", "地址：", "地址:"))
    img_nodes = tree.xpath('//*[@id="js_content"]//img')
    url_contexts: List[Tuple[str, str]] = []
    for node in img_nodes:
        u = node.get("data-src") or node.get("data-original") or node.get("src") or ""
        u = u.strip()
        if not u:
            continue
        sec_text = " ".join(node.xpath("ancestor::section[1]//text()")).strip()
        url_contexts.append((u, sec_text))
    context_map = {}
    for u, t in url_contexts:
        if u not in context_map:
            context_map[u] = t
    def filter_address_urls(urls: List[str]) -> List[str]:
        kept = []
        for u in urls:
            if is_address_context(context_map.get(u, "")):
                continue
            kept.append(u)
        return kept
    if candidates:
        candidates.sort(key=lambda x: (x[0], x[1]), reverse=True)
        selected = candidates[0][2]
        filtered = filter_address_urls(selected)
        if len(filtered) >= 4:
            return filtered[-4:]
        if len(selected) >= 5 and is_address_context(context_map.get(selected[-1], "")):
            return selected[-5:-1]
        return selected
    all_urls = [u for u, _ in url_contexts] or extract_images_in_js_content(page_html)
    if len(all_urls) >= 4:
        filtered = filter_address_urls(all_urls)
        if len(filtered) >= 4:
            return filtered[-4:]
        if len(all_urls) >= 5 and is_address_context(context_map.get(all_urls[-1], "")):
            return all_urls[-5:-1]
        return all_urls[-4:]
    return all_urls


def download_with_retry(url: str, retries: int = 3, timeout: int = 15) -> bytes:
    last_error = None
    for _ in range(retries):
        try:
            resp = requests.get(url, timeout=timeout)
            resp.raise_for_status()
            return resp.content
        except Exception as e:
            last_error = e
            time.sleep(1)
    raise RuntimeError(str(last_error))


def write_json(path: str, payload: Dict) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def read_json(path: str) -> Optional[Dict]:
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def latest_metadata_file(folder: str) -> Optional[str]:
    if not os.path.exists(folder):
        return None
    files = [f for f in os.listdir(folder) if f.endswith(".json") and f.startswith("phoenix_schedule_")]
    if not files:
        return None
    files.sort()
    return os.path.join(folder, files[-1])


def detect_change(folder: str, new_hash: str) -> bool:
    latest = latest_metadata_file(folder)
    if not latest:
        return True
    data = read_json(latest) or {}
    return data.get("image_hash") != new_hash


def send_email(subject: str, body: str, smtp_cfg: Dict[str, str]) -> None:
    host = smtp_cfg.get("SMTP_HOST")
    port = int(smtp_cfg.get("SMTP_PORT", "465"))
    user = smtp_cfg.get("SMTP_USER")
    pwd = smtp_cfg.get("SMTP_PASS")
    sender = smtp_cfg.get("EMAIL_FROM")
    to_list = [x.strip() for x in (smtp_cfg.get("EMAIL_TO") or "").split(",") if x.strip()]
    if not host or not sender or not to_list:
        return
    msg = f"From: {sender}\nTo: {', '.join(to_list)}\nSubject: {subject}\n\n{body}"
    with smtplib.SMTP_SSL(host, port) as server:
        if user and pwd:
            server.login(user, pwd)
        server.sendmail(sender, to_list, msg)


def find_latest_article_url(page_html: str) -> Optional[str]:
    links = re.findall(r"https?://mp\.weixin\.qq\.com/s/[a-zA-Z0-9_\-]+", page_html)
    return links[0] if links else None


def should_check_month_end(today: datetime) -> bool:
    return today.day >= 25


def setup_logger(base_dir: str) -> logging.Logger:
    ensure_dir(base_dir)
    logger = logging.getLogger("phoenix_crawler")
    if logger.handlers:
        return logger
    logger.setLevel(logging.INFO)
    log_path = os.path.join(base_dir, "crawler_error.log")
    handler = logging.FileHandler(log_path)
    formatter = logging.Formatter("%(asctime)s %(levelname)s %(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    return logger


def branch_folder(base_dir: str, branch: BranchConfig) -> str:
    return os.path.join(base_dir, branch.name)


def parse_indices(value: str) -> List[int]:
    parts = [p.strip() for p in value.split(",") if p.strip()]
    return [int(p) for p in parts]


def build_month_config(month: str, cfg: Dict[str, str]) -> Optional[MonthConfig]:
    if cfg.get("PHOENIX_XPATH"):
        indices = parse_indices(cfg.get("PHOENIX_IMAGE_INDICES") or "0,1,2,3")
        fallback_urls = [u.strip() for u in (cfg.get("PHOENIX_FALLBACK_URLS") or "").split(",") if u.strip()]
        return MonthConfig(
            xpath=cfg["PHOENIX_XPATH"],
            image_indices=indices,
            fallback_urls=fallback_urls
        )
    if month == "2026-02":
        return MonthConfig(
            xpath='//*[@id="js_content"]/section[1]/section[16]//img',
            image_indices=[0, 1, 2, 3],
            fallback_urls=[
                "https://mmecoa.qpic.cn/mmecoa_png/moJ4BbEnOjfZBicmCO5vFobGmryOEQ39lQmGjnibAecTy2XRAsPEolLsxjDOM5KzDE6d2TyBN1Zcrns9ut7TFGNQ/640?wx_fmt=png&from=appmsg#imgIndex=15",
                "https://mmecoa.qpic.cn/mmecoa_png/moJ4BbEnOjfZBicmCO5vFobGmryOEQ39lHINouic3EGkYLwGXRMljRLoY3yUR9l8hAbLNK2YRTEBWUjiarS1YZjKA/640?wx_fmt=png&from=appmsg#imgIndex=16",
                "https://mmecoa.qpic.cn/mmecoa_png/moJ4BbEnOjfZBicmCO5vFobGmryOEQ39lDMjCibODOOqib918o12FHl2kSbd8z6YZnJpmEXOjMh9XRmFiaicJY1Xxug/640?wx_fmt=png&from=appmsg#imgIndex=17",
                "https://mmecoa.qpic.cn/mmecoa_png/moJ4BbEnOjfZBicmCO5vFobGmryOEQ39liaAzDib3ONlK6RhgF2CZx4h5A4dZkyHbo48kINiaJEQLTasfhocPfKQdw/640?wx_fmt=png&from=appmsg#imgIndex=18",
            ],
        )
    if month == "2026-01":
        return MonthConfig(
            xpath='//*[@id="js_content"]/section[1]/section[11]//img',
            image_indices=[0, 1, 2, 3],
            fallback_urls=[
                "https://mmecoa.qpic.cn/mmecoa_png/moJ4BbEnOjdJWmWUjyG8UOgujWiciaAHRhRhFstvcTicWGSdoRFibticAZTsGHahKgZw55lIMXCh4ibZaHNMToRXlc2g/640?wx_fmt=png&from=appmsg#imgIndex=9",
                "https://mmecoa.qpic.cn/mmecoa_png/moJ4BbEnOjdJWmWUjyG8UOgujWiciaAHRhWnIWBvzE53p2icXVw5UtVO01pRqBMa6vOleXuicajzG52PHyCX7LpmWg/640?wx_fmt=png&from=appmsg#imgIndex=10",
                "https://mmecoa.qpic.cn/mmecoa_png/moJ4BbEnOjdJWmWUjyG8UOgujWiciaAHRhwa8Mp5ibcD0Jdmem5cbSic0Yt2fqGXnNnQf5rfVBNsQwmDrFY2oEFKyA/640?wx_fmt=png&from=appmsg#imgIndex=11",
                "https://mmecoa.qpic.cn/mmecoa_png/moJ4BbEnOjdJWmWUjyG8UOgujWiciaAHRhSydtGCbwEu3rN3DjPYgk76BXbkhukPFnHQZhD2vMCYvVpebdlg33uw/640?wx_fmt=png&from=appmsg#imgIndex=12",
            ],
        )
    return None


def load_env_config() -> Dict[str, str]:
    return {
        "PHOENIX_DATA_DIR": os.getenv("PHOENIX_DATA_DIR", "data/phoenix"),
        "PHOENIX_ARTICLE_URL": os.getenv("PHOENIX_ARTICLE_URL", ""),
        "PHOENIX_ACCOUNT_HOME_URL": os.getenv("PHOENIX_ACCOUNT_HOME_URL", ""),
        "PHOENIX_MONTH": os.getenv("PHOENIX_MONTH", ""),
        "PHOENIX_XPATH": os.getenv("PHOENIX_XPATH", ""),
        "PHOENIX_IMAGE_INDICES": os.getenv("PHOENIX_IMAGE_INDICES", ""),
        "PHOENIX_FALLBACK_URLS": os.getenv("PHOENIX_FALLBACK_URLS", ""),
        "SMTP_HOST": os.getenv("SMTP_HOST", ""),
        "SMTP_PORT": os.getenv("SMTP_PORT", "465"),
        "SMTP_USER": os.getenv("SMTP_USER", ""),
        "SMTP_PASS": os.getenv("SMTP_PASS", ""),
        "EMAIL_FROM": os.getenv("EMAIL_FROM", ""),
        "EMAIL_TO": os.getenv("EMAIL_TO", ""),
    }


def crawl_once(month: str, branches: List[BranchConfig], cfg: Dict[str, str]) -> Dict:
    base_dir = cfg["PHOENIX_DATA_DIR"]
    ensure_dir(base_dir)
    logger = setup_logger(base_dir)
    state_path = os.path.join(base_dir, "state.json")
    state = read_json(state_path) or {}
    today = datetime.utcnow()
    article_url = clean_url(cfg.get("PHOENIX_ARTICLE_URL") or "")
    if cfg.get("PHOENIX_ACCOUNT_HOME_URL") and should_check_month_end(today):
        try:
            account_html = fetch_html(cfg["PHOENIX_ACCOUNT_HOME_URL"])
            latest = find_latest_article_url(account_html)
            if latest and latest != state.get("last_article_url"):
                article_url = latest
                state["last_article_url"] = latest
        except Exception as e:
            logger.error(json.dumps({
                "type": "account_home_fetch_failed",
                "url": cfg["PHOENIX_ACCOUNT_HOME_URL"],
                "error": str(e),
                "time": now_ts()
            }, ensure_ascii=False))
    if not article_url:
        raise RuntimeError("PHOENIX_ARTICLE_URL missing")
    page_html = fetch_html(article_url)
    month_cfg = build_month_config(month, cfg)
    extracted = guess_image_urls(page_html)
    if len(extracted) < 4 and month_cfg:
        extracted = extract_image_urls_from_xpath(page_html, month_cfg.xpath)
        if len(extracted) < 4:
            extracted = month_cfg.fallback_urls
    if len(extracted) < 4:
        raise RuntimeError("image urls不足四张")
    results = []
    alerts = []
    updates = []
    errors = []
    for idx, branch in enumerate(branches):
        branch_dir = branch_folder(base_dir, branch)
        ensure_dir(branch_dir)
        if month_cfg and len(extracted) >= (max(month_cfg.image_indices) + 1):
            img_url = extracted[month_cfg.image_indices[idx]]
        else:
            img_url = extracted[idx]
        try:
            img_data = download_with_retry(img_url)
            size_bytes = len(img_data)
            if size_bytes < 50 * 1024 or size_bytes > 5 * 1024 * 1024:
                alerts.append({"branch": branch.name, "url": img_url, "size_bytes": size_bytes})
            img_hash = sha256_bytes(img_data)
            changed = detect_change(branch_dir, img_hash)
            if changed:
                updates.append(branch.name)
            w, h = image_dimensions(img_data)
            filename = f"phoenix_schedule_{branch.code}_{today.strftime('%Y%m%d')}.png"
            img_path = os.path.join(branch_dir, filename)
            with open(img_path, "wb") as f:
                f.write(img_data)
            meta = {
                "crawl_time": now_ts(),
                "article_url": article_url,
                "image_url": img_url,
                "branch": branch.name,
                "branch_code": branch.code,
                "image_size_bytes": size_bytes,
                "image_hash": img_hash,
                "width": w,
                "height": h,
                "xpath": month_cfg.xpath if month_cfg else None,
            }
            meta_path = img_path.replace(".png", ".json")
            write_json(meta_path, meta)
            results.append(meta)
        except Exception as e:
            err = {
                "branch": branch.name,
                "url": img_url,
                "error": str(e),
                "time": now_ts()
            }
            errors.append(err)
            logger.error(json.dumps(err, ensure_ascii=False))
    state["last_run_at"] = now_ts()
    write_json(state_path, state)
    return {
        "results": results,
        "alerts": alerts,
        "updates": updates,
        "errors": errors,
        "article_url": article_url
    }


def build_default_branches() -> List[BranchConfig]:
    return [
        BranchConfig(code="A", name="分店A"),
        BranchConfig(code="B", name="分店B"),
        BranchConfig(code="C", name="分店C"),
        BranchConfig(code="D", name="分店D"),
    ]


def run_job() -> None:
    cfg = load_env_config()
    month = cfg.get("PHOENIX_MONTH") or datetime.utcnow().strftime("%Y-%m")
    branches = build_default_branches()
    try:
        result = crawl_once(month, branches, cfg)
        subject = f"Phoenix 课表爬取报告 {datetime.utcnow().strftime('%Y-%m-%d')}"
        body = json.dumps(result, ensure_ascii=False, indent=2)
        send_email(subject, body, cfg)
    except Exception as e:
        logger = setup_logger(cfg["PHOENIX_DATA_DIR"])
        logger.error(json.dumps({
            "type": "run_job_failed",
            "error": str(e),
            "time": now_ts()
        }, ensure_ascii=False))
        subject = f"Phoenix 课表爬取失败 {datetime.utcnow().strftime('%Y-%m-%d')}"
        body = json.dumps({"error": str(e), "time": now_ts()}, ensure_ascii=False, indent=2)
        send_email(subject, body, cfg)


def start_scheduler() -> None:
    scheduler = BackgroundScheduler(timezone="Asia/Shanghai")
    scheduler.add_job(run_job, "cron", day_of_week="mon", hour=2, minute=0)
    scheduler.start()
    while True:
        time.sleep(60)


if __name__ == "__main__":
    if os.getenv("ENABLE_SCHEDULER", "0") == "1":
        start_scheduler()
    else:
        run_job()
