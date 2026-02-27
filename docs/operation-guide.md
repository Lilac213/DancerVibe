## 管理后台操作指南

### 1. 访问入口
- 管理后台前端：`https://dancervibe-admin-frontend.up.railway.app`
- 后端 API 健康检查：`https://dancervibe-admin-backend.up.railway.app/health`
- Python OCR 健康检查：`https://dancervibe-ocr.up.railway.app/health`

### 2. 爬虫配置管理（Templates 页面 → 舞室与URL配置）
1. 点击左侧菜单 Templates。
2. 在“舞室与URL配置”页点击“新增配置”。
3. 填写舞室、分店、公众号 URL、模板名称，保存后即可加入轮询队列。
4. 可在配置列表中“运行”单条配置，或等待系统轮询自动执行。

### 3. 模板编辑与版本管理
1. 在 Templates 页的“模板与规则”中填写模板名称、舞室/分店、爬虫规则与 OCR 规则。
2. 点击“保存为新版本”会自动生成版本号，并将该版本设为当前。
3. 模板列表可“设为当前”，用于回滚或切换历史版本。
4. “导出模板”会导出 JSON；“导入模板”支持批量导入多个舞室配置。

### 4. 规则预览
1. 进入 Templates → 实时预览。
2. 填写模板名称、舞室、分店，可选择 URL 或上传图片进行预览。
3. 点击“预览效果”后将展示 OCR 结果与 preview 结构。

### 5. 微信 URL 爬取
1. 进入 WeChat Crawler 页面。
2. 选择配置（可选）或直接输入公众号 URL。
3. 点击 Start Crawl，后台将调用 Python 服务并写入 crawl_items。

### 6. 手动上传
1. 进入 Manual Upload 页面。
2. 选择配置或输入舞室/分店。
3. 上传图片并提交。
4. OCR 结果会直接展示在页面，并同步写入 crawl_items。

### 7. Dashboard 状态监控
- 查看最近 7 天游走数据与爬虫配置列表。
- 如果 need_manual_upload 标记为 true，会在 Dashboard 顶部显示告警。

### 8. 环境变量
admin-backend：
- SUPABASE_URL
- SUPABASE_SERVICE_KEY
- PYTHON_SERVICE_URL
- FRONTEND_URL
- ADMIN_TOKEN
- CRAWL_POLL_INTERVAL_MS（可选，默认 600000）

python OCR 服务：
- DATABASE_URL

### 9. 权限控制
- 模板编辑、导入导出、配置增删改与执行需要 ADMIN_TOKEN。
- 在 Templates 页面输入后会存入本地缓存并自动携带到请求头。

### 10. Phoenix 课表爬虫操作
1. 配置环境变量：
   - PHOENIX_ARTICLE_URL（当月文章 URL）
   - PHOENIX_ACCOUNT_HOME_URL（公众号主页，可选）
   - PHOENIX_DATA_DIR（输出目录）
   - 邮件相关 SMTP_*、EMAIL_* 配置
2. 手动执行：
   - `python phoenix_schedule_crawler.py`
3. 计划任务执行：
   - `ENABLE_SCHEDULER=1 python phoenix_schedule_crawler.py`
4. 输出目录结构：
   - data/phoenix/分店A
   - data/phoenix/分店B
   - data/phoenix/分店C
   - data/phoenix/分店D
5. 元数据与日志：
   - 每张图片会生成同名 .json
   - 失败日志写入 data/phoenix/crawler_error.log
6. 配置模板示例（环境变量形式）：
   - PHOENIX_MONTH=2026-02
   - PHOENIX_XPATH=//*[@id="js_content"]/section[1]/section[16]//img
   - PHOENIX_IMAGE_INDICES=0,1,2,3
   - PHOENIX_FALLBACK_URLS=四张图片URL用逗号分隔
