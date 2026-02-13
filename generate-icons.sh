#!/bin/bash

# DancerVibe App 图标生成脚本
# 使用方法: ./generate-icons.sh <原始图片路径>

if [ -z "$1" ]; then
    echo "请提供原始图片路径"
    echo "使用方法: ./generate-icons.sh <图片路径>"
    exit 1
fi

SOURCE_IMAGE="$1"

if [ ! -f "$SOURCE_IMAGE" ]; then
    echo "错误: 找不到图片文件 $SOURCE_IMAGE"
    exit 1
fi

echo "正在生成 DancerVibe app 图标..."

# 创建图标目录
mkdir -p public/icons

# 生成 PWA 所需的图标尺寸
sips -z 192 192 "$SOURCE_IMAGE" --out public/icons/icon-192x192.png
sips -z 512 512 "$SOURCE_IMAGE" --out public/icons/icon-512x512.png

# 生成 iOS 所需的图标尺寸（可选）
sips -z 152 152 "$SOURCE_IMAGE" --out public/icons/icon-152x152.png
sips -z 180 180 "$SOURCE_IMAGE" --out public/icons/icon-180x180.png
sips -z 167 167 "$SOURCE_IMAGE" --out public/icons/icon-167x167.png

echo "✅ 图标生成完成！"
echo "生成的图标："
ls -lh public/icons/
