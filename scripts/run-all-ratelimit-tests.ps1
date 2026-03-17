# run-all-ratelimit-tests.ps1
# Orchestrates 6 rate-limiting test scenarios (3 algorithms × 2 modes)
# plus a TokenBucket replenishment test.
#
# Prerequisites:
#   1. docker compose -f docker-compose-ratelimiting.yml up -d --build
#   2. .\scripts\setup-ratelimit-test.ps1   (creates test-secrets.json)
#   3. .\scripts\run-all-ratelimit-tests.ps1

param(
    [string]$ComposeFile = "$PSScriptRoot\..\docker-compose-ratelimiting.yml",
    [string]$SecretsFile = "$PSScriptRoot\test-secrets.json",
    [int]$PermitLimit    = 5,
    [int]$WindowSeconds  = 10
)

$ErrorActionPreference = "Stop"
$scriptDir = $PSScriptRoot

# ── Scenario definitions ──────────────────────────────────────────────────────
# Each scenario maps to env vars consumed by docker-compose-ratelimiting.yml
$scenarios = @(
    @{
        Name        = "FixedWindow + Distributed (Redis)"
        EnvVars     = @{
            RATELIMIT_TYPE        = "FixedWindow"
            RATELIMIT_DISTRIBUTED = "true"
        }
        Replenish   = $false
    },
    @{
        Name        = "FixedWindow + Local (in-memory)"
        EnvVars     = @{
            RATELIMIT_TYPE        = "FixedWindow"
            RATELIMIT_DISTRIBUTED = "false"
        }
        Replenish   = $false
    },
    @{
        Name        = "SlidingWindow + Distributed (Redis)"
        EnvVars     = @{
            RATELIMIT_TYPE        = "SlidingWindow"
            RATELIMIT_DISTRIBUTED = "true"
        }
        Replenish   = $false
    },
    @{
        Name        = "SlidingWindow + Local (in-memory)"
        EnvVars     = @{
            RATELIMIT_TYPE        = "SlidingWindow"
            RATELIMIT_DISTRIBUTED = "false"
        }
        Replenish          = $false
        RetryAfterOptional = $true   # in-memory SlidingWindowRateLimiter does not expose Retry-After metadata
    },
    @{
        Name        = "TokenBucket + Distributed (Redis)"
        EnvVars     = @{
            RATELIMIT_TYPE        = "TokenBucket"
            RATELIMIT_DISTRIBUTED = "true"
        }
        Replenish   = $true
    },
    @{
        Name        = "TokenBucket + Local (in-memory)"
        EnvVars     = @{
            RATELIMIT_TYPE        = "TokenBucket"
            RATELIMIT_DISTRIBUTED = "false"
        }
        Replenish   = $true
    }
)

# ── Helpers ───────────────────────────────────────────────────────────────────
function Flush-Redis {
    Write-Host "  Flushing Redis..." -ForegroundColor DarkGray
    docker exec $(docker compose -f $ComposeFile ps -q redis) redis-cli FLUSHALL | Out-Null
}

function Restart-EvalServer {
    param([hashtable]$ExtraEnv)

    # Build the full set of env vars — shared defaults + scenario overrides
    $env:RATELIMIT_ENABLED             = "true"
    $env:RATELIMIT_PERMIT_LIMIT        = "$PermitLimit"
    $env:RATELIMIT_WINDOW_SECONDS      = "$WindowSeconds"
    $env:RATELIMIT_SEGMENTS_PER_WINDOW = "4"
    $env:RATELIMIT_TOKEN_LIMIT         = "$PermitLimit"
    $env:RATELIMIT_TOKENS_PER_PERIOD   = "$PermitLimit"
    $env:RATELIMIT_REPLENISHMENT_SECONDS = "$WindowSeconds"

    foreach ($kv in $ExtraEnv.GetEnumerator()) {
        Set-Item -Path "env:$($kv.Key)" -Value $kv.Value
    }

    Write-Host "  Restarting evaluation-server (Type=$($env:RATELIMIT_TYPE), Distributed=$($env:RATELIMIT_DISTRIBUTED))..." -ForegroundColor DarkGray

    # Recreate just the evaluation-server container with updated env
    docker compose -f $ComposeFile up -d --no-deps --force-recreate evaluation-server 2>&1 | Out-Null

    # Wait for it to become healthy / responsive
    Write-Host "  Waiting for evaluation-server to be ready..." -ForegroundColor DarkGray
    $maxWait = 30
    $ready = $false
    for ($i = 0; $i -lt $maxWait; $i++) {
        try {
            $resp = Invoke-WebRequest -Uri "http://localhost:5100/health/liveness" -UseBasicParsing -ErrorAction Stop -TimeoutSec 2
            if ($resp.StatusCode -eq 200) { $ready = $true; break }
        } catch { }
        Start-Sleep -Seconds 1
    }
    if (-not $ready) {
        Write-Host "  ⚠ evaluation-server did not become ready within ${maxWait}s" -ForegroundColor Red
        return $false
    }
    Write-Host "  evaluation-server is ready." -ForegroundColor DarkGray
    return $true
}

