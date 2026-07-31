<#
.SYNOPSIS
    Manages all FeatBit port forwards in a single process with auto-restart.

.DESCRIPTION
    This script runs all kubectl port-forward commands in a single PowerShell window
    with automatic restart if any connection fails. Much cleaner than multiple terminals.
    
    Port Forwards:
    - West UI: 8081 -> ui:8081
    - East UI: 8082 -> ui:8081
    - West API: 15000 -> api-server:5000
    - East API: 15001 -> api-server:5000
    - West Eval: 5100 -> evaluation-server:5100
    - East Eval: 5101 -> evaluation-server:5100
    - West Control Plane: 5200 -> control-plane:5200
    - East Control Plane: 5201 -> control-plane:5200
    - Kafka: 29092 -> kafka:29092 (West, external listener)
    - West Kafka UI: 18080 -> kafka-ui:8080
    - East Kafka UI: 18081 -> kafka-ui:8080
    - West Redis: 6379 -> redis:6379
    - East Redis: 6380 -> redis:6379
    - MongoDB-0: 27017 -> mongodb-0-lb:27017 (West)
    - MongoDB-1: 27018 -> mongodb-1-lb:27017 (West)
    - MongoDB-2: 27019 -> mongodb-2-lb:27017 (East)

.EXAMPLE
    .\Start-PortForwards.ps1
    Starts all port forwards in a minimized window.

.NOTES
    Author: GitHub Copilot
    Date: 2026-03-04
#>

[CmdletBinding()]
param()

$ErrorActionPreference = "Continue"

$logFile = Join-Path $PSScriptRoot "port-forwards.log"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Level] $Message"
    Write-Host $logMessage
    Add-Content -Path $logFile -Value $logMessage -ErrorAction SilentlyContinue
}

