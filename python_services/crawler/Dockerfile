# 使用官方 Python 3.10 轻量版作为基础镜像
FROM python:3.10-slim

# 设置工作目录
WORKDIR /app

# 安装系统依赖（PaddleOCR 和 OpenCV 需要）
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglx-mesa0 \
    libglib2.0-0 \
    libgomp1 \
    git \
    && rm -rf /var/lib/apt/lists/*

# 复制当前目录下的文件到容器中
COPY . /app

# 安装 Python 依赖
RUN pip install --upgrade pip && \
    pip install --no-cache-dir "numpy<2.0.0" && \
    pip install --no-cache-dir -r requirements.txt --pre

# 暴露端口
EXPOSE 8000

# 启动命令
# 调试：列出已安装的包
RUN pip list

CMD ["python3", "wecom_bot.py"]
