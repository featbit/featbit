<#
.SYNOPSIS
    Tear down the FeatBit Hyper-V deployment in layered steps.

.DESCRIPTION
    Reverses what Quickstart-HyperV.ps1 sets up. Pick how deep to go:

      Stop      (default) — stop port-forwards, stop Windows nginx, and pause
                            both Minikube clusters. Fully resumable with
                            'minikube start'. Keeps clusters, images, nginx
                            config, and hosts entries intact.

      Clusters  — everything in Stop, plus delete the west/east Minikube
                  clusters, the featbit-registry container, and the
                  featbit-cluster-network Docker network. Redeploying takes
                  ~15 min (clusters come back, images may need rebuilding).

      Full      — everything in Clusters, plus remove the FeatBit nginx
                  config file, Windows hosts entries for featbit.*.local,
                  the wizard progress file, and FeatBit images from the
                  local docker cache.

    Stop and Clusters run fine from a normal PowerShell prompt. Full writes
    to C:\Windows\System32\drivers\etc\hosts and the nginx conf under C:\,
    so it requires an elevated pwsh session.

    Scope note — NOT touched by any level:
      * Docker Desktop, Hyper-V feature, WSL (enabled by Quickstart Phase 2)
      * Minikube, kubectl, nginx binaries / Chocolatey packages
      * deployment.env (your configured values)
      * The FeatBit source tree

.PARAMETER Level
    Stop, Clusters, or Full. Default: Stop.

.PARAMETER Force
    Skip the confirmation prompt before destructive levels.

.PARAMETER NginxPath
    Override nginx install path. Auto-detected from C:\nginx or C:\tools\nginx*
    by default.

.EXAMPLE
    .\Teardown-HyperV.ps1
    Stop port-forwards, stop nginx, pause both clusters.

.EXAMPLE
    .\Teardown-HyperV.ps1 -Level Clusters
    Delete the two Minikube clusters and the local registry.

.EXAMPLE
    .\Teardown-HyperV.ps1 -Level Full -Force
    Full wipe of the FeatBit footprint without prompting. Requires admin.
