#Requires -Module Pester
<#
.SYNOPSIS
    Pester v5 tests for Assert-NoImagePullBackoff.ps1.

.NOTES
    Exit-code strategy
    ------------------
    The script under test calls 'exit 0' or 'exit 1'.  Dot-sourcing a script
    that calls 'exit' would terminate the test runner's PowerShell session, so
    every test here invokes the script in a CHILD process:

        $output = & $pwshExe -NoProfile -Command $commandString 2>&1
        $LASTEXITCODE  # reflects the child's exit code

    The child process is launched via the '-Command' parameter so that we can
    define a 'kubectl' function INSIDE the same process before calling the
    script.  Because PowerShell's command-lookup order prefers functions over
    external executables, the function intercepts every '& kubectl ...' call
    that the script makes — no real kubectl binary is required.

    Call counting
    -------------
    For tests that need to verify poll count (A, E), the kubectl stub writes a
    call counter to a file in $TestDrive.  After the child process exits the
    parent test reads that file.

    Timing
    ------
    Pull-backoff tests use -TimeoutSeconds 5 -IntervalSeconds 1 so they
    complete in roughly 5 s.  The eventual-recovery test uses -TimeoutSeconds
    30 -IntervalSeconds 1 but the mock recovers on the second poll, so it
    exits in about 1–2 s.

    Compatibility: Pester v5, PowerShell 5.1 and 7+.
    Requirements : Pester installed; no kubectl binary or real clusters needed.
#>

# ── Shared setup ─────────────────────────────────────────────────────────────

BeforeAll {
    $script:SutPath = Resolve-Path (
        Join-Path $PSScriptRoot "..\..\01-Infrastructure\Assert-NoImagePullBackoff.ps1"
    ) | Select-Object -ExpandProperty Path

    # Use the same PowerShell executable that is running the tests.
    $script:pwshExe = if ($PSVersionTable.PSEdition -eq 'Core') { 'pwsh' } else { 'powershell' }

    # ── Shared JSON fixtures (single-quoted so embedded " chars are safe) ──────

    $script:HealthyPodJson = '{"apiVersion":"v1","kind":"PodList","items":[{"metadata":{"name":"app-pod-abc12"},"status":{"phase":"Running","containerStatuses":[{"name":"app","image":"myregistry.example.com/app:1.0","state":{"running":{"startedAt":"2024-01-01T00:00:00Z"}}}],"initContainerStatuses":[]}}]}'

    $script:BackoffPodJson = '{"apiVersion":"v1","kind":"PodList","items":[{"metadata":{"name":"stuck-pod-xyz99"},"status":{"phase":"Pending","containerStatuses":[{"name":"app","image":"myregistry.example.com/app:2.0","state":{"waiting":{"reason":"ImagePullBackOff","message":"Back-off pulling image"}}}],"initContainerStatuses":[]}}]}'

    $script:InitBackoffJson = '{"apiVersion":"v1","kind":"PodList","items":[{"metadata":{"name":"init-stuck-def44"},"status":{"phase":"Pending","initContainerStatuses":[{"name":"init-fetch","image":"myregistry.example.com/init:1.0","state":{"waiting":{"reason":"Init:ImagePullBackOff","message":"Back-off pulling init image"}}}],"containerStatuses":[]}}]}'

    $script:EmptyEventsJson = '{"apiVersion":"v1","kind":"EventList","items":[]}'
}

# ─────────────────────────────────────────────────────────────────────────────
# A  Healthy cluster — exit 0, single poll
# ─────────────────────────────────────────────────────────────────────────────

