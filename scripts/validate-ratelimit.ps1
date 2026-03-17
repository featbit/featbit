# validate-ratelimit.ps1
# Validates per-envId rate limiting on the FeatBit evaluation server.
# Expects test-secrets.json to have been created by setup-ratelimit-test.ps1.

param(
    [string]$SecretsFile = "$PSScriptRoot\test-secrets.json",
    [switch]$TestReplenishment,
    # Set when using the in-memory SlidingWindowRateLimiter, which does not produce
    # Retry-After metadata. The header check becomes advisory rather than a hard failure.
    [switch]$RetryAfterOptional
)

$ErrorActionPreference = "Stop"

# ── Load secrets ──────────────────────────────────────────────────────────────
if (-not (Test-Path $SecretsFile)) {
    Write-Error "Secrets file not found at $SecretsFile. Run setup-ratelimit-test.ps1 first."
    exit 1
}

$config = Get-Content $SecretsFile -Raw | ConvertFrom-Json
$evalBase     = $config.evalBase
$permitLimit  = $config.permitLimit
$secretA      = $config.envA.secret
$secretB      = $config.envB.secret
$envAName     = $config.envA.name
$envBName     = $config.envB.name

$endpoint = "$evalBase/api/public/sdk/server/latest-all?timestamp=0"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host " FeatBit Rate-Limit Validation" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Endpoint    : $endpoint"
Write-Host "  Permit Limit: $permitLimit requests / $($config.windowSeconds)s"
Write-Host "  Env A       : $envAName (secret: $($secretA.Substring(0,10))...)"
Write-Host "  Env B       : $envBName (secret: $($secretB.Substring(0,10))...)"
Write-Host ""

$passed = 0
$failed = 0
$total  = 0

function Assert-True {
    param(
        [bool]$Condition,
        [string]$Description
    )
    $script:total++
    if ($Condition) {
        $script:passed++
        Write-Host "  [PASS] $Description" -ForegroundColor Green
    } else {
        $script:failed++
        Write-Host "  [FAIL] $Description" -ForegroundColor Red
    }
}

function Send-Request {
    param(
        [string]$Secret,
        [string]$Url
    )
    try {
        $resp = Invoke-WebRequest -Uri $Url -Method Get `
            -Headers @{ Authorization = $Secret } `
            -UseBasicParsing -ErrorAction Stop
        return @{
            StatusCode = $resp.StatusCode
            Headers    = $resp.Headers
            Body       = $resp.Content
        }
    } catch [System.Net.WebException] {
        $webResp = $_.Exception.Response
        if ($webResp) {
            $statusCode = [int]$webResp.StatusCode
            $headers = @{}
            foreach ($key in $webResp.Headers.AllKeys) {
                $headers[$key] = $webResp.Headers[$key]
            }
            $body = ""
            try {
                $stream = $webResp.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($stream)
                $body = $reader.ReadToEnd()
                $reader.Close()
            } catch { }
            return @{
                StatusCode = $statusCode
                Headers    = $headers
                Body       = $body
            }
        }
        return @{ StatusCode = 0; Headers = @{}; Body = $_.Exception.Message }
    } catch {
        # PowerShell 7+ uses HttpRequestException wrapping HttpResponseMessage
        $ex = $_.Exception
        $resp = $_.Exception.Response
        if ($resp) {
            $statusCode = [int]$resp.StatusCode
            $headers = @{}
            foreach ($h in $resp.Headers) {
                $headers[$h.Key] = ($h.Value -join ",")
            }
            # Also check Content headers for completeness
            if ($resp.Content -and $resp.Content.Headers) {
                foreach ($h in $resp.Content.Headers) {
                    $headers[$h.Key] = ($h.Value -join ",")
                }
            }
            # PowerShell captures the body in ErrorDetails.Message
            $body = $_.ErrorDetails.Message
            if (-not $body) {
                try { $body = $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult() } catch { }
            }
            return @{
                StatusCode = $statusCode
                Headers    = $headers
                Body       = $body
            }
        }
        return @{ StatusCode = 0; Headers = @{}; Body = $ex.Message }
    }
}

# ── Test 1: Env A — first N requests should succeed ──────────────────────────
Write-Host "── Test 1: Env A — $permitLimit requests should succeed ──" -ForegroundColor Yellow
$envAStatuses = @()
for ($i = 1; $i -le $permitLimit; $i++) {
    $r = Send-Request -Secret $secretA -Url $endpoint
    $envAStatuses += $r.StatusCode
    Assert-True ($r.StatusCode -ne 429) "Env A request $i => HTTP $($r.StatusCode) (expected non-429)"
}

