from __future__ import annotations

import argparse
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import config

from common import load_json, write_json_atomic


LENSES = ("panorama", "coref", "causal", "emotion", "position")


def source_issues(source: dict[str, Any]) -> list[str]:
    issues: list[str] = []
    tokens = source["tokens"]
    focus = source["focus"]
    punct = source["punct"]
    if not 8 <= len(tokens) <= 16:
        issues.append(f"tokens 数量 {len(tokens)} 不在 8..16")
    if not 0 <= focus < len(tokens):
        issues.append("focus 越界")
    if focus in punct:
        issues.append("focus 不能是标点")
    if any(not 0 <= index < len(tokens) for index in punct):
        issues.append("punct 越界")
    owners: dict[int, str] = {}
    for group in source["coref"]:
        for member in group["members"]:
            if not 0 <= member < len(tokens):
                issues.append(f"同指成员 {member} 越界")
            previous = owners.get(member)
            if previous is not None and previous != group["entity"]:
                issues.append(f"同指成员 {member} 重复归属")
            owners[member] = group["entity"]
    return issues


def attention_issues(
    source: dict[str, Any],
    record: dict[str, Any],
) -> list[str]:
    issues: list[str] = []
    excluded = {source["focus"], *source["punct"]}
    for lens in LENSES:
        weights = record["lenses"][lens]
        if len(weights) != len(source["tokens"]):
            issues.append(f"{lens} 权重长度不一致")
            continue
        if any(not math.isfinite(value) or value < 0 for value in weights):
            issues.append(f"{lens} 包含非法权重")
        if any(weights[index] != 0 for index in excluded):
            issues.append(f"{lens} 未将焦点或标点清零")
        total = sum(
            weight
            for index, weight in enumerate(weights)
            if index not in excluded
        )
        if abs(total - 1) > 1e-6:
            issues.append(f"{lens} 归一化和为 {total}")
    if record["stability"] != 1:
        issues.append(f"稳定性为 {record['stability']}")
    if record["crossModelAgreement"] < 0.6:
        issues.append(f"跨模型相关性为 {record['crossModelAgreement']:.6f}")
    if record["caseStrength"] < 0.45:
        issues.append(f"区分度为 {record['caseStrength']:.6f}")
    return issues


def main() -> int:
    parser = argparse.ArgumentParser(description="执行内容与技术质量门禁")
    parser.add_argument(
        "--aggregated",
        type=Path,
        default=config.ROOT / "content" / "generated" / "aggregated.json",
    )
    parser.add_argument(
        "--sources",
        type=Path,
        default=config.ROOT / "content" / "sources" / "levels.json",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=config.ROOT / "content" / "generated" / "gates.json",
    )
    args = parser.parse_args()

    aggregated = load_json(args.aggregated)
    sources = {source["id"]: source for source in load_json(args.sources)}
    records: list[dict[str, Any]] = []
    for record in aggregated["levels"]:
        source = sources.get(record["id"])
        if source is None:
            records.append(
                {
                    "id": record["id"],
                    "passed": False,
                    "issues": ["找不到源句"],
                }
            )
            continue
        issues = source_issues(source) + attention_issues(source, record)
        records.append(
            {
                "id": source["id"],
                "passed": not issues,
                "issues": issues,
                "crossModelAgreement": record["crossModelAgreement"],
                "caseStrength": record["caseStrength"],
            }
        )

    report = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "passed": [record["id"] for record in records if record["passed"]],
        "rejected": [record["id"] for record in records if not record["passed"]],
        "records": records,
    }
    write_json_atomic(args.out, report)
    print(
        f"质量门禁：{len(report['passed'])} 通过，{len(report['rejected'])} 淘汰"
    )
    for record in records:
        if not record["passed"]:
            print(f"  {record['id']}: {'; '.join(record['issues'])}")
    return 0 if not report["rejected"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