Describe "Assert-NoImagePullBackoff - healthy cluster" {

    It "exits 0 when all pods are Running with no waiting reasons" {
        # Counter file lets us verify only one kubectl 'get pods' call was made.
        $counterFile = Join-Path $TestDrive "kubectl_polls.txt"
        Set-Content -Path $counterFile -Value "0"

        $healthyJson  = $script:HealthyPodJson
        $eventsJson   = $script:EmptyEventsJson
        $sutPath      = $script:SutPath
        $counterPath  = $counterFile

        # Build the child-process command.  Variables without a leading backtick
        # are expanded NOW by the here-string (outer process); backtick-escaped
        # $-variables are literals executed by the child process.
        $command = @"
`$callCount = [int](Get-Content '$counterPath')
function kubectl {
    param([Parameter(ValueFromRemainingArguments)] `$Arguments)
    if (`$Arguments -contains 'pods') {
        `$script:callCount++
        Set-Content '$counterPath' `$script:callCount
        '$healthyJson'
        `$global:LASTEXITCODE = 0
        return
    }
    if (`$Arguments -contains 'events') {
        '$eventsJson'
        `$global:LASTEXITCODE = 0
        return
    }
    `$global:LASTEXITCODE = 0
}
& '$sutPath' -TimeoutSeconds 5 -IntervalSeconds 1 -Contexts @('west-test') -Namespaces @('default') -Quiet
"@
        & $script:pwshExe -NoProfile -Command $command 2>&1 | Out-Null
        $LASTEXITCODE | Should -Be 0
    }

    It "completes after a single poll when all pods are healthy (kubectl called once)" {
        $counterFile = Join-Path $TestDrive "kubectl_polls.txt"
        Set-Content -Path $counterFile -Value "0"

        $healthyJson  = $script:HealthyPodJson
        $eventsJson   = $script:EmptyEventsJson
        $sutPath      = $script:SutPath
        $counterPath  = $counterFile

        $command = @"
`$callCount = [int](Get-Content '$counterPath')
function kubectl {
    param([Parameter(ValueFromRemainingArguments)] `$Arguments)
    if (`$Arguments -contains 'pods') {
        `$script:callCount++
        Set-Content '$counterPath' `$script:callCount
        '$healthyJson'
        `$global:LASTEXITCODE = 0
        return
    }
    if (`$Arguments -contains 'events') {
        '$eventsJson'
        `$global:LASTEXITCODE = 0
        return
    }
    `$global:LASTEXITCODE = 0
}
& '$sutPath' -TimeoutSeconds 5 -IntervalSeconds 1 -Contexts @('west-test') -Namespaces @('default') -Quiet
"@
        & $script:pwshExe -NoProfile -Command $command 2>&1 | Out-Null

        # The script exits 0 on the first healthy poll, so kubectl 'get pods'
        # is called exactly once per (context, namespace) pair.
        [int](Get-Content $counterFile) | Should -Be 1
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# B  Pull-backoff detected — exit 1 after timeout
# ─────────────────────────────────────────────────────────────────────────────

Describe "Assert-NoImagePullBackoff - pull-backoff detected" {

    It "exits 1 after the timeout when a container is in ImagePullBackOff" {
        $backoffJson = $script:BackoffPodJson
        $eventsJson  = $script:EmptyEventsJson
        $sutPath     = $script:SutPath

        $command = @"
function kubectl {
    param([Parameter(ValueFromRemainingArguments)] `$Arguments)
    if (`$Arguments -contains 'pods') {
        '$backoffJson'
        `$global:LASTEXITCODE = 0
        return
    }
    if (`$Arguments -contains 'events') {
        '$eventsJson'
        `$global:LASTEXITCODE = 0
        return
    }
    `$global:LASTEXITCODE = 0
}
& '$sutPath' -TimeoutSeconds 5 -IntervalSeconds 1 -Contexts @('west-test') -Namespaces @('default') -Quiet
"@
        & $script:pwshExe -NoProfile -Command $command 2>&1 | Out-Null
        $LASTEXITCODE | Should -Be 1
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# C  Init container pull-backoff — exit 1
# ─────────────────────────────────────────────────────────────────────────────

Describe "Assert-NoImagePullBackoff - init container pull-backoff" {

    It "exits 1 when an init container is in Init:ImagePullBackOff" {
        $initJson   = $script:InitBackoffJson
        $eventsJson = $script:EmptyEventsJson
        $sutPath    = $script:SutPath

        $command = @"
function kubectl {
    param([Parameter(ValueFromRemainingArguments)] `$Arguments)
    if (`$Arguments -contains 'pods') {
        '$initJson'
        `$global:LASTEXITCODE = 0
        return
    }
    if (`$Arguments -contains 'events') {
        '$eventsJson'
        `$global:LASTEXITCODE = 0
        return
    }
    `$global:LASTEXITCODE = 0
}
& '$sutPath' -TimeoutSeconds 5 -IntervalSeconds 1 -Contexts @('west-test') -Namespaces @('default') -Quiet
"@
        & $script:pwshExe -NoProfile -Command $command 2>&1 | Out-Null
        $LASTEXITCODE | Should -Be 1
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# D  Cluster unreachable — hard failure, exit 1
# ─────────────────────────────────────────────────────────────────────────────

Describe "Assert-NoImagePullBackoff - cluster unreachable" {

    It "exits 1 immediately when kubectl returns a non-zero exit code" {
        # The script treats any kubectl failure as a hard error and breaks out
        # of the poll loop without sleeping until the timeout.
        $sutPath = $script:SutPath

        $command = @"
function kubectl {
    param([Parameter(ValueFromRemainingArguments)] `$Arguments)
    Write-Error 'Unable to connect to the server: west-test context unreachable'
    `$global:LASTEXITCODE = 1
}
& '$sutPath' -TimeoutSeconds 5 -IntervalSeconds 1 -Contexts @('west-test') -Namespaces @('default') -Quiet
"@
        & $script:pwshExe -NoProfile -Command $command 2>&1 | Out-Null
        $LASTEXITCODE | Should -Be 1
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# E  Eventual recovery — exit 0 after second poll
# ─────────────────────────────────────────────────────────────────────────────

Describe "Assert-NoImagePullBackoff - eventual recovery" {

    It "exits 0 when the second poll shows all pods healthy (polling retry works)" {
        # Poll 1: stuck pod → script sees pull-backoff, sleeps, retries.
        # Poll 2: healthy pod → script prints PASS and exits 0.
        # This proves the loop actually waits and re-checks rather than giving
        # up on the first failure observation.
        $counterFile = Join-Path $TestDrive "kubectl_polls.txt"
        Set-Content -Path $counterFile -Value "0"

        $backoffJson  = $script:BackoffPodJson
        $healthyJson  = $script:HealthyPodJson
        $eventsJson   = $script:EmptyEventsJson
        $sutPath      = $script:SutPath
        $counterPath  = $counterFile

        $command = @"
`$callCount = [int](Get-Content '$counterPath')
function kubectl {
    param([Parameter(ValueFromRemainingArguments)] `$Arguments)
    if (`$Arguments -contains 'pods') {
        `$script:callCount++
        Set-Content '$counterPath' `$script:callCount
        if (`$script:callCount -eq 1) {
            '$backoffJson'
        } else {
            '$healthyJson'
        }
        `$global:LASTEXITCODE = 0
        return
    }
    if (`$Arguments -contains 'events') {
        '$eventsJson'
        `$global:LASTEXITCODE = 0
        return
    }
    `$global:LASTEXITCODE = 0
}
& '$sutPath' -TimeoutSeconds 30 -IntervalSeconds 1 -Contexts @('west-test') -Namespaces @('default') -Quiet
"@
        & $script:pwshExe -NoProfile -Command $command 2>&1 | Out-Null
        $LASTEXITCODE | Should -Be 0
    }

    It "polls more than once before declaring the cluster healthy (counter >= 2)" {
        $counterFile = Join-Path $TestDrive "kubectl_polls.txt"
        Set-Content -Path $counterFile -Value "0"

        $backoffJson  = $script:BackoffPodJson
        $healthyJson  = $script:HealthyPodJson
        $eventsJson   = $script:EmptyEventsJson
        $sutPath      = $script:SutPath
        $counterPath  = $counterFile

        $command = @"
`$callCount = [int](Get-Content '$counterPath')
function kubectl {
    param([Parameter(ValueFromRemainingArguments)] `$Arguments)
    if (`$Arguments -contains 'pods') {
        `$script:callCount++
        Set-Content '$counterPath' `$script:callCount
        if (`$script:callCount -eq 1) {
            '$backoffJson'
        } else {
            '$healthyJson'
        }
        `$global:LASTEXITCODE = 0
        return
    }
    if (`$Arguments -contains 'events') {
        '$eventsJson'
        `$global:LASTEXITCODE = 0
        return
    }
    `$global:LASTEXITCODE = 0
}
& '$sutPath' -TimeoutSeconds 30 -IntervalSeconds 1 -Contexts @('west-test') -Namespaces @('default') -Quiet
"@
        & $script:pwshExe -NoProfile -Command $command 2>&1 | Out-Null

        [int](Get-Content $counterFile) | Should -BeGreaterOrEqual 2
    }
}
