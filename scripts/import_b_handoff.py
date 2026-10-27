#!/usr/bin/env python3
"""导入板块 B 的 handoff 包。

做四件事：
  1. 校验 SHA-256（包里带 .sha256 时强制比对，不一致直接退出）
  2. 解压到临时目录
  3. 备份旧的 packages/schema、packages/engine、levels.draft.json，再替换成新版
  4. 写 packages/VENDOR.json 记录来源，并打印接下来的验收命令

用法：
    python scripts/import_b_handoff.py <handoff.zip>
    python scripts/import_b_handoff.py <handoff.zip> --dry-run
"""

import argparse
import hashlib
import json
import shutil
import sys
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path

# Windows 控制台默认 GBK，遇到包里带 emoji/生僻字会直接抛 UnicodeEncodeError
for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, "reconfigure"):
        stream.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
BACKUP_DIR = ROOT / "vendor" / "backup"
VENDOR_RECORD = ROOT / "packages" / "VENDOR.json"

# (包内相对路径, 仓库内目标路径)
TARGETS = [
    ("packages/schema", "packages/schema"),
    ("packages/engine", "packages/engine"),
    ("levels/draft/levels.json", "apps/web/src/levels/levels.draft.json"),
]

SKIP_PARTS = {"node_modules", "dist", "__pycache__", ".git"}


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def check_hash(zip_path: Path) -> str:
    actual = sha256_of(zip_path)
    sidecar = zip_path.with_suffix(zip_path.suffix + ".sha256")
    if not sidecar.exists():
        print(f"[warn] 没有找到 {sidecar.name}，跳过比对；实际 SHA-256 = {actual}")
        return actual

    expected = sidecar.read_text(encoding="utf-8").split()[0].strip().upper()
    if expected != actual:
        print("[fail] SHA-256 不一致，拒绝导入")
        print(f"       期望 {expected}")
        print(f"       实际 {actual}")
        sys.exit(1)
    print(f"[ok] SHA-256 一致：{actual}")
    return actual


def fix_name(info: zipfile.ZipInfo) -> str:
    """Windows 打包的 zip 常常没设 UTF-8 标志：名字被按 cp437 解出来，中文会变乱码。

    先拿到原始字节，再依次试 utf-8 / gbk —— B 的包是 GBK 存的。
    """
    if info.flag_bits & 0x800:
        return info.filename
    try:
        raw = info.filename.encode("cp437")
    except UnicodeEncodeError:
        return info.filename
    for codec in ("utf-8", "gbk"):
        try:
            return raw.decode(codec)
        except UnicodeDecodeError:
            continue
    return info.filename


def extract(zip_path: Path, workdir: Path) -> Path:
    with zipfile.ZipFile(zip_path) as archive:
        for info in archive.infolist():
            name = fix_name(info)
            if any(part in SKIP_PARTS for part in Path(name).parts):
                continue
            target = workdir / name
            if info.is_dir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(info) as source, target.open("wb") as sink:
                shutil.copyfileobj(source, sink)

    # 包的根目录通常带一层「注意力高亮_板块B/」，找 packages/schema 定位根
    for candidate in workdir.rglob("packages/schema/level.schema.json"):
        return candidate.parents[2]
    print("[fail] 包里找不到 packages/schema/level.schema.json，确认是不是 B 的 handoff 包")
    sys.exit(1)


def backup(path: Path, stamp: str) -> None:
    if not path.exists():
        return
    relative = path.relative_to(ROOT)
    target = BACKUP_DIR / stamp / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    if path.is_dir():
        shutil.copytree(path, target, ignore=shutil.ignore_patterns(*SKIP_PARTS))
    else:
        shutil.copy2(path, target)


def replace(source: Path, target: Path) -> None:
    if target.is_dir():
        shutil.rmtree(target)
    target.parent.mkdir(parents=True, exist_ok=True)
    if source.is_dir():
        shutil.copytree(source, target, ignore=shutil.ignore_patterns(*SKIP_PARTS))
    else:
        shutil.copy2(source, target)


def read_package_version(source_root: Path) -> str:
    package_json = source_root / "packages" / "schema" / "package.json"
    try:
        return json.loads(package_json.read_text(encoding="utf-8")).get("version", "unknown")
    except (OSError, json.JSONDecodeError):
        return "unknown"


def main() -> None:
    parser = argparse.ArgumentParser(description="导入板块 B 的 handoff 包")
    parser.add_argument("zip", type=Path, help="handoff zip 路径")
    parser.add_argument("--dry-run", action="store_true", help="只校验与解压，不替换文件")
    parser.add_argument(
        "--workdir",
        type=Path,
        default=None,
        help="解压用的临时目录（受限环境下系统临时目录不可写时指定仓库内路径）",
    )
    args = parser.parse_args()

    zip_path = args.zip.expanduser().resolve()
    if not zip_path.exists():
        print(f"[fail] 找不到 {zip_path}")
        sys.exit(1)

    digest = check_hash(zip_path)

    context = (
        None
        if args.workdir is not None
        else tempfile.TemporaryDirectory()
    )
    workdir = args.workdir.resolve() if args.workdir is not None else Path(context.name)
    workdir.mkdir(parents=True, exist_ok=True)
    try:
        source_root = extract(zip_path, workdir)
        version = read_package_version(source_root)
        print(f"[ok] 解压完成，包版本 {version}，根目录 {source_root.name}")

        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        replaced = []
        for relative_source, relative_target in TARGETS:
            source = source_root / relative_source
            target = ROOT / relative_target
            if not source.exists():
                print(f"[skip] 包里没有 {relative_source}")
                continue
            if args.dry_run:
                print(f"[dry-run] 将替换 {relative_target}")
                continue
            backup(target, stamp)
            replace(source, target)
            replaced.append(relative_target)
            print(f"[ok] 已替换 {relative_target}")

        if args.dry_run:
            print("\n[dry-run] 未改动任何文件")
            return

        VENDOR_RECORD.write_text(
            json.dumps(
                {
                    "source": zip_path.name,
                    "sha256": digest,
                    "packageVersion": version,
                    "importedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                    "replaced": replaced,
                    "backup": str((BACKUP_DIR / stamp).relative_to(ROOT)),
                },
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        print(f"[ok] 已写入 {VENDOR_RECORD.relative_to(ROOT)}，旧文件备份在 vendor/backup/{stamp}/")
    finally:
        if context is not None:
            context.cleanup()

    print(
        "\n接下来按顺序跑：\n"
        "  pnpm build:packages\n"
        "  pnpm validate:levels\n"
        "  pnpm test\n"
        "  pnpm typecheck\n"
        "  pnpm build\n"
        "\n然后看三件事：黄金值有没有变、界面截图有没有变、draft 句数有没有变。\n"
        "任何一处变了，先找 B 确认是「预期升级」还是「回归」。"
    )


if __name__ == "__main__":
    main()
