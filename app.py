# -*- coding: utf-8 -*-
"""APIStar 接口管理平台 - 启动入口

实现已模块化到 apistar/ 包：
    apistar/config.py      环境变量配置（HOST/PORT/WORKERS/DB/限流后端…）
    apistar/db.py          SQLite（WAL 并发）+ 迁移
    apistar/security.py    会话持久化 / 登录防爆破 / 审计
    apistar/ratelimit.py   限流（memory / sqlite 双后端，多 worker 安全）
    apistar/builtin.py     内置服务
    apistar/plugins.py     插件子进程沙箱
    apistar/external.py    外部转发
    apistar/gateway.py     统一网关（线程池化，支持路径参数 / 密钥白名单）
    apistar/realtime.py    WebSocket 实时日志广播
    apistar/docs.py        HTML 接口文档导出
    apistar/routers/       auth / admin / user 路由

运行：
    python app.py                    # 单 worker
    APISTAR_WORKERS=4 python app.py  # 多 worker（需 APISTAR_RATE_BACKEND=sqlite）
    docker compose up -d             # 容器化部署
"""
from apistar import main

if __name__ == "__main__":
    main()
