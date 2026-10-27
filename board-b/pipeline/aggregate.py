from __future__ import annotations

import argparse
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import config

from common import (
    PipelineError,
    case_strength,
    load_json,
    normalize_word_weights,
    sha256_file,
    spearman,
    write_json_atomic,
)


LENSES = ("panorama", "coref", "causal", "emotion", "position")


def words_for_model(
    source: dict[str, Any],
    model_record: dict[str, Any],
) -> dict[str, list[float]]:
    return {
        lens: normalize_word_weights(
            model_record["weights"][lens],
            source["focus"],
            source["punct"],
        )
        for lens in LENSES
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="跨模型汇总并计算稳定性和区分度")
    parser.add_argument(
        "--in",
        dest="input_path",
        type=Path,
        default=config.ROOT / "content" / "generated" / "extracted.json",
    )
    parser.add_argument(
        "--sources",
        type=Path,
        default=config.ROOT / "content" / "sources" / "levels.json",
    )
    parser.add_argument(
        "--lock",
        type=Path,
        default=config.ROOT / "pipeline" / "models.lock",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=config.ROOT / "content" / "generated" / "aggregated.json",
    )
    args = parser.parse_args()

    extracted = load_json(args.input_path)
    sources = {source["id"]: source for source in load_json(args.sources)}
    lock = load_json(args.lock)
    output: dict[str, Any] = {
        "schemaVersion": "1.0.0",
        "aggVersion": lock["aggVersion"],
        "modelLockHash": sha256_file(args.lock),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "levels": [],
    }

    for record in extracted["levels"]:
        source = sources.get(record["id"])
        if source is None:
            raise PipelineError(f"找不到源句：{record['id']}")
        primary = words_for_model(source, record["primary"])
        control = words_for_model(source, record["control"])
        excluded = {source["focus"], *source["punct"]}
        comparable_indices = [
            index
            for index in range(len(source["tokens"]))
            if index not in excluded
        ]
        agreement = spearman(
            [primary["panorama"][index] for index in comparable_indices],
            [control["panorama"][index] for index in comparable_indices],
        )
        strength, groups = case_strength(
            primary["panorama"],
            source["focus"],
            source["punct"],
            source["coref"],
        )
        output["levels"].append(
            {
                "id": source["id"],
                "lenses": primary,
                "stability": record["primary"]["stability"],
                "crossModelAgreement": round(agreement, 12),
                "caseStrength": round(strength, 12),
                "topGroups": groups[:3],
            }
        )

    write_json_atomic(args.out, output)
    print(f"聚合完成：{args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
