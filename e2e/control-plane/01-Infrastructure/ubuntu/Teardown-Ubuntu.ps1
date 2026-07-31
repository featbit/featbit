<#
.SYNOPSIS
    Tear down the FeatBit Ubuntu deployment in layered steps.

.DESCRIPTION
    Reverses what Quickstart-Ubuntu.ps1 sets up. Pick how deep to go:

      Stop      (default) — stop port-forwards and pause Minikube. Fully
                            resumable with 'minikube start'. Keeps clusters,
                            images, nginx, and hosts entries intact.

      Clusters  — everything in Stop, plus delete the west/east Minikube
                  clusters, the featbit-registry container, and the
                  featbit-cluster-network Docker network. Redeploying takes
                  ~15 min (clusters come back, images may need rebuilding).

      Full      — everything in Clusters, plus remove the FeatBit nginx
                  config, /etc/hosts entries, wizard progress file,
                  leftover /root/.minikube and /root/.kube from any old
                  sudo runs, and FeatBit images from the local docker cache.

    Run as your normal user. The script invokes sudo per-command for steps
    that need root. Minikube's docker driver refuses root, so the script
    refuses root too.

    Scope note — NOT touched by any level:
      * Docker Engine, Minikube, kubectl, nginx (system packages)
      * deployment.env (your configured values)
      * The FeatBit source tree

.PARAMETER Level
    Stop, Clusters, or Full. Default: Stop.

.PARAMETER Force
    Skip the confirmation prompt before destructive levels.

.EXAMPLE
    pwsh ./Teardown-Ubuntu.ps1
    Stop port-forwards and pause both clusters.

.EXAMPLE
    pwsh ./Teardown-Ubuntu.ps1 -Level Clusters
    Delete the two Minikube clusters and the local registry.

.EXAMPLE
    pwsh ./Teardown-Ubuntu.ps1 -Level Full -Force
    Full wipe of the FeatBit footprint without prompting.
#>
[CmdletBinding(SupportsShouldProcess)]
param(
    [ValidateSet("Stop", "Clusters", "Full")]
    [string]$Level = "Stop",
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $IsLinux) {
    Write-Host ""
    Write-Host "  ✗ Teardown-Ubuntu.ps1 must be run on a Linux system." -ForegroundColor Red
    Write-Host ""
    exit 1
}

if (((id -u) -as [int]) -eq 0) {
    Write-Host ""
    Write-Host "  ✗ Do not run this script as root (or via sudo)." -ForegroundColor Red
    Write-Host "  It escalates per-command. Re-run as your normal user:" -ForegroundColor Gray
    Write-Host "    pwsh $PSCommandPath" -ForegroundColor White
    Write-Host ""
    exit 1
}

$script:StateFile = Join-Path $PSScriptRoot ".quickstart-state-ubuntu.json"

# ── Console helpers ───────────────────────────────────────────────────────────

function Write-Step    { param([string]$M) Write-Host "`n════════════════════════════════════════════════════════════" -ForegroundColor DarkCyan
                         Write-Host "  $M" -ForegroundColor Cyan
                         Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor DarkCyan }
function Write-Success { param([string]$M) Write-Host "  ✓ $M" -ForegroundColor Green }
function Write-Info    { param([string]$M) Write-Host "  $M" -ForegroundColor Gray }
function Write-Warn    { param([string]$M) Write-Host "  ⚠ $M" -ForegroundColor Yellow }
function Write-Fail    { param([string]$M) Write-Host "  ✗ $M" -ForegroundColor Red }

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
  It will STOP all FeatBit port-forwards first.
  Source code and deployment.env are NOT touched.
"@
        }
        "Full" {
@"
  This will DELETE everything from 'Clusters', plus:
    * Nginx config: /etc/nginx/sites-{available,enabled}/featbit
    * /etc/hosts entries for featbit.*.local / redis.*.local
    * Wizard progress file: $script:StateFile
    * Leftover /root/.minikube, /root/.kube (from old sudo runs)
    * FeatBit images in the local docker cache
  Source code and deployment.env are NOT touched.
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
    # Supervisors first so they don't respawn workers. Both pkill calls are
    # gated by ShouldProcess so -WhatIf genuinely dry-runs.
    $svc = @(& pgrep -f 'Start-PortForwards\.ps1' 2>$null).Count
    if ($svc -gt 0) {
        Write-Info "Found $svc Start-PortForwards supervisor(s)."
        if ($PSCmdlet.ShouldProcess("Start-PortForwards.ps1 supervisors ($svc)", "sudo pkill")) {
            & sudo pkill -f 'Start-PortForwards\.ps1' 2>$null | Out-Null
            Start-Sleep -Seconds 2
        }
    } else {
        Write-Info "No Start-PortForwards supervisors found."
    }

    $pf = @(& pgrep -f 'kubectl.*port-forward' 2>$null).Count
    if ($pf -gt 0) {
        Write-Info "Found $pf kubectl port-forward worker(s)."
        if ($PSCmdlet.ShouldProcess("kubectl port-forward workers ($pf)", "sudo pkill")) {
            & sudo pkill -f 'kubectl.*port-forward' 2>$null | Out-Null
            Start-Sleep -Seconds 1
            # Second sweep in case a supervisor we missed respawned some.
            $pf2 = @(& pgrep -f 'kubectl.*port-forward' 2>$null).Count
            if ($pf2 -gt 0) {
                Write-Info "  $pf2 port-forwards respawned — a supervisor survived. Killing again..."
                & sudo pkill -9 -f 'Start-PortForwards\.ps1' 2>$null | Out-Null
                & sudo pkill -9 -f 'kubectl.*port-forward' 2>$null | Out-Null
                Start-Sleep -Seconds 1
            }
        }
    } else {
        Write-Info "No kubectl port-forward workers found."
    }

    if (-not $WhatIfPreference) {
        $remaining = @(& pgrep -f 'kubectl.*port-forward|Start-PortForwards\.ps1' 2>$null)
        if ($remaining.Count -gt 0) {
            Write-Warn "$($remaining.Count) process(es) still running: $($remaining -join ', ')"
        } else {
            Write-Success "All port-forward processes stopped."
        }
    }
}

