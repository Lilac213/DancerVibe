# 使用官方 Python 3.9 轻量版作为基础镜像
FROM python:3.9-slim

# 设置工作目录
WORKDIR /app

# 安装系统依赖（PaddleOCR 和 OpenCV 需要）
# libgl1-mesa-glx, libglib2.0-0 是 OpenCV 运行必须的
# libgomp1 是 PaddlePaddle 运行必须的
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libgomp1 \
    git \
    && rm -rf /var/lib/apt/lists/*

# 复制当前目录下的文件到容器中
COPY . /app

# 安装 Python 依赖
# 先安装 numpy 以避免某些包安装时的构建问题
RUN pip install --no-cache-dir numpy && \
    pip install --no-cache-dir -r requirements.txt

# 暴露端口（Railway 会覆盖这个端口，但最好写上）
EXPOSE 8000

# 启动命令
# 使用 uvicorn 启动 FastAPI 应用
# host=0.0.0.0 是必须的，让外部可以访问
CMD ["python3", "wecom_bot.py"]
