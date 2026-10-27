$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "env.ps1")

$issues = [System.Collections.Generic.List[string]]::new()
if ((Resolve-Path $ProjectRoot).Drive.Name -ne "E") {
    $issues.Add("Project root is not on drive E")
}

$requiredPaths = @(
    (Join-Path $ProjectRoot "node_modules"),
    (Join-Path $ProjectRoot ".cache\pnpm"),
    (Join-Path $ProjectRoot ".cache\pip"),
    (Join-Path $ProjectRoot ".cache\modelscope"),
    (Join-Path $ProjectRoot ".models\primary"),
    (Join-Path $ProjectRoot ".models\control"),
    $PythonExe
)
foreach ($path in $requiredPaths) {
    if (-not (Test-Path -LiteralPath $path)) {
        $issues.Add("Missing E-drive path: $path")
    }
}

$environmentPaths = @(
    $env:NPM_CONFIG_CACHE,
    $env:PIP_CACHE_DIR,
    $env:HF_HOME,
    $env:TORCH_HOME,
    $env:MODELSCOPE_CACHE,
    $env:TEMP
)
foreach ($path in $environmentPaths) {
    $resolved = [System.IO.Path]::GetFullPath($path)
    if (-not $resolved.StartsWith("E:\", [System.StringComparison]::OrdinalIgnoreCase)) {
        $issues.Add("Cache path is outside drive E: $resolved")
    }
}

$drive = Get-PSDrive -Name E
if ($drive.Free -lt 1GB) {
    $issues.Add("Drive E has less than 1GB free")
}

if ($issues.Count -gt 0) {
    $issues | ForEach-Object { Write-Error $_ }
    exit 1
}

Write-Host "Preflight passed: project, dependencies, Python, models and caches are on drive E."
Write-Host ("Drive E free space: {0:N2} GB" -f ($drive.Free / 1GB))