function Start-PortForward {
    param(
        [string]$Name,
        [string]$Context,
        [string]$Namespace,
        [string]$Service,
        [string]$Pod,
        [string]$LocalPort,
        [string]$RemotePort
    )
    
    while ($true) {
        $target = if ($Pod) { "pod/$Pod" } else { "svc/$Service" }
        $displayName = if ($Pod) { $Pod } else { $Service }
        
        Write-Log "Starting $Name (${Context}/${Namespace}/${displayName} ${LocalPort}:${RemotePort})"
        
        try {
            $process = Start-Process kubectl `
                -ArgumentList @(
                    "--context", $Context,
                    "port-forward",
                    "-n", $Namespace,
                    $target,
                    "${LocalPort}:${RemotePort}"
                ) `
                -NoNewWindow `
                -PassThru `
                -RedirectStandardOutput "$PSScriptRoot\${Name}-stdout.log" `
                -RedirectStandardError "$PSScriptRoot\${Name}-stderr.log"
            
            Write-Log "$Name started (PID: $($process.Id))"
            
            # Wait for process to exit
            $process.WaitForExit()
            
            Write-Log "$Name exited with code $($process.ExitCode)" -Level "WARN"
            
        } catch {
            Write-Log "Error starting ${Name}: $($_.Exception.Message)" -Level "ERROR"
        }
        
        # Wait before restarting
        Write-Log "Restarting $Name in 5 seconds..." -Level "WARN"
        Start-Sleep -Seconds 5
    }
}

function Test-PodExists {
    param(
        [string]$Context,
        [string]$Namespace,
        [string]$PodName
    )

    kubectl --context $Context get pod $PodName -n $Namespace -o name 2>$null | Out-Null
    return ($LASTEXITCODE -eq 0)
}

Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "  FeatBit Port Forward Manager" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Starting all port forwards..." -ForegroundColor Yellow
Write-Host "  This window will stay open and manage all forwards" -ForegroundColor Gray
Write-Host "  Press Ctrl+C to stop all port forwards" -ForegroundColor Gray
Write-Host "  Logs: $logFile" -ForegroundColor Gray
Write-Host ""

# Clear old log
if (Test-Path $logFile) {
    try {
        Remove-Item $logFile -Force -ErrorAction Stop
    } catch {
        $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
        $logFile = Join-Path $PSScriptRoot "port-forwards-$timestamp.log"
        Write-Host "Using alternate log file: $logFile" -ForegroundColor Yellow
    }
}

Write-Log "Port Forward Manager Started"

# Create jobs for each port forward
$jobs = @(
    @{Name="west-ui"; Context="west"; Namespace="featbit"; Service="ui"; LocalPort="8081"; RemotePort="8081"}
    @{Name="east-ui"; Context="east"; Namespace="featbit"; Service="ui"; LocalPort="8082"; RemotePort="8081"}
    @{Name="west-api"; Context="west"; Namespace="featbit"; Service="api-server"; LocalPort="15000"; RemotePort="5000"}
    @{Name="east-api"; Context="east"; Namespace="featbit"; Service="api-server"; LocalPort="15001"; RemotePort="5000"}
    # NOTE: west-eval and east-eval port-forwards are no longer static here.
    # cp09 needs intra-cluster failover testing, which requires per-pod
    # port-forwards through host nginx round-robin. The eval coordinator
    # runspaces below own the slot pool (5100,5102,5104,5106,5108 for west
    # and 5101,5103,5105,5107,5109 for east) and dynamically map running
    # eval-server pods to free slots. nginx.conf upstream featbit_eval lists
    # all 10 slots; pods that aren't currently mapped show as "down" — fine.
    @{Name="west-control-plane"; Context="west"; Namespace="featbit"; Service="control-plane"; LocalPort="5200"; RemotePort="5200"}
    @{Name="east-control-plane"; Context="east"; Namespace="featbit"; Service="control-plane"; LocalPort="5201"; RemotePort="5200"}
    @{Name="kafka"; Context="west"; Namespace="featbit"; Service="kafka"; LocalPort="29092"; RemotePort="29092"}
    @{Name="west-kafka-ui"; Context="west"; Namespace="featbit"; Service="kafka-ui"; LocalPort="18080"; RemotePort="8080"}
    @{Name="east-kafka-ui"; Context="east"; Namespace="featbit"; Service="kafka-ui"; LocalPort="18081"; RemotePort="8080"}
    # Redis port-forwards bind to 0.0.0.0 so that control-plane pods can reach them via
    # host.minikube.internal (resolves to 192.168.127.254 on Hyper-V), which is not the
    # loopback address. All other port-forwards remain loopback-only.
    @{Name="west-redis"; Context="west"; Namespace="featbit"; Service="redis"; LocalPort="6379"; RemotePort="6379"; Address="0.0.0.0"}
    @{Name="east-redis"; Context="east"; Namespace="featbit"; Service="redis"; LocalPort="6380"; RemotePort="6379"; Address="0.0.0.0"}
)

# Advanced mode: MongoDB runs as a StatefulSet — pods are mongodb-west-0/1 and mongodb-east-0.
# Basic mode: MongoDB runs on host Docker — no pods in the cluster.
$mongoAdvanced = (Test-PodExists -Context "west" -Namespace "featbit" -PodName "mongodb-west-0") -and
                 (Test-PodExists -Context "east" -Namespace "featbit" -PodName "mongodb-east-0")
$mongoBasic    = -not $mongoAdvanced -and
                 (Test-PodExists -Context "west" -Namespace "featbit" -PodName "mongodb-0") -and
                 (Test-PodExists -Context "east" -Namespace "featbit" -PodName "mongodb-0")

if ($mongoAdvanced) {
    $jobs += @(
        @{Name="mongodb-0"; Context="west"; Namespace="featbit"; Pod="mongodb-west-0"; LocalPort="27017"; RemotePort="27017"}
        @{Name="mongodb-1"; Context="west"; Namespace="featbit"; Pod="mongodb-west-1"; LocalPort="27018"; RemotePort="27017"}
        @{Name="mongodb-2"; Context="east"; Namespace="featbit"; Pod="mongodb-east-0"; LocalPort="27019"; RemotePort="27017"}
    )
}
elseif ($mongoBasic) {
    $jobs += @(
        @{Name="mongodb-0"; Context="west"; Namespace="featbit"; Pod="mongodb-0"; LocalPort="27017"; RemotePort="27017"}
        @{Name="mongodb-1"; Context="east"; Namespace="featbit"; Pod="mongodb-0"; LocalPort="27018"; RemotePort="27017"}
    )
}
else {
    Write-Log "Skipping MongoDB pod port-forwards (no MongoDB pods found — host MongoDB mode or pods not ready)." -Level "WARN"
}

# Start each port forward in a background job
$runspaceJobs = @()
foreach ($job in $jobs) {
    $scriptBlock = {
        param($Name, $Context, $Namespace, $Service, $Pod, $LocalPort, $RemotePort, $LogFile, $ScriptRoot, $Address)
        
        function Write-Log {
            param([string]$Message, [string]$Level = "INFO")
            $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            $logMessage = "[$timestamp] [$Level] [$Name] $Message"
            Add-Content -Path $LogFile -Value $logMessage -ErrorAction SilentlyContinue
        }
        
        while ($true) {
            Write-Log "Starting port forward ${LocalPort}:${RemotePort}"
            
            try {
                $addressArgs = if ($Address) { @("--address", $Address) } else { @() }
                if ($Pod) {
                    kubectl --context $Context port-forward @addressArgs -n $Namespace "pod/$Pod" "${LocalPort}:${RemotePort}" 2>&1 | Out-Null
                } else {
                    kubectl --context $Context port-forward @addressArgs -n $Namespace "svc/$Service" "${LocalPort}:${RemotePort}" 2>&1 | Out-Null
                }
                Write-Log "Port forward exited" -Level "WARN"
            } catch {
                Write-Log "Error: $($_.Exception.Message)" -Level "ERROR"
            }
            
            Start-Sleep -Seconds 5
        }
    }
    
    $powerShell = [PowerShell]::Create()
    $powerShell.AddScript($scriptBlock).
        AddArgument($job.Name).
        AddArgument($job.Context).
        AddArgument($job.Namespace).
        AddArgument($(if ($job.ContainsKey('Service')) { $job['Service'] } else { $null })).
        AddArgument($(if ($job.ContainsKey('Pod')) { $job['Pod'] } else { $null })).
        AddArgument($job.LocalPort).
        AddArgument($job.RemotePort).
        AddArgument($logFile).
        AddArgument($PSScriptRoot).
        AddArgument($(if ($job.ContainsKey('Address')) { $job['Address'] } else { $null })) | Out-Null
    
    $handle = $powerShell.BeginInvoke()
    
    $runspaceJobs += @{
        PowerShell = $powerShell
        Handle = $handle
        Name = $job.Name
    }
    
    Write-Log "Started background job for $($job.Name)"
}

# ── Evaluation-server slot-pool coordinators (per cluster) ─────────────────
# cp09 needs intra-cluster failover proof, which requires per-pod port-forwards
# through host nginx so each WS connection lands on a specific pod (not the
# Service round-robin behind a single port-forward). Each coordinator runspace
# owns a fixed slot pool for its cluster, polls running eval-server pods
# every 3s, claims a free slot for each unclaimed pod (after kubectl wait
# --for=condition=ready), spawns kubectl port-forward pod/<name> <slot>:5100,
# and frees slots when a pod or its forward dies. nginx.conf lists all 10
# slots; unmapped slots show as "down" upstreams which nginx tolerates.
#
# West slots: 5100, 5102, 5104 (active) + 5106, 5108 (spare for scale-up).
# East slots: 5101, 5103, 5105 (active) + 5107, 5109 (spare for scale-up).
$evalSlotsWest = @(5100, 5102, 5104, 5106, 5108)
$evalSlotsEast = @(5101, 5103, 5105, 5107, 5109)

$evalCoordinatorScript = {
    param($ScriptRoot, $LogFile, [int[]]$Slots, $Context, $Namespace)

    function Write-Log {
        param([string]$Message, [string]$Level = "INFO")
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        $logMessage = "[$timestamp] [$Level] [eval-coord-$Context] $Message"
        Add-Content -Path $LogFile -Value $logMessage -ErrorAction SilentlyContinue
    }

    # slot port -> @{Pod=...; Process=...; StartedAt=...}
    $forwards = @{}

    Write-Log "Coordinator starting; managing slots: $($Slots -join ', ')"

    while ($true) {
        try {
            # Discover running eval-server pods on this cluster.
            $podsJson = kubectl --context $Context -n $Namespace get pods -l app=evaluation-server -o json 2>$null
            if (-not $podsJson) {
                Write-Log "kubectl get pods returned no output; sleeping" -Level "WARN"
                Start-Sleep -Seconds 3
                continue
            }

            $podObjs = ($podsJson | ConvertFrom-Json).items
            $runningPods = @($podObjs | Where-Object {
                $_.status.phase -eq 'Running' -and
                ($_.status.containerStatuses | Where-Object { -not $_.ready } | Measure-Object).Count -eq 0
            } | ForEach-Object { $_.metadata.name })

            # Reap forwards whose process died OR whose pod disappeared.
            foreach ($slotPort in @($forwards.Keys)) {
                $f = $forwards[$slotPort]
                $podGone = ($runningPods -notcontains $f.Pod)
                $procDead = ($null -eq $f.Process) -or $f.Process.HasExited
                if ($podGone -or $procDead) {
                    $reason = if ($podGone) { "pod $($f.Pod) gone" } else { "port-forward process exited" }
                    Write-Log "Freeing slot $slotPort ($reason)"
                    if ($f.Process -and -not $f.Process.HasExited) {
                        try { Stop-Process -Id $f.Process.Id -Force -ErrorAction SilentlyContinue } catch {}
                    }
                    $forwards.Remove($slotPort)
                }
            }

            # Assign any unclaimed running pod to a free slot.
            $claimedPods = @($forwards.Values | ForEach-Object { $_.Pod })
            foreach ($pod in $runningPods) {
                if ($claimedPods -contains $pod) { continue }

                $freeSlot = $Slots | Where-Object { -not $forwards.ContainsKey($_) } | Select-Object -First 1
                if (-not $freeSlot) {
                    Write-Log "No free slot for pod $pod (all $($Slots.Count) slots busy)" -Level "WARN"
                    break
                }

                # Wait for the pod to be Ready (covers the case where Phase=Running
                # but readinessProbe hasn't passed yet — eliminates the port-forward
                # bound to terminating/half-up pod flap).
                $waitOutput = kubectl --context $Context -n $Namespace wait --for=condition=ready "pod/$pod" --timeout=30s 2>&1
                if ($LASTEXITCODE -ne 0) {
                    Write-Log "kubectl wait pod/$pod failed: $waitOutput; skipping this cycle" -Level "WARN"
                    continue
                }

                $slotLog = Join-Path $ScriptRoot "$Context-eval-slot-$freeSlot.log"
                $slotErr = Join-Path $ScriptRoot "$Context-eval-slot-$freeSlot.err"

                try {
                    $proc = Start-Process kubectl `
                        -ArgumentList @(
                            "--context", $Context,
                            "port-forward",
                            "-n", $Namespace,
                            "pod/$pod",
                            "${freeSlot}:5100"
                        ) `
                        -NoNewWindow `
                        -PassThru `
                        -RedirectStandardOutput $slotLog `
                        -RedirectStandardError $slotErr

                    $forwards[$freeSlot] = @{
                        Pod       = $pod
                        Process   = $proc
                        StartedAt = Get-Date
                    }
                    $claimedPods += $pod
                    Write-Log "Slot $freeSlot -> pod $pod (PID $($proc.Id))"
                } catch {
                    Write-Log "Failed to spawn port-forward for pod $pod on slot ${freeSlot}: $($_.Exception.Message)" -Level "ERROR"
                }
            }
        } catch {
            Write-Log "Coordinator loop error: $($_.Exception.Message)" -Level "ERROR"
        }

        Start-Sleep -Seconds 3
    }
}

