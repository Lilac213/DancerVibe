import requests
from bs4 import BeautifulSoup
import os
import time
import re
from urllib.parse import urljoin

class WeChatCrawler:
    def __init__(self):
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
        }

    def fetch_article_images(self, url: str, download_dir: str = "downloaded_images", rules: dict = None):
        """
        Fetches images from a WeChat article URL.
        Returns a list of local file paths.
        """
        rules = rules or {}
        if not os.path.exists(download_dir):
            os.makedirs(download_dir)

        print(f"Fetching article: {url}")
        try:
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
        except Exception as e:
            print(f"Failed to fetch URL: {e}")
            return []

        soup = BeautifulSoup(response.text, "html.parser")
        
        # WeChat images are usually in 'data-src' attribute
        img_tags = soup.find_all("img", {"data-src": True})
        print(f"Found {len(img_tags)} images.")

        downloaded_files = []
        
        # Filter logic: We want the timetable, which is usually large.
        # We can also filter by position (bottom of the article).
        # For this specific task, we'll download all large images and let OCR decide.
        
        def is_address_text(text: str) -> bool:
            if not text:
                return False
            t = text.lower()
            return any(k in t for k in ["地址", "门店地址", "校区地址", "电话", "联系电话", "contact", "tel"])

        contexts = []
        for img in img_tags:
            sec = img.find_parent("section")
            sec_text = sec.get_text(" ", strip=True) if sec else ""
            contexts.append(sec_text)

        indices = list(range(len(img_tags)))
        if rules.get("skip_first_n"):
            indices = indices[int(rules.get("skip_first_n")):]
        if rules.get("take_last_n"):
            indices = indices[-int(rules.get("take_last_n")):]
        if rules.get("image_index") is not None:
            idxs = rules.get("image_index")
            if isinstance(idxs, int):
                idxs = [idxs]
            idxs = [int(i) for i in idxs]
            if rules.get("index_base") == 1 or (0 not in idxs and any(i >= 1 for i in idxs)):
                idxs = [i - 1 for i in idxs]
            indices = [i for i in indices if i in idxs]

        exclude_address = rules.get("exclude_address")
        if exclude_address is None:
            exclude_address = True
        if exclude_address:
            desired = int(rules.get("take_last_n") or 0)
            filtered = [i for i in indices if not is_address_text(contexts[i] if i < len(contexts) else "")]
            if desired and len(filtered) < desired:
                backfill = []
                for i in range(len(img_tags) - 1, -1, -1):
                    if i in filtered:
                        continue
                    if is_address_text(contexts[i] if i < len(contexts) else ""):
                        continue
                    backfill.append(i)
                    if len(filtered) + len(backfill) >= desired:
                        break
                filtered = (backfill[::-1] + filtered)[-desired:]
            indices = filtered

        max_images = int(rules.get("max_images") or 0)
        image_url_contains = rules.get("image_url_contains")
        if isinstance(image_url_contains, str):
            image_url_contains = [image_url_contains]

        for idx in indices:
            img = img_tags[idx]
            img_url = img["data-src"]
            # Convert to appropriate format if needed (WeChat uses webp often)
            if "fmt=png" in img_url:
                ext = "png"
            elif "fmt=jpg" in img_url or "fmt=jpeg" in img_url:
                ext = "jpg"
            else:
                ext = "jpg" # Default
                
            # Filter by data-ratio (timetables are often vertical, ratio > 1)
            # data-ratio is often present in WeChat img tags
            ratio = img.get("data-ratio")
            if ratio:
                try:
                    ratio_val = float(ratio)
                    ratio_min = rules.get("ratio_min")
                    ratio_max = rules.get("ratio_max")
                    if ratio_min is not None and ratio_val < float(ratio_min):
                        continue
                    if ratio_max is not None and ratio_val > float(ratio_max):
                        continue
                except:
                    pass
            if image_url_contains:
                if not any(s in img_url for s in image_url_contains):
                    continue

            filename = f"image_{idx}.{ext}"
            filepath = os.path.join(download_dir, filename)
            
            try:
                img_data = requests.get(img_url, headers=self.headers, timeout=10).content
                min_kb = int(rules.get("min_size_kb") or 50)
                max_kb = int(rules.get("max_size_kb") or 0)
                if len(img_data) < min_kb * 1024:
                    continue
                if max_kb and len(img_data) > max_kb * 1024:
                    continue
                    
                with open(filepath, "wb") as f:
                    f.write(img_data)
                downloaded_files.append(filepath)
                print(f"Downloaded: {filepath}")
                time.sleep(0.5) # Be nice
                if max_images and len(downloaded_files) >= max_images:
                    break
            except Exception as e:
                print(f"Failed to download image {img_url}: {e}")

        return downloaded_files

if __name__ == "__main__":
    crawler = WeChatCrawler()
    url = "https://mp.weixin.qq.com/s/sLyEcs2vhNqy1ff-lqPWIw"
    images = crawler.fetch_article_images(url)
    print(f"Total images downloaded: {len(images)}")
