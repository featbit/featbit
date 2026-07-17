<#
.SYNOPSIS
    Installs or upgrades Chaos Mesh on Minikube clusters (east, west, or both).

.DESCRIPTION
    This script performs the following operations:
    1. Ensures the Chaos Mesh Helm repository is available
    2. Tunes node-level inotify limits to prevent "too many open files" errors
    3. Installs or upgrades Chaos Mesh via Helm using the shared values file
    4. Validates that all Chaos Mesh pods reach Running state

    The values file is located at e2e/control-plane/01-Infrastructure/chaos-mesh/values.yml.

    Prerequisites:
    - Minikube clusters (east/west) already running
    - Helm installed
    - kubectl installed

.PARAMETER Clusters
    Which clusters to deploy to. Default: both east and west.

.PARAMETER ChartVersion
    Chaos Mesh Helm chart version to install. Default: latest.

.PARAMETER Namespace
    Kubernetes namespace for Chaos Mesh. Default: chaos-mesh.

.PARAMETER ValuesFile
    Path to the Helm values file. Default: e2e/control-plane/01-Infrastructure/chaos-mesh/values.yml.

.PARAMETER SkipInotifyTuning
    If specified, skips the inotify sysctl tuning on cluster nodes.

.PARAMETER TimeoutSeconds
    Seconds to wait for pods to become ready. Default: 120.

.EXAMPLE
    .\Deploy-ChaosMesh.ps1
    Installs Chaos Mesh on both east and west clusters.

.EXAMPLE
    .\Deploy-ChaosMesh.ps1 -Clusters east
    Installs Chaos Mesh on the east cluster only.

.EXAMPLE
    .\Deploy-ChaosMesh.ps1 -ChartVersion 2.8.2
    Installs a specific Chaos Mesh version on both clusters.

.NOTES
    Author: GitHub Copilot
    Date: 2026-05-05
#>

[CmdletBinding()]
param(
    [ValidateSet("east", "west")]
    [string[]]$Clusters = @("east", "west"),
    [string]$ChartVersion = "",
    [string]$Namespace = "chaos-mesh",
    [string]$ValuesFile = "",
    [switch]$SkipInotifyTuning,
    [int]$TimeoutSeconds = 120
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "`n=== $Message ===" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host "  $Message" -ForegroundColor Gray
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

if (-not $ValuesFile) {
    $ValuesFile = Join-Path $PSScriptRoot ".." "chaos-mesh" "values.yml"
}

if (-not (Test-Path $ValuesFile)) {
    Write-Error "Values file not found: $ValuesFile"
    exit 1
}

# ── Pre-flight ────────────────────────────────────────────────────────────────

Write-Step "Pre-flight Checks"

$missingTools = @()
foreach ($tool in @("helm", "kubectl", "minikube")) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        $missingTools += $tool
    }
}
if ($missingTools.Count -gt 0) {
    Write-Error "Missing required tools: $($missingTools -join ', ')"
    Write-Error "Have you setup the control-plane?"
    exit 1
}
Write-Success "All required tools found (helm, kubectl, minikube)"

foreach ($cluster in $Clusters) {
    $nodes = kubectl --context $cluster get nodes -o name 2>$null
    if (-not $nodes -or $LASTEXITCODE -ne 0) {
        Write-Error "Cluster context '$cluster' is not reachable. Is Minikube running?"
        exit 1
    }
}
Write-Success "Cluster(s) reachable: $($Clusters -join ', ')"

# ── Helm Repository ──────────────────────────────────────────────────────────

Write-Step "Configuring Helm Repository"

$existingRepos = helm repo list -o json 2>$null | ConvertFrom-Json
$hasRepo = $existingRepos | Where-Object { $_.name -eq "chaos-mesh" }

if ($hasRepo) {
    Write-Info "Chaos Mesh Helm repo already configured, updating..."
    helm repo update chaos-mesh | Out-Null
}
else {
    Write-Info "Adding Chaos Mesh Helm repository..."
    helm repo add chaos-mesh https://charts.chaos-mesh.org
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to add Chaos Mesh Helm repository"
        exit 1
    }
}
Write-Success "Chaos Mesh Helm repository ready"

