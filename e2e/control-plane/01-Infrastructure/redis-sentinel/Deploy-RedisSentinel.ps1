<#
.SYNOPSIS
    Deploy a per-cluster Redis + Sentinel, point that cluster's FeatBit at it, and
    wire the control-plane's cross-cluster Redis (Instances__1) to the PEER cluster.

.DESCRIPTION
    Gives each cluster (west, east) its OWN HA Redis (1 master + 2 replicas, 3
    Sentinels) in-cluster, and repoints that cluster's FeatBit services
    (api-server, evaluation-server, control-plane) at its own Sentinel via:

        Redis__ConnectionString = featbit-redis:26379,serviceName=mymaster

    No shared redis between DCs. FeatBit needs NO code change — StackExchange.Redis
    2.13.1 resolves the Sentinel master from the `serviceName=` connection string.

    CROSS-CLUSTER (control-plane Redis__Instances):
      Instances__0 = LOCAL sentinel   (featbit-redis:26379,serviceName=mymaster)
      Instances__1 = PEER  master     (<peer-node-ip>:31649)   <-- this script wires it

    Why a forwarder and not the peer Sentinel directly: each cluster's Sentinel
    announces the master's IN-CLUSTER FQDN
    (featbit-redis-node-N.featbit-redis-headless.featbit.svc.cluster.local). Both
    clusters share that service name + the 'featbit' namespace, so the peer's
    announced master FQDN RESOLVES TO THE LOCAL CLUSTER'S same-ordinal pod —
    pointing Instances__1 at the peer Sentinel would MISDIRECT cross-DC writes to
    the local redis (verified). Overlapping pod CIDRs make the announced pod IPs
    non-unique too. So we expose each cluster's CURRENT master via a tiny HAProxy
    (redis-master-forward.yaml: tcp-check role:master -> master-only, follows
    failover) published on NodePort 31649, and point the peer's Instances__1 at
    <peer-node-ip>:31649 (NO serviceName -> direct master, no FQDN misdirection).
    The LOCAL sentinel path is left untouched.

    Idempotent: re-running upgrades the chart, re-applies the forwarder, and
    re-applies the env.

.PARAMETER Contexts        kube contexts (default west, east) — exactly two, ordered.
.PARAMETER Namespace       featbit namespace (default featbit)
.PARAMETER ChartVersion    bitnami/redis chart version (default 23.2.12, appVersion 8.2.3)
.PARAMETER DockerNetwork   shared docker network the node containers share (default featbit-cluster-network)
.PARAMETER ForwarderNodePort  NodePort the master-forwarder is published on (default 31649)
.PARAMETER PeerNodeIPs     optional explicit map of context->node IP (e.g. @{west='172.31.0.10';east='172.31.0.20'});
                           if omitted the script discovers each node container's IP on $DockerNetwork.
#>
[CmdletBinding()]
param(
    [string[]]$Contexts = @("west", "east"),
    [string]$Namespace = "featbit",
    [string]$ChartVersion = "23.2.12",
    [string]$DockerNetwork = "featbit-cluster-network",
    [int]$ForwarderNodePort = 31649,
    [hashtable]$PeerNodeIPs = $null
)
$ErrorActionPreference = "Stop"
function Write-Step { param([string]$M) Write-Host "`n=== $M ===" -ForegroundColor Cyan }
function Write-Ok   { param([string]$M) Write-Host "✓ $M" -ForegroundColor Green }
function Write-Info { param([string]$M) Write-Host "  $M" -ForegroundColor Gray }
function Write-Fail { param([string]$M) Write-Host "✗ $M" -ForegroundColor Red }

# Runs a kubectl/helm invocation and checks $LASTEXITCODE afterward. On non-zero
# exit, Write-Fail's the given message and exits 1 immediately — this is what
# makes sure an early failure in a pass can never be masked by a later call's
# exit code (or an unconditional Write-Ok downstream).
function Invoke-Checked {
    param(
        [Parameter(Mandatory)][scriptblock]$Command,
        [Parameter(Mandatory)][string]$FailureMessage
    )
    & $Command
    if ($LASTEXITCODE -ne 0) { Write-Fail $FailureMessage; exit 1 }
}

