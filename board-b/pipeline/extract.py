from __future__ import annotations

import argparse
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import config
import torch

from common import (
    PipelineError,
    load_json,
    sha256_file,
    write_json_atomic,
)
from model_runtime import (
    ModelBundle,
    load_bundle,
    model_attentions,
    selected_attention,
    word_attention,
)


LENSES = ("panorama", "coref", "causal", "emotion", "position")


def same_attentions(
    left: tuple[torch.Tensor, ...],
    right: tuple[torch.Tensor, ...],
) -> bool:
    return len(left) == len(right) and all(
        torch.equal(left_tensor, right_tensor)
        for left_tensor, right_tensor in zip(left, right, strict=True)
    )


def extract_lenses(
    bundle: ModelBundle,
    attentions: tuple[torch.Tensor, ...],
    word_positions: list[list[int]],
    source: dict[str, Any],
    heads: dict[str, list[list[int]]],
) -> dict[str, list[float]]:
    focus_positions = word_positions[source["focus"]]
    result: dict[str, list[float]] = {}
    panorama = selected_attention(attentions, heads=None, last_layers=4)
    result["panorama"] = word_attention(
        panorama,
        focus_positions,
        word_positions,
        source["focus"],
        source["punct"],
    )
    for lens in LENSES[1:]:
        attention = selected_attention(attentions, heads=lens and heads[lens])
        result[lens] = word_attention(
            attention,
            focus_positions,
            word_positions,
            source["focus"],
            source["punct"],
        )
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="从两套真实中文模型抽取词级注意力")
    parser.add_argument(
        "--in",
        dest="input_path",
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
        default=config.ROOT / "content" / "generated" / "extracted.json",
    )
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args()

    lock = load_json(args.lock)
    if not lock.get("lenses"):
        raise PipelineError("models.lock 尚未校准透镜，请先运行 calibrate_lenses.py")
    levels = load_json(args.input_path)
    if args.limit is not None:
        levels = levels[: args.limit]

    torch.set_num_threads(1)
    torch.use_deterministic_algorithms(True)
    torch.manual_seed(0)

    bundles = {
        label: load_bundle(lock[label], label) for label in ("primary", "control")
    }
    output: dict[str, Any] = {
        "schemaVersion": "1.0.0",
        "modelLockHash": sha256_file(args.lock),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "levels": [],
    }

    for index, source in enumerate(levels, start=1):
        print(f"[{index}/{len(levels)}] {source['id']}")
        records: dict[str, Any] = {}
        primary_attentions: tuple[torch.Tensor, ...] | None = None
        primary_positions: list[list[int]] | None = None
        for label in ("primary", "control"):
            bundle = bundles[label]
            heads = lock["lenses"][label]
            attentions, word_positions = model_attentions(bundle, source["tokens"])
            weights = extract_lenses(
                bundle,
                attentions,
                word_positions,
                source,
                heads,
            )
            record: dict[str, Any] = {"weights": weights}
            if label == "primary":
                primary_attentions = attentions
                primary_positions = word_positions
                repeated, repeated_positions = model_attentions(
                    bundle, source["tokens"]
                )
                if repeated_positions != word_positions:
                    raise PipelineError(f"{source['id']} 的重复分词结果不一致")
                record["stability"] = (
                    1.0 if same_attentions(attentions, repeated) else 0.0
                )
            records[label] = record

        if primary_attentions is None or primary_positions is None:
            raise PipelineError("主模型没有生成注意力")
        output["levels"].append(
            {
                "id": source["id"],
                "tokens": source["tokens"],
                **records,
            }
        )
        write_json_atomic(args.out, output)

    print(f"真实模型抽取完成：{args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
