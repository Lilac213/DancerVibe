#!/bin/bash

# Supabase 自动配置脚本
# 使用 Management API 创建数据库表和部署 Edge Function

PROJECT_REF="tpkruofcrdlcqzdsdmyq"
ACCESS_TOKEN="sbp_1f7e9dd8b3339d9e07bedde709cd2f5dc4e0b045"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwa3J1b2ZjcmRsY3F6ZHNkbXlxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDM3NTg5MSwiZXhwIjoyMDg1OTUxODkxfQ.BpLpi1krNShnCgbGfugK4I4ob6Rdv0C67Jt-2kXFqf8"

echo "🚀 开始自动配置 Supabase..."

# 读取 SQL 文件
SQL_CONTENT=$(cat supabase/migrations/20260214_create_music_tables.sql)

# 执行 SQL
echo "📊 创建数据库表..."
curl -X POST "https://${PROJECT_REF}.supabase.co/rest/v1/rpc/exec_sql" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(echo "$SQL_CONTENT" | jq -Rs .)}"

echo ""
echo "✅ 数据库表创建完成！"
echo ""
echo "📝 后续步骤："
echo "1. 访问 https://supabase.com/dashboard/project/${PROJECT_REF}/functions"
echo "2. 创建新函数 'identify-music'"
echo "3. 复制 supabase/functions/identify-music/index.ts 的内容"
echo "4. 部署函数"
echo ""
echo "或者手动在 SQL Editor 中运行："
echo "https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new"
