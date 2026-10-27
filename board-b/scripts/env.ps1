$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$env:PNPM_HOME = Join-Path $ProjectRoot ".tools\pnpm"
$env:NPM_CONFIG_CACHE = Join-Path $ProjectRoot ".cache\npm"
$env:XDG_CACHE_HOME = Join-Path $ProjectRoot ".cache"
$env:PIP_CACHE_DIR = Join-Path $ProjectRoot ".cache\pip"
$env:HF_HOME = Join-Path $ProjectRoot ".cache\hf"
$env:HF_HUB_CACHE = Join-Path $ProjectRoot ".cache\hf\hub"
$env:TORCH_HOME = Join-Path $ProjectRoot ".cache\torch"
$env:MODELSCOPE_CACHE = Join-Path $ProjectRoot ".cache\modelscope"
$env:TEMP = Join-Path $ProjectRoot ".cache\tmp"
$env:TMP = Join-Path $ProjectRoot ".cache\tmp"
$env:TOKENIZERS_PARALLELISM = "false"
$env:CI = "true"

New-Item -ItemType Directory -Path $env:TEMP -Force | Out-Null

$PythonExe = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$PnPmCommand = Get-Command pnpm -ErrorAction Stop