$evalCoordinators = @()
foreach ($evalCtx in @(
    @{Context = "west"; Slots = $evalSlotsWest},
    @{Context = "east"; Slots = $evalSlotsEast}
)) {
    $ps = [PowerShell]::Create()
    $ps.AddScript($evalCoordinatorScript).
        AddArgument($PSScriptRoot).
        AddArgument($logFile).
        AddArgument($evalCtx.Slots).
        AddArgument($evalCtx.Context).
        AddArgument("featbit") | Out-Null

    $handle = $ps.BeginInvoke()
    $evalCoordinators += @{
        PowerShell = $ps
        Handle     = $handle
        Name       = "eval-coordinator-$($evalCtx.Context)"
    }
    Write-Log "Started eval-coordinator for $($evalCtx.Context) (slots: $($evalCtx.Slots -join ','))"
}

Write-Host "✓ All port forwards started" -ForegroundColor Green
Write-Host ""
Write-Host "Port Mappings:" -ForegroundColor Cyan
Write-Host "  Application Services:" -ForegroundColor Yellow
Write-Host "    localhost:8081 → West UI" -ForegroundColor Gray
Write-Host "    localhost:8082 → East UI" -ForegroundColor Gray
Write-Host "    localhost:15000 → West API" -ForegroundColor Gray
Write-Host "    localhost:15001 → East API" -ForegroundColor Gray
Write-Host "    localhost:5100,5102,5104 → West Evaluation (per-pod slots; 5106/5108 spare)" -ForegroundColor Gray
Write-Host "    localhost:5101,5103,5105 → East Evaluation (per-pod slots; 5107/5109 spare)" -ForegroundColor Gray
Write-Host "    localhost:5200 → West Control Plane" -ForegroundColor Gray
Write-Host "    localhost:5201 → East Control Plane" -ForegroundColor Gray
Write-Host ""
Write-Host "  Infrastructure Services:" -ForegroundColor Yellow
Write-Host "    localhost:29092 → Kafka (West, external listener)" -ForegroundColor Gray
    Write-Host "    localhost:18080 → West Kafka UI (featbit-kafka.west.local)" -ForegroundColor Gray
    Write-Host "    localhost:18081 → East Kafka UI (featbit-kafka.east.local)" -ForegroundColor Gray
    Write-Host "    localhost:6379  → West Redis (redis.west.local)" -ForegroundColor Gray
    Write-Host "    localhost:6380  → East Redis (redis.east.local)" -ForegroundColor Gray
