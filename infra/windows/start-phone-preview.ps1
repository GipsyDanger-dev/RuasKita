[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$runtimeDir = Join-Path $projectRoot '.runtime'
$null = New-Item -ItemType Directory -Path $runtimeDir -Force
$node = (Get-Command node -ErrorAction Stop).Source
$tunnel = (Get-Command cloudflared -ErrorAction Stop).Source
foreach ($port in @(3000, 8000, 3080)) {
    if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) { throw "Port $port occupied; no existing process was stopped." }
}
if (-not (Test-Path (Join-Path $projectRoot 'apps/web/.next-host/BUILD_ID'))) { throw 'Run build-host.ps1 first.' }
$credentialFile = Join-Path $runtimeDir 'phone-access.json'
$randomBytes = New-Object byte[] 18
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($randomBytes)
$rng.Dispose()
$password = [Convert]::ToBase64String($randomBytes).TrimEnd('=').Replace('+','-').Replace('/','_')
@{ username='ruaskita'; password=$password; origin=$null } | ConvertTo-Json | Set-Content -LiteralPath $credentialFile -Encoding UTF8
$env:NEXT_PUBLIC_API_URL = '/api'
$env:RUASKITA_WEB_DIST_DIR = '.next-host'
$env:RUASKITA_API_PROXY_TARGET = 'http://127.0.0.1:8000'
$env:RUASKITA_ORIGINS = 'http://127.0.0.1:3000,http://localhost:3000'
$env:RUASKITA_DISABLE_MODEL = '0'
$env:NODE_ENV = 'production'
$started = @()
function Start-PreviewProcess([string]$Executable, [string]$Arguments, [string]$Directory, [string]$Name) {
    $child = Start-Process -FilePath $Executable -ArgumentList $Arguments -WorkingDirectory $Directory -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $runtimeDir "$Name.out.log") -RedirectStandardError (Join-Path $runtimeDir "$Name.err.log")
    return @{ name=$Name; pid=$child.Id; started=$child.StartTime.ToUniversalTime().ToString('o') }
}
$started += Start-PreviewProcess (Join-Path $projectRoot '.venv/Scripts/python.exe') '-m uvicorn services.api.app.main:app --host 127.0.0.1 --port 8000 --no-proxy-headers' $projectRoot 'phone-api'
$started += Start-PreviewProcess $node 'node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3000' (Join-Path $projectRoot 'apps/web') 'phone-web'
$gatewayArgs = '"{0}" "{1}"' -f (Join-Path $PSScriptRoot 'phone-gateway.mjs'), $credentialFile
$started += Start-PreviewProcess $node $gatewayArgs $projectRoot 'phone-gateway'
$started += Start-PreviewProcess $tunnel 'tunnel --url http://127.0.0.1:3080 --no-autoupdate' $projectRoot 'phone-tunnel'
$started | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runtimeDir 'phone-processes.json') -Encoding UTF8
Write-Host 'Preview processes requested. Credential file: .runtime/phone-access.json'
$tunnelLog = Join-Path $runtimeDir 'phone-tunnel.err.log'
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    $logText = Get-Content -LiteralPath $tunnelLog -Raw -ErrorAction SilentlyContinue
    if ($logText -match 'https://[a-z0-9-]+\.trycloudflare\.com') {
        $previewOrigin = $Matches[0]
        @{ username='ruaskita'; password=$password; origin=$previewOrigin } | ConvertTo-Json | Set-Content -LiteralPath $credentialFile -Encoding UTF8
        Write-Host "Phone preview: $previewOrigin/scan"
        exit 0
    }
    Start-Sleep -Seconds 1
}
Write-Warning 'Tunnel URL not ready. Inspect .runtime/phone-tunnel.err.log; do not assume remote access works.'
