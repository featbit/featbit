[CmdletBinding()]
param([ValidateRange(45, 86400)][int]$MaxWaitSeconds = 360)

$ErrorActionPreference = 'Stop'
$demoRoot = Split-Path $PSScriptRoot -Parent
$queries = Get-Content -LiteralPath (Join-Path $demoRoot 'queries/queries.json') -Raw | ConvertFrom-Json
$started = [DateTimeOffset]::UtcNow
$deadline = $started.AddSeconds($MaxWaitSeconds)
$samples = [Collections.Generic.List[object]]::new()
$transitions = [Collections.Generic.List[object]]::new()
$stable = @{}
$phaseOrder = @('healthy', 'regression', 'recovery')
$observationStart = $null
$phaseSeconds = 0
$previousPhase = $null
$ready = $false
$passed = $false
$failure = $null

function Read-Health {
    $health = Invoke-RestMethod -Uri 'http://127.0.0.1:19180/health' -TimeoutSec 10
    if ($health.scenario -ne 'cycle') { throw 'The demo must already be in cycle mode; this verifier never changes scenarios.' }
    if ($health.activePhase -notin $phaseOrder) { throw 'The demo returned an invalid active phase.' }
    if ($null -eq $health.phaseSeconds -or [int]$health.phaseSeconds -lt 45) { throw 'The demo must expose a phaseSeconds value of at least 45.' }
    if ($null -eq $health.phaseRemainingSeconds -or [double]$health.phaseRemainingSeconds -lt 0 -or [double]$health.phaseRemainingSeconds -gt [double]$health.phaseSeconds) { throw 'The demo returned invalid phase timing.' }
    return $health
}

function Read-Value([string]$expression) {
    $url = 'http://127.0.0.1:19181/none/api/v1/query?query=' + [Uri]::EscapeDataString($expression)
    $response = Invoke-RestMethod -Uri $url -TimeoutSec 10
    if ($response.status -ne 'success') { throw 'A live Prometheus query failed.' }
    $result = @($response.data.result)
    if ($result.Count -ne 1 -or $result[0].value.Count -ne 2) { return $null }
    $number = [double]::Parse([string]$result[0].value[1], [Globalization.CultureInfo]::InvariantCulture)
    if (-not [double]::IsFinite($number)) { return $null }
    return $number
}

