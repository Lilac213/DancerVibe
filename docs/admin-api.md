## Admin 配置管理系统 API

### 认证方式
- Header: `x-admin-token: ADMIN_TOKEN`

### 月份与舞室
- `GET /api/admin/months`
  - 返回可用月份列表（YYYY-MM）
- `GET /api/admin/studios?month=YYYY-MM`
  - 返回该月份舞室与爬虫状态列表

### 爬虫控制
- `POST /api/admin/restart`
  - Body: `{ month, studio?, branch? }`
  - 说明：重启单个或全部实例，覆盖当月数据

### 图片结果
- `GET /api/admin/images?month=YYYY-MM&studio=&branch=&limit=&offset=`
  - 返回图片结果分页列表
- `GET /api/admin/image?path=...`
  - 代理获取图片文件

### 解析结果
- `GET /api/admin/parsed?month=YYYY-MM&studio=&branch=&teacher=&q=&limit=&offset=`
  - 返回结构化课表结果分页列表

### 监控统计
- `GET /api/admin/stats?month=YYYY-MM`
  - 返回总舞室、完成数、未完成数、失败列表

### 规则管理
- `GET /api/admin/rules`
- `POST /api/admin/rules`
  - Body: `{ name, studio?, branch?, target_url?, field_mapping?, update_frequency?, exception_policy?, is_current? }`
- `POST /api/admin/rules/:id/set-current`
- `DELETE /api/admin/rules/:id`

### 操作日志
- `GET /api/admin/logs?limit=&offset=`

### 备份与恢复
- `GET /api/admin/backup`
- `POST /api/admin/restore`
  - Body: `{ configs: [], templates: [], rules: [] }`
