# APIStar 接口管理平台
# 构建: docker build -t apistar .
# 运行: docker run -d -p 8000:8000 -v apistar-data:/data apistar
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    APISTAR_HOST=0.0.0.0 \
    APISTAR_PORT=8000 \
    APISTAR_DB=/data/data.db \
    APISTAR_RATE_BACKEND=sqlite

WORKDIR /app

# 先装依赖（利用层缓存）
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 应用代码：同时复制到运行目录与镜像内源码副本（entrypoint 用于初始化代码卷）
COPY apistar/ ./apistar/
COPY plugin_runner.py ./
COPY static/ ./static/
COPY docker-entrypoint.sh /opt/app-src-entrypoint.sh
RUN mkdir -p /opt/app-src && cp -a apistar plugin_runner.py static /opt/app-src/ \
    && cp /opt/app-src-entrypoint.sh /usr/local/bin/docker-entrypoint.sh \
    && chmod +x /usr/local/bin/docker-entrypoint.sh

# 数据目录（挂卷点）
RUN mkdir -p /data && chown -R nobody:nogroup /data /app
# 插件依赖默认装在解释器 site-packages；如需重启后仍保留，可把该目录挂卷
ENV PYTHONUSERBASE=/data/pyuserbase
ENV PYTHONPATH=/data/pyuserbase/lib/python3.12/site-packages
RUN mkdir -p $PYTHONUSERBASE && chown -R nobody:nogroup /data
USER nobody

VOLUME ["/data"]
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health',timeout=4).status==200 else 1)"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["python", "-m", "apistar"]
