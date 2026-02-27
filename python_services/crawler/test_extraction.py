import os
import sys
import json
from wechat_crawler import WeChatCrawler
from extract_phoenix_timetable import extract_global, build_ocr, run_ocr, BRANCH_MAPPING

def test_extraction():
    url = "https://mp.weixin.qq.com/s/sLyEcs2vhNqy1ff-lqPWIw"
    print(f"Testing extraction for URL: {url}")

    # 1. Download images
    crawler = WeChatCrawler()
    download_dir = "downloaded_article_images"
    if not os.path.exists(download_dir):
        os.makedirs(download_dir)
    
    # Use default rules or minimal rules
    rules = {"exclude_address": True}
    print("Fetching images...")
    image_paths = crawler.fetch_article_images(url, download_dir, rules)
    print(f"Downloaded {len(image_paths)} images: {image_paths}")

    if not image_paths:
        print("No images downloaded!")
        return

    # 2. Run OCR
    print("Initializing OCR...")
    ocr_engine = build_ocr()

    for img_path in image_paths:
        print(f"\nProcessing {img_path}...")
        try:
            ocr_data = run_ocr(ocr_engine, img_path)
            
            # 3. Extract info
            studio, branch, month = extract_global(ocr_data)
            print(f"Extracted - Studio: '{studio}', Branch: '{branch}', Month: '{month}'")
            
            # Check if mapping worked
            if branch:
                print(f"Branch matched mapping? {branch in BRANCH_MAPPING.values()}")
            
        except Exception as e:
            print(f"Error processing {img_path}: {e}")

if __name__ == "__main__":
    test_extraction()
