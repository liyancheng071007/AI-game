from __future__ import annotations

import argparse
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import config
import torch

from common import PipelineError, load_json, sha256_file, write_json_atomic
from model_runtime import load_bundle, model_attentions, target_mass, token_word_positions


THEMATIC_LENSES = ("coref", "causal", "emotion", "position")
TOP_HEADS = 4


def calibrate_bundle(bundle: Any, probes: list[dict[str, Any]]) -> dict[str, list[list[int]]]:
    scores: dict[str, list[list[float]]] = {
        lens: [] for lens in THEMATIC_LENSES
    }
    for probe in probes:
        lens = probe["lens"]
        if lens not in scores:
            raise PipelineError(f"未知探针透镜：{lens}")
        attentions, word_positions = model_attentions(bundle, probe["tokens"])
        focus_positions = word_positions[probe["focus"]]
        head_scores: list[float] = []
        for layer in attentions:
            for head_index in range(layer.shape[1]):
                head_scores.append(
                    target_mass(
                        layer[0, head_index],
                        focus_positions,
                        word_positions,
                        probe["targets"],
                    )
                )
        scores[lens].append(head_scores)

    layer_count = attentions[0].shape[0]
    head_count = attentions[0].shape[1]
    result: dict[str, list[list[int]]] = {}
    detail: dict[str, list[dict[str, Any]]] = {}
    for lens in THEMATIC_LENSES:
        if not scores[lens]:
            raise PipelineError(f"透镜 {lens} 没有探针")
        matrix = torch.tensor(scores[lens], dtype=torch.float64)
        means = matrix.mean(dim=0).tolist()
        ranked = sorted(
            (
                (mean, index // head_count, index % head_count)
                for index, mean in enumerate(means)
            ),
            key=lambda item: (-item[0], item[1], item[2]),
        )
        result[lens] = [
            [layer, head] for _, layer, head in ranked[:TOP_HEADS]
        ]
        detail[lens] = [
            {"layer": layer, "head": head, "score": score}
            for score, layer, head in ranked
        ]

    result["_detail"] = detail  # type: ignore[assignment]
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="用探针冻结五种透镜的注意力头")
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
    parser.add_argument(
        "--out",
        type=Path,
        default=config.ROOT / "content" / "generated" / "probe_scores.json",
    )
    args = parser.parse_args()

    lock = load_json(args.lock)
    probes = load_json(args.probes)
    actual_probe_hash = sha256_file(args.probes)
    if lock.get("probeSetHash") not in {"", actual_probe_hash}:
        raise PipelineError("探针集已经变化，请运行 resolve_models.py 更新锁文件")
    lock["probeSetHash"] = actual_probe_hash

    torch.set_num_threads(1)
    torch.use_deterministic_algorithms(True)
    torch.manual_seed(0)

    output: dict[str, Any] = {"probeSetHash": actual_probe_hash, "models": {}}
    lens_locks: dict[str, Any] = {}
    for label in ("primary", "control"):
        print(f"校准 {label}...")
        bundle = load_bundle(lock[label], label)
        calibrated = calibrate_bundle(bundle, probes)
        detail = calibrated.pop("_detail")
        output["models"][label] = {
            "repoId": bundle.spec.repo_id,
            "revision": bundle.spec.revision,
            "heads": calibrated,
            "headScores": detail,
        }
        lens_locks[label] = calibrated

    lock["lenses"] = lens_locks
    lock["calibratedAt"] = datetime.now(timezone.utc).isoformat()
    write_json_atomic(args.lock, lock)
    write_json_atomic(args.out, output)
    print(f"透镜已冻结：{args.lock}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
