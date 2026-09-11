# -*- coding: utf-8 -*-
"""兼容 shim：历史代码 import database 仍可用；实现已迁移到 apistar/db.py + apistar/seed.py"""
from apistar.db import (  # noqa: F401
    DB_PATH,
    _PBKDF2_PREFIX,
    get_conn,
    hash_pwd,
    init_db,
    verify_pwd,
)

BASE_DIR = __file__[: __file__.rfind("\\")] if "\\" in __file__ else "."


def __getattr__(name):
    if name == "seed":
        from apistar.seed import seed
        return seed
    raise AttributeError(name)
