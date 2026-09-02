[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$demoRoot = Split-Path $PSScriptRoot -Parent
$secretDir = Join-Path $demoRoot '.local'
New-Item -ItemType Directory -Path $secretDir -Force | Out-Null
foreach ($name in @('provider-token', 'provider-password')) {
    $target = Join-Path $secretDir $name
    if (-not (Test-Path -LiteralPath $target)) {
        [IO.File]::WriteAllText($target, [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)))
    }
}
docker compose -f (Join-Path $demoRoot 'compose.yaml') up -d --build
if ($LASTEXITCODE -ne 0) { throw 'Demo startup failed.' }
Write-Host 'Demo: http://127.0.0.1:19180; Prometheus: http://127.0.0.1:19090'
Write-Host 'Connection endpoints: http://127.0.0.1:19181/none, /basic, /bearer'
Write-Host 'Basic username: metrics-reader. Test credentials are in .local/provider-password and .local/provider-token (not printed).'
