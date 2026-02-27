import os
import sys
import tempfile

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import cv2
import numpy as np

from phoenix_schedule_crawler import (
    clean_url,
    extract_image_urls_from_xpath,
    extract_images_in_js_content,
    guess_image_urls,
    image_dimensions,
    sha256_bytes,
    write_json,
    detect_change,
    build_month_config,
    build_default_branches,
)


def test_clean_url():
    assert clean_url(" `https://mp.weixin.qq.com/s/abc` ") == "https://mp.weixin.qq.com/s/abc"


def test_extract_image_urls_from_xpath():
    html = """
    <div id="js_content">
      <section><section>
        <img data-src="https://a.com/1.png" />
        <img data-src="https://a.com/2.png" />
      </section></section>
    </div>
    """
    urls = extract_image_urls_from_xpath(html, '//*[@id="js_content"]/section[1]/section[1]//img')
    assert urls == ["https://a.com/1.png", "https://a.com/2.png"]


def test_guess_image_urls_from_sections():
    html = """
    <div id="js_content">
      <section>
        <p>无关内容</p>
        <img data-src="https://a.com/x1.png" />
      </section>
      <section>
        <p>二月常规课表</p>
        <img data-src="https://a.com/1.png" />
        <img data-src="https://a.com/2.png" />
        <img data-src="https://a.com/3.png" />
        <img data-src="https://a.com/4.png" />
      </section>
    </div>
    """
    urls = guess_image_urls(html)
    assert urls == ["https://a.com/1.png", "https://a.com/2.png", "https://a.com/3.png", "https://a.com/4.png"]


def test_extract_images_in_js_content():
    html = """
    <div id="js_content">
      <section>
        <img data-src="https://a.com/1.png" />
        <img data-src="https://a.com/2.png" />
      </section>
    </div>
    """
    urls = extract_images_in_js_content(html)
    assert urls == ["https://a.com/1.png", "https://a.com/2.png"]


def test_image_dimensions():
    img = np.zeros((1, 1, 3), dtype=np.uint8)
    ok, buf = cv2.imencode(".png", img)
    assert ok is True
    w, h = image_dimensions(buf.tobytes())
    assert w == 1
    assert h == 1


def test_detect_change():
    with tempfile.TemporaryDirectory() as d:
        img_hash = sha256_bytes(b"abc")
        meta_path = os.path.join(d, "phoenix_schedule_A_20260223.json")
        write_json(meta_path, {"image_hash": img_hash})
        assert detect_change(d, img_hash) is False
        assert detect_change(d, sha256_bytes(b"def")) is True


def test_month_config_and_branches():
    cfg = build_month_config("2026-02", {})
    assert cfg is not None
    assert len(cfg.image_indices) == 4
    branches = build_default_branches()
    assert len(branches) == 4
