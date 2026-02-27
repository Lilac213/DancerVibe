# PWA 图标说明

## 需要的图标尺寸

请在 `public/icons/` 目录下放置以下尺寸的图标：

- icon-192x192.png (必需，PWA 标准)
- icon-512x512.png (必需，PWA 标准)

## 快速生成图标

### 方法 1: 在线工具
访问 https://realfavicongenerator.net/ 上传你的 logo，自动生成所有尺寸。

### 方法 2: 使用 ImageMagick
```bash
# 从原始图标生成所有尺寸
convert logo.png -resize 192x192 public/icons/icon-192x192.png
convert logo.png -resize 512x512 public/icons/icon-512x512.png
```

## 临时占位图标

如果暂时没有图标，可以创建纯色占位图：

```bash
# 创建目录
mkdir -p public/icons

# 创建占位图（需要 ImageMagick）
convert -size 192x192 xc:#6366f1 public/icons/icon-192x192.png
convert -size 512x512 xc:#6366f1 public/icons/icon-512x512.png
```

或者使用在线工具：https://placeholder.com/
