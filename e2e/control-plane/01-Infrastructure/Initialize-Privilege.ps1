<#
.SYNOPSIS
    Shared sudo / privilege-session helpers for the FeatBit infra scripts (Linux).

.DESCRIPTION
    Goal: behave like `vagrant up`. Acquire root at most ONCE per run — zero times
    when passwordless sudo is configured or the script is already root — keep the
    sudo ticket warm for the whole run so long phases never stall waiting on a
    password, and when root is genuinely required but unreachable (no interactive
    terminal AND no passwordless sudo) fail FAST at preflight with a copy-pasteable
    fix instead of dying deep in a multi-phase deploy.

    Dot-source this file, then:
      Initialize-FbSudoSession -Required   # prime once (prompt/passwordless/root) or exit
      Invoke-FbSudo apt-get install -y git # run a single command with root, no prompt

    These helpers are Linux-only. On Windows the callers use RunAs elevation and
    this file is a no-op (functions are still defined but report 'root'/unavailable
    based on the Windows admin check the caller performs).
#>

# Avoid clobbering if dot-sourced more than once in the same session.
if (-not (Get-Variable -Name FbSudoMode -Scope Script -ErrorAction SilentlyContinue)) {
    $script:FbSudoMode      = $null   # 'root' | 'nopasswd' | 'cached' | 'unavailable'
    $script:FbSudoKeepAlive = $null
}

function Test-FbIsRoot {
    return (((& id -u) -as [int]) -eq 0)
}

function Test-FbHasTty {
    # `tty -s` exits 0 when stdin is a terminal. No interactive terminal means
    # sudo can never prompt for a password.
    & tty -s 2>$null
    return ($LASTEXITCODE -eq 0)
}

function Test-FbPasswordlessSudo {
    if (Test-FbIsRoot) { return $true }
    if (-not (Get-Command sudo -ErrorAction SilentlyContinue)) { return $false }
    # `sudo -n` never prompts; exit 0 means a valid ticket exists or NOPASSWD is set.
    & sudo -n true 2>$null
    return ($LASTEXITCODE -eq 0)
}

function Start-FbSudoKeepAlive {
    # Refresh the sudo timestamp every 60s so long phases (the cluster deploy runs
    # ~20 min) never let the ticket expire mid-run. Start-ThreadJob runs in-process,
    # so it shares the controlling terminal and refreshes the same tty_tickets entry
    # the interactive prompt created — a detached Start-Job would not.
    if ($script:FbSudoKeepAlive) { return }
    try {
        $script:FbSudoKeepAlive = Start-ThreadJob -ScriptBlock {
            while ($true) { & sudo -n true 2>$null; Start-Sleep -Seconds 60 }
        }
    } catch {
        # ThreadJob unavailable: best-effort only. sudo may re-prompt on the
        # terminal after timestamp_timeout, which is acceptable interactively.
        $script:FbSudoKeepAlive = $null
    }
}

function Stop-FbSudoKeepAlive {
    if ($script:FbSudoKeepAlive) {
        Stop-Job  $script:FbSudoKeepAlive -ErrorAction SilentlyContinue
        Remove-Job $script:FbSudoKeepAlive -Force -ErrorAction SilentlyContinue
        $script:FbSudoKeepAlive = $null
    }
}

function Show-FbSudoRemediation {
    param([string]$Purpose)
    $me = ((& id -un) | Out-String).Trim()
    Write-Host ""
    Write-Host "  ✗ Administrator (sudo) access is required for: $Purpose" -ForegroundColor Red
    Write-Host "    This session has no interactive terminal and passwordless sudo is" -ForegroundColor Gray
    Write-Host "    not configured, so a password cannot be entered. Stopping now rather" -ForegroundColor Gray
    Write-Host "    than after the long build/deploy phases." -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Pick ONE of the following, then re-run the same command:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  1) Run it in a real terminal window (you'll be prompted for your" -ForegroundColor White
    Write-Host "     password a single time, then it runs unattended)." -ForegroundColor White
    Write-Host ""
    Write-Host "  2) Enable passwordless sudo for fully unattended / CI use (one-time):" -ForegroundColor White
    Write-Host "       echo '$me ALL=(ALL) NOPASSWD: ALL' | sudo tee /etc/sudoers.d/$me" -ForegroundColor Gray
    Write-Host "       sudo chmod 440 /etc/sudoers.d/$me" -ForegroundColor Gray
    Write-Host ""
}

function Initialize-FbSudoSession {
    <#
    .SYNOPSIS
        Prime root access for the rest of the run. Returns $true when privileged
        commands can proceed unattended from here on.
    .PARAMETER Required
        When set and root cannot be obtained, print remediation and exit 1.
    .PARAMETER Purpose
        Short human description of what needs root, shown in the prompt / error.
    #>
    param(
        [switch]$Required,
        [string]$Purpose = "system configuration (nginx, /etc/hosts, systemd)"
    )

    # Idempotent: once resolved, reuse the verdict for the rest of the process.
    if ($script:FbSudoMode) { return ($script:FbSudoMode -ne 'unavailable') }

    if (Test-FbIsRoot)           { $script:FbSudoMode = 'root';     return $true }
    if (Test-FbPasswordlessSudo) { $script:FbSudoMode = 'nopasswd'; return $true }

    if ((Test-FbHasTty) -and (Get-Command sudo -ErrorAction SilentlyContinue)) {
        Write-Host ""
        Write-Host "  FeatBit needs administrator access once for: $Purpose" -ForegroundColor Yellow
        Write-Host "  You'll be asked for your password a single time; the rest runs unattended." -ForegroundColor Gray
        & sudo -v
        if ($LASTEXITCODE -eq 0) {
            $script:FbSudoMode = 'cached'
            Start-FbSudoKeepAlive
            return $true
        }
    }

    $script:FbSudoMode = 'unavailable'
    if ($Required) {
        Show-FbSudoRemediation -Purpose $Purpose
        exit 1
    }
    return $false
}

function Get-FbSudoMode { return $script:FbSudoMode }

function Invoke-FbSudo {
    <#
    .SYNOPSIS
        Run a single command with root privileges using the already-primed session.
        Never prompts (-n) — Initialize-FbSudoSession must have succeeded first.
        Returns the command's exit code.
    #>
    param([Parameter(Mandatory, ValueFromRemainingArguments)] [string[]]$Command)

    if (-not $script:FbSudoMode) { [void](Initialize-FbSudoSession) }

    if ($script:FbSudoMode -eq 'root') {
        if ($Command.Count -gt 1) { & $Command[0] @($Command[1..($Command.Count - 1)]) }
        else                      { & $Command[0] }
    }
    else {
        & sudo -n @Command
    }
    return $LASTEXITCODE
}
