#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Deploy MongoDB replica set across east and west Minikube clusters
    
.DESCRIPTION
    This script deploys MongoDB with:
    - StatefulSet for stable network identities
    - Headless service for direct pod access
    - LoadBalancer service for cross-cluster communication
    - Persistent volumes for data
    
    Run this BEFORE deploying FeatBit application components.
    
.EXAMPLE
    .\Deploy-MongoDB.ps1
#>

param(
  [switch]$SkipPreflightChecks,
  [string]$CustomImageRegistry = "",
  [string]$InfraImageRepository = "",
  [PSCredential]$CustomRegistryCredential,
  [string]$CustomRegistrySecretName = "registry-credentials",
  [string]$MongoImage = ""
)

$ErrorActionPreference = "Stop"

# Load deployment.env defaults for any parameter not explicitly passed by the caller.
$_envDefaults = & (Join-Path $PSScriptRoot "Import-DeploymentEnv.ps1")
foreach ($k in $_envDefaults.Keys) {
    if (-not $PSBoundParameters.ContainsKey($k)) {
        Set-Variable -Name $k -Value $_envDefaults[$k]
    }
}

# ============================================================================
# Helper Functions
# ============================================================================

function Write-Header {
    param([string]$Text)
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  $Text" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step {
    param([string]$Text)
    Write-Host "  $Text" -ForegroundColor White
}

function Write-Success {
    param([string]$Text)
    Write-Host "✓ $Text" -ForegroundColor Green
}

function Write-Error-Message {
    param([string]$Text)
    Write-Host "✗ $Text" -ForegroundColor Red
}

function Write-Warning-Message {
    param([string]$Text)
    Write-Host "⚠ $Text" -ForegroundColor Yellow
}

function Ensure-CustomRegistryImagePullSecret {
  param(
    [string]$ClusterContext,
    [string]$Namespace,
    [string]$Registry,
    [PSCredential]$Credential,
    [string]$SecretName = "registry-credentials"
  )

  $username = $Credential.UserName
  $password = $Credential.GetNetworkCredential().Password

  kubectl --context $ClusterContext --namespace $Namespace delete secret $SecretName --ignore-not-found | Out-Null
  kubectl --context $ClusterContext --namespace $Namespace create secret docker-registry $SecretName --docker-server=$Registry --docker-username=$username --docker-password=$password --docker-email=devnull@$Registry | Out-Null

  if ($LASTEXITCODE -ne 0) {
    throw "Failed to create $SecretName secret in $ClusterContext"
  }
}

# ============================================================================
# Preflight Checks
# ============================================================================

Write-Header "MongoDB Replica Set Deployment"

if (-not $CustomRegistryCredential -and $CustomImageRegistry) {
  Write-Step "Enter credentials for $CustomImageRegistry when prompted."
  $CustomRegistryCredential = Get-Credential -Message "Registry credentials ($CustomImageRegistry)"
  if (-not $CustomRegistryCredential) {
    Write-Error-Message "Registry credentials are required to pull infra images."
    exit 1
  }
}

Write-Step "Using infra image repository: $InfraImageRepository"
Write-Step "Using MongoDB image: $MongoImage"

if (-not $SkipPreflightChecks) {
    Write-Step "Checking prerequisites..."
    
    # Check kubectl
    try {
        $null = kubectl version --client --output=json 2>$null
        Write-Success "kubectl found"
    } catch {
        Write-Error-Message "kubectl not found. Please install kubectl first."
        exit 1
    }
    
    # Check contexts
    $contexts = kubectl config get-contexts -o name 2>$null
    if ($contexts -notcontains "west") {
        Write-Error-Message "Context 'west' not found. Please run Deploy-FeatBitClusters.ps1 first."
        exit 1
    }
    if ($contexts -notcontains "east") {
        Write-Error-Message "Context 'east' not found. Please run Deploy-FeatBitClusters.ps1 first."
        exit 1
    }
    Write-Success "Both clusters available"
    
    # Check namespaces
    $westNs = kubectl --context west get namespace featbit -o name 2>$null
    $eastNs = kubectl --context east get namespace featbit -o name 2>$null
    if (-not $westNs -or -not $eastNs) {
        Write-Error-Message "featbit namespace not found. Please run Deploy-FeatBitClusters.ps1 first."
        exit 1
    }
    Write-Success "Namespaces ready"
}

# ============================================================================
# Create MongoDB Manifests
# ============================================================================

Write-Header "Creating MongoDB Manifests"

$mongoDbManifest = @"
---
# MongoDB StatefulSet for stable network identity
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mongodb
  namespace: featbit
