
import os
import shutil
from wechat_crawler import WeChatCrawler
from extract_phoenix_timetable import normalize_template_rules, build_ocr, run_ocr, extract_global

def test_filter():
    url = "https://mp.weixin.qq.com/s/sLyEcs2vhNqy1ff-lqPWIw"
    download_dir = "test_downloaded_images"
    
    # Clean up previous run
    if os.path.exists(download_dir):
        shutil.rmtree(download_dir)
    os.makedirs(download_dir)

    print(f"Testing filter on {url}...")
    
    rules = {
        "exclude_address": True,
        # Timetable images are tall. h/w should be > 1.
        "min_ratio": 1.5,
        "max_ratio": 3.5,
        "take_last_n": 4
    }
    
    crawler = WeChatCrawler()
    downloaded = crawler.fetch_article_images(url, download_dir, rules)
    
    print(f"\nDownloaded {len(downloaded)} images:")
    for path in downloaded:
        print(path)
        
    # Validation
    if len(downloaded) == 4:
        print("\nSUCCESS: Downloaded exactly 4 images as expected.")
        
        # Test OCR on the first image
        first_img = downloaded[0]
        print(f"\nRunning OCR on {first_img}...")
        try:
            ocr = build_ocr()
            items = run_ocr(ocr, first_img)
            studio, branch, month = extract_global(items)
            print(f"OCR Result: Studio={studio}, Branch={branch}, Month={month}")
            if studio and branch:
                print("OCR Validation PASSED: Found studio and branch.")
            else:
                print("OCR Validation WARNING: Studio or Branch not found.")
        except Exception as e:
            print(f"OCR Failed: {e}")
            
    else:
        print(f"\nWARNING: Expected 4 images, got {len(downloaded)}.")

if __name__ == "__main__":
    test_filter()