#>
[CmdletBinding(SupportsShouldProcess)]
param(
    [ValidateSet("Stop", "Clusters", "Full")]
    [string]$Level = "Stop",
    [switch]$Force,
    [string]$NginxPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:StateFile = Join-Path $PSScriptRoot ".quickstart-state-hyperv.json"
$script:HostsFile = "$env:SystemRoot\System32\drivers\etc\hosts"

# ── Console helpers ───────────────────────────────────────────────────────────

function Write-Step    { param([string]$M) Write-Host "`n════════════════════════════════════════════════════════════" -ForegroundColor DarkCyan
                         Write-Host "  $M" -ForegroundColor Cyan
                         Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor DarkCyan }
function Write-Success { param([string]$M) Write-Host "  ✓ $M" -ForegroundColor Green }
function Write-Info    { param([string]$M) Write-Host "  $M" -ForegroundColor Gray }
function Write-Warn    { param([string]$M) Write-Host "  ⚠ $M" -ForegroundColor Yellow }
function Write-Fail    { param([string]$M) Write-Host "  ✗ $M" -ForegroundColor Red }

# ── Privilege check ───────────────────────────────────────────────────────────

function Test-Administrator {
    $id = [System.Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [System.Security.Principal.WindowsPrincipal]$id
    return $principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
}

if ($Level -eq "Full" -and -not (Test-Administrator)) {
    Write-Host ""
    Write-Fail "Level 'Full' requires an elevated PowerShell session."
    Write-Info "Close this terminal and re-launch pwsh as Administrator, then re-run:"
    Write-Info "  .\Teardown-HyperV.ps1 -Level Full"
    Write-Host ""
    exit 1
}

# ── nginx install auto-detect ─────────────────────────────────────────────────

function Resolve-NginxPath {
    if ($NginxPath -and (Test-Path (Join-Path $NginxPath "nginx.exe"))) { return $NginxPath }
    foreach ($pattern in @("C:\nginx", "C:\tools\nginx", "C:\tools\nginx-*")) {
        $resolved = Resolve-Path $pattern -ErrorAction SilentlyContinue
        foreach ($p in @($resolved)) {
            if ($p -and (Test-Path (Join-Path $p.Path "nginx.exe"))) { return $p.Path }
        }
    }
    return $null
}

# ── Confirmation ──────────────────────────────────────────────────────────────

function Confirm-Teardown([string]$Lvl) {
    if ($Force) { return }
    if ($Lvl -eq "Stop") { return }

    $summary = switch ($Lvl) {
        "Clusters" {
@"
  This will DELETE:
    * Minikube clusters: west, east
    * Docker container: featbit-registry
    * Docker network:   featbit-cluster-network
  It will STOP all FeatBit port-forwards and the Windows nginx first.
  Source code and deployment.env are NOT touched.
"@
        }
        "Full" {
@"
  This will DELETE everything from 'Clusters', plus:
    * Nginx config: <nginx-install>\conf\nginx.conf
    * Hosts entries for featbit.*.local / redis.*.local / mongodb-*.local
    * Wizard progress file: $script:StateFile
    * FeatBit images in the local docker cache
  Source code and deployment.env are NOT touched.
  Docker Desktop, Hyper-V, and WSL are NOT touched.
"@
        }
    }

    Write-Host ""
    Write-Host $summary -ForegroundColor Yellow
    Write-Host ""
    do {
        Write-Host "  ► Proceed with '$Lvl' teardown? [Y/N] " -ForegroundColor Yellow -NoNewline
        $r = (Read-Host).Trim().ToLower()
    } while ($r -notin @("y","n","yes","no"))

    if ($r -in @("n","no")) {
        Write-Warn "Cancelled by user."
        exit 0
    }
}

# ── Level: Stop ───────────────────────────────────────────────────────────────

function Stop-PortForwardTree {
    # Kill supervisors (pwsh hosting Start-PortForwards.ps1) first so they don't
    # respawn their kubectl workers, then kill the workers.
    $supervisors = Get-CimInstance Win32_Process -Filter "Name = 'pwsh.exe' OR Name = 'powershell.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -and $_.CommandLine -match 'Start-PortForwards\.ps1' }
    if ($supervisors) {
        Write-Info "Found $($supervisors.Count) Start-PortForwards supervisor(s)."
        if ($PSCmdlet.ShouldProcess("Start-PortForwards supervisors ($($supervisors.Count))", "Stop-Process")) {
            foreach ($p in $supervisors) {
                Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
            }
            Start-Sleep -Seconds 2
        }
    } else {
        Write-Info "No Start-PortForwards supervisors found."
    }

    $workers = Get-CimInstance Win32_Process -Filter "Name = 'kubectl.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -and $_.CommandLine -match 'port-forward' }
    if ($workers) {
        Write-Info "Found $($workers.Count) kubectl port-forward worker(s)."
        if ($PSCmdlet.ShouldProcess("kubectl port-forward workers ($($workers.Count))", "Stop-Process")) {
            foreach ($p in $workers) {
                Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
            }
            Start-Sleep -Seconds 1
        }
    } else {
        Write-Info "No kubectl port-forward workers found."
    }

    if (-not $WhatIfPreference) {
        $remaining = Get-CimInstance Win32_Process -Filter "Name = 'kubectl.exe' OR Name = 'pwsh.exe' OR Name = 'powershell.exe'" -ErrorAction SilentlyContinue |
            Where-Object { $_.CommandLine -and ($_.CommandLine -match 'Start-PortForwards\.ps1' -or $_.CommandLine -match 'port-forward') }
        if ($remaining) {
            Write-Warn "$($remaining.Count) process(es) still running."
        } else {
            Write-Success "All port-forward processes stopped."
        }
    }
}

function Stop-WindowsNginx {
    $nginxProcs = Get-Process nginx -ErrorAction SilentlyContinue
    if (-not $nginxProcs) {
        Write-Info "nginx is not running."
        return
    }
    Write-Info "Stopping $($nginxProcs.Count) nginx process(es)..."

    # Try a graceful stop via the nginx binary first; fall back to Stop-Process.
    $nginxDir = Resolve-NginxPath
    if ($nginxDir) {
        $nginxExe = Join-Path $nginxDir "nginx.exe"
        if ($PSCmdlet.ShouldProcess("nginx", "graceful stop via nginx -s stop")) {
            Push-Location $nginxDir
            try { & $nginxExe -s stop 2>$null | Out-Null } catch { }
            Pop-Location
            Start-Sleep -Seconds 2
        }
    }

    $stubborn = Get-Process nginx -ErrorAction SilentlyContinue
    if ($stubborn) {
        if ($PSCmdlet.ShouldProcess("remaining nginx processes", "Stop-Process -Force")) {
            $stubborn | Stop-Process -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 1
        }
    }

    if (Get-Process nginx -ErrorAction SilentlyContinue) {
        Write-Warn "nginx is still running — may be managed by a service. Stop manually."
    } else {
        Write-Success "nginx stopped."
    }
}

function Invoke-Level-Stop {
    Write-Step "Stop — port-forwards, nginx, Minikube clusters"
    Stop-PortForwardTree
    Stop-WindowsNginx

    foreach ($profile in @("west","east")) {
        $status = (& minikube status -p $profile --format '{{.Host}}' 2>$null | Out-String).Trim()
        if (-not $status -or $status -eq "Nonexistent") {
            Write-Info "minikube profile '$profile' not present — skipping stop."
            continue
        }
        if ($status -eq "Stopped") {
            Write-Info "minikube profile '$profile' already stopped."
            continue
        }
        Write-Info "Stopping minikube profile '$profile' (status: $status)..."
        if ($PSCmdlet.ShouldProcess("minikube $profile", "stop")) {
            & minikube stop -p $profile | Out-Null
            if ($LASTEXITCODE -eq 0) { Write-Success "minikube '$profile' stopped." }
            else { Write-Warn "minikube stop -p $profile exited $LASTEXITCODE" }
        }
    }
}

# ── Level: Clusters ───────────────────────────────────────────────────────────

function Invoke-Level-Clusters {
    Write-Step "Clusters — delete clusters, registry, network"

    foreach ($profile in @("west","east")) {
        $exists = (& minikube status -p $profile --format '{{.Host}}' 2>$null | Out-String).Trim()
        if ($exists -and $exists -ne "Nonexistent") {
            Write-Info "Deleting minikube profile '$profile'..."
            if ($PSCmdlet.ShouldProcess("minikube $profile", "delete")) {
                & minikube delete -p $profile | Out-Null
                if ($LASTEXITCODE -eq 0) { Write-Success "minikube '$profile' deleted." }
                else { Write-Warn "minikube delete -p $profile exited $LASTEXITCODE" }
            }
        } else {
            Write-Info "minikube profile '$profile' not known to minikube — will check for orphan container."
        }

        # Safety net: minikube state can go stale (wizard reset, Docker Desktop
        # reinstall, etc) leaving the west/east container alive but unmanaged.
        $orphan = (& docker ps -a --filter "name=^$profile$" --format '{{.Names}}' 2>$null | Out-String).Trim()
        if ($orphan -eq $profile) {
            Write-Info "  Orphan container '$profile' still present — removing..."
            if ($PSCmdlet.ShouldProcess("container $profile", "docker rm -f")) {
                & docker rm -f $profile | Out-Null
                Write-Success "  Orphan container '$profile' removed."
            }
        }
    }

    $reg = (& docker ps -a --filter 'name=^featbit-registry$' --format '{{.Names}}' 2>$null | Out-String).Trim()
    if ($reg) {
        Write-Info "Removing featbit-registry container..."
        if ($PSCmdlet.ShouldProcess("featbit-registry", "docker rm -f")) {
            & docker rm -f featbit-registry | Out-Null
            Write-Success "featbit-registry removed."
        }
    } else {
        Write-Info "featbit-registry container not present."
    }

    $net = (& docker network ls --filter 'name=^featbit-cluster-network$' --format '{{.Name}}' 2>$null | Out-String).Trim()
    if ($net) {
        Write-Info "Removing featbit-cluster-network..."
        if ($PSCmdlet.ShouldProcess("featbit-cluster-network", "docker network rm")) {
            & docker network rm featbit-cluster-network 2>$null | Out-Null
            if ($LASTEXITCODE -eq 0) { Write-Success "Network removed." }
            else {
                Write-Warn "docker network rm failed — containers still attached? List:"
                & docker network inspect featbit-cluster-network --format '{{range .Containers}}{{.Name}} {{end}}' 2>$null
            }
        }
    } else {
        Write-Info "featbit-cluster-network not present."
    }
}

# ── Level: Full ───────────────────────────────────────────────────────────────

function Invoke-Level-Full {
    Write-Step "Full — remove nginx config, hosts entries, state, images"

    # nginx config — remove the featbit nginx.conf (leave install + default conf alone)
    $nginxDir = Resolve-NginxPath
    if ($nginxDir) {
        $confPath = Join-Path $nginxDir "conf\nginx.conf"
        if (Test-Path $confPath) {
            # Back up to conf\nginx.conf.featbit-backup so the user can restore
            # the stock conf manually if needed.
            $backupPath = "$confPath.featbit-backup"
            Write-Info "Backing up and removing nginx config at $confPath..."
            if ($PSCmdlet.ShouldProcess($confPath, "move to $backupPath")) {
                Move-Item -Force $confPath $backupPath
                Write-Success "nginx config moved to $backupPath (restore manually if needed)."
            }
        } else {
            Write-Info "No nginx.conf found at $confPath."
        }
    } else {
        Write-Info "nginx install not detected — skipping nginx config cleanup."
    }

    # Windows hosts entries
    if (Test-Path $script:HostsFile) {
        $pattern = '(featbit[-.].*\.(west|east)\.local|redis\.(west|east)\.local|mongodb-[012]\.(west|east)\.local)'
        $hostsContent = Get-Content $script:HostsFile
        $filtered = $hostsContent | Where-Object { $_ -notmatch $pattern -and $_ -notmatch '^\s*# FeatBit DNS Entries' }
        if ($filtered.Count -ne $hostsContent.Count) {
            $removed = $hostsContent.Count - $filtered.Count
            Write-Info "Removing $removed entries from $script:HostsFile..."
            if ($PSCmdlet.ShouldProcess($script:HostsFile, "strip featbit.*.local entries")) {
                Set-Content -Path $script:HostsFile -Value $filtered -Encoding ASCII
                Write-Success "Hosts file cleaned."
            }
        } else {
            Write-Info "No featbit entries in $script:HostsFile."
        }
    }

    # Wizard state
    if (Test-Path $script:StateFile) {
        Write-Info "Removing wizard state: $script:StateFile"
        if ($PSCmdlet.ShouldProcess($script:StateFile, "remove")) {
            Remove-Item -Force $script:StateFile
            Write-Success "Wizard state removed."
        }
    } else {
        Write-Info "No wizard state file to remove."
    }

    # FeatBit images in local docker cache
    $imgs = (& docker images --format '{{.Repository}}:{{.Tag}}' 2>$null) | Where-Object {
        $_ -match '^(localhost:5000/)?featbit/'
    }
    if ($imgs) {
        Write-Info "Removing $($imgs.Count) FeatBit image(s) from local docker cache..."
        if ($PSCmdlet.ShouldProcess("FeatBit images", "docker rmi -f")) {
            $imgs | ForEach-Object { & docker rmi -f $_ 2>$null | Out-Null }
            Write-Success "FeatBit images removed."
        }
    } else {
        Write-Info "No FeatBit images in local docker cache."
    }
}

# ── Main ──────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  FeatBit Hyper-V Teardown — Level: $Level" -ForegroundColor White
Write-Host ""

Confirm-Teardown $Level

# Each level is strictly additive.
Invoke-Level-Stop
if ($Level -in @("Clusters","Full")) { Invoke-Level-Clusters }
if ($Level -eq "Full")               { Invoke-Level-Full }

Write-Host ""
Write-Success "Teardown level '$Level' complete."
Write-Host ""

if ($Level -eq "Full") {
    Write-Host "  To redeploy later:" -ForegroundColor White
    Write-Host "    .\Quickstart-HyperV.ps1 -Reset" -ForegroundColor Cyan
    Write-Host ""
} elseif ($Level -eq "Clusters") {
    Write-Host "  To redeploy, resume the wizard:" -ForegroundColor White
    Write-Host "    .\Quickstart-HyperV.ps1 -Reset" -ForegroundColor Cyan
    Write-Host ""
} else {
    $parent = Split-Path -Parent $PSScriptRoot
    Write-Host "  To resume, start the clusters back up:" -ForegroundColor White
    Write-Host "    minikube start -p west; minikube start -p east" -ForegroundColor Cyan
    Write-Host "    & `"$parent\Start-PortForwards.ps1`"" -ForegroundColor Cyan
    Write-Host ""
}