# ── Test 2: Env A — next request should be 429 ───────────────────────────────
Write-Host "`n── Test 2: Env A — request $($permitLimit + 1) should be rate-limited ──" -ForegroundColor Yellow
$r = Send-Request -Secret $secretA -Url $endpoint
Assert-True ($r.StatusCode -eq 429) "Env A request $($permitLimit + 1) => HTTP $($r.StatusCode) (expected 429)"

# Check Retry-After header
$retryAfter = $null
if ($r.Headers -and $r.Headers.ContainsKey("Retry-After")) {
    $retryAfter = $r.Headers["Retry-After"]
}
if ($RetryAfterOptional) {
    # In-memory SlidingWindowRateLimiter does not expose Retry-After metadata;
    # omitting the header is expected behaviour — log but don't count as failure.
    if ($null -ne $retryAfter) {
        $script:total++; $script:passed++
        Write-Host "  [PASS] Env A 429 response has Retry-After header (value: $retryAfter)" -ForegroundColor Green
    } else {
        Write-Host "  [INFO] Env A 429 response has no Retry-After header (expected for in-memory SlidingWindow)" -ForegroundColor DarkGray
    }
} else {
    Assert-True ($null -ne $retryAfter) "Env A 429 response has Retry-After header (value: $retryAfter)"
}

# Check error body
$hasErrorBody = $r.Body -match "Rate limit exceeded"
Assert-True $hasErrorBody "Env A 429 response body contains 'Rate limit exceeded'"

# ── Test 3: Env B — should NOT be affected by Env A's exhaustion ─────────────
Write-Host "`n── Test 3: Env B — $permitLimit requests should succeed (independent bucket) ──" -ForegroundColor Yellow
$envBStatuses = @()
for ($i = 1; $i -le $permitLimit; $i++) {
    $r = Send-Request -Secret $secretB -Url $endpoint
    $envBStatuses += $r.StatusCode
    Assert-True ($r.StatusCode -ne 429) "Env B request $i => HTTP $($r.StatusCode) (expected non-429)"
}

# ── Test 4: Env B — next request should also be 429 ──────────────────────────
Write-Host "`n── Test 4: Env B — request $($permitLimit + 1) should be rate-limited ──" -ForegroundColor Yellow
$r = Send-Request -Secret $secretB -Url $endpoint
Assert-True ($r.StatusCode -eq 429) "Env B request $($permitLimit + 1) => HTTP $($r.StatusCode) (expected 429)"

$retryAfterB = $null
if ($r.Headers -and $r.Headers.ContainsKey("Retry-After")) {
    $retryAfterB = $r.Headers["Retry-After"]
}
if ($RetryAfterOptional) {
    if ($null -ne $retryAfterB) {
        $script:total++; $script:passed++
        Write-Host "  [PASS] Env B 429 response has Retry-After header (value: $retryAfterB)" -ForegroundColor Green
    } else {
        Write-Host "  [INFO] Env B 429 response has no Retry-After header (expected for in-memory SlidingWindow)" -ForegroundColor DarkGray
    }
} else {
    Assert-True ($null -ne $retryAfterB) "Env B 429 response has Retry-After header (value: $retryAfterB)"
}

# ── Test 5: Env A is still rate-limited (window hasn't expired) ──────────────
Write-Host "`n── Test 5: Env A — still rate-limited (window active) ──" -ForegroundColor Yellow
$r = Send-Request -Secret $secretA -Url $endpoint
Assert-True ($r.StatusCode -eq 429) "Env A extra request => HTTP $($r.StatusCode) (expected 429, window still active)"

# ── Test 6 (optional): Token replenishment ─ wait for refill, then verify access restored ─
if ($TestReplenishment) {
    $replenishSeconds = $config.windowSeconds
    Write-Host "`n── Test 6: Token replenishment — wait ${replenishSeconds}s then verify access restored ──" -ForegroundColor Yellow
    Write-Host "  Sleeping ${replenishSeconds}s for token replenishment..." -ForegroundColor DarkGray
    Start-Sleep -Seconds ($replenishSeconds + 2)  # +2s buffer

    $r = Send-Request -Secret $secretA -Url $endpoint
    Assert-True ($r.StatusCode -ne 429) "Env A after replenishment => HTTP $($r.StatusCode) (expected non-429)"

    $r = Send-Request -Secret $secretB -Url $endpoint
    Assert-True ($r.StatusCode -ne 429) "Env B after replenishment => HTTP $($r.StatusCode) (expected non-429)"
}

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host " Results: $passed/$total passed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })
Write-Host "============================================" -ForegroundColor Cyan

if ($failed -gt 0) {
    Write-Host " $failed test(s) FAILED" -ForegroundColor Red
    exit 1
} else {
    Write-Host " All tests PASSED — rate limiting works!" -ForegroundColor Green
    exit 0
}
