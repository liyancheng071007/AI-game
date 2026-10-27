from __future__ import annotations

import argparse
from datetime import datetime, timezone
from pathlib import Path

import config
from common import load_json, sha256_file, write_json_atomic
from model_runtime import resolve_and_download_models


def main() -> int:
    parser = argparse.ArgumentParser(description="下载并锁定两套中文注意力模型")
    parser.add_argument(
        "--lock",
        type=Path,
        default=config.ROOT / "pipeline" / "models.lock",
    )
    parser.add_argument(
        "--probes",
        type=Path,
        default=config.ROOT / "content" / "probes" / "probes.json",
    )
    args = parser.parse_args()

    lock = load_json(args.lock)
    lock["probeSetHash"] = sha256_file(args.probes)
    lock["downloadedAt"] = datetime.now(timezone.utc).isoformat()
    write_json_atomic(args.lock, lock)
    resolve_and_download_models(args.lock)
    print(f"模型锁定完成：{args.lock}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
