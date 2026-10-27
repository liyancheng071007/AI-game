from __future__ import annotations

import json
from pathlib import Path

import pytest

from common import (
    PipelineError,
    case_strength,
    normalize_word_weights,
    spearman,
)
from config import ROOT


def test_normalization_zeroes_focus_and_punctuation() -> None:
    result = normalize_word_weights([1, 2, 3, 4], focus=3, punct=[0])
    assert result[0] == 0
    assert result[3] == 0
    assert sum(result) == pytest.approx(1)


def test_empty_attention_is_rejected() -> None:
    with pytest.raises(PipelineError):
        normalize_word_weights([0, 0], focus=0, punct=[])


def test_coref_weights_merge_before_case_strength() -> None:
    value, groups = case_strength(
        [0.4, 0.05, 0.05, 0.5],
        focus=3,
        punct=[],
        coref=[{"entity": "奶娃", "members": [0, 1], "refersFrom": []}],
    )
    assert groups[0]["members"] == [0, 1]
    assert groups[0]["weight"] == pytest.approx(0.45)
    assert value == pytest.approx(0.85)


def test_spearman_handles_rank_reversal_and_ties() -> None:
    assert spearman([1, 2, 3], [3, 2, 1]) == pytest.approx(-1)
    tied = spearman([1, 1, 2], [2, 2, 1])
    assert tied == pytest.approx(-1)


def test_sources_are_inside_e_project_and_have_expected_counts() -> None:
    levels = json.loads(
        (ROOT / "content" / "sources" / "levels.json").read_text(encoding="utf-8")
    )
    probes = json.loads(
        (ROOT / "content" / "probes" / "probes.json").read_text(encoding="utf-8")
    )
    assert len(levels) == 12
    assert len(probes) == 12
    assert len({level["id"] for level in levels}) == 12
    assert {level["level"] for level in levels} == {1, 2, 3, 4, 5, 6}
    assert ROOT.drive.upper() == "E:"
