# -*- coding: utf-8 -*-
"""一键打包发布更新包：build_release.py

生成符合在线更新规范的 apistar-update.zip：
- 仅包含更新器白名单内的条目：apistar/、static/、plugin_runner.py、requirements.txt、app.py
- 自动排除 __pycache__ / *.pyc / .env / data.db* / backups 等运行时产物
- 打包前校验版本号，并做一次「模拟 inspect_zip」自检，确保能被线上更新器接受
- 输出 sha256 校验和，便于发布时核对

用法：
    python build_release.py                    # 按当前 apistar/VERSION 打包
    python build_release.py --set-version 1.0.1  # 顺带把 VERSION 改成 1.0.1 再打包
    python build_release.py --out dist/        # 指定输出目录（默认 dist/）
"""
import argparse
import hashlib
import os
import re
import sys
import zipfile
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
VERSION_FILE = os.path.join(BASE_DIR, "apistar", "VERSION")

# 与 apistar/updater.py 的 ALLOWED_ROOTS 保持一致
INCLUDE_ROOTS = ("apistar", "static", "plugin_runner.py", "requirements.txt", "app.py")
# 与 apistar/updater.py 的 SKIP_PARTS 保持一致，另加打包时会遇到的噪音
SKIP_DIRS = {"__pycache__", ".git", ".gitignore", "backups", "dist", ".idea", ".vscode"}
SKIP_FILES = {".env", "data.db", "data.db-wal", "data.db-shm", "server_run.log",
              "apistar-update-status.json", "openapi_demo.json", ".dockerignore", "LICENSE"}
SKIP_SUFFIX = (".pyc", ".pyo", ".log", ".db", ".db-wal", ".db-shm")


def _skip(rel_path: str) -> bool:
    parts = re.split(r"[\\/]", rel_path)
    if any(p in SKIP_DIRS for p in parts):
        return True
    name = parts[-1]
    if name in SKIP_FILES:
        return True
    if name.endswith(SKIP_SUFFIX):
        return True
    return False


def _collect():
    """遍历白名单根，收集 (绝对路径, zip 内相对路径)"""
    items = []
    for root in INCLUDE_ROOTS:
        abs_root = os.path.join(BASE_DIR, root)
        if not os.path.exists(abs_root):
            print(f"  ! 跳过不存在的条目：{root}")
            continue
        if os.path.isfile(abs_root):
            items.append((abs_root, root))
            continue
        for dirpath, dirnames, filenames in os.walk(abs_root):
            # 原地过滤掉跳过目录，walk 不再深入
            dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
            for fn in filenames:
                abs_f = os.path.join(dirpath, fn)
                rel = os.path.relpath(abs_f, BASE_DIR).replace(os.sep, "/")
                if _skip(rel):
                    continue
                items.append((abs_f, rel))
    return items


def _validate_version(v: str) -> str:
    v = (v or "").strip()
    if not re.match(r"^\d+\.\d+\.\d+$", v):
        raise SystemExit(f"版本号格式不合法：{v!r}（应为 x.y.z，如 1.0.1）")
    return v


def _read_version() -> str:
    with open(VERSION_FILE, encoding="utf-8") as f:
        return f.read().strip()


def _write_version(v: str):
    with open(VERSION_FILE, "w", encoding="utf-8", newline="\n") as f:
        f.write(v + "\n")


def _self_check(zip_path: str):
    """复用线上 updater.inspect_zip 做一次自检，确保更新器能接受这个包"""
    sys.path.insert(0, BASE_DIR)
    try:
        from apistar import updater
        plans = updater.inspect_zip(zip_path)
        return len(plans)
    except ImportError as e:
        print(f"  ! 跳过自检（无法导入 apistar.updater：{e}）")
        return None
    except Exception as e:
        raise SystemExit(f"自检失败，更新包会被线上拒绝：{e}")


def main():
    ap = argparse.ArgumentParser(description="打包 APIStar 在线更新包")
    ap.add_argument("--set-version", metavar="X.Y.Z", help="打包前将 apistar/VERSION 改为指定版本")
    ap.add_argument("--out", default="dist", help="输出目录（默认 dist/）")
    args = ap.parse_args()

    if args.set_version:
        v = _validate_version(args.set_version)
        _write_version(v)
        print(f"✓ VERSION 已更新为 {v}")

    version = _validate_version(_read_version())
    out_dir = os.path.join(BASE_DIR, args.out)
    os.makedirs(out_dir, exist_ok=True)
    zip_path = os.path.join(out_dir, "apistar-update.zip")

    print(f"打包版本 {version} …")
    items = _collect()
    if not items:
        raise SystemExit("没有可打包的文件，检查工作目录是否正确")
    # 干净的临时写入：先写 .tmp 再原子改名（与线上 os.replace 风格一致）
    tmp_path = zip_path + ".tmp"
    with zipfile.ZipFile(tmp_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for abs_f, rel in sorted(items, key=lambda x: x[1]):
            z.write(abs_f, rel)
    os.replace(tmp_path, zip_path)

    size = os.path.getsize(zip_path)
    sha = hashlib.sha256(open(zip_path, "rb").read()).hexdigest()
    checked = _self_check(zip_path)

    print()
    print("=" * 60)
    print(f"  更新包：{os.path.relpath(zip_path, BASE_DIR)}")
    print(f"  版本号：{version}   文件数：{len(items)}   大小：{size / 1024:.1f} KB")
    print(f"  SHA256：{sha}")
    if checked is not None:
        print(f"  自检：通过（更新器识别 {checked} 个文件）")
    print("=" * 60)
    print()
    print("发布步骤：")
    print(f"  1. GitHub 仓库 → Releases → Draft a new release")
    print(f"  2. Tag 填 v{version}（与包内 VERSION 一致）")
    print(f"  3. 上传 dist/apistar-update.zip（文件名必须保持此名）")
    print(f"  4. Publish release 后，管理端「系统设置 → 在线更新」填 owner/repo 检查并应用")
    print()
    print(f"  打包时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == "__main__":
    main()
