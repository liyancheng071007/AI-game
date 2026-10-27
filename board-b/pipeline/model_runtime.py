from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Sequence

import config  # noqa: F401 - config sets all cache variables before model imports
import torch
from modelscope.hub.snapshot_download import snapshot_download
from transformers import AutoModel, AutoTokenizer

from common import PipelineError, load_json, sha256_file, write_json_atomic


@dataclass(frozen=True)
class ModelSpec:
    label: str
    repo_id: str
    revision: str
    local_dir: Path


@dataclass
class ModelBundle:
    spec: ModelSpec
    tokenizer: Any
    model: Any


def resolve_and_download_models(lock_path: Path) -> dict[str, Any]:
    lock = load_json(lock_path)
    for label in ("primary", "control"):
        spec = lock[label]
        local_dir = (config.ROOT / spec["localDir"]).resolve()
        local_dir.mkdir(parents=True, exist_ok=True)
        snapshot_download(
            model_id=spec["providerModelId"],
            revision=spec["revision"],
            cache_dir=str(config.MODELSCOPE_CACHE),
            local_dir=str(local_dir),
            allow_file_pattern=[
                "config.json",
                "configuration.json",
                "tokenizer.json",
                "tokenizer_config.json",
                "special_tokens_map.json",
                "added_tokens.json",
                "vocab.txt",
                spec["weightFile"],
            ],
            local_files_only=False,
        )
        weight_path = local_dir / spec["weightFile"]
        if not weight_path.is_file():
            raise PipelineError(f"模型权重未下载成功：{weight_path}")
        spec["modelSha256"] = sha256_file(weight_path)
        print(
            f"{label}: {spec['repoId']}@{spec['revision']} "
            f"sha256={spec['modelSha256']}"
        )
    write_json_atomic(lock_path, lock)
    return lock


def load_bundle(spec_data: dict[str, Any], label: str) -> ModelBundle:
    revision = spec_data.get("revision")
    if not revision:
        raise PipelineError("models.lock 缺少 revision，请先运行 resolve_models.py")
    spec = ModelSpec(
        label=label,
        repo_id=spec_data["repoId"],
        revision=revision,
        local_dir=(config.ROOT / spec_data["localDir"]).resolve(),
    )
    tokenizer = AutoTokenizer.from_pretrained(
        spec.local_dir,
        use_fast=True,
        local_files_only=True,
    )
    model = AutoModel.from_pretrained(
        spec.local_dir,
        attn_implementation="eager",
        local_files_only=True,
    )
    model.eval()
    model.to("cpu")
    model.requires_grad_(False)
    return ModelBundle(spec=spec, tokenizer=tokenizer, model=model)


def token_word_positions(
    bundle: ModelBundle,
    tokens: Sequence[str],
) -> tuple[torch.Tensor, list[list[int]]]:
    text = "".join(tokens)
    encoded = bundle.tokenizer(
        text,
        return_tensors="pt",
        return_offsets_mapping=True,
        add_special_tokens=True,
        truncation=False,
    )
    offsets = encoded["offset_mapping"][0].tolist()
    word_positions: list[list[int]] = []
    cursor = 0
    for word in tokens:
        start = cursor
        end = start + len(word)
        positions = [
            index
            for index, (left, right) in enumerate(offsets)
            if not (left == right == 0)
            and left < end
            and right > start
        ]
        if not positions:
            raise PipelineError(f"分词器无法映射词语：{word!r}")
        word_positions.append(positions)
        cursor = end
    if cursor != len(text):
        raise PipelineError("词序列无法完整覆盖原句")
    encoded.pop("offset_mapping")
    return encoded["input_ids"], word_positions


def model_attentions(
    bundle: ModelBundle,
    tokens: Sequence[str],
) -> tuple[tuple[torch.Tensor, ...], list[list[int]]]:
    input_ids, word_positions = token_word_positions(bundle, tokens)
    attention_mask = torch.ones_like(input_ids)
    with torch.inference_mode():
        outputs = bundle.model(
            input_ids=input_ids,
            attention_mask=attention_mask,
            output_attentions=True,
            return_dict=True,
        )
    if outputs.attentions is None:
        raise PipelineError(f"{bundle.spec.repo_id} 未返回注意力张量")
    return tuple(tensor.detach().clone() for tensor in outputs.attentions), word_positions


def selected_attention(
    attentions: Sequence[torch.Tensor],
    heads: Sequence[Sequence[int]] | None,
    last_layers: int | None = None,
) -> torch.Tensor:
    if last_layers is not None:
        layers = list(attentions[-last_layers:])
        stacked = torch.stack([layer[0] for layer in layers], dim=0)
        return stacked.mean(dim=(0, 1))
    if not heads:
        raise PipelineError("主题透镜没有已校准的注意力头")
    selected = []
    for layer_index, head_index in heads:
        tensor = attentions[layer_index][0, head_index]
        selected.append(tensor)
    return torch.stack(selected, dim=0).mean(dim=0)


def word_attention(
    attention: torch.Tensor,
    focus_positions: Sequence[int],
    word_positions: Sequence[Sequence[int]],
    focus: int,
    punct: Sequence[int],
) -> list[float]:
    if attention.ndim != 2:
        raise PipelineError("聚合后的注意力必须是二维 key × query 矩阵")
    focus_distribution = attention[list(focus_positions), :].mean(dim=0)
    excluded = {focus, *punct}
    weights = []
    for word_index, positions in enumerate(word_positions):
        if word_index in excluded:
            weights.append(0.0)
        else:
            weights.append(float(focus_distribution[positions].sum().item()))
    total = sum(weights)
    if total <= 0:
        raise PipelineError("焦点词没有可归一化的词级注意力")
    return [weight / total for weight in weights]


def target_mass(
    attention: torch.Tensor,
    focus_positions: Sequence[int],
    word_positions: Sequence[Sequence[int]],
    targets: Sequence[int],
) -> float:
    focus_distribution = attention[list(focus_positions), :].mean(dim=0)
    return float(
        sum(
            focus_distribution[word_positions[target]].sum().item()
            for target in targets
        )
    )


def model_config_sha(bundle: ModelBundle) -> str:
    files = sorted(
        path
        for path in Path(bundle.model.name_or_path).glob("*")
        if path.is_file() and path.suffix in {".bin", ".safetensors", ".json"}
    )
    if not files:
        return ""
    return sha256_file(files[0])
