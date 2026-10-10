$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$env:NEXT_PUBLIC_API_URL = '/api'
$env:RUASKITA_API_PROXY_TARGET = 'http://127.0.0.1:8000'
$env:RUASKITA_WEB_DIST_DIR = '.next-host'
$env:NODE_ENV = 'production'
$node = (Get-Command node -ErrorAction Stop).Source
Push-Location (Join-Path $projectRoot 'apps/web')
try {
    & $node 'node_modules/next/dist/bin/next' build
    if ($LASTEXITCODE -ne 0) { throw "Production build failed ($LASTEXITCODE)." }
} finally {
    Pop-Location
}