try {
    $initial = Read-Health
    $phaseSeconds = [int]$initial.phaseSeconds
    if ($MaxWaitSeconds -lt 3 * $phaseSeconds + 5) { throw "MaxWaitSeconds must allow a complete cycle: use at least $(3 * $phaseSeconds + 5) seconds, plus warm-up time if just started." }
    Write-Host "Read-only verification of the running demo: 3 x $phaseSeconds-second phases."
    do {
        $health = Read-Health
        if ([int]$health.phaseSeconds -ne $phaseSeconds) { throw 'Phase duration changed during observation.' }
        $errorRate = Read-Value $queries.errorRate
        $p95Ms = Read-Value $queries.p95Latency
        $throughput = Read-Value $queries.throughput
        $valid = $null -ne $errorRate -and $null -ne $p95Ms -and $null -ne $throughput -and $errorRate -ge 0 -and $errorRate -le 100 -and $p95Ms -gt 0 -and $throughput -gt 0
        if (-not $valid) {
            if ($ready) { throw 'A metric became missing, non-finite, outside its expected range, or throughput stopped after observation began.' }
            # A newly started counter needs two scrapes before rate()/histogram_quantile() can resolve.
            Start-Sleep -Seconds 3
            continue
        }
        $now = [DateTimeOffset]::UtcNow
        if (-not $ready) {
            $ready = $true
            $observationStart = $now
            Write-Host 'Real traffic and all three PromQL queries are ready; observing one complete automatic cycle.'
        }
        $phase = [string]$health.activePhase
        if ($previousPhase -ne $phase) {
            if ($null -ne $previousPhase) {
                $expectedPhase = $phaseOrder[([array]::IndexOf($phaseOrder, $previousPhase) + 1) % $phaseOrder.Count]
                if ($phase -ne $expectedPhase) { throw 'The automatic phase sequence did not follow healthy -> regression -> recovery.' }
            }
            $transitions.Add([PSCustomObject]@{ timestamp = $now; phase = $phase })
            Write-Host "Automatic phase observed: $phase"
            $previousPhase = $phase
        }
        $elapsedInPhase = $phaseSeconds - [double]$health.phaseRemainingSeconds
        $sample = [PSCustomObject]@{
            timestamp = $now
            phase = $phase
            phaseElapsedSeconds = [Math]::Round($elapsedInPhase, 2)
            errorRate = $errorRate
            p95Ms = $p95Ms
            throughputPerSecond = $throughput
        }
        $samples.Add($sample)
        # The 30s lookback plus the 2s export/scrape intervals must clear the preceding phase.
        # Leave a margin before the next transition so the health label and queried data agree.
        if ($elapsedInPhase -ge [Math]::Max(35, $phaseSeconds - 15) -and [double]$health.phaseRemainingSeconds -ge 2) {
            $stable[$phase] = $sample
        }
        if (($now - $observationStart).TotalSeconds -ge 3 * $phaseSeconds -and $transitions.Count -ge 4 -and $stable.Count -eq 3) {
            break
        }
        Start-Sleep -Seconds 3
    } while ([DateTimeOffset]::UtcNow -lt $deadline)

    if (-not $ready -or $null -eq $observationStart -or ([DateTimeOffset]::UtcNow - $observationStart).TotalSeconds -lt 3 * $phaseSeconds -or $transitions.Count -lt 4 -or $stable.Count -ne 3) {
        throw 'Timed out before observing a complete automatic cycle with settled samples for all three phases.'
    }
    foreach ($phase in $phaseOrder) {
        $sample = $stable[$phase]
        $withinExpectedRange = if ($phase -eq 'regression') { $sample.errorRate -gt 15 -and $sample.p95Ms -gt 300 } else { $sample.errorRate -lt 2 -and $sample.p95Ms -lt 100 }
        if (-not $withinExpectedRange) { throw "Settled $phase error rate or P95 did not reach the expected range." }
        Write-Host "$phase settled: error=$($sample.errorRate)%, p95=$($sample.p95Ms)ms, throughput=$($sample.throughputPerSecond)/s"
    }
    if ($stable.regression.errorRate -le $stable.healthy.errorRate -or $stable.regression.errorRate -le $stable.recovery.errorRate -or $stable.regression.p95Ms -le $stable.healthy.p95Ms -or $stable.regression.p95Ms -le $stable.recovery.p95Ms) {
        throw 'Error rate and P95 did not both rise during regression and fall during recovery.'
    }
    $passed = $true
} catch {
    $failure = $_.Exception.Message
} finally {
    $ended = [DateTimeOffset]::UtcNow
    $settledSamples = @($phaseOrder | Where-Object { $stable.ContainsKey($_) } | ForEach-Object { $stable[$_] })
    $report = [ordered]@{
        startedAt = $started
        endedAt = $ended
        passed = $passed
        readOnly = $true
        scenario = 'cycle'
        phaseSeconds = $phaseSeconds
        maxWaitSeconds = $MaxWaitSeconds
        observationStartedAt = $observationStart
        observedSeconds = $(if ($null -ne $observationStart) { [Math]::Round(($ended - $observationStart).TotalSeconds, 2) } else { 0 })
        failure = $failure
        transitions = @($transitions.ToArray())
        settledSamples = $settledSamples
        samples = @($samples.ToArray())
        queries = $queries
    }
    $reportDir = Join-Path $demoRoot 'reports'
    New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
    $report | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $reportDir 'continuous-latest.json')
    $lines = @(
        '# Release Health Demo - continuous live evidence',
        '',
        'Read-only observation of real HTTP traffic, OpenTelemetry export and Prometheus queries. No scenario changes, generated query results, or provider credentials.',
        '',
        "Passed: $passed. Observed: $($report.observedSeconds)s. Phase duration: $($phaseSeconds)s. Samples: $($samples.Count).",
        '',
        '| Settled phase | Error % | P95 ms | Requests/s |',
        '| --- | ---: | ---: | ---: |'
    )
    foreach ($sample in $settledSamples) { $lines += "| $($sample.phase) | $($sample.errorRate) | $($sample.p95Ms) | $($sample.throughputPerSecond) |" }
    $lines += @('', 'Automatic phase sequence: ' + (($transitions | ForEach-Object phase) -join ' -> '))
    if ($failure) { $lines += @('', "Failure: $failure") }
    $lines | Set-Content -LiteralPath (Join-Path $reportDir 'continuous-latest.md')
}
if (-not $passed) { throw $failure }
Write-Host 'PASS: one complete automatic cycle, continuous real samples, positive throughput and expected error/P95 recovery. Evidence: reports/continuous-latest.json'
