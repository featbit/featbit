<#
.SYNOPSIS
    Restores the cross-cluster Kafka configuration after a manual YAML re-apply.

.DESCRIPTION
    Applying the kafka-aggregate or kafka-mirrormaker-remote YAML files directly
    (e.g. with kubectl apply or Set-InfraImages.ps1) resets their env vars to the
    placeholder values baked into the manifests:

        KAFKA_CFG_ADVERTISED_LISTENERS = PLAINTEXT://kafka-aggregate:9092,PLAINTEXT_HOST://127.0.0.1:30094
        REMOTE_BOOTSTRAP_SERVERS       = 127.0.0.1:30094

    This script re-applies the correct node IPs on the shared bridge network so that:
      - kafka-aggregate advertises its real NodePort address to remote MirrorMakers.
      - kafka-mirrormaker-remote produces to the OTHER cluster's kafka-aggregate.

    Cross-cluster topology (fixed IPs on the featbit-cluster-network bridge):
      west node: 172.31.0.10   east node: 172.31.0.20

    west kafka-aggregate  -> advertises 172.31.0.10:30094
    east kafka-aggregate  -> advertises 172.31.0.20:30094
    west mirrormaker-remote -> produces to east at 172.31.0.20:30094
    east mirrormaker-remote -> produces to west at 172.31.0.10:30094

.PARAMETER WestNodeIp
    Shared bridge network IP of the west Minikube node. Default: 172.31.0.10

.PARAMETER EastNodeIp
    Shared bridge network IP of the east Minikube node. Default: 172.31.0.20

.PARAMETER Namespace
    Kubernetes namespace where FeatBit is deployed. Default: featbit

.PARAMETER WhatIf
    Preview the kubectl commands that would be run without executing them.

.EXAMPLE
    .\Repair-KafkaConfig.ps1
    Restores default node IPs on both clusters.

.EXAMPLE
    .\Repair-KafkaConfig.ps1 -WhatIf
    Preview the commands without making any changes.

.EXAMPLE
    .\Repair-KafkaConfig.ps1 -WestNodeIp 192.168.1.10 -EastNodeIp 192.168.1.20
    Use custom node IPs (if defaults were changed in deployment).

.NOTES
    Run this script whenever you re-apply kafka-aggregate or
    kafka-mirrormaker-remote manifests outside of Deploy-FeatBitClusters.ps1.
#>

[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$WestNodeIp = "172.31.0.10",
    [string]$EastNodeIp  = "172.31.0.20",
    [string]$Namespace   = "featbit"
)

$ErrorActionPreference = "Stop"

# Load deployment.env overrides if present (WestNodeIp / EastNodeIp are not
# standard env-file keys, so CLI args always win; this is just for namespace).
# deployment.env and Import-DeploymentEnv.ps1 live one level up in 01-Infrastructure/.
$infraDir = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $infraDir "deployment.env"
if (Test-Path $envFile) {
    $parsed = & (Join-Path $infraDir "Import-DeploymentEnv.ps1")
    if ($parsed.ContainsKey("Namespace") -and -not $PSBoundParameters.ContainsKey("Namespace")) {
        $Namespace = $parsed["Namespace"]
    }
}

function Write-Info  { param([string]$msg) Write-Host "  $msg" -ForegroundColor Cyan }
function Write-Ok    { param([string]$msg) Write-Host "  $msg" -ForegroundColor Green }
function Write-Step  { param([string]$msg) Write-Host "`n$msg" -ForegroundColor White }

function Invoke-SetEnv {
    param(
        [string]$Context,
        [string]$Resource,
        [string]$EnvKv,
        [string]$Label
    )

    $cmd = "kubectl --context $Context -n $Namespace set env $Resource `"$EnvKv`""
    if ($PSCmdlet.ShouldProcess("$Context/$Resource", "set env $EnvKv")) {
        Write-Info $Label
        kubectl --context $Context -n $Namespace set env $Resource $EnvKv | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "kubectl set env failed for $Context/$Resource ($EnvKv)"
        }
    }
    else {
        Write-Info "[WhatIf] $cmd"
    }
}

Write-Step "Repairing Kafka cross-cluster configuration"
Write-Info "West node IP : $WestNodeIp"
Write-Info "East node IP : $EastNodeIp"
Write-Info "Namespace    : $Namespace"

# 1. Patch kafka-aggregate advertised listeners on both clusters.
Write-Step "Patching kafka-aggregate ADVERTISED_LISTENERS"

Invoke-SetEnv `
    -Context   "west" `
    -Resource  "deployment/kafka-aggregate" `
    -EnvKv     "KAFKA_CFG_ADVERTISED_LISTENERS=PLAINTEXT://kafka-aggregate:9092,PLAINTEXT_HOST://${WestNodeIp}:30094" `
    -Label     "west kafka-aggregate -> $WestNodeIp:30094"

Invoke-SetEnv `
    -Context   "east" `
    -Resource  "deployment/kafka-aggregate" `
    -EnvKv     "KAFKA_CFG_ADVERTISED_LISTENERS=PLAINTEXT://kafka-aggregate:9092,PLAINTEXT_HOST://${EastNodeIp}:30094" `
    -Label     "east kafka-aggregate -> $EastNodeIp:30094"

# 2. Patch kafka-mirrormaker-remote target broker on both clusters.
Write-Step "Patching kafka-mirrormaker-remote REMOTE_BOOTSTRAP_SERVERS"

Invoke-SetEnv `
    -Context   "west" `
    -Resource  "deployment/kafka-mirrormaker-remote" `
    -EnvKv     "REMOTE_BOOTSTRAP_SERVERS=${EastNodeIp}:30094" `
    -Label     "west mirrormaker-remote -> east ($EastNodeIp:30094)"

Invoke-SetEnv `
    -Context   "east" `
    -Resource  "deployment/kafka-mirrormaker-remote" `
    -EnvKv     "REMOTE_BOOTSTRAP_SERVERS=${WestNodeIp}:30094" `
    -Label     "east mirrormaker-remote -> west ($WestNodeIp:30094)"

if ($PSCmdlet.ShouldProcess("both clusters", "wait for rollouts")) {
    # 3. Wait for rollouts to complete.
    Write-Step "Waiting for rollouts"

    foreach ($ctx in @("west", "east")) {
        Write-Info "Waiting for kafka-aggregate rollout on $ctx..."
        kubectl --context $ctx rollout status deployment/kafka-aggregate -n $Namespace --timeout=120s | Out-Null

        Write-Info "Waiting for kafka-mirrormaker-remote rollout on $ctx..."
        kubectl --context $ctx rollout status deployment/kafka-mirrormaker-remote -n $Namespace --timeout=120s | Out-Null
    }

    Write-Ok ""
    Write-Ok "Kafka cross-cluster configuration repaired."
    Write-Ok "Allow ~30 seconds for MirrorMaker to re-establish consumer group membership."
}
