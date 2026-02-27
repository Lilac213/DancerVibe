# Supabase 音乐识别部署指南

## 1. 部署 Edge Function

```bash
# 安装 Supabase CLI
npm install -g supabase

# 登录 Supabase
supabase login

# 链接到你的项目
supabase link --project-ref your-project-ref

# 部署函数
supabase functions deploy identify-music
```

## 2. 配置环境变量

在项目根目录的 `.env.local` 文件中添加：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 3. 测试

```bash
# 本地测试
supabase functions serve identify-music

# 测试请求
curl -X POST https://your-project.supabase.co/functions/v1/identify-music \
  -F "audio=@test-audio.m4a"
```

## 4. ACRCloud 配置

已配置的信息：
- Host: `identify-cn-north-1.acrcloud.cn`
- Access Key: `b7dec7d529aa70616fccfb58aad3435e`
- Project ID: `8091`
- Account: `dancervibe`

## 5. 成本优化

- 歌曲识别结果会缓存到 IndexedDB
- 相同 `acrcloudId` 的歌曲不会重复调用 API
- 只提取视频前 15 秒音频进行识别

## 6. 使用流程

1. 用户上传视频
2. 前端自动提取 15 秒音频
3. 调用 Supabase Edge Function
4. Edge Function 调用 ACRCloud API
5. 返回歌曲信息并缓存
6. 自动填充到"舞曲/内容"字段