function Invoke-Level-Stop {
    Write-Step "Stop — port-forwards and Minikube clusters"
    Stop-PortForwardTree

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

        # Safety net: minikube's state can go stale (e.g. /root/.minikube nuked by
        # an earlier teardown), leaving the actual east/west container alive but
        # unmanaged. Remove it directly if present.
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
            else { Write-Warn "docker network rm failed — containers still attached? List:"
                   & docker network inspect featbit-cluster-network --format '{{range .Containers}}{{.Name}} {{end}}' 2>$null }
        }
    } else {
        Write-Info "featbit-cluster-network not present."
    }
}

# ── Level: Full ───────────────────────────────────────────────────────────────

function Invoke-Level-Full {
    Write-Step "Full — remove nginx config, hosts entries, state, images"

    # nginx config
    $sitesAvail   = "/etc/nginx/sites-available/featbit"
    $sitesEnabled = "/etc/nginx/sites-enabled/featbit"
    $hasConf = (Test-Path $sitesAvail) -or (Test-Path $sitesEnabled)
    if ($hasConf) {
        Write-Info "Removing nginx config files..."
        if ($PSCmdlet.ShouldProcess("nginx featbit config", "remove and reload")) {
            & sudo rm -f $sitesEnabled $sitesAvail | Out-Null
            & sudo nginx -t 2>$null
            if ($LASTEXITCODE -eq 0) {
                & sudo systemctl reload nginx 2>$null | Out-Null
                Write-Success "Nginx config removed and reloaded."
            } else {
                Write-Warn "nginx -t failed — not reloading. Check 'sudo nginx -t' manually."
            }
        }
    } else {
        Write-Info "No featbit nginx config present."
    }

    # /etc/hosts entries
    $hostsHits = (& grep -cE 'featbit[-.].*\.(west|east)\.local|redis\.(west|east)\.local' /etc/hosts 2>$null | Out-String).Trim()
    if ($hostsHits -and [int]$hostsHits -gt 0) {
        Write-Info "Removing $hostsHits /etc/hosts entries..."
        if ($PSCmdlet.ShouldProcess("/etc/hosts", "strip featbit.*.local entries")) {
            & sudo sed -i -E '/featbit[-.].*\.(west|east)\.local|redis\.(west|east)\.local/d' /etc/hosts
            Write-Success "/etc/hosts cleaned."
        }
    } else {
        Write-Info "No featbit entries in /etc/hosts."
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

    # Root-owned leftovers from aborted sudo runs
    foreach ($path in @("/root/.minikube","/root/.kube")) {
        $exists = & sudo test -e $path 2>$null; $rc = $LASTEXITCODE
        if ($rc -eq 0) {
            Write-Info "Removing $path (from old sudo run)..."
            if ($PSCmdlet.ShouldProcess($path, "sudo rm -rf")) {
                & sudo rm -rf $path | Out-Null
                Write-Success "$path removed."
            }
        } else {
            Write-Info "$path not present."
        }
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
Write-Host "  FeatBit Ubuntu Teardown — Level: $Level" -ForegroundColor White
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
    Write-Host "    pwsh $PSScriptRoot/Quickstart-Ubuntu.ps1 -Reset" -ForegroundColor Cyan
    Write-Host ""
} elseif ($Level -eq "Clusters") {
    Write-Host "  To redeploy, resume the wizard:" -ForegroundColor White
    Write-Host "    pwsh $PSScriptRoot/Quickstart-Ubuntu.ps1 -Reset" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host "  To resume, start the clusters back up:" -ForegroundColor White
    Write-Host "    minikube start -p west && minikube start -p east" -ForegroundColor Cyan
    Write-Host "    pwsh $(Split-Path -Parent $PSScriptRoot | Join-Path -ChildPath Start-PortForwards.ps1)" -ForegroundColor Cyan
    Write-Host ""
}
