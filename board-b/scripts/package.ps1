$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ProjectLeaf = Split-Path -Leaf $ProjectRoot
$ParentDirectory = Split-Path -Parent $ProjectRoot
$ProjectDrive = (Resolve-Path $ProjectRoot).Drive.Name
if ($ProjectDrive -ne "E") {
    throw "Project root must be on drive E"
}
if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot "levels\draft\levels.json"))) {
    throw "draft levels are missing; run scripts\run-pipeline.ps1 first"
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$archiveName = "${ProjectLeaf}_handoff_${timestamp}.zip"
$archivePath = Join-Path $ParentDirectory $archiveName

$excludePaths = @(
    "$ProjectLeaf/.cache",
    "$ProjectLeaf/.models",
    "$ProjectLeaf/.tools",
    "$ProjectLeaf/.venv",
    "$ProjectLeaf/node_modules",
    "$ProjectLeaf/*/node_modules",
    "$ProjectLeaf/*/node_modules/*",
    "$ProjectLeaf/**/node_modules",
    "$ProjectLeaf/**/node_modules/*",
    "$ProjectLeaf/packages/schema/dist",
    "$ProjectLeaf/packages/engine/dist",
    "$ProjectLeaf/packages/daily/dist",
    "$ProjectLeaf/.git",
    "$ProjectLeaf/**/__pycache__",
    "$ProjectLeaf/**/*.pyc",
    "$ProjectLeaf/**/*.tsbuildinfo"
)

$tarArguments = @("-a", "-c", "-f", $archivePath)
foreach ($excludePath in $excludePaths) {
    $tarArguments += "--exclude=$excludePath"
}
$tarArguments += $ProjectLeaf

Push-Location $ParentDirectory
try {
    & tar.exe @tarArguments
    if ($LASTEXITCODE -ne 0) {
        throw "tar.exe failed with exit code $LASTEXITCODE"
    }
} finally {
    Pop-Location
}

$entries = & tar.exe -tf $archivePath
if ($LASTEXITCODE -ne 0) {
    Remove-Item -LiteralPath $archivePath -Force
    throw "Unable to inspect generated archive"
}
$forbidden = $entries | Where-Object {
    $_ -match '(^|/)(node_modules|\.cache|\.models|\.tools|\.venv|__pycache__)(/|$)'
}
if ($forbidden) {
    Remove-Item -LiteralPath $archivePath -Force
    throw "Archive contains excluded environment paths"
}

$sha256 = [System.Security.Cryptography.SHA256]::Create()
$stream = [System.IO.File]::OpenRead($archivePath)
try {
    $hashBytes = $sha256.ComputeHash($stream)
} finally {
    $stream.Dispose()
    $sha256.Dispose()
}
$hashText = ([System.BitConverter]::ToString($hashBytes)).Replace("-", "")
$checksumPath = "$archivePath.sha256"
$utf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText(
    $checksumPath,
    "$hashText  $archiveName`r`n",
    $utf8
)

$sizeMb = (Get-Item -LiteralPath $archivePath).Length / 1MB
Write-Host ("Handoff archive: {0}" -f $archivePath)
Write-Host ("Archive size: {0:N2} MB" -f $sizeMb)
Write-Host ("SHA-256 file: {0}" -f $checksumPath)
