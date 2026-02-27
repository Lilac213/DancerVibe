#!/bin/bash

# Supabase 音乐识别功能部署脚本

echo "🚀 开始部署 Supabase 音乐识别功能..."

# 检查是否安装了 Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo "❌ 未安装 Supabase CLI"
    echo "请运行: npm install -g supabase"
    exit 1
fi

# 检查是否已登录
echo "📝 检查登录状态..."
if ! supabase projects list &> /dev/null; then
    echo "❌ 未登录 Supabase"
    echo "请运行: supabase login"
    exit 1
fi

# 提示用户输入项目信息
echo ""
echo "请提供以下信息："
read -p "Supabase 项目 URL (例如: https://xxx.supabase.co): " SUPABASE_URL
read -p "Supabase 项目 Ref (例如: abcdefghijk): " PROJECT_REF

# 链接项目
echo ""
echo "🔗 链接到 Supabase 项目..."
supabase link --project-ref "$PROJECT_REF"

# 运行数据库迁移
echo ""
echo "📊 创建数据库表..."
supabase db push

# 部署 Edge Function
echo ""
echo "☁️  部署 Edge Function..."
supabase functions deploy identify-music

# 更新 .env.local
echo ""
echo "📝 更新环境变量..."
cat > .env.local << EOF
# Supabase 配置
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_ANON_KEY=请从 Supabase Dashboard 获取

# Gemini API (已有)
API_KEY="AIzaSyAoiHU0caH3n7a-dwx2Zg66h2cojIEVjEw"
EOF

echo ""
echo "✅ 部署完成！"
echo ""
echo "📋 后续步骤："
echo "1. 访问 Supabase Dashboard: $SUPABASE_URL"
echo "2. 在 Settings > API 中获取 anon key"
echo "3. 将 anon key 填入 .env.local 文件"
echo "4. 运行 npm run dev 测试功能"
echo ""
echo "🎵 音乐识别功能已配置完成！"