# ── Deploy to each cluster ───────────────────────────────────────────────────

foreach ($cluster in $Clusters) {
    Write-Step "Deploying Chaos Mesh to '$cluster' cluster"

    # Tune inotify limits to avoid "too many open files" on single-node clusters.
    if (-not $SkipInotifyTuning) {
        Write-Info "Tuning inotify limits on node..."
        $sysctlOutput = minikube ssh -p $cluster -- "sudo sysctl -w fs.inotify.max_user_instances=8192 && sudo sysctl -w fs.inotify.max_user_watches=1048576" 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Failed to tune inotify limits (non-fatal): $sysctlOutput"
        }
        else {
            Write-Success "inotify limits configured (max_user_instances=8192, max_user_watches=1048576)"
        }
    }

    # Ensure namespace exists.
    $nsExists = kubectl get ns $Namespace --context $cluster -o name 2>$null
    if (-not $nsExists) {
        Write-Info "Creating namespace '$Namespace'..."
        kubectl create ns $Namespace --context $cluster | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to create namespace '$Namespace' on '$cluster'"
            exit 1
        }
        Write-Success "Namespace '$Namespace' created"
    }

    # Determine install vs upgrade.
    $existingRelease = helm list -n $Namespace --kube-context $cluster -q 2>$null | Where-Object { $_ -eq "chaos-mesh" }
    $helmAction = if ($existingRelease) { "upgrade" } else { "install" }

    $helmArgs = @(
        $helmAction,
        "chaos-mesh",
        "chaos-mesh/chaos-mesh",
        "-n", $Namespace,
        "--kube-context", $cluster,
        "-f", $ValuesFile
    )
    if ($ChartVersion) {
        $helmArgs += @("--version", $ChartVersion)
    }

    Write-Info "Running helm $helmAction..."
    $helmOutput = helm @helmArgs 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Helm $helmAction failed on '$cluster': $helmOutput"
        exit 1
    }
    Write-Success "Helm $helmAction succeeded on '$cluster'"

    # Wait for pods to become ready.
    Write-Info "Waiting for Chaos Mesh pods to become ready (timeout: ${TimeoutSeconds}s)..."
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $ready = $false

    while ((Get-Date) -lt $deadline) {
        $pods = kubectl get pods -n $Namespace --context $cluster -o json 2>$null | ConvertFrom-Json
        $totalPods = $pods.items.Count
        $readyPods = ($pods.items | Where-Object {
            $_.status.phase -eq "Running" -and
            ($_.status.containerStatuses | Where-Object { $_.ready -eq $true }).Count -eq $_.spec.containers.Count
        }).Count

        if ($totalPods -gt 0 -and $readyPods -eq $totalPods) {
            $ready = $true
            break
        }

        Write-Info "$readyPods/$totalPods pods ready..."
        Start-Sleep -Seconds 5
    }

    if ($ready) {
        Write-Success "All Chaos Mesh pods running on '$cluster'"
    }
    else {
        Write-Warning "Not all pods are ready after ${TimeoutSeconds}s on '$cluster'. Check with:"
        Write-Info "kubectl get pods -n $Namespace --context $cluster"
    }

    kubectl get pods -n $Namespace --context $cluster
}

# ── Summary ──────────────────────────────────────────────────────────────────

Write-Step "Deployment Complete"

Write-Success "Chaos Mesh deployed to: $($Clusters -join ', ')"

Write-Host ""
Write-Host "Dashboard Access:" -ForegroundColor Cyan
foreach ($cluster in $Clusters) {
    Write-Host "  $cluster cluster: kubectl port-forward svc/chaos-dashboard 2333:2333 -n $Namespace --context $cluster" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Useful Commands:" -ForegroundColor Cyan
foreach ($cluster in $Clusters) {
    Write-Host "  View pods ($cluster):   kubectl get pods -n $Namespace --context $cluster" -ForegroundColor Gray
}

Write-Host ""
Write-Warning "Note: inotify sysctl tuning is not persistent across node reboots."
Write-Host ""
