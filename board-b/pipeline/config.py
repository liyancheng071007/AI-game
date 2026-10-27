from __future__ import annotations

import os
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CACHE_ROOT = ROOT / ".cache"
MODEL_ROOT = ROOT / ".models"
MODELSCOPE_CACHE = CACHE_ROOT / "modelscope"

HF_HOME = CACHE_ROOT / "hf"
HF_HUB_CACHE = HF_HOME / "hub"
TORCH_HOME = CACHE_ROOT / "torch"
PIP_CACHE_DIR = CACHE_ROOT / "pip"
TEMP_DIR = CACHE_ROOT / "tmp"


def configure_environment() -> None:
    """Point every model and temporary cache at the E-drive project."""
    TEMP_DIR.mkdir(parents=True, exist_ok=True)
    values = {
        "HF_HOME": HF_HOME,
        "HF_HUB_CACHE": HF_HUB_CACHE,
        "TORCH_HOME": TORCH_HOME,
        "MODELSCOPE_CACHE": MODELSCOPE_CACHE,
        "PIP_CACHE_DIR": PIP_CACHE_DIR,
        "TEMP": TEMP_DIR,
        "TMP": TEMP_DIR,
        "PYTHONUTF8": "1",
        "TOKENIZERS_PARALLELISM": "false",
    }
    for key, value in values.items():
        os.environ[key] = str(value)


configure_environment()
