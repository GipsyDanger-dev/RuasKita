$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$processFile = Join-Path $projectRoot '.runtime/phone-processes.json'
if (-not (Test-Path -LiteralPath $processFile)) { throw 'No managed phone preview process file.' }
$managed = Get-Content -LiteralPath $processFile -Raw | ConvertFrom-Json
foreach ($entry in @($managed)[($managed.Count - 1)..0]) {
    $child = Get-Process -Id $entry.pid -ErrorAction SilentlyContinue
    if ($child -and $child.StartTime.ToUniversalTime().ToString('o') -eq $entry.started) {
        & (Join-Path $env:SystemRoot 'System32/taskkill.exe') /PID $child.Id /T /F
    }
}
