<#
.SYNOPSIS
    Assert that no pods are stuck in ImagePullBackOff or ErrImagePull state across
    one or more Minikube clusters.

.DESCRIPTION
    Polls kubectl for pod status across each (context, namespace) pair, examining
    both regular containers and init containers for image-pull failure states.
    Retries until all pods are healthy or the timeout is exceeded.

    Detection covers the following waiting reasons:
        ImagePullBackOff, ErrImagePull, Init:ImagePullBackOff, Init:ErrImagePull,
        RegistryUnavailable, ImageInspectError

    Pods in phase Succeeded or Completed are skipped.

    If kubectl returns a non-zero exit code for any pair (unreachable cluster,
    unknown context, RBAC denial, etc.), the script treats that as a hard failure
    rather than silently passing — masking infrastructure problems would be worse
    than a false positive.

    On success the script prints one line per (context, namespace) and a summary
    banner, then exits 0.  On failure it prints a full diagnostic block for every
    offending pod/container including the most-recent kubelet Warning/Failed event,
    then exits 1.

    This script is strictly read-only.  It never mutates cluster state and is safe
    to run repeatedly (idempotent).

    NOTE: This script uses 'exit 0 / exit 1' and is intended to be invoked as a
    top-level orchestration step, not dot-sourced.  If you dot-source it the exit
    calls will terminate your calling session.

    Exit codes: 0 = all pods healthy; 1 = pull-backoff detected OR cluster unreachable.

.PARAMETER Contexts
    kubectl context names to check.  Defaults to @("west", "east").

.PARAMETER Namespaces
    Kubernetes namespaces to inspect within each context.  Defaults to @("featbit").
    Multi-namespace support is provided for future use; a single namespace is the
    typical case.

.PARAMETER TimeoutSeconds
    Total seconds to keep polling before declaring failure.  Default: 90.

.PARAMETER IntervalSeconds
    Seconds to sleep between successive poll iterations.  Default: 5.

.PARAMETER IncludeInitContainers
    Reserved for future use.  Init containers are always checked regardless of this
    switch; it exists only as a forward-compatible knob.

.PARAMETER Quiet
    Suppress per-poll progress lines.  Only the final pass/fail summary is printed.

.EXAMPLE
    .\Assert-NoImagePullBackoff.ps1

    Polls west and east contexts, featbit namespace, with a 90-second timeout and
    5-second interval.  Progress is printed on each poll iteration.

.EXAMPLE
    .\Assert-NoImagePullBackoff.ps1 -Contexts @("west")

    Checks only the west context.  Useful when east is intentionally offline.

.EXAMPLE
    .\Assert-NoImagePullBackoff.ps1 -Quiet -TimeoutSeconds 120

    Polls silently for up to 2 minutes; only the final pass/fail banner is printed.
    Ideal for CI pipelines where log verbosity should be minimal.

.EXAMPLE
    .\Assert-NoImagePullBackoff.ps1 -Contexts @("west","east") -Namespaces @("featbit","monitoring") -IntervalSeconds 10 -TimeoutSeconds 180

    Checks two namespaces across both clusters, polling every 10 seconds for up to
    3 minutes.  Each (context, namespace) pair is assessed independently.
#>

[CmdletBinding()]
param(
    [string[]]$Contexts         = @("west", "east"),
    [string[]]$Namespaces       = @("featbit"),
    [int]$TimeoutSeconds        = 90,
    [int]$IntervalSeconds       = 5,
    [switch]$IncludeInitContainers,
    [switch]$Quiet
)

$ErrorActionPreference = "Stop"

# This script is invoked via '& $assertScript' from Deploy-FeatBitClusters.ps1
# (and from the Quickstart wizards), both of which run with
# 'Set-StrictMode -Version Latest'. Strict mode v2+ throws on access to a
# missing property — but kubectl JSON omits 'initContainerStatuses' for pods
# with no init containers (and 'containerStatuses' for pods that haven't
# created them yet, etc.), so traversal that should yield $null instead errors:
#   "The property 'initContainerStatuses' cannot be found on this object."
# Downgrade to v1.0 (variables must be initialized, but missing properties
# return $null) so the existing defensive checks below work as intended.
Set-StrictMode -Version 1.0

# ─── Output helpers ───────────────────────────────────────────────────────────

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host "  $Message" -ForegroundColor Gray
}

