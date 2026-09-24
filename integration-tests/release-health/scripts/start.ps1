[CmdletBinding()]
param(
    [ValidateSet('cycle', 'healthy', 'regression', 'recovery')]
    [string]$Scenario = 'cycle',
    [ValidateRange(45, 3600)]
    [int]$PhaseSeconds = 60
)
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
$previousScenario = $env:FEATBIT_DEMO_SCENARIO
$previousPhaseSeconds = $env:FEATBIT_DEMO_PHASE_SECONDS
try {
    $env:FEATBIT_DEMO_SCENARIO = $Scenario
    $env:FEATBIT_DEMO_PHASE_SECONDS = [string]$PhaseSeconds
    docker compose -f (Join-Path $demoRoot 'compose.yaml') up -d --build
    if ($LASTEXITCODE -ne 0) { throw 'Demo startup failed.' }
} finally {
    $env:FEATBIT_DEMO_SCENARIO = $previousScenario
    $env:FEATBIT_DEMO_PHASE_SECONDS = $previousPhaseSeconds
}
$deadline = [DateTime]::UtcNow.AddSeconds(60)
$ready = $false
do {
    try {
        $health = Invoke-RestMethod -Uri 'http://127.0.0.1:19180/health' -TimeoutSec 3
        $ready = $health.status -eq 'ok' -and $health.phaseSeconds -eq $PhaseSeconds
    } catch { }
    if (-not $ready) { Start-Sleep -Seconds 1 }
} while (-not $ready -and [DateTime]::UtcNow -lt $deadline)
if (-not $ready) { throw 'Demo did not become ready with the requested phase duration.' }
# Reusing running containers must also resume a cycle left in a manual scenario.
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:19180/scenario/$Scenario" -TimeoutSec 5 | Out-Null
Write-Host 'Demo: http://127.0.0.1:19180; Prometheus: http://127.0.0.1:19090'
Write-Host "Scenario: $Scenario; phase duration: $PhaseSeconds seconds. Containers keep running until scripts/stop.ps1 is used."
Write-Host 'Connection endpoints: http://127.0.0.1:19181/none, /basic, /bearer'
Write-Host 'Basic username: metrics-reader. Test credentials are in .local/provider-password and .local/provider-token (not printed).'
