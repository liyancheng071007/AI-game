from __future__ import annotations

import hashlib
import json
import math
import os
import tempfile
from pathlib import Path
from typing import Any, Iterable, Sequence

import numpy as np

from config import ROOT


class PipelineError(RuntimeError):
    pass


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json_atomic(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.",
        suffix=".tmp",
        dir=path.parent,
        text=True,
    )
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(value, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_name, path)
    finally:
        if os.path.exists(temporary_name):
            os.unlink(temporary_name)


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def relative_display(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(ROOT.resolve()))
    except ValueError:
        return str(path.resolve())


def ensure_project_path(path: Path) -> Path:
    resolved = path.resolve()
    try:
        resolved.relative_to(ROOT.resolve())
    except ValueError as error:
        raise PipelineError(f"路径必须位于 E 盘项目目录内：{resolved}") from error
    return resolved


def normalize_word_weights(
    weights: Sequence[float],
    focus: int,
    punct: Iterable[int],
) -> list[float]:
    if not weights:
        raise PipelineError("不能归一化空权重")
    excluded = {focus, *punct}
    values = [0.0 if index in excluded else float(weight) for index, weight in enumerate(weights)]
    if any(not math.isfinite(weight) or weight < -1e-12 for weight in values):
        raise PipelineError("注意力权重必须为有限非负数")
    values = [max(0.0, weight) for weight in values]
    total = sum(values)
    if total <= 0:
        raise PipelineError("归一化前的可评分权重之和必须大于 0")
    result = [weight / total for weight in values]
    correction = 1.0 - sum(result)
    result[max((i for i in range(len(result)) if i not in excluded), default=0)] += correction
    return result


def group_weights(
    weights: Sequence[float],
    focus: int,
    punct: Iterable[int],
    coref: Sequence[dict[str, Any]],
) -> list[dict[str, Any]]:
    excluded = {focus, *punct}
    owner: dict[int, int] = {}
    for group_index, group in enumerate(coref):
        for member in group["members"]:
            if member in owner and owner[member] != group_index:
                raise PipelineError(f"同指下标 {member} 被多个实体重复使用")
            owner[member] = group_index

    groups: list[dict[str, Any]] = []
    for group_index, group in enumerate(coref):
        members = sorted(index for index in group["members"] if index not in excluded)
        if not members:
            continue
        groups.append(
            {
                "entity": group["entity"],
                "members": members,
                "weight": sum(weights[index] for index in members),
            }
        )
    for token_index, weight in enumerate(weights):
        if token_index in excluded or token_index in owner:
            continue
        groups.append(
            {
                "entity": None,
                "members": [token_index],
                "weight": weight,
            }
        )

    return sorted(
        groups,
        key=lambda item: (-item["weight"], item["members"][0]),
    )


def case_strength(
    weights: Sequence[float],
    focus: int,
    punct: Iterable[int],
    coref: Sequence[dict[str, Any]],
) -> tuple[float, list[dict[str, Any]]]:
    groups = group_weights(weights, focus, punct, coref)
    if not groups:
        raise PipelineError("没有可评分目标")
    first = groups[0]["weight"]
    second = groups[1]["weight"] if len(groups) > 1 else 0.0
    return first + (first - second), groups


def average_ranks(values: Sequence[float]) -> np.ndarray:
    array = np.asarray(values, dtype=np.float64)
    order = np.argsort(array, kind="mergesort")
    ranks = np.empty(len(array), dtype=np.float64)
    start = 0
    while start < len(order):
        end = start + 1
        while end < len(order) and math.isclose(
            array[order[end]],
            array[order[start]],
            rel_tol=0,
            abs_tol=1e-12,
        ):
            end += 1
        average = (start + end - 1) / 2 + 1
        ranks[order[start:end]] = average
        start = end
    return ranks


def spearman(left: Sequence[float], right: Sequence[float]) -> float:
    if len(left) != len(right) or len(left) < 2:
        raise PipelineError("Spearman 相关系数至少需要两个等长样本")
    left_ranks = average_ranks(left)
    right_ranks = average_ranks(right)
    left_center = left_ranks - left_ranks.mean()
    right_center = right_ranks - right_ranks.mean()
    denominator = math.sqrt(
        float(np.dot(left_center, left_center) * np.dot(right_center, right_center))
    )
    if denominator == 0:
        return 1.0 if np.array_equal(left, right) else 0.0
    return float(np.dot(left_center, right_center) / denominator)