function Write-Warn {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

function Write-Fail {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

# ─── Constants ────────────────────────────────────────────────────────────────

# All waiting reasons that indicate an image-pull failure.
$script:PullBackoffReasons = @(
    "ImagePullBackOff",
    "ErrImagePull",
    "Init:ImagePullBackOff",
    "Init:ErrImagePull",
    "RegistryUnavailable",
    "ImageInspectError"
)

# Pods in these terminal phases cannot be in pull-backoff; skip them.
$script:SkippedPhases = @("Succeeded", "Completed")

# ─── kubectl wrapper ──────────────────────────────────────────────────────────

# Runs kubectl and captures stdout and stderr independently.
#
# Uses the '2>&1' merge so that no external temp files are required.
# PowerShell surfaces redirected stderr as [ErrorRecord] objects mixed into the
# output stream; we separate them by type after the call.
#
# Returns a hashtable:
#   ExitCode  [int]    – raw LASTEXITCODE
#   Success   [bool]   – $true when ExitCode -eq 0
#   Stdout    [string] – joined stdout lines
#   Stderr    [string] – joined stderr messages
function Invoke-KubectlCapture {
    param([string[]]$Arguments)

    $allOutput = & kubectl @Arguments 2>&1
    $rc = $LASTEXITCODE

    $stdoutLines = $allOutput | Where-Object { $_ -isnot [System.Management.Automation.ErrorRecord] }
    $stderrLines = $allOutput | Where-Object { $_ -is  [System.Management.Automation.ErrorRecord] }

    $stdout = if ($stdoutLines) { $stdoutLines -join "`n" } else { "" }
    $stderr = if ($stderrLines) { ($stderrLines | ForEach-Object { $_.Exception.Message }) -join "`n" } else { "" }

    return @{
        ExitCode = $rc
        Success  = ($rc -eq 0)
        Stdout   = $stdout
        Stderr   = $stderr
    }
}

# ─── Pod inspection ───────────────────────────────────────────────────────────

# Inspects all pods in (Context, Namespace) for image-pull failure states.
#
# Returns one of two shapes:
#   Success path: @{ Success=$true;  Offending=@(...); TotalCount=N }
#   Error path:   @{ Success=$false; Error="<human-readable message>" }
#
# Offending entries are hashtables:
#   { Context; Namespace; PodName; ContainerName; ContainerType; Image; Reason }
#
# JSON parsing is used rather than jsonpath because jsonpath output collapses to
# scalar values and breaks on multi-container pods, while ConvertFrom-Json lets
# us navigate the full object graph and inspect every container in one pass.
function Get-PodPullBackoff {
    param(
        [string]$Context,
        [string]$Namespace
    )

    $kr = Invoke-KubectlCapture @("--context", $Context, "get", "pods", "-n", $Namespace, "-o", "json")

    if (-not $kr.Success) {
        $detail = if ($kr.Stderr) { $kr.Stderr } else { "(no stderr captured)" }
        return @{
            Success = $false
            Error   = "Cannot reach context '$Context' namespace '$Namespace' (kubectl exit code $($kr.ExitCode)): $detail. Treating as failure."
        }
    }

    $podsObj = $null
    try {
        $podsObj = $kr.Stdout | ConvertFrom-Json
    } catch {
        return @{
            Success = $false
            Error   = "Failed to parse JSON from 'kubectl --context $Context get pods -n $Namespace -o json': $_"
        }
    }

    $offending  = @()
    $totalCount = if ($podsObj.items) { @($podsObj.items).Count } else { 0 }

    foreach ($pod in $podsObj.items) {
        $phase = $pod.status.phase
        if ($phase -in $script:SkippedPhases) { continue }

        # Always check both init and regular containers (IncludeInitContainers is
        # reserved for future use — init containers are unconditionally inspected).
        $containerGroups = @(
            @{ Type = "init"; Statuses = $pod.status.initContainerStatuses },
            @{ Type = "main"; Statuses = $pod.status.containerStatuses }
        )

        foreach ($group in $containerGroups) {
            if (-not $group.Statuses) { continue }
            foreach ($cs in $group.Statuses) {
                # Guard for missing state/waiting nodes (PS 5.1 has no ?. operator)
                $reason = $null
                if ($cs.state -and $cs.state.waiting) {
                    $reason = $cs.state.waiting.reason
                }
                if ($reason -and ($reason -in $script:PullBackoffReasons)) {
                    $offending += @{
                        Context       = $Context
                        Namespace     = $Namespace
                        PodName       = $pod.metadata.name
                        ContainerName = $cs.name
                        ContainerType = $group.Type
                        Image         = $cs.image
                        Reason        = $reason
                    }
                }
            }
        }
    }

    return @{
        Success    = $true
        Offending  = $offending
        TotalCount = $totalCount
    }
}

# Returns the message from the most-recent Warning/Failed kubelet event for the
# given pod, or an empty string when no matching event exists.
# Errors from this lookup are silently swallowed — it is diagnostic-only and
# must never cause an assertion failure on its own.
function Get-LastPullEvent {
    param(
        [string]$Context,
        [string]$Namespace,
        [string]$PodName
    )

    $kr = Invoke-KubectlCapture @(
        "--context", $Context, "get", "events",
        "-n", $Namespace,
        "--field-selector", "involvedObject.name=$PodName",
        "-o", "json"
    )

    if (-not $kr.Success -or -not $kr.Stdout) { return "" }

    try {
        $eventsObj = $kr.Stdout | ConvertFrom-Json
        $latest = $eventsObj.items |
            Where-Object { $_.type -eq "Warning" -and $_.reason -eq "Failed" -and $_.lastTimestamp } |
            Sort-Object { [datetime]$_.lastTimestamp } -Descending |
            Select-Object -First 1
        if ($latest) { return $latest.message }
    } catch { }

    return ""
}

# ─── Polling loop ─────────────────────────────────────────────────────────────

$deadline  = (Get-Date).AddSeconds($TimeoutSeconds)
$maxIter   = [math]::Ceiling($TimeoutSeconds / [math]::Max(1, $IntervalSeconds))

# $lastResults caches the most-recent successful result per "ctx/ns" key.
# Used to build diagnostics on the failure path without an extra kubectl round-trip.
$lastResults = @{}
$hardFailure = $false
$iteration   = 0

:pollLoop while ($true) {
    $iteration++

    if ((Get-Date) -gt $deadline) { break pollLoop }

    $iterOffending = @()
    $progressParts = @()

    foreach ($ctx in $Contexts) {
        foreach ($ns in $Namespaces) {
            if ((Get-Date) -gt $deadline) { break pollLoop }

            $key    = "$ctx/$ns"
            $result = Get-PodPullBackoff -Context $ctx -Namespace $ns

            if (-not $result.Success) {
                Write-Fail $result.Error
                $hardFailure = $true
                break pollLoop
            }

            $lastResults[$key] = $result
            $iterOffending += $result.Offending
            $progressParts  += "$key`: $($result.Offending.Count) pull-backoff pod(s)"
        }
    }

    if (-not $Quiet) {
        $progressLine = "[poll $iteration/$maxIter] " + ($progressParts -join " | ")
        Write-Host $progressLine -ForegroundColor DarkGray
    }

    if ($iterOffending.Count -eq 0) {
        # ── SUCCESS ────────────────────────────────────────────────────────────
        Write-Host ""
        foreach ($ctx in $Contexts) {
            foreach ($ns in $Namespaces) {
                $key = "$ctx/$ns"
                $r   = $lastResults[$key]
                if ($r.TotalCount -eq 0) {
                    Write-Warn "$key`: namespace has zero pods — trivial pass (no pull-backoff conditions possible)"
                } else {
                    Write-Success "$key`: all pods healthy ($($r.TotalCount) pods checked)"
                }
            }
        }
        Write-Host ""
        Write-Host "PASS: zero ImagePullBackOff/ErrImagePull pods across $($Contexts.Count) cluster(s) x $($Namespaces.Count) namespace(s)" `
            -ForegroundColor Green
        exit 0
    }

    # Budget check before sleeping: don't sleep past the deadline.
    $remaining = ($deadline - (Get-Date)).TotalSeconds
    if ($remaining -gt $IntervalSeconds) {
        Start-Sleep -Seconds $IntervalSeconds
    } else {
        break pollLoop
    }
}

# ─── FAILURE ──────────────────────────────────────────────────────────────────

Write-Host ""

if ($hardFailure) {
    # Hard failure already printed by Get-PodPullBackoff above.
    Write-Host "FAIL: one or more clusters were unreachable — see error above" -ForegroundColor Red
    exit 1
}

Write-Host "FAIL: ImagePullBackOff detected after ${TimeoutSeconds}s" -ForegroundColor Red

foreach ($ctx in $Contexts) {
    foreach ($ns in $Namespaces) {
        $key = "$ctx/$ns"
        if (-not $lastResults.ContainsKey($key)) { continue }

        foreach ($entry in $lastResults[$key].Offending) {
            $fqn       = "$($entry.Context)/$($entry.Namespace)/$($entry.PodName)"
            $lastEvent = Get-LastPullEvent -Context $entry.Context -Namespace $entry.Namespace -PodName $entry.PodName
            $eventLine = if ($lastEvent) { $lastEvent } else { "(no Warning/Failed event found)" }

            Write-Host ""
            Write-Fail $fqn
            Write-Host "    Container        : $($entry.ContainerName)"
            Write-Host "    Image            : $($entry.Image)"
            Write-Host "    Waiting reason   : $($entry.Reason)"
            Write-Host "    Last event       : $eventLine"
            Write-Host "    Suggested action : See https://kubernetes.io/docs/concepts/containers/images/#image-pull-policy and verify (1) registry CA trust inside the Minikube node and (2) imagePullSecrets are attached"
        }
    }
}

Write-Host ""
exit 1
