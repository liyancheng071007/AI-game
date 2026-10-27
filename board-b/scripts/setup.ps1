$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "env.ps1")

Set-Location $ProjectRoot
$installer = Join-Path $ProjectRoot ".tools\python-3.11.9-amd64.exe"
$portableDir = Join-Path $ProjectRoot ".tools\Python311"
$portablePython = Join-Path $portableDir "python.exe"

if (-not (Test-Path -LiteralPath $portablePython)) {
    if (-not (Test-Path -LiteralPath $installer)) {
        Invoke-WebRequest `
            -Uri "https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe" `
            -OutFile $installer
    }
    $installerArgs = @(
        "/quiet",
        "InstallAllUsers=0",
        "TargetDir=$portableDir",
        "Include_pip=1",
        "Include_venv=1",
        "Include_launcher=0",
        "Include_test=0",
        "AssociateFiles=0",
        "Shortcuts=0",
        "PrependPath=0",
        "SimpleInstall=1",
        "Log=$(Join-Path $ProjectRoot '.cache\python-install.log')"
    )
    $process = Start-Process `
        -FilePath $installer `
        -ArgumentList $installerArgs `
        -Wait `
        -PassThru `
        -WindowStyle Hidden
    if ($process.ExitCode -ne 0) {
        throw "Python installation failed with exit code $($process.ExitCode)"
    }
}

if (-not (Test-Path -LiteralPath $PythonExe)) {
    & $portablePython -m venv (Join-Path $ProjectRoot ".venv")
}

& $PythonExe -m pip install --cache-dir $env:PIP_CACHE_DIR -r "pipeline\requirements.txt"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $PnPmCommand.Source install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $PnPmCommand.Source build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
