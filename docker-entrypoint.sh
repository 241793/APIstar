#!/bin/sh
# APIStar 容器入口：初始化代码卷后启动服务
# - /app 为命名卷：首次启动为空，从镜像内 /opt/app-src 拷贝初始代码
# - 后续在线更新直接写入 /app 卷，容器重建不丢失
# - APISTAR_FORCE_SYNC_IMAGE=1 可强制用镜像内代码覆盖卷（镜像升级救急，会丢失卷内热更新）

set -e

APP_SRC=/opt/app-src

if [ "$APISTAR_FORCE_SYNC_IMAGE" = "1" ] || [ ! -f /app/apistar/__init__.py ]; then
  echo "[entrypoint] 初始化代码卷：从镜像复制应用到 /app"
  mkdir -p /app
  cp -a "$APP_SRC"/. /app/
  chown -R nobody:nogroup /app 2>/dev/null || true
else
  echo "[entrypoint] 使用 /app 卷内现有代码（版本 $(cat /app/apistar/VERSION 2>/dev/null || echo unknown)）"
fi

exec "$@"