Write-Host ""
Write-Host "  MongoDB Replica Set:" -ForegroundColor Yellow
if ($mongoAdvanced) {
    Write-Host "    localhost:27017 → mongodb-west-0 (West)" -ForegroundColor Gray
    Write-Host "    localhost:27018 → mongodb-west-1 (West)" -ForegroundColor Gray
    Write-Host "    localhost:27019 → mongodb-east-0 (East)" -ForegroundColor Gray
}
elseif ($mongoBasic) {
    Write-Host "    localhost:27017 → MongoDB-0 (West)" -ForegroundColor Gray
    Write-Host "    localhost:27018 → MongoDB-0 (East)" -ForegroundColor Gray
}
else {
    Write-Host "    Skipped (no MongoDB pods found — host MongoDB mode or pods not ready)" -ForegroundColor Gray
}
Write-Host ""
Write-Host "Press Ctrl+C to stop..." -ForegroundColor Yellow

# Keep script running and monitor
try {
    while ($true) {
        Start-Sleep -Seconds 10
        
        # Check if any jobs failed
        $anyFailed = $false
        foreach ($job in $runspaceJobs) {
            if ($job.Handle.IsCompleted) {
                $anyFailed = $true
                Write-Log "Job $($job.Name) completed unexpectedly" -Level "ERROR"
            }
        }
        
        if ($anyFailed) {
            Write-Log "Some jobs completed, but auto-restart should handle it" -Level "WARN"
        }
    }
} finally {
    Write-Log "Shutting down all port forwards..."
    foreach ($job in $runspaceJobs) {
        $job.PowerShell.Stop()
        $job.PowerShell.Dispose()
    }
    foreach ($coord in $evalCoordinators) {
        $coord.PowerShell.Stop()
        $coord.PowerShell.Dispose()
    }
    # The eval coordinators' child kubectl port-forward processes are not
    # owned by any runspace; sweep up any orphans started by this script.
    Get-Process kubectl -ErrorAction SilentlyContinue | Where-Object {
        try {
            $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)" -ErrorAction SilentlyContinue).CommandLine
            $cmd -match 'port-forward.*pod/evaluation-server'
        } catch { $false }
    } | ForEach-Object {
        try { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue } catch {}
    }
    Write-Log "Port Forward Manager Stopped"
}