$valuesFile = Join-Path $PSScriptRoot "values.yaml"
$fwdFile    = Join-Path $PSScriptRoot "redis-master-forward.yaml"
if (-not (Test-Path $valuesFile)) { Write-Fail "values.yaml not found next to this script"; exit 1 }
if (-not (Test-Path $fwdFile))    { Write-Fail "redis-master-forward.yaml not found next to this script"; exit 1 }
$sentinelConn = "featbit-redis:26379,serviceName=mymaster"

# Resolve each context's node-container IP on the shared docker network (used as the
# cross-cluster-reachable address the peer's Instances__1 dials).
function Get-NodeIp {
    param([string]$Ctx)
    if ($PeerNodeIPs -and $PeerNodeIPs[$Ctx]) { return $PeerNodeIPs[$Ctx] }
    # minikube node containers are named after the profile (== context here)
    $ip = (& docker inspect -f "{{(index .NetworkSettings.Networks `"$DockerNetwork`").IPAddress}}" $Ctx 2>$null)
    if (-not $ip) { Write-Fail "could not discover node IP for '$Ctx' on docker network '$DockerNetwork' (pass -PeerNodeIPs)"; exit 1 }
    return $ip.Trim()
}

& helm repo add bitnami https://charts.bitnami.com/bitnami *> $null
& helm repo update bitnami *> $null

# ---- Pass 1: per-cluster redis+sentinel, master-forwarder, and LOCAL sentinel wiring ----
foreach ($ctx in $Contexts) {
    Write-Step "Deploying Redis+Sentinel to '$ctx'"
    & helm upgrade --install featbit-redis bitnami/redis --version $ChartVersion `
        --kube-context $ctx --namespace $Namespace -f $valuesFile --timeout 6m
    if ($LASTEXITCODE -ne 0) { Write-Fail "helm install failed on $ctx"; exit 1 }
    & kubectl --context $ctx -n $Namespace rollout status statefulset/featbit-redis-node --timeout=300s
    if ($LASTEXITCODE -ne 0) { Write-Fail "redis nodes not ready on $ctx"; exit 1 }
    Write-Ok "redis+sentinel ready on $ctx (3 nodes)"

    Write-Step "Deploying cross-cluster master-forwarder to '$ctx'"
    Invoke-Checked -FailureMessage "master-forwarder apply failed on $ctx" -Command {
        kubectl --context $ctx -n $Namespace apply -f $fwdFile | Out-Null
    }
    Invoke-Checked -FailureMessage "master-forwarder rollout not ready on $ctx" -Command {
        kubectl --context $ctx -n $Namespace rollout status deploy/featbit-redis-master-fwd --timeout=120s | Out-Null
    }
    Write-Ok "master-forwarder ready on $ctx (NodePort $ForwarderNodePort -> current master)"

    Write-Step "Pointing $ctx FeatBit at its Sentinel"
    # api-server first: it repopulates redis from MongoDB on startup.
    Invoke-Checked -FailureMessage "set env deploy/api-server failed on $ctx" -Command {
        kubectl --context $ctx -n $Namespace set env deploy/api-server "Redis__ConnectionString=$sentinelConn" | Out-Null
    }
    # DcId is required alongside the ConnectionString (per README) — without it,
    # standalone/re-run deploys leave Instances__0__DcId unset and the
    # DcIdConsistencyChecker reports persistent 'unknownDcs' warnings.
    # Redis__ConnectionString (the PLAIN key) is what the back-end components embedded in the
    # control-plane use (PodHealthChecker heartbeat purge, etc.). Without it they read the
    # orphaned legacy redis and silently see nothing (#113); Instances__0/__1 cover only the
    # composite/consistency paths.
    Invoke-Checked -FailureMessage "set env deploy/control-plane failed on $ctx" -Command {
        kubectl --context $ctx -n $Namespace set env deploy/control-plane `
            "Redis__ConnectionString=$sentinelConn" `
            "Redis__Instances__0__ConnectionString=$sentinelConn" "Redis__Instances__0__DcId=$ctx" | Out-Null
    }
    Invoke-Checked -FailureMessage "api-server rollout not ready on $ctx" -Command {
        kubectl --context $ctx -n $Namespace rollout status deploy/api-server --timeout=180s | Out-Null
    }
    Invoke-Checked -FailureMessage "control-plane rollout not ready on $ctx" -Command {
        kubectl --context $ctx -n $Namespace rollout status deploy/control-plane --timeout=180s | Out-Null
    }
    Invoke-Checked -FailureMessage "set env deploy/evaluation-server failed on $ctx" -Command {
        kubectl --context $ctx -n $Namespace set env deploy/evaluation-server "Redis__ConnectionString=$sentinelConn" | Out-Null
    }
    Invoke-Checked -FailureMessage "evaluation-server rollout not ready on $ctx" -Command {
        kubectl --context $ctx -n $Namespace rollout status deploy/evaluation-server --timeout=180s | Out-Null
    }
    Write-Ok "$ctx api/eval/control-plane Instances__0 -> $sentinelConn (local sentinel, DcId=$ctx)"
}

# ---- Pass 2: cross-cluster control-plane Instances__1 -> PEER master forwarder ----
# Order is preserved: Instances__0 = local sentinel (above), Instances__1 = remote peer.
if ($Contexts.Count -eq 2) {
    $a, $b = $Contexts[0], $Contexts[1]
    $ipA = Get-NodeIp $a
    $ipB = Get-NodeIp $b
    Write-Step "Wiring cross-cluster control-plane Instances__1 (peer master forwarder)"
    Write-Info "$a node=$ipA  |  $b node=$ipB  |  forwarder NodePort=$ForwarderNodePort"

    # $a control-plane -> peer ($b) ; $b control-plane -> peer ($a)
    Invoke-Checked -FailureMessage "set env deploy/control-plane (Instances__1) failed on $a" -Command {
        kubectl --context $a -n $Namespace set env deploy/control-plane `
            "Redis__Instances__1__ConnectionString=${ipB}:$ForwarderNodePort" "Redis__Instances__1__DcId=$b" | Out-Null
    }
    Invoke-Checked -FailureMessage "set env deploy/control-plane (Instances__1) failed on $b" -Command {
        kubectl --context $b -n $Namespace set env deploy/control-plane `
            "Redis__Instances__1__ConnectionString=${ipA}:$ForwarderNodePort" "Redis__Instances__1__DcId=$a" | Out-Null
    }

    Invoke-Checked -FailureMessage "control-plane rollout not ready on $a (Instances__1)" -Command {
        kubectl --context $a -n $Namespace rollout status deploy/control-plane --timeout=180s | Out-Null
    }
    Invoke-Checked -FailureMessage "control-plane rollout not ready on $b (Instances__1)" -Command {
        kubectl --context $b -n $Namespace rollout status deploy/control-plane --timeout=180s | Out-Null
    }
    Write-Ok "$a CP Instances__1 -> ${ipB}:$ForwarderNodePort (DcId=$b)"
    Write-Ok "$b CP Instances__1 -> ${ipA}:$ForwarderNodePort (DcId=$a)"
}
else {
    Write-Info "Not exactly two contexts; skipping cross-cluster Instances__1 wiring."
}

Write-Step "Done"
Write-Info "Each cluster has its own Redis+Sentinel (local Instances__0); cross-DC Instances__1 -> peer master via NodePort $ForwarderNodePort."
Write-Info "Verify local : kubectl --context <c> -n featbit exec featbit-redis-node-0 -c sentinel -- redis-cli -p 26379 SENTINEL get-master-addr-by-name mymaster"
Write-Info "Verify cross : kubectl --context <c> -n featbit exec featbit-redis-node-0 -c sentinel -- redis-cli -h <peer-node-ip> -p $ForwarderNodePort INFO replication | grep role:"