function Clean-EnvVars {
    # Remove orchestrator env vars so they don't leak between scenarios
    $vars = @(
        "RATELIMIT_ENABLED", "RATELIMIT_TYPE", "RATELIMIT_DISTRIBUTED",
        "RATELIMIT_PERMIT_LIMIT", "RATELIMIT_WINDOW_SECONDS",
        "RATELIMIT_SEGMENTS_PER_WINDOW", "RATELIMIT_TOKEN_LIMIT",
        "RATELIMIT_TOKENS_PER_PERIOD", "RATELIMIT_REPLENISHMENT_SECONDS"
    )
    foreach ($v in $vars) {
        Remove-Item -Path "env:$v" -ErrorAction SilentlyContinue
    }
}

# ── Pre-flight checks ────────────────────────────────────────────────────────
if (-not (Test-Path $SecretsFile)) {
    Write-Error "Secrets file not found at $SecretsFile. Run setup-ratelimit-test.ps1 first."
    exit 1
}

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║   FeatBit Rate-Limiting — Full Test Suite               ║" -ForegroundColor Magenta
Write-Host "║   6 scenarios (3 algorithms × 2 modes) + replenishment  ║" -ForegroundColor Magenta
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host ""
Write-Host "  Permit Limit : $PermitLimit requests / ${WindowSeconds}s window"
Write-Host "  Compose File : $ComposeFile"
Write-Host "  Secrets File : $SecretsFile"
Write-Host ""

# ── Run scenarios ─────────────────────────────────────────────────────────────
$results = @()

for ($idx = 0; $idx -lt $scenarios.Count; $idx++) {
    $s = $scenarios[$idx]
    $num = $idx + 1
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host " Scenario $num / $($scenarios.Count): $($s.Name)" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

    # 1. Flush Redis to clear any leftover rate-limit counters
    Flush-Redis

    # 2. Restart evaluation-server with scenario-specific config
    $ok = Restart-EvalServer -ExtraEnv $s.EnvVars
    if (-not $ok) {
        $results += @{ Name = $s.Name; Status = "SKIP (server not ready)" }
        Clean-EnvVars
        continue
    }

    # Small extra delay to let rate limiter initialize
    Start-Sleep -Seconds 2

    # 3. Run the validation script
    $validateArgs = @{ SecretsFile = $SecretsFile }
    if ($s.Replenish) {
        $validateArgs["TestReplenishment"] = $true
    }
    if ($s.RetryAfterOptional) {
        $validateArgs["RetryAfterOptional"] = $true
    }

    try {
        & "$scriptDir\validate-ratelimit.ps1" @validateArgs
        $exitCode = $LASTEXITCODE
    } catch {
        $exitCode = 1
        Write-Host "  ERROR: $_" -ForegroundColor Red
    }

    if ($exitCode -eq 0) {
        $results += @{ Name = $s.Name; Status = "PASSED" }
    } else {
        $results += @{ Name = $s.Name; Status = "FAILED" }
    }

    # 4. Clean up env vars
    Clean-EnvVars

    Write-Host ""
}

# ── Consolidated summary ─────────────────────────────────────────────────────
$totalScenarios = $results.Count
$passedScenarios = ($results | Where-Object { $_.Status -eq "PASSED" }).Count
$failedScenarios = ($results | Where-Object { $_.Status -eq "FAILED" }).Count
$skippedScenarios = ($results | Where-Object { $_.Status -like "SKIP*" }).Count

Write-Host "╔══════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║              Consolidated Results                       ║" -ForegroundColor Magenta
Write-Host "╠══════════════════════════════════════════════════════════╣" -ForegroundColor Magenta

foreach ($r in $results) {
    $icon = switch -Wildcard ($r.Status) {
        "PASSED"  { "✅" }
        "FAILED"  { "❌" }
        "SKIP*"   { "⏭️" }
    }
    $color = switch -Wildcard ($r.Status) {
        "PASSED"  { "Green" }
        "FAILED"  { "Red" }
        "SKIP*"   { "Yellow" }
    }
    $line = "  $icon $($r.Name)".PadRight(56) + $r.Status
    Write-Host "║ $line ║" -ForegroundColor $color
}

Write-Host "╠══════════════════════════════════════════════════════════╣" -ForegroundColor Magenta
$summaryLine = "  $passedScenarios passed, $failedScenarios failed, $skippedScenarios skipped / $totalScenarios total"
Write-Host "║ $($summaryLine.PadRight(57))║" -ForegroundColor $(if ($failedScenarios -eq 0) { "Green" } else { "Red" })
Write-Host "╚══════════════════════════════════════════════════════════╝" -ForegroundColor Magenta

if ($failedScenarios -gt 0) {
    exit 1
} else {
    Write-Host "`n All $passedScenarios scenarios PASSED!" -ForegroundColor Green
    exit 0
}
