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
        
        exclude_address = rules.get("exclude_address")
        if exclude_address is None:
            exclude_address = True
            
        if exclude_address:
            # Simple heuristic: filter out images surrounded by address text
            # If no text found (contexts are empty), this filter does nothing (keeps all)
            filtered = [i for i in indices if not is_address_text(contexts[i] if i < len(contexts) else "")]
            indices = filtered

        # Filter by aspect ratio if provided (data-ratio is h/w)
        # e.g. rules={"min_ratio": 1.5, "max_ratio": 3.0}
        min_ratio = rules.get("min_ratio")
        max_ratio = rules.get("max_ratio")
        if min_ratio is not None or max_ratio is not None:
            filtered = []
            for i in indices:
                img = img_tags[i]
                try:
                    r = float(img.get("data-ratio", 0))
                    # Debug ratio
                    # print(f"Image {i} ratio: {r}")
                    
                    if min_ratio is not None and r < float(min_ratio):
                        # print(f"Skipping {i}: ratio {r} < {min_ratio}")
                        continue
                    if max_ratio is not None and r > float(max_ratio):
                        # print(f"Skipping {i}: ratio {r} > {max_ratio}")
                        continue
                    filtered.append(i)
                except (ValueError, TypeError):
                    # If no ratio, keep it? Or skip? Keep for safety.
                    filtered.append(i)
            indices = filtered

        # Take last N images
        take_last_n = rules.get("take_last_n")
        if take_last_n:
            try:
                n = int(take_last_n)
                if n > 0:
                    indices = indices[-n:]
            except (ValueError, TypeError):
                pass

        for idx in indices:
            img = img_tags[idx]
            img_url = img["data-src"]
            if "fmt=png" in img_url:
                ext = "png"
            elif "fmt=jpeg" in img_url or "fmt=jpg" in img_url:
                ext = "jpg"
            else:
                ext = "jpg"
                
            filename = f"image_{idx}.{ext}"
            filepath = os.path.join(download_dir, filename)
            
            try:
                img_resp = requests.get(img_url, headers=self.headers, timeout=10)
                img_resp.raise_for_status()
                with open(filepath, "wb") as f:
                    f.write(img_resp.content)
                downloaded_files.append(filepath)
                print(f"Downloaded: {filepath}")
            except Exception as e:
                print(f"Failed to download image {idx}: {e}")
                
        return downloaded_files
