$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "env.ps1")

Set-Location (Join-Path $ProjectRoot "pipeline")

$primaryWeight = Join-Path $ProjectRoot ".models\primary\model.safetensors"
$controlWeight = Join-Path $ProjectRoot ".models\control\pytorch_model.bin"
if (-not (Test-Path -LiteralPath $primaryWeight) -or -not (Test-Path -LiteralPath $controlWeight)) {
    & $PythonExe resolve_models.py
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

& $PythonExe calibrate_lenses.py
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $PythonExe extract.py
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $PythonExe aggregate.py
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $PythonExe gates.py
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $PythonExe build_levels.py
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Set-Location $ProjectRoot
& $PnPmCommand.Source build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $PnPmCommand.Source validate:levels
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