spec:
  serviceName: mongodb-headless
  replicas: 1
  selector:
    matchLabels:
      app: mongodb
  template:
    metadata:
      labels:
        app: mongodb
    spec:
      imagePullSecrets:
      - name: $CustomRegistrySecretName
      containers:
      - name: mongodb
        image: $MongoImage
        command:
        - mongod
        - "--replSet"
        - "rs0"
        - "--bind_ip_all"
        ports:
        - containerPort: 27017
          name: mongodb
        volumeMounts:
        - name: mongodb-data
          mountPath: /data/db
        env:
        - name: MONGO_INITDB_ROOT_USERNAME
          value: "admin"
        - name: MONGO_INITDB_ROOT_PASSWORD
          value: "password"
  volumeClaimTemplates:
  - metadata:
      name: mongodb-data
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 5Gi
---
# Headless service for StatefulSet pod DNS
apiVersion: v1
kind: Service
metadata:
  name: mongodb-headless
  namespace: featbit
spec:
  clusterIP: None
  selector:
    app: mongodb
  ports:
  - port: 27017
    targetPort: 27017
---
# LoadBalancer service for cross-cluster access
apiVersion: v1
kind: Service
metadata:
  name: mongodb
  namespace: featbit
spec:
  type: LoadBalancer
  selector:
    app: mongodb
  ports:
  - port: 27017
    targetPort: 27017
"@

# ============================================================================
# Deploy MongoDB to Both Clusters
# ============================================================================

Write-Header "Deploying MongoDB"

foreach ($cluster in @("west", "east")) {
    Write-Step "Deploying to $cluster cluster..."

  if ($CustomImageRegistry -and $CustomRegistryCredential) {
    Ensure-CustomRegistryImagePullSecret -ClusterContext $cluster -Namespace "featbit" -Registry $CustomImageRegistry -Credential $CustomRegistryCredential -SecretName $CustomRegistrySecretName
  }
    
    $mongoDbManifest | kubectl --context $cluster apply -f - | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "$cluster MongoDB deployed"
    } else {
        Write-Error-Message "Failed to deploy MongoDB to $cluster"
        exit 1
    }
}

# ============================================================================
# Wait for Pods to be Ready
# ============================================================================

Write-Header "Waiting for MongoDB Pods"

foreach ($cluster in @("west", "east")) {
    Write-Step "Waiting for $cluster MongoDB pod..."
    
    $timeout = 300  # 5 minutes
    $elapsed = 0
    $ready = $false
    
    while ($elapsed -lt $timeout) {
        $pod = kubectl --context $cluster get pods -n featbit -l app=mongodb -o jsonpath='{.items[0].status.phase}' 2>$null
        if ($pod -eq "Running") {
            $ready = $true
            break
        }
        Start-Sleep -Seconds 5
        $elapsed += 5
    }
    
    if ($ready) {
        Write-Success "$cluster MongoDB pod ready"
    } else {
        Write-Error-Message "$cluster MongoDB pod not ready after $timeout seconds"
        exit 1
    }
}

# ============================================================================
# Get LoadBalancer IPs
# ============================================================================

Write-Header "Getting LoadBalancer IPs"

$westIP = $null
$eastIP = $null

foreach ($cluster in @("west", "east")) {
    Write-Step "Waiting for $cluster LoadBalancer IP..."
    
    $timeout = 120  # 2 minutes
    $elapsed = 0
    
    while ($elapsed -lt $timeout) {
        $ip = kubectl --context $cluster get svc mongodb -n featbit -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>$null
        if ($ip) {
            if ($cluster -eq "west") {
                $westIP = $ip
            } else {
                $eastIP = $ip
            }
            Write-Success "$cluster LoadBalancer IP: $ip"
            break
        }
        Start-Sleep -Seconds 5
        $elapsed += 5
    }
    
    if (-not $ip) {
        Write-Error-Message "$cluster LoadBalancer IP not assigned after $timeout seconds"
        exit 1
    }
}

# ============================================================================
# Summary
# ============================================================================

Write-Header "Deployment Summary"

Write-Host "  MongoDB has been deployed to both clusters" -ForegroundColor White
Write-Host ""
Write-Host "  West Cluster:" -ForegroundColor Cyan
Write-Host "    LoadBalancer IP: $westIP" -ForegroundColor White
Write-Host "    Internal DNS:    mongodb-0.mongodb-headless.featbit.svc.cluster.local" -ForegroundColor White
Write-Host ""
Write-Host "  East Cluster:" -ForegroundColor Cyan
Write-Host "    LoadBalancer IP: $eastIP" -ForegroundColor White
Write-Host "    Internal DNS:    mongodb-0.mongodb-headless.featbit.svc.cluster.local" -ForegroundColor White
Write-Host ""
Write-Host "  Next Steps:" -ForegroundColor Yellow
Write-Host "    1. Run Initialize-MongoDBReplicaSet.ps1 to configure replica set" -ForegroundColor White
Write-Host "    2. Run Deploy-FeatBitClusters.ps1 to deploy application components" -ForegroundColor White
Write-Host ""
