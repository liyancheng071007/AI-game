from __future__ import annotations

import argparse
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import config

from common import load_json, sha256_file, write_json_atomic


def build_level(
    source: dict[str, Any],
    record: dict[str, Any],
    lock: dict[str, Any],
) -> dict[str, Any]:
    alternatives = source.get("acceptedAlternatives")
    level: dict[str, Any] = {
        "schemaVersion": "1.0.0",
        "id": source["id"],
        "level": source["level"],
        "template": source["template"],
        "tokens": source["tokens"],
        "focus": source["focus"],
        "punct": source["punct"],
        "coref": source["coref"],
        "causal": source["causal"],
        "attention": {
            "lenses": record["lenses"],
            "lensConfigId": f"probe-{lock['probeSetHash'][:12]}",
            "modelVersion": (
                f"{lock['primary']['repoId']}@{lock['primary']['revision']}"
                f" + {lock['control']['repoId']}@{lock['control']['revision']}"
                f"#{lock['aggVersion']}"
            ),
            "probeSetHash": lock["probeSetHash"],
            "stability": record["stability"],
            "crossModelAgreement": record["crossModelAgreement"],
            "caseStrength": record["caseStrength"],
        },
        "scoring": {
            "cap": 4,
            "bCumulative": 0.7,
            "maxTargets": 3,
        },
        "explain": {
            "copyId": f"EXP-{source['id']}",
            "text": source["explainText"],
        },
        "humanRationale": source["humanRationale"],
        "provenance": {
            "source": "ai-assisted",
            "pipelineVersion": "board-b-v1",
        },
        "review": {
            "status": "draft",
            "notes": source["reviewNote"],
        },
    }
    if alternatives:
        level["alternatives"] = alternatives
    return level


def main() -> int:
    parser = argparse.ArgumentParser(description="把门禁通过的真实数据构建成关卡包")
    parser.add_argument(
        "--sources",
        type=Path,
        default=config.ROOT / "content" / "sources" / "levels.json",
    )
    parser.add_argument(
        "--aggregated",
        type=Path,
        default=config.ROOT / "content" / "generated" / "aggregated.json",
    )
    parser.add_argument(
        "--gates",
        type=Path,
        default=config.ROOT / "content" / "generated" / "gates.json",
    )
    parser.add_argument(
        "--lock",
        type=Path,
        default=config.ROOT / "pipeline" / "models.lock",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=config.ROOT / "levels" / "draft" / "levels.json",
    )
    args = parser.parse_args()

    lock = load_json(args.lock)
    source_by_id = {
        source["id"]: source for source in load_json(args.sources)
    }
    record_by_id = {
        record["id"]: record
        for record in load_json(args.aggregated)["levels"]
    }
    gates = load_json(args.gates)
    passed = gates["passed"]
    if len(passed) != len(source_by_id):
        rejected = ", ".join(gates["rejected"])
        raise RuntimeError(
            f"有 {len(gates['rejected'])} 句未通过质量门禁：{rejected}"
        )

    levels = [
        build_level(source_by_id[level_id], record_by_id[level_id], lock)
        for level_id in passed
    ]
    package = {
        "schemaVersion": "1.0.0",
        "packageVersion": "0.1.0",
        "status": "draft",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "modelLockHash": sha256_file(args.lock),
        "levels": levels,
    }
    write_json_atomic(args.out, package)
    print(f"draft 关卡包已生成：{args.out}")
    print("生产包未生成：12 句仍待人工审核，禁止自动标记 approved。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
