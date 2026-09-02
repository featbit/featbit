[CmdletBinding()]
param([int]$PhaseSeconds = 45)
$ErrorActionPreference = 'Stop'
if ($PhaseSeconds -lt 40) { throw 'Each phase must cover the 30s PromQL lookback plus export/scrape delay.' }
$demoRoot = Split-Path $PSScriptRoot -Parent
$queries = Get-Content -LiteralPath (Join-Path $demoRoot 'queries/queries.json') -Raw | ConvertFrom-Json
$token = (Get-Content -LiteralPath (Join-Path $demoRoot '.local/provider-token') -Raw).Trim()
$password = (Get-Content -LiteralPath (Join-Path $demoRoot '.local/provider-password') -Raw).Trim()
$basic = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('metrics-reader:' + $password))
function Query([string]$expression, [string]$mode = 'none', [hashtable]$headers = @{}) {
    $url = 'http://127.0.0.1:19181/' + $mode + '/api/v1/query?query=' + [Uri]::EscapeDataString($expression)
    $response = Invoke-RestMethod -Uri $url -Headers $headers -TimeoutSec 10
    if ($response.status -ne 'success') { throw 'Provider query failed.' }
    return $response.data.result
}
$deadline = [DateTime]::UtcNow.AddMinutes(2)
do {
    try { $up = Query 'up{job="release-health-demo"}'; if ($up.Count -eq 1 -and $up[0].value[1] -eq '1') { break } } catch { }
    Start-Sleep -Seconds 2
} while ([DateTime]::UtcNow -lt $deadline)
if (-not $up -or $up[0].value[1] -ne '1') { throw 'Collector scrape did not become ready.' }
foreach ($mode in @('basic', 'bearer')) {
    $headers = @{ Authorization = $(if ($mode -eq 'basic') { 'Basic ' + $basic } else { 'Bearer ' + $token }) }
    $result = Query 'vector(1)' $mode $headers
    if ($result[0].value[1] -ne '1') { throw "$mode failed" }
    $rejected = Invoke-WebRequest -Uri "http://127.0.0.1:19181/$mode/api/v1/query?query=vector(1)" -SkipHttpErrorCheck
    if ($rejected.StatusCode -ne 401) { throw "$mode accepted missing credentials" }
    $wrong = Invoke-WebRequest -Uri "http://127.0.0.1:19181/$mode/api/v1/query?query=vector(1)" -Headers @{ Authorization = 'Bearer invalid-fixture-credential' } -SkipHttpErrorCheck
    if ($wrong.StatusCode -ne 401) { throw "$mode accepted incorrect credentials" }
    Write-Host "$mode authentication: valid accepted, missing rejected."
}
$started = [DateTimeOffset]::UtcNow
$samples = [Collections.Generic.List[object]]::new()
$phases = [Collections.Generic.List[object]]::new()
try {
    foreach ($mode in @('healthy', 'regression', 'recovery')) {
        Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:19180/scenario/$mode" | Out-Null
        $phaseStart = [DateTimeOffset]::UtcNow
        Write-Host "Observing $mode for $PhaseSeconds seconds..."
        do {
            Start-Sleep -Seconds 3
            $errorResult = Query $queries.errorRate
            $latencyResult = Query $queries.p95Latency
            if ($errorResult.Count -eq 1 -and $latencyResult.Count -eq 1) {
                $sample = [PSCustomObject]@{ timestamp = [DateTimeOffset]::UtcNow; phase = $mode; errorRate = [double]$errorResult[0].value[1]; p95Ms = [double]$latencyResult[0].value[1] }
                if ([double]::IsFinite($sample.errorRate) -and [double]::IsFinite($sample.p95Ms)) { $samples.Add($sample) }
            }
        } while (([DateTimeOffset]::UtcNow - $phaseStart).TotalSeconds -lt $PhaseSeconds)
        $last = $samples | Where-Object phase -eq $mode | Select-Object -Last 1
        if (-not $last) { throw "No finite samples for $mode." }
        $passed = if ($mode -eq 'regression') { $last.errorRate -gt 15 -and $last.p95Ms -gt 300 } else { $last.errorRate -lt 2 -and $last.p95Ms -lt 100 }
        $phases.Add([PSCustomObject]@{ phase = $mode; errorRate = $last.errorRate; p95Ms = $last.p95Ms; passed = $passed })
        Write-Host "$mode observed: error=$($last.errorRate)%, p95=$($last.p95Ms)ms; passed=$passed"
    }
} finally {
    Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:19180/scenario/recovery' | Out-Null
}
$reportDir = Join-Path $demoRoot 'reports'
$report = @{ startedAt = $started; endedAt = [DateTimeOffset]::UtcNow; phases = $phases; samples = $samples; queries = $queries; authVerified = @('none','basic','bearer') }
$report | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $reportDir 'demo-latest.json')
$lines = @('# Release Health Demo — live evidence', '', 'Generated from real HTTP traffic, OTel export and Prometheus queries. No provider secrets included.', '', '| Phase | Error % | P95 ms | Passed |', '| --- | ---: | ---: | --- |')
foreach ($phase in $phases) { $lines += "| $($phase.phase) | $($phase.errorRate) | $($phase.p95Ms) | $($phase.passed) |" }
$lines | Set-Content -LiteralPath (Join-Path $reportDir 'demo-latest.md')
$culture = [Globalization.CultureInfo]::InvariantCulture
function Chart([string]$field, [string]$label, [double]$maximum, [string]$color) {
    $duration = ([DateTimeOffset]$samples[-1].timestamp - $started).TotalSeconds
    $points = foreach ($sample in $samples) {
        $x = 60 + 1000 * (([DateTimeOffset]$sample.timestamp - $started).TotalSeconds / $duration)
        $y = 230 - 180 * ([double]$sample.$field / $maximum)
        $x.ToString('F2', $culture) + ',' + $y.ToString('F2', $culture)
    }
    return "<h2>$label</h2><svg viewBox='0 0 1120 280' role='img' aria-label='$label over time'><path d='M60 40V230H1080' fill='none' stroke='#94a3b8'/><text x='12' y='55'>$maximum</text><text x='32' y='230'>0</text><text x='60' y='265'>Healthy</text><text x='400' y='265'>Regression</text><text x='745' y='265'>Recovery</text><polyline points='$($points -join ' ')' fill='none' stroke='$color' stroke-width='3'/></svg>"
}
$charts = (Chart 'errorRate' 'Error rate (%)' 30 '#c2410c') + (Chart 'p95Ms' 'P95 latency (ms)' 900 '#2563eb')
"<!doctype html><html lang='en'><meta charset='utf-8'><title>Release Health live evidence</title><style>body{font:16px system-ui;max-width:1120px;margin:40px auto;padding:24px;color:#0f172a}svg{width:100%;background:#f8fafc;border-radius:12px}h2{font-size:18px}</style><h1>Release Health · live evidence</h1><p>$started · Real HTTP traffic → OpenTelemetry → Prometheus. Healthy → regression → recovery.</p>$charts<p>Values are measured, not generated chart data. Detailed samples and assertions: demo-latest.json.</p></html>" | Set-Content -LiteralPath (Join-Path $reportDir 'demo-latest.html')
if ($phases | Where-Object { -not $_.passed }) { throw 'A live phase assertion failed. See reports/demo-latest.json.' }
Write-Host 'PASS: all three phases and authentication checks. Evidence: reports/demo-latest.json'
