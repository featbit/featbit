<#
.SYNOPSIS
    Deploys FeatBit Pro to two Minikube clusters (west and east) with shared local registry.

.DESCRIPTION
    This script performs the following operations:
    1. Verifies the local Docker registry is running
    2. Creates two Minikube clusters with insecure registry support
    3. Configures ingress on both clusters
    4. Deploys FeatBit Pro infrastructure and applications to both clusters

    Deployment modes:
    - Basic (default): selected infrastructure components run on host Docker,
      while FeatBit applications are deployed to east and west clusters.
    - Advanced: infrastructure runs in both east and west clusters.
    
    Prerequisites:
    - Docker Desktop running
    - Minikube installed
    - kubectl installed
    - Local Docker registry running on port 5000 with FeatBit images
    - FeatBit images already tagged and pushed to localhost:5000/featbit/*
    
.PARAMETER SkipClusterCreation
    If specified, skips cluster creation and only deploys FeatBit components.

.PARAMETER RecreateClusters
    If specified, deletes and recreates west and east Minikube clusters.

.PARAMETER SkipImageCheck
    If specified, skips verification that images exist in the local registry.

.PARAMETER DeploymentMode
    Deployment mode to use. Basic (default) uses host Docker infra for selected
    components; Advanced deploys infrastructure in both clusters.

.PARAMETER DatabaseProvider
    Database backend to use for the deployment. Valid values: MongoDb, Postgres.
    Exactly one database provider is active per deployment. Default: MongoDb.

.PARAMETER HostInfraComponents
    Infrastructure components to run on host Docker when DeploymentMode is Basic.
    Valid values: redis, kafka, clickhouse, mongodb, postgresql.
    Default: redis, kafka, clickhouse, mongodb.

.PARAMETER WestCpus
    Number of CPUs for west cluster. Default: 4

.PARAMETER WestMemory
    Memory in MB for west cluster. Default: 8192

.PARAMETER EastCpus
    Number of CPUs for east cluster. Default: 4

.PARAMETER EastMemory
    Memory in MB for east cluster. Default: 8192

.EXAMPLE
    .\Deploy-FeatBitClusters.ps1
    Creates both clusters and deploys FeatBit Pro with default settings.

.EXAMPLE
    .\Deploy-FeatBitClusters.ps1 -SkipClusterCreation
    Only deploys FeatBit to existing clusters.

.EXAMPLE
    .\Deploy-FeatBitClusters.ps1 -RecreateClusters
    Recreates west/east clusters, then deploys FeatBit.

.EXAMPLE
    .\Deploy-FeatBitClusters.ps1 -DeploymentMode Basic -HostInfraComponents redis,kafka,clickhouse,mongodb
    Deploys apps to both clusters while selected infrastructure runs on host Docker.

.EXAMPLE
    .\Deploy-FeatBitClusters.ps1 -DeploymentMode Advanced -RecreateClusters
    Recreates clusters and deploys infrastructure + applications into both clusters.

.NOTES
    Author: GitHub Copilot
    Date: 2026-03-04
    
    The script expects to be run from the featbit repository root directory.
    If clusters already exist, they will be deleted and recreated.
#>

[CmdletBinding()]
param(
    [switch]$SkipClusterCreation,
    [switch]$RecreateClusters,
    [switch]$SkipImageCheck,
    [ValidateSet("Basic", "Advanced")]
    [string]$DeploymentMode = "Basic",
    [ValidateSet("MongoDb", "Postgres")]
    [string]$DatabaseProvider = "MongoDb",
    [string[]]$HostInfraComponents = @("redis", "kafka", "clickhouse", "mongodb"),
    [string]$CustomImageRegistry = "",
    [string]$FeatBitImageRegistry = "",
    [string]$InfraImageRepository = "",
    [string]$InfraImageMapFile = "",
    [PSCredential]$CustomRegistryCredential,
    [string]$CustomRegistrySecretName = "registry-credentials",
    # When set to $true, Minikube starts with --insecure-registry=$CustomImageRegistry,
    # which disables TLS verification for that host. Use only when a CA cannot be
    # installed via TRUST_CERTIFICATES. Default keeps proper TLS verification on.
    [bool]$InsecureCustomRegistry = $false,
    [string]$MinikubeBaseImage = "",
    [string]$MongoImage = "",
    [string]$PostgresImage = "",
    [int]$WestCpus = 4,
    [int]$WestMemory = 8192,
    [int]$EastCpus = 4,
    [int]$EastMemory = 8192,
    # The host IP that control-plane pods use to reach Redis port-forwards.
    # Defaults to host.minikube.internal (works on Linux/macOS minikube).
    # On Windows with Hyper-V, pass the vEthernet (WSL (Hyper-V firewall)) adapter IP
    # (e.g. 172.31.128.1) because host.minikube.internal resolves to the Hyper-V virtual
    # switch address (192.168.127.254) which is not reachable from within pods.
    [string]$CrossClusterRedisHost = "host.minikube.internal",
    # Deploy a per-cluster in-cluster Redis + Sentinel (no shared redis between DCs)
    # and point each cluster's FeatBit at its own Sentinel. Default on. Set
    # -UseRedisSentinel:$false to keep the legacy single/host redis topology.
    [bool]$UseRedisSentinel = $true,
    # When set, skips caching infra images (redis, kafka, mongo, clickhouse, etc.) in
    # the local registry. By default all mapped infra images are pulled from the remote
    # source once and cached at localhost:5000/infra/* so subsequent deploys don't need
    # VPN access or risk hitting remote rate limits.
    [switch]$NoCacheInfraImages
)

$ErrorActionPreference = "Stop"

# Load deployment.env defaults for any parameter not explicitly passed by the caller.
$_envDefaults = & (Join-Path $PSScriptRoot "Import-DeploymentEnv.ps1")
foreach ($k in $_envDefaults.Keys) {
    if (-not $PSBoundParameters.ContainsKey($k)) {
        Set-Variable -Name $k -Value $_envDefaults[$k]
    }
}

if (-not $InfraImageRepository -and $CustomImageRegistry) {
    $InfraImageRepository = "$CustomImageRegistry/dockerhub/library"
}

# Only build infra image overrides when a repository is actually configured.
# When neither $CustomImageRegistry nor $InfraImageRepository is set, leave
# $MongoImage / $PostgresImage empty so that downstream `kubectl set image`
# calls are skipped and the manifests' default Docker Hub images are used as-is.
# Previously these defaulted to "/mongo:7.0" (leading slash), which kubelet
# rejects as InvalidImageName.
if (-not $MongoImage -and $InfraImageRepository) {
    $MongoImage = "$InfraImageRepository/mongo:7.0"
}

if (-not $PostgresImage -and $InfraImageRepository) {
    $PostgresImage = "$InfraImageRepository/postgres:15.10"
}

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

# Loads the infrastructure image map from the JSON file.
# Automatically merges infra-image-map.local.json (gitignored) on top of the
# base map so users can override registry paths without touching committed files.
# Returns a hashtable of { defaultImage -> registryRelativePath } or $null.
function Get-InfraImageMap {
    param([string]$MapFile)

    $repoRoot    = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
    $defaultPath = Join-Path $repoRoot "kubernetes\infra-image-map.json"
    $localPath   = Join-Path $repoRoot "kubernetes\infra-image-map.local.json"
    $resolved = if ($MapFile) { $MapFile } else { $defaultPath }

    if (-not (Test-Path $resolved)) {
        return $null
    }

    $map = @{}
    $json = Get-Content $resolved -Raw | ConvertFrom-Json
    $json.images.PSObject.Properties | ForEach-Object {
        $map[$_.Name] = $_.Value
    }

    # Merge local override (only when using the default map file path).
    if (-not $MapFile -and (Test-Path $localPath)) {
        $localJson = Get-Content $localPath -Raw | ConvertFrom-Json
        $localJson.images.PSObject.Properties | ForEach-Object {
            $map[$_.Name] = $_.Value
        }
    }

    return $map
}

# Pulls each infra image from its remote source (CustomImageRegistry or Docker Hub)
# and pushes it to the local registry at localhost:5000/infra/<name>:<tag>, skipping
# any image that is already present in the registry catalog.
# Returns a hashtable of { remoteImage -> "host.minikube.internal:5000/infra/<name>:<tag>" }
# so Invoke-KubectlApplyFile can rewrite manifest image references to the local cache.
function Sync-InfraImagesToLocalRegistry {
    param(
        [hashtable]$ImageMap,
        [string]$RemoteRegistry,
        [int]$LocalPort = 5000
    )

    $localBase  = "localhost:$LocalPort/infra"
    $minikubeBase = "host.minikube.internal:$LocalPort/infra"
    $result     = @{}

    # Query the local registry catalog once up-front to avoid a round-trip per image.
    $catalogRepos = @()
    try {
        $catalog = Invoke-RestMethod -Uri "http://localhost:$LocalPort/v2/_catalog" -TimeoutSec 5
        if ($catalog.repositories) { $catalogRepos = $catalog.repositories }
    }
    catch {
        Write-Warning "Could not reach local registry at localhost:$LocalPort — infra image caching skipped."
        return $result
    }

    Write-Step "Syncing Infra Images to Local Registry"

    foreach ($canonicalImage in $ImageMap.Keys) {
        # Derive a flat repository name safe for a registry path:
        # e.g. "bitnamilegacy/kafka:3.8" -> repo="infra/bitnamilegacy-kafka" tag="3.8"
        $nameAndTag = $canonicalImage -split ":",2
        $imageName  = $nameAndTag[0]
        $imageTag   = if ($nameAndTag.Count -gt 1) { $nameAndTag[1] } else { "latest" }
        $repoName   = "infra/" + ($imageName -replace "/", "-")
        $localTag   = "$localBase/$($imageName -replace '/', '-'):$imageTag"
        $minikubeTag = "$minikubeBase/$($imageName -replace '/', '-'):$imageTag"

        if ($catalogRepos -contains $repoName) {
            Write-Info "  [cached] $canonicalImage"
            $result[$canonicalImage] = $minikubeTag
            continue
        }

        # Determine the full pull reference.
        $remoteImage = if ($RemoteRegistry) {
            "$RemoteRegistry/$($ImageMap[$canonicalImage])"
        } else {
            $canonicalImage
        }

        Write-Host "  Pulling  $remoteImage ..." -ForegroundColor Gray
        docker pull $remoteImage
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Failed to pull $remoteImage — skipping cache for this image."
            continue
        }

        docker tag $remoteImage $localTag
        docker push $localTag
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Failed to push $localTag — skipping cache for this image."
            continue
        }

        # Remove the bulky remote-tagged copy from the local daemon; the local registry
        # is the authoritative source going forward.
        docker rmi $remoteImage 2>$null | Out-Null

        Write-Success "  Cached   $canonicalImage -> $localTag"
        $result[$canonicalImage] = $minikubeTag
    }

    return $result
}

# Writes a source YAML file to the per-cluster generated directory
# (kubernetes/.generated/<context>/) with image references rewritten for the
# custom registry, then applies the generated file with kubectl.
# Source-controlled files are never modified.
function Invoke-KubectlApplyFile {
    param(
        [string]$Context,
        [string]$FilePath,
        [string]$Namespace,
        [string]$Registry,
        [hashtable]$ImageMap,
        [string]$PullSecretName = "registry-credentials",
        # Optional: canonical->localRegistry rewrites built by Sync-InfraImagesToLocalRegistry.
        # Applied AFTER the remote-registry rewrite so local cache wins.
        [hashtable]$InfraLocalImageMap = @{}
    )

    $content = Get-Content $FilePath -Raw

    if ($Registry -and $ImageMap -and $ImageMap.Count -gt 0) {
        foreach ($defaultImage in $ImageMap.Keys) {
            $registryPath  = $ImageMap[$defaultImage]
            $customImage   = "${Registry}/${registryPath}"
            $escapedDefault = [regex]::Escape($defaultImage)
            $content = $content -replace "(\bimage:\s+)${escapedDefault}\b", "`${1}${customImage}"
        }
    }

    # Swap the default pull-secret name on imagePullSecrets entries so users who
    # set CUSTOM_REGISTRY_SECRET_NAME to a non-default value still get their pods
    # to authenticate to the registry. The literal "registry-credentials" is the
    # baked-in default in every manifest under kubernetes/pro/infrastructure/.
    if ($PullSecretName -and $PullSecretName -ne "registry-credentials") {
        $content = $content -replace "(\bname:\s+)registry-credentials\b", "`${1}${PullSecretName}"
    }

    # Rewrite infra image references to the local cache (overrides remote registry).
    if ($InfraLocalImageMap -and $InfraLocalImageMap.Count -gt 0) {
        foreach ($canonicalImage in $InfraLocalImageMap.Keys) {
            $localImage = $InfraLocalImageMap[$canonicalImage]
            # Match either the canonical name or the already-rewritten remote path.
            foreach ($searchImage in @($canonicalImage, ("${Registry}/$($ImageMap[$canonicalImage])"))) {
                if ($searchImage) {
                    $escaped = [regex]::Escape($searchImage)
                    $content = $content -replace "(\bimage:\s+)${escaped}\b", "`${1}${localImage}"
                }
            }
        }
    }

    # Mirror the source layout under kubernetes/.generated/<context>/ so
    # generated files are inspectable and can be reapplied independently.
    $relPath  = [System.IO.Path]::GetRelativePath($kubernetesProPath, $FilePath)
    $destPath = Join-Path $kubernetesGeneratedPath $Context $relPath
    $destDir  = Split-Path $destPath -Parent
    if (-not (Test-Path $destDir)) {
        New-Item $destDir -ItemType Directory -Force | Out-Null
    }
    [System.IO.File]::WriteAllText($destPath, $content)

    kubectl --context $Context apply -f $destPath -n $Namespace | Out-Null
}

function Wait-ApiServerReady {
    param(
        [string]$ClusterContext,
        [int]$MaxAttempts = 60,
        [int]$DelaySeconds = 5
    )

    Write-Info "Waiting for API server to be ready in '$ClusterContext'..."

    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        $nodes = kubectl --context $ClusterContext get nodes --no-headers 2>&1
        if ($LASTEXITCODE -eq 0 -and $nodes) {
            Write-Success "API server ready in '$ClusterContext'."
            return
        }

        Write-Info "API server not ready in '$ClusterContext' (attempt $attempt/$MaxAttempts). Waiting ${DelaySeconds}s..."
        Start-Sleep -Seconds $DelaySeconds
    }

    throw "API server in '$ClusterContext' did not become ready after $($MaxAttempts * $DelaySeconds) seconds."
}

# Ensure-CustomRegistryImagePullSecret / Ensure-DefaultServiceAccountImagePullSecret
# live in Set-RegistryPullSecrets.ps1 so Deploy-OtelDemo.ps1 (otel-demo namespace)
# can reuse the exact same pull-secret logic instead of a second copy.
. (Join-Path $PSScriptRoot "Set-RegistryPullSecrets.ps1")

function Get-LoadBalancerIp {
    param(
        [string]$ClusterContext,
        [string]$Namespace,
        [string]$ServiceName,
        [int]$MaxAttempts = 30,
        [int]$DelaySeconds = 2
    )

    $ipv4Pattern = '^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$'

    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        $rawIp = kubectl --context $ClusterContext get svc $ServiceName -n $Namespace -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>$null
        if ($null -eq $rawIp) {
            $candidateIp = ""
        }
        else {
            $candidateIp = ([string]$rawIp).Trim()
        }

        if ($candidateIp -and $candidateIp -match $ipv4Pattern) {
            return $candidateIp
        }

        Start-Sleep -Seconds $DelaySeconds
    }

    return $null
}

function Normalize-InfraComponentName {
    param([string]$Name)

    if (-not $Name) {
        return $null
    }

    $normalized = $Name.Trim().ToLowerInvariant()
    switch ($normalized) {
        "mongo" { return "mongodb" }
        "mongodb" { return "mongodb" }
        "postgres" { return "postgresql" }
        "postgresql" { return "postgresql" }
        "redis" { return "redis" }
        "kafka" { return "kafka" }
        "clickhouse" { return "clickhouse" }
        default { return $null }
    }
}

function ConvertTo-InfraComponentSet {
    param([string[]]$ComponentNames)

    $componentSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)

    foreach ($componentName in $ComponentNames) {
        $normalizedName = Normalize-InfraComponentName -Name $componentName
        if (-not $normalizedName) {
            throw "Unsupported infrastructure component '$componentName'. Valid values: redis, kafka, clickhouse, mongodb, postgresql."
        }

        [void]$componentSet.Add($normalizedName)
    }

    return $componentSet
}

function Stop-HostInfrastructure {
    param(
        [string]$RepositoryRoot
    )

    $composePath = Join-Path $RepositoryRoot "docker\composes\docker-compose-infra.yml"
    if (-not (Test-Path $composePath)) {
        Write-Info "No host infra compose file found; nothing to stop."
        return
    }

    Write-Info "Stopping host infrastructure Docker containers (if running)..."
    docker compose --project-directory $RepositoryRoot -f $composePath down 2>&1 | Out-Null

    Write-Success "Host infrastructure stopped."
}

function Start-HostInfrastructure {
    param(
        [System.Collections.Generic.HashSet[string]]$Components,
        [string]$RepositoryRoot,
        [string]$CustomImageRegistry = "",
        [hashtable]$ImageMap = $null
    )

    if ($Components.Count -eq 0) {
        Write-Info "No host infrastructure components selected."
        return
    }

    $composePath = Join-Path $RepositoryRoot "docker\composes\docker-compose-infra.yml"
    if (-not (Test-Path $composePath)) {
        throw "Cannot find host infra compose file: $composePath"
    }

    # Set image env vars so docker compose can substitute registry-prefixed paths.
    # Env vars are only set when a custom registry is configured; the compose file
    # falls back to the bare Docker Hub names when they are absent.
    if ($CustomImageRegistry -and $ImageMap) {
        $composeImageKeys = @{
            "KAFKA_IMAGE"           = "bitnamilegacy/kafka:3.8"
            "REDIS_IMAGE"           = "bitnamilegacy/redis:7.2"
            "CLICKHOUSE_IMAGE"      = "clickhouse/clickhouse-server:24.8"
            "MONGO_COMPOSE_IMAGE"   = "mongo:7.0"
            "POSTGRES_COMPOSE_IMAGE" = "postgres:15.10"
        }
        foreach ($envVar in $composeImageKeys.Keys) {
            $mapKey = $composeImageKeys[$envVar]
            if ($ImageMap.ContainsKey($mapKey)) {
                [System.Environment]::SetEnvironmentVariable($envVar, "$CustomImageRegistry/$($ImageMap[$mapKey])")
            }
        }
    }

    $serviceNames = New-Object System.Collections.Generic.List[string]
    if ($Components.Contains("mongodb")) {
        $serviceNames.Add("mongodb")
    }

    if ($Components.Contains("redis")) {
        $serviceNames.Add("redis")
    }

    if ($Components.Contains("kafka")) {
        $serviceNames.Add("kafka")
        $serviceNames.Add("init-kafka-topics")
    }

    if ($Components.Contains("clickhouse")) {
        $serviceNames.Add("clickhouse-server")
    }

    if ($Components.Contains("postgresql")) {
        $serviceNames.Add("postgresql")
    }

    if ($serviceNames.Count -eq 0) {
        Write-Info "No host Docker services to start for selected components."
        return
    }

    Write-Info "Starting host infrastructure via docker compose: $($serviceNames -join ', ')"

    docker compose --project-directory $RepositoryRoot -f $composePath up -d $serviceNames
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to start host infrastructure services."
    }

    Write-Success "Host infrastructure services are running"
}

function Ensure-SharedClusterNetwork {
    param(
        [string]$NetworkName,
        [string]$Subnet
    )

    docker network inspect $NetworkName 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Info "Shared cluster network already exists: $NetworkName"
        return
    }

    Write-Info "Creating shared cluster network: $NetworkName ($Subnet)"
    docker network create --driver bridge --subnet $Subnet $NetworkName | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create shared cluster network '$NetworkName'."
    }

    Write-Success "Shared cluster network ready: $NetworkName"
}

function Connect-ClusterToSharedNetwork {
    param(
        [string]$ClusterName,
        [string]$NetworkName,
        [string]$NodeIp
    )

    $connectResult = docker network connect --ip $NodeIp $NetworkName $ClusterName 2>&1
    if ($LASTEXITCODE -ne 0) {
        $connectText = ($connectResult | Out-String)
        if ($connectText -match "already exists|already connected") {
            Write-Info "$ClusterName already connected to $NetworkName"
            return
        }

        throw "Failed to connect '$ClusterName' to '$NetworkName': $connectText"
    }

    Write-Success "$ClusterName connected to $NetworkName ($NodeIp)"
}

function Set-CrossClusterMasqueradeRules {
    param(
        [string]$ClusterName,
        [string]$PodCidr = "10.244.0.0/16",
        [string]$SharedNetworkSubnet
    )

    # MASQUERADE traffic from local pods heading to the shared cluster network so the
    # destination node sees the minikube node IP as the source and can route replies back.
    $rule = "iptables -t nat -C POSTROUTING -s $PodCidr -d $SharedNetworkSubnet -j MASQUERADE 2>/dev/null || iptables -t nat -A POSTROUTING -s $PodCidr -d $SharedNetworkSubnet -j MASQUERADE"
    docker exec $ClusterName sh -c $rule 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Failed to add masquerade rule for $ClusterName (may already exist)"
    }
    else {
        Write-Success "Cross-cluster masquerade rule set on $ClusterName"
    }
}

function Ensure-HostBridgeService {
    param(
        [string]$ClusterContext,
        [string]$Namespace,
        [string]$ServiceName,
        [int]$Port
    )

    @"
apiVersion: v1
kind: Service
metadata:
  name: $ServiceName
  namespace: $Namespace
spec:
  type: ExternalName
  externalName: host.minikube.internal
  ports:
  - port: $Port
    targetPort: $Port
"@ | kubectl --context $ClusterContext apply -f - | Out-Null

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to configure host bridge service '$ServiceName' in cluster '$ClusterContext'."
    }
}

function Ensure-HostBridgeServices {
    param(
        [string]$ClusterContext,
        [string]$Namespace,
        [System.Collections.Generic.HashSet[string]]$HostComponents
    )

    if ($HostComponents.Contains("redis")) {
        Ensure-HostBridgeService -ClusterContext $ClusterContext -Namespace $Namespace -ServiceName "redis" -Port 6379
    }

    if ($HostComponents.Contains("kafka")) {
        Ensure-HostBridgeService -ClusterContext $ClusterContext -Namespace $Namespace -ServiceName "kafka" -Port 9092
    }

    if ($HostComponents.Contains("clickhouse")) {
        Ensure-HostBridgeService -ClusterContext $ClusterContext -Namespace $Namespace -ServiceName "clickhouse-server" -Port 8123
    }

    if ($HostComponents.Contains("mongodb")) {
        Ensure-HostBridgeService -ClusterContext $ClusterContext -Namespace $Namespace -ServiceName "mongodb" -Port 27017
    }

    if ($HostComponents.Contains("postgresql")) {
        Ensure-HostBridgeService -ClusterContext $ClusterContext -Namespace $Namespace -ServiceName "postgresql" -Port 5432
    }
}

$scriptPath = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
$kubernetesProPath = Join-Path $scriptPath "kubernetes\pro"

# Ephemeral manifests directory — gitignored.  Every YAML file applied to a
# cluster is written here first (under a per-cluster subdirectory) so the
# source-controlled files are never modified by deployment tooling.
# Layout: kubernetes\.generated\<context>\{infrastructure,application}\*.yaml
$kubernetesGeneratedPath = Join-Path $scriptPath "kubernetes\.generated"

# Load the infra image map once; used when CustomImageRegistry is set.
$infraImageMap = Get-InfraImageMap -MapFile $InfraImageMapFile
if ($CustomImageRegistry -and $infraImageMap) {
    Write-Host "  Custom registry : $CustomImageRegistry" -ForegroundColor Gray
    Write-Host "  Image map       : $($infraImageMap.Count) entries" -ForegroundColor Gray
}
$sharedClusterNetwork = "featbit-cluster-network"
$sharedClusterSubnet = "172.31.0.0/16"
$westSharedClusterIp = "172.31.0.10"
$eastSharedClusterIp = "172.31.0.20"

if (-not $PSBoundParameters.ContainsKey("HostInfraComponents")) {
    if ($DatabaseProvider -eq "Postgres") {
        $HostInfraComponents = @("redis", "kafka", "clickhouse", "postgresql")
    }
    else {
        $HostInfraComponents = @("redis", "kafka", "clickhouse", "mongodb")
    }
}

$hostComponentSet = ConvertTo-InfraComponentSet -ComponentNames $HostInfraComponents
$clusterInfraComponentSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)

$databaseComponent = "mongodb"
$excludedDatabaseComponent = "postgresql"
if ($DatabaseProvider -eq "Postgres") {
    $databaseComponent = "postgresql"
    $excludedDatabaseComponent = "mongodb"
}

if ($hostComponentSet.Contains($excludedDatabaseComponent)) {
    Write-Error "Database provider is '$DatabaseProvider' but HostInfraComponents includes '$excludedDatabaseComponent'. Choose either MongoDb or Postgres, not both."
    exit 1
}

$allSupportedComponents = @("redis", "kafka", "clickhouse", $databaseComponent)

if ($DeploymentMode -eq "Basic") {
    foreach ($componentName in $allSupportedComponents) {
        if (-not $hostComponentSet.Contains($componentName)) {
            [void]$clusterInfraComponentSet.Add($componentName)
        }
    }
}
else {
    [void]$clusterInfraComponentSet.Add("redis")
    [void]$clusterInfraComponentSet.Add("kafka")
    [void]$clusterInfraComponentSet.Add("clickhouse")
    [void]$clusterInfraComponentSet.Add("mongodb")
}

if (-not (Test-Path $kubernetesProPath)) {
    Write-Error "Cannot find kubernetes\pro directory at: $kubernetesProPath"
    Write-Info "Please run this script from the featbit repository root directory."
    exit 1
}

Write-Step "Pre-flight Checks"

# Collect any interactive input now, before long-running cluster work begins.
# A credential prompt buried 5+ minutes into the deploy ruined "kick it off and
# walk away" UX — anything that needs the user's keyboard belongs up here.
if ($CustomImageRegistry -and -not $CustomRegistryCredential -and -not $InsecureCustomRegistry) {
    Write-Info "Registry '$CustomImageRegistry' is configured but no credentials were supplied"
    Write-Info "via deployment.env (CUSTOM_REGISTRY_USERNAME / CUSTOM_REGISTRY_PASSWORD) or"
    Write-Info "the -CustomRegistryCredential parameter."
    Write-Info ""
    Write-Info "Prompting now so you don't have to babysit the terminal during deploy."
    Write-Info "If your registry does not require authentication, press Enter at both prompts to skip."
    $CustomRegistryCredential = Get-Credential -Message "Registry credentials for $CustomImageRegistry (Enter to skip)"
    if (-not $CustomRegistryCredential -or [string]::IsNullOrWhiteSpace($CustomRegistryCredential.UserName)) {
        Write-Warning "No credentials provided — image pull secrets will not be created."
        Write-Warning "If '$CustomImageRegistry' requires authentication, pods will fail with 'unauthorized'."
        $CustomRegistryCredential = $null
    }
    else {
        Write-Success "Registry credentials captured for $($CustomRegistryCredential.UserName)@$CustomImageRegistry"
    }
}
elseif ($CustomImageRegistry -and $CustomRegistryCredential) {
    Write-Info "Registry credentials supplied via deployment.env / -CustomRegistryCredential."
}
elseif ($CustomImageRegistry -and $InsecureCustomRegistry) {
    Write-Info "INSECURE_CUSTOM_REGISTRY=true — credentials will not be prompted."
}

Write-Step "Deployment Configuration Summary"

$hostComponentsForDisplay = @($hostComponentSet)
[array]::Sort($hostComponentsForDisplay)

$clusterComponentsForDisplay = @($clusterInfraComponentSet)
[array]::Sort($clusterComponentsForDisplay)

if ($hostComponentsForDisplay.Count -eq 0) {
    $hostComponentsDisplay = "none"
}
else {
    $hostComponentsDisplay = ($hostComponentsForDisplay -join ", ")
}

if ($clusterComponentsForDisplay.Count -eq 0) {
    $clusterComponentsDisplay = "none"
}
else {
    $clusterComponentsDisplay = ($clusterComponentsForDisplay -join ", ")
}

Write-Host "  DeploymentMode        : $DeploymentMode" -ForegroundColor Gray
Write-Host "  DatabaseProvider      : $DatabaseProvider" -ForegroundColor Gray
Write-Host "  HostInfraComponents   : $hostComponentsDisplay" -ForegroundColor Gray
Write-Host "  ClusterInfraComponents: $clusterComponentsDisplay" -ForegroundColor Gray

if ($DeploymentMode -eq "Basic") {
    Write-Info "Basic mode routes selected infrastructure to host Docker."
}


Write-Info "Using infra image repository: $InfraImageRepository"
Write-Info "Using MongoDB image: $MongoImage"
Write-Info "Using PostgreSQL image: $PostgresImage"
if ($MinikubeBaseImage) {
    Write-Info "Using Minikube base image: $MinikubeBaseImage"
}
else {
    Write-Info "Using Minikube default base image"
}

Write-Info "Checking Docker registry..."
$registryRunning = docker ps --filter "name=registry" --filter "status=running" --format "{{.Names}}" | Select-String -Pattern "^featbit-registry$"
if (-not $registryRunning) {
    Write-Warning "Local Docker registry not running on port 5000"
    Write-Info "Starting registry container..."
    try {
        docker start registry 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Info "Creating new registry container..."
            docker run -d --restart=always --name registry -p 5000:5000 registry:2
        }
        Start-Sleep -Seconds 3
        Write-Success "Registry is now running"
    }
    catch {
        Write-Error "Failed to start registry: $_"
        exit 1
    }
}
else {
    Write-Success "Docker registry is running"
}

if (-not $SkipImageCheck) {
    Write-Info "Checking required images in local registry..."

    # Expected repository names as stored inside the registry (not the full pull URI).
    $requiredImages = @(
        "featbit/featbit-api-server",
        "featbit/featbit-ui",
        "featbit/featbit-evaluation-server",
        "featbit/featbit-control-plane"
    )

    # Query the registry catalog directly so the check works even when the images
    # are no longer cached in the local Docker daemon (e.g. after a docker system prune).
    $registryBase = "http://localhost:5000"
    $catalogJson  = $null
    try {
        $catalogJson = Invoke-RestMethod -Uri "$registryBase/v2/_catalog" -TimeoutSec 5
    }
    catch {
        Write-Warning "Could not reach local registry at $registryBase — falling back to docker images cache."
    }

    $missingImages = @()
    foreach ($image in $requiredImages) {
        $found = $false
        if ($catalogJson -and $catalogJson.repositories) {
            $found = $catalogJson.repositories -contains $image
        }
        else {
            # Fallback: check the local daemon image store.
            $found = [bool](docker images --format "{{.Repository}}:{{.Tag}}" |
                Select-String -Pattern "localhost:5000/$image")
        }

        if (-not $found) {
            $missingImages += $image
        }
    }

    if ($missingImages.Count -gt 0) {
        Write-Error "Missing images in local registry:"
        foreach ($img in $missingImages) {
            Write-Info "  - localhost:5000/$img:latest"
        }
        Write-Info "`nPlease build and push images first:"
        Write-Info "  .\Initialize-LocalRegistry.ps1"
        exit 1
    }
    Write-Success "All required images found in local registry"
}

# ── Infra image caching ───────────────────────────────────────────────────────
# Pull each mapped infra image from the remote registry and cache it in the
# local registry (localhost:5000/infra/*).  Subsequent deploys skip the pull
# entirely, which avoids VPN dependency and remote rate limits.
$script:infraLocalImageMap = @{}
if (-not $NoCacheInfraImages -and $infraImageMap -and $infraImageMap.Count -gt 0) {
    $script:infraLocalImageMap = Sync-InfraImagesToLocalRegistry `
        -ImageMap $infraImageMap `
        -RemoteRegistry $CustomImageRegistry
}

if ($RecreateClusters -and -not $SkipClusterCreation) {
    Write-Step "Cluster Creation"

    Write-Step "Stopping Host Infrastructure"
    Write-Info "Tearing down host Docker infra before cluster recreation to ensure a clean state..."
    Stop-HostInfrastructure -RepositoryRoot $scriptPath

    $existingWest = minikube profile list -o json 2>$null | ConvertFrom-Json | Select-Object -ExpandProperty valid | Where-Object { $_.Name -eq "west" }
    if ($existingWest) {
        Write-Warning "West cluster already exists. Deleting..."
        minikube delete -p west
        Write-Success "West cluster deleted"
    }
    
    $existingEast = minikube profile list -o json 2>$null | ConvertFrom-Json | Select-Object -ExpandProperty valid | Where-Object { $_.Name -eq "east" }
    if ($existingEast) {
        Write-Warning "East cluster already exists. Deleting..."
        minikube delete -p east
        Write-Success "East cluster deleted"
    }
    
    Write-Info "Creating west cluster (CPUs=$WestCpus, Memory=$WestMemory MB)..."
    $westStartArguments = @(
        "start",
        "-p", "west",
        "--driver=docker",
        "--cpus=$WestCpus",
        "--memory=$WestMemory",
        "--insecure-registry=host.minikube.internal:5000"
    )
    if ($FeatBitImageRegistry -and $FeatBitImageRegistry -ne "host.minikube.internal:5000") {
        $westStartArguments += "--insecure-registry=$FeatBitImageRegistry"
    }
    if ($InsecureCustomRegistry -and $CustomImageRegistry) {
        Write-Warning "INSECURE_CUSTOM_REGISTRY=true — TLS verification will be DISABLED for '$CustomImageRegistry' in the west cluster. Configure TRUST_CERTIFICATES instead for proper TLS trust."
        $westStartArguments += "--insecure-registry=$CustomImageRegistry"
    }
    if ($MinikubeBaseImage) {
        $westStartArguments += "--base-image=$MinikubeBaseImage"
    }
    minikube @westStartArguments
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to create west cluster"
        exit 1
    }
    Write-Success "West cluster created"
    
    Write-Info "Creating east cluster (CPUs=$EastCpus, Memory=$EastMemory MB)..."
    $eastStartArguments = @(
        "start",
        "-p", "east",
        "--driver=docker",
        "--cpus=$EastCpus",
        "--memory=$EastMemory",
        "--insecure-registry=host.minikube.internal:5000"
    )
    if ($FeatBitImageRegistry -and $FeatBitImageRegistry -ne "host.minikube.internal:5000") {
        $eastStartArguments += "--insecure-registry=$FeatBitImageRegistry"
    }
    if ($InsecureCustomRegistry -and $CustomImageRegistry) {
        Write-Warning "INSECURE_CUSTOM_REGISTRY=true — TLS verification will be DISABLED for '$CustomImageRegistry' in the east cluster. Configure TRUST_CERTIFICATES instead for proper TLS trust."
        $eastStartArguments += "--insecure-registry=$CustomImageRegistry"
    }
    if ($MinikubeBaseImage) {
        $eastStartArguments += "--base-image=$MinikubeBaseImage"
    }
    minikube @eastStartArguments
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to create east cluster"
        exit 1
    }
    Write-Success "East cluster created"
    
    Write-Step "Enabling Addons"
    
    Write-Info "Enabling ingress on west cluster..."
    minikube -p west addons enable ingress | Out-Null
    Write-Success "West ingress enabled"

    Write-Info "Enabling ingress on east cluster..."
    minikube -p east addons enable ingress | Out-Null
    Write-Success "East ingress enabled"

    Write-Info "Refreshing kubeconfig context endpoints..."
    minikube update-context -p west | Out-Null
    minikube update-context -p east | Out-Null
    Write-Success "Kubeconfig contexts updated with current API server ports"
}
elseif ($SkipClusterCreation) {
    Write-Info "Skipping cluster creation due to -SkipClusterCreation"
}
else {
    Write-Info "Using existing west/east clusters (non-destructive default)."
    Write-Info "Use -RecreateClusters to delete and recreate clusters."
}

Write-Step "Cluster Validation"

foreach ($clusterContext in @("west", "east")) {
    $nodes = kubectl --context $clusterContext get nodes -o name 2>$null
    if (-not $nodes -or $LASTEXITCODE -ne 0) {
        Write-Error "Cluster context '$clusterContext' is not reachable."
        Write-Info "Rerun this script with -RecreateClusters to create the clusters."
        exit 1
    }
}

Write-Success "Both clusters are reachable"

# Ensure the metrics-server addon is enabled on both clusters so `kubectl top`
# (and any resource-usage tooling) works out of the box. Idempotent, so it is
# safe to run on every invocation, including -SkipClusterCreation / existing
# clusters where the create-time addon block above does not run.
Write-Step "Ensuring metrics-server Addon"
foreach ($clusterProfile in @("west", "east")) {
    Write-Info "Enabling metrics-server on $clusterProfile cluster..."
    minikube -p $clusterProfile addons enable metrics-server | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Failed to enable metrics-server on $clusterProfile cluster; 'kubectl top' may be unavailable."
    }
    else {
        Write-Success "metrics-server enabled on $clusterProfile cluster"
    }
}

Write-Step "Configuring Shared Cluster Network"
Ensure-SharedClusterNetwork -NetworkName $sharedClusterNetwork -Subnet $sharedClusterSubnet
Connect-ClusterToSharedNetwork -ClusterName "west" -NetworkName $sharedClusterNetwork -NodeIp $westSharedClusterIp
Connect-ClusterToSharedNetwork -ClusterName "east" -NetworkName $sharedClusterNetwork -NodeIp $eastSharedClusterIp

Write-Info "Configuring cross-cluster pod masquerade rules..."
Set-CrossClusterMasqueradeRules -ClusterName "west" -SharedNetworkSubnet $sharedClusterSubnet
Set-CrossClusterMasqueradeRules -ClusterName "east" -SharedNetworkSubnet $sharedClusterSubnet

Write-Step "Refreshing Kubeconfig"
Write-Info "Refreshing kubeconfig context endpoints for west/east clusters..."
minikube update-context -p west | Out-Null
minikube update-context -p east | Out-Null
Write-Success "Kubeconfig contexts updated with current API server ports"

Write-Step "Waiting for API Servers"
Wait-ApiServerReady -ClusterContext "west"
Wait-ApiServerReady -ClusterContext "east"

Write-Step "Installing Registry TLS Trust"
if ($CustomImageRegistry) {
    $trustScript = Join-Path $PSScriptRoot "Trust-MinikubeCertificates.ps1"
    if (-not (Test-Path $trustScript)) {
        Write-Warning "Trust-MinikubeCertificates.ps1 not found at $trustScript — skipping TLS trust installation."
        Write-Warning "If '$CustomImageRegistry' uses a private CA, pods will fail with x509 errors."
    }
    elseif ($InsecureCustomRegistry) {
        Write-Info "INSECURE_CUSTOM_REGISTRY=true — skipping CA trust install; --insecure-registry was passed to minikube start instead."
    }
    else {
        Write-Info "Installing CA trust for '$CustomImageRegistry' into west/east Docker daemons..."
        try {
            & $trustScript -Clusters @("west", "east") -RegistryHosts @($CustomImageRegistry)
            if ($LASTEXITCODE -ne 0) {
                throw "Trust-MinikubeCertificates.ps1 exited with code $LASTEXITCODE"
            }
            Write-Success "Registry TLS trust installed in both clusters"
        }
        catch {
            Write-Error "Failed to install registry TLS trust: $_"
            Write-Info "If '$CustomImageRegistry' is signed by a private CA, configure TRUST_CERTIFICATES in deployment.env."
            Write-Info "Alternatively, set INSECURE_CUSTOM_REGISTRY=true to bypass TLS verification for that host."
            exit 1
        }
    }
}
else {
    Write-Info "No CUSTOM_IMAGE_REGISTRY configured — skipping registry TLS trust step."
}

Write-Step "Creating Namespaces"

Write-Info "Creating featbit namespace in west cluster..."
kubectl --context west create namespace featbit 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Success "West namespace created"
}
else {
    Write-Warning "West namespace already exists"
}

Write-Info "Creating featbit namespace in east cluster..."
kubectl --context east create namespace featbit 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Success "East namespace created"
}
else {
    Write-Warning "East namespace already exists"
}

Write-Step "Creating Registry Image Pull Secrets"
# Credentials are collected during the Pre-flight Checks step at the top of
# this script so the user can walk away once the deploy starts. By the time we
# reach this step, $CustomRegistryCredential is either populated or explicitly
# null (user declined). No interactive prompt belongs here.
if ($CustomImageRegistry -and $CustomRegistryCredential) {
    Ensure-CustomRegistryImagePullSecret -ClusterContext "west" -Namespace "featbit" -Registry $CustomImageRegistry -Credential $CustomRegistryCredential -SecretName $CustomRegistrySecretName
    Ensure-CustomRegistryImagePullSecret -ClusterContext "east" -Namespace "featbit" -Registry $CustomImageRegistry -Credential $CustomRegistryCredential -SecretName $CustomRegistrySecretName

    Ensure-DefaultServiceAccountImagePullSecret -ClusterContext "west" -Namespace "featbit" -SecretName $CustomRegistrySecretName
    Ensure-DefaultServiceAccountImagePullSecret -ClusterContext "east" -Namespace "featbit" -SecretName $CustomRegistrySecretName
}
else {
    Write-Info "Skipping registry image pull secret creation (no registry configured or no credentials provided)."
}

# ── Corporate Certificate Trust ───────────────────────────────────────────────
# When TRUST_CERTIFICATES is set in deployment.env (or passed directly), install
# corporate CA certs into both clusters BEFORE any pods are scheduled.  This
# prevents ImagePullBackOff on registries that present certs signed by a
# corporate CA that Minikube's stock kicbase does not trust.
$trustCertsScript = Join-Path $PSScriptRoot "Trust-MinikubeCertificates.ps1"
$trustCertsEnv = ""
$trustCertStoreSubjects = @()
foreach ($line in (Get-Content (Join-Path $PSScriptRoot "deployment.env") -ErrorAction SilentlyContinue)) {
    $t = $line.Trim()
    if ($t -and -not $t.StartsWith("#")) {
        if ($t.StartsWith("TRUST_CERTIFICATES=")) {
            $trustCertsEnv = $t.Substring("TRUST_CERTIFICATES=".Length).Trim()
        }
        elseif ($t.StartsWith("TRUST_CERT_STORE_SUBJECTS=")) {
            $v = $t.Substring("TRUST_CERT_STORE_SUBJECTS=".Length).Trim()
            if ($v) { $trustCertStoreSubjects = [string[]]@($v -split "," | ForEach-Object { $_.Trim() } | Where-Object { $_ }) }
        }
    }
}
if (($trustCertsEnv -or $trustCertStoreSubjects.Count -gt 0) -and (Test-Path $trustCertsScript)) {
    Write-Step "Installing Corporate CA Certificates"
    $registryHosts = @()
    if ($CustomImageRegistry) { $registryHosts += $CustomImageRegistry.Split(":")[0] }
    $trustArgs = @{ Clusters = @("west", "east"); RegistryHosts = $registryHosts }
    if ($trustCertStoreSubjects.Count -gt 0) {
        $trustArgs["WindowsCertStoreSubjects"] = $trustCertStoreSubjects
    }
    & $trustCertsScript @trustArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Certificate trust installation reported errors — image pulls from $CustomImageRegistry may fail."
    }
    else {
        Write-Success "Corporate CA certificates installed in both clusters"
    }
}
elseif ($CustomImageRegistry) {
    Write-Warning "CUSTOM_IMAGE_REGISTRY is set but no cert trust is configured in deployment.env."
    Write-Warning "If $CustomImageRegistry uses a corporate CA, pods may get ImagePullBackOff."
    Write-Warning "Add TRUST_CERT_STORE_SUBJECTS or TRUST_CERTIFICATES to deployment.env."
}

if ($DeploymentMode -eq "Basic") {
    Write-Step "Starting Host Infrastructure"
    Start-HostInfrastructure -Components $hostComponentSet -RepositoryRoot $scriptPath `
        -CustomImageRegistry $CustomImageRegistry -ImageMap $infraImageMap

    Write-Step "Configuring Host Bridge Services"
    foreach ($clusterContext in @("west", "east")) {
        Ensure-HostBridgeServices -ClusterContext $clusterContext -Namespace "featbit" -HostComponents $hostComponentSet
    }
    Write-Success "Host bridge services configured for selected components"
}
else {
    Write-Step "Stopping Host Infrastructure"
    Write-Info "Advanced mode: ensuring host Docker infra is not running to avoid port conflicts..."
    Stop-HostInfrastructure -RepositoryRoot $scriptPath
}

Write-Step "Deploying Infrastructure"

# Stale-pod cleanup: prior runs may have deployed infra components that are no
# longer part of $clusterInfraComponentSet (for example, switching from Advanced
# back to Basic mode leaves orphaned in-cluster pods that ImagePullBackOff
# forever because their owning workloads are never reconciled by this script).
# Delete those orphans before re-applying so the cluster converges to the
# intended state without manual cleanup.
$infraSelectorByComponent = @{
    "redis"      = "app=redis"
    "kafka"      = "app in (kafka,kafka-aggregate,kafka-mirrormaker-local,kafka-mirrormaker-remote,kafka-ui)"
    "clickhouse" = "app=clickhouse-server"
    "mongodb"    = "app in (mongodb,mongodb-west,mongodb-east)"
}
$allInfraComponents = @("redis", "kafka", "clickhouse", "mongodb")
# Wrap the Where-Object pipeline in @() so $staleComponents is always a real
# array — Where-Object returns $null when nothing matches, and $null.Count
# throws "The property 'Count' cannot be found on this object."
$staleComponents = @($allInfraComponents | Where-Object { -not $clusterInfraComponentSet.Contains($_) })
if ($staleComponents.Count -gt 0) {
    Write-Info "Cleaning up stale in-cluster infra not selected for this run: $($staleComponents -join ', ')"
    foreach ($clusterContext in @("west", "east")) {
        foreach ($componentName in $staleComponents) {
            $selector = $infraSelectorByComponent[$componentName]
            if (-not $selector) { continue }
            kubectl --context $clusterContext -n featbit delete deploy,statefulset,pod,svc,configmap,pvc -l $selector --ignore-not-found --timeout=60s 2>&1 | Out-Null
        }
    }
    Write-Success "Stale infra cleanup complete"
}

if ($clusterInfraComponentSet.Count -eq 0) {
    Write-Info "No infrastructure components selected for in-cluster deployment."
}
else {
    $infraPatternByComponent = @{
        "redis" = @("redis-*.yaml")
        "kafka" = @("kafka-*.yaml")
        "clickhouse" = @("clickhouse-*.yaml")
    }

    foreach ($clusterContext in @("west", "east")) {
        Write-Info "Deploying selected in-cluster infrastructure to $clusterContext..."
        Push-Location $kubernetesProPath

        foreach ($componentName in @("redis", "kafka", "clickhouse")) {
            if (-not $clusterInfraComponentSet.Contains($componentName)) {
                continue
            }

            foreach ($filePattern in $infraPatternByComponent[$componentName]) {
                Get-ChildItem ".\infrastructure\$filePattern" | ForEach-Object {
                    Invoke-KubectlApplyFile -Context $clusterContext -FilePath $_.FullName `
                        -Namespace "featbit" -Registry $CustomImageRegistry -ImageMap $infraImageMap `
                        -PullSecretName $CustomRegistrySecretName `
                        -InfraLocalImageMap $script:infraLocalImageMap
                }
            }
        }

        Pop-Location
        Write-Success "$clusterContext infrastructure deployed"
    }
}

Write-Info "Waiting 30 seconds for infrastructure pods to initialize..."
Start-Sleep -Seconds 30

if ($clusterInfraComponentSet.Contains("kafka")) {
    Write-Step "Configuring Kafka Aggregate"

    Write-Info "Waiting for kafka-aggregate deployment to be ready..."
    kubectl --context west wait --for=condition=available deployment/kafka-aggregate -n featbit --timeout=120s | Out-Null
    kubectl --context east wait --for=condition=available deployment/kafka-aggregate -n featbit --timeout=120s | Out-Null

    Write-Info "Configuring west kafka-aggregate advertised listeners ($westSharedClusterIp)..."
    kubectl --context west -n featbit set env deployment/kafka-aggregate `
        "KAFKA_CFG_ADVERTISED_LISTENERS=PLAINTEXT://kafka-aggregate:9092,PLAINTEXT_HOST://${westSharedClusterIp}:30094" | Out-Null

    Write-Info "Configuring east kafka-aggregate advertised listeners ($eastSharedClusterIp)..."
    kubectl --context east -n featbit set env deployment/kafka-aggregate `
        "KAFKA_CFG_ADVERTISED_LISTENERS=PLAINTEXT://kafka-aggregate:9092,PLAINTEXT_HOST://${eastSharedClusterIp}:30094" | Out-Null

    # Wait for the kafka-aggregate rollouts to finish before patching MirrorMaker.
    # kafka-aggregate uses Recreate strategy, so there is a window where the old pod is
    # still serving connections with the placeholder 127.0.0.1:30094 in its broker metadata.
    # If mirrormaker-remote starts during that window it caches the wrong address and fails
    # permanently until restarted. Waiting here ensures the new pods (with correct advertised
    # listeners) are the only ones accepting connections before MirrorMaker bootstraps.
    Write-Info "Waiting for kafka-aggregate rollout to complete on both clusters..."
    kubectl --context west rollout status deployment/kafka-aggregate -n featbit --timeout=120s | Out-Null
    kubectl --context east rollout status deployment/kafka-aggregate -n featbit --timeout=120s | Out-Null
    Write-Info "kafka-aggregate rollout complete."

    # Pre-create the featbit topics on every broker BEFORE the MirrorMakers (re)start.
    # At first bring-up the MirrorMakers otherwise race topic auto-creation on their
    # destination broker (UNKNOWN_TOPIC_OR_PARTITION warnings), and the deprecated
    # MirrorMaker tool can silently drop records in that window (#113).
    $featbitTopics = @(
        "featbit-feature-flag-change", "featbit-segment-change",
        "featbit-endusers", "featbit-insights",
        "featbit-connection-made", "featbit-connection-closed",
        "featbit-pod-heartbeat",
        "featbit-control-plane-feature-flag-change", "featbit-control-plane-segment-change",
        "featbit-control-plane-secret-change", "featbit-control-plane-license-change",
        "featbit-control-plane-web-hooks", "featbit-control-plane-command",
        "featbit-control-plane-push-full-sync-change"
    ) -join " "
    Write-Info "Pre-creating featbit topics on main + aggregate brokers (both clusters)..."
    foreach ($topicCtx in @("west", "east")) {
        foreach ($topicBootstrap in @("kafka:9092", "kafka-aggregate:9092")) {
            kubectl --context $topicCtx -n featbit exec kafka -- bash -c `
                "for t in $featbitTopics; do /opt/bitnami/kafka/bin/kafka-topics.sh --bootstrap-server $topicBootstrap --create --if-not-exists --topic `$t --partitions 1 --replication-factor 1 >/dev/null 2>&1; done" | Out-Null
        }
    }
    Write-Success "featbit topics pre-created on all brokers (both clusters)"

    # The local MirrorMakers started with the kafka group and may carry dead mirror
    # threads from the pre-topic window; restart them now that topics exist. (The
    # remote MirrorMakers restart anyway via the set env below.)
    kubectl --context west -n featbit rollout restart deployment/kafka-mirrormaker-local | Out-Null
    kubectl --context east -n featbit rollout restart deployment/kafka-mirrormaker-local | Out-Null

    Write-Info "Configuring west kafka-mirrormaker-remote -> east kafka-aggregate (${eastSharedClusterIp}:30094)..."
    kubectl --context west -n featbit set env deployment/kafka-mirrormaker-remote `
        "REMOTE_BOOTSTRAP_SERVERS=${eastSharedClusterIp}:30094" | Out-Null

    Write-Info "Configuring east kafka-mirrormaker-remote -> west kafka-aggregate (${westSharedClusterIp}:30094)..."
    kubectl --context east -n featbit set env deployment/kafka-mirrormaker-remote `
        "REMOTE_BOOTSTRAP_SERVERS=${westSharedClusterIp}:30094" | Out-Null

    Write-Success "Kafka aggregate and MirrorMakers configured"
}

if ($clusterInfraComponentSet.Contains("mongodb")) {
    Write-Step "Deploying MongoDB Replica Set"

$imagePullSecretPatch = @{
        spec = @{
            template = @{
                spec = @{
                    imagePullSecrets = @(
                        @{
                            name = $CustomRegistrySecretName
                        }
                    )
                }
            }
        }
    } | ConvertTo-Json -Depth 8 -Compress

    Write-Info "Deploying MongoDB ConfigMap..."
    Invoke-KubectlApplyFile -Context "west" `
        -FilePath (Join-Path $kubernetesProPath "infrastructure\mongodb-init-configMap.yaml") `
        -Namespace "featbit" -Registry $CustomImageRegistry -ImageMap $infraImageMap `
        -PullSecretName $CustomRegistrySecretName `
        -InfraLocalImageMap $script:infraLocalImageMap
    Write-Success "MongoDB ConfigMap deployed"

    Write-Info "Deploying MongoDB to west cluster (2 replicas)..."
    Invoke-KubectlApplyFile -Context "west" `
        -FilePath (Join-Path $kubernetesProPath "infrastructure\mongodb-west-statefulset.yaml") `
        -Namespace "featbit" -Registry $CustomImageRegistry -ImageMap $infraImageMap `
        -PullSecretName $CustomRegistrySecretName `
        -InfraLocalImageMap $script:infraLocalImageMap
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "MongoDB west StatefulSet apply returned non-zero; continuing with image and pull-secret reconciliation."
    }
    if ($MongoImage) {
        kubectl --context west set image statefulset/mongodb-west mongodb=$MongoImage -n featbit | Out-Null
    }
    kubectl --context west patch statefulset mongodb-west -n featbit --type merge -p $imagePullSecretPatch | Out-Null
    Write-Success "MongoDB west StatefulSet deployed"

    Write-Info "Deploying MongoDB to east cluster (1 replica)..."
    Invoke-KubectlApplyFile -Context "east" `
        -FilePath (Join-Path $kubernetesProPath "infrastructure\mongodb-east-statefulset.yaml") `
        -Namespace "featbit" -Registry $CustomImageRegistry -ImageMap $infraImageMap `
        -PullSecretName $CustomRegistrySecretName `
        -InfraLocalImageMap $script:infraLocalImageMap
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "MongoDB east StatefulSet apply returned non-zero; continuing with image and pull-secret reconciliation."
    }
    if ($MongoImage) {
        kubectl --context east set image statefulset/mongodb-east mongodb=$MongoImage -n featbit | Out-Null
    }
    kubectl --context east patch statefulset mongodb-east -n featbit --type merge -p $imagePullSecretPatch | Out-Null
    Write-Success "MongoDB east StatefulSet deployed"

    Write-Info "Waiting for MongoDB pods to be ready (this may take 60-90 seconds)..."
    kubectl --context west wait --for=condition=ready pod -n featbit -l app=mongodb,region=west --timeout=180s | Out-Null
    $westMongoReady = ($LASTEXITCODE -eq 0)

    kubectl --context east wait --for=condition=ready pod -n featbit -l app=mongodb,region=east --timeout=180s | Out-Null
    $eastMongoReady = ($LASTEXITCODE -eq 0)

    if ($westMongoReady -and $eastMongoReady) {
        Write-Success "All MongoDB pods are ready"
    }
    else {
        Write-Warning "One or more MongoDB pods are not ready yet. Deployment will continue with fallback connection settings if needed."
    }
}
else {
    Write-Step "MongoDB Deployment"
    Write-Info "Skipping in-cluster MongoDB deployment (MongoDB is in host mode or not selected)."
}

if ($clusterInfraComponentSet.Contains("postgresql")) {
        Write-Step "Deploying PostgreSQL"

        foreach ($clusterContext in @("west", "east")) {
                Write-Info "Deploying PostgreSQL to $clusterContext cluster..."

                @"
apiVersion: v1
kind: Service
metadata:
    name: postgresql
    namespace: featbit
spec:
    ports:
    - port: 5432
        targetPort: 5432
    selector:
        app: postgresql
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
    name: postgresql
    namespace: featbit
spec:
    serviceName: postgresql
    replicas: 1
    selector:
        matchLabels:
            app: postgresql
    template:
        metadata:
            labels:
                app: postgresql
        spec:
            imagePullSecrets:
            - name: $CustomRegistrySecretName
            containers:
            - name: postgresql
                image: $PostgresImage
                ports:
                - containerPort: 5432
                env:
                - name: POSTGRES_USER
                    value: postgres
                - name: POSTGRES_PASSWORD
                    value: please_change_me
                - name: POSTGRES_DB
                    value: featbit
                volumeMounts:
                - name: postgres-data
                    mountPath: /var/lib/postgresql/data
    volumeClaimTemplates:
    - metadata:
            name: postgres-data
        spec:
            accessModes:
            - ReadWriteOnce
            resources:
                requests:
                    storage: 5Gi
"@ | kubectl --context $clusterContext apply -f - | Out-Null

                if ($LASTEXITCODE -ne 0) {
                        Write-Error "Failed to deploy PostgreSQL to $clusterContext cluster"
                        exit 1
                }
        }

        Write-Info "Waiting for PostgreSQL pods to be ready..."
        kubectl --context west wait --for=condition=ready pod -n featbit -l app=postgresql --timeout=240s | Out-Null
        kubectl --context east wait --for=condition=ready pod -n featbit -l app=postgresql --timeout=240s | Out-Null
        Write-Success "PostgreSQL pods are ready"
}
else {
        Write-Step "PostgreSQL Deployment"
        Write-Info "Skipping in-cluster PostgreSQL deployment (PostgreSQL is in host mode or not selected)."
}

Write-Step "Deploying Applications"

# Build an image map for FeatBit application images so Invoke-KubectlApplyFile
# can rewrite them to the configured FeatBit image registry.
$appImageRegistry = if ($FeatBitImageRegistry) { $FeatBitImageRegistry } else { "host.minikube.internal:5000" }
$appImageMap = @{
    "featbit/featbit-api-server:latest"            = "featbit/featbit-api-server:latest"
    "featbit/featbit-ui:latest"                    = "featbit/featbit-ui:latest"
    "featbit/featbit-evaluation-server:latest"     = "featbit/featbit-evaluation-server:latest"
    "featbit/featbit-control-plane:latest"         = "featbit/featbit-control-plane:latest"
}

Write-Info "Using FeatBit image registry: $appImageRegistry"

Write-Info "Deploying FeatBit applications to west cluster..."
Get-ChildItem (Join-Path $kubernetesProPath "application") -Filter "*.yaml" | Sort-Object Name | ForEach-Object {
    Invoke-KubectlApplyFile -Context "west" -FilePath $_.FullName `
        -Namespace "featbit" -Registry $appImageRegistry -ImageMap $appImageMap `
        -PullSecretName $CustomRegistrySecretName
}
Write-Success "West applications deployed"

Write-Info "Deploying FeatBit applications to east cluster..."
Get-ChildItem (Join-Path $kubernetesProPath "application") -Filter "*.yaml" | Sort-Object Name | ForEach-Object {
    Invoke-KubectlApplyFile -Context "east" -FilePath $_.FullName `
        -Namespace "featbit" -Registry $appImageRegistry -ImageMap $appImageMap `
        -PullSecretName $CustomRegistrySecretName
}
Write-Success "East applications deployed"

Write-Step "Configuring UI Endpoints"

Write-Info "Setting west UI API/Evaluation URLs..."
kubectl --context west -n featbit set env deployment/ui API_URL=http://featbit-api.west.local EVALUATION_URL=http://featbit-eval.west.local DEMO_URL=https://featbit-samples.vercel.app | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to set west UI endpoint environment variables"
    exit 1
}

Write-Info "Setting east UI API/Evaluation URLs..."
kubectl --context east -n featbit set env deployment/ui API_URL=http://featbit-api.east.local EVALUATION_URL=http://featbit-eval.east.local DEMO_URL=https://featbit-samples.vercel.app | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to set east UI endpoint environment variables"
    exit 1
}

Write-Success "UI endpoint environment variables configured"

Write-Step "Configuring Control Plane"
Write-Info "Setting control-plane API key..."
kubectl --context west -n featbit set env "deployment/control-plane" "Api__ApiKey=api-key" | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to set west control-plane API key"
    exit 1
}
kubectl --context east -n featbit set env "deployment/control-plane" "Api__ApiKey=api-key" | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to set east control-plane API key"
    exit 1
}
Write-Success "Control-plane API key configured (api-key)"

Write-Step "Configuring Database Connections"

# Application services that use the app database (flags/segments/users).
$databaseDeployments = @(
    "api-server",
    "control-plane",
    "evaluation-server"
)

if ($DatabaseProvider -eq "MongoDb") {
    if ($clusterInfraComponentSet.Contains("mongodb")) {
        if ($DeploymentMode -eq "Advanced") {
            # In Advanced mode, pods need to reach all replica set members across both clusters.
            # Kubernetes DNS (mongodb-headless) only resolves within one cluster, so we build an
            # explicit NodePort seed list using each node's shared-network IP and the service's
            # dynamically assigned NodePort. MongoDB runs without --auth in this dev topology,
            # so no credentials are needed in the connection string.
            $westIp = (minikube ip -p west)
            $eastIp = (minikube ip -p east)
            $west0Port = kubectl --context west get svc mongodb-0-lb -n featbit -o jsonpath='{.spec.ports[0].nodePort}'
            $west1Port = kubectl --context west get svc mongodb-1-lb -n featbit -o jsonpath='{.spec.ports[0].nodePort}'
            $east0Port = kubectl --context east get svc mongodb-2-lb -n featbit -o jsonpath='{.spec.ports[0].nodePort}'
            $mongoConnectionString = "mongodb://${westIp}:${west0Port},${westIp}:${west1Port},${eastIp}:${east0Port}/?replicaSet=rs-featbit"
            Write-Info "Using NodePort replica-set MongoDB connection string: $mongoConnectionString"
        }
        else {
            $westMongoIp = Get-LoadBalancerIp -ClusterContext "west" -Namespace "featbit" -ServiceName "mongodb-0-lb"
            $eastMongoIp = Get-LoadBalancerIp -ClusterContext "east" -Namespace "featbit" -ServiceName "mongodb-2-lb"

            if ($westMongoIp -and $eastMongoIp) {
                $mongoConnectionString = "mongodb://${westMongoIp}:27017,${eastMongoIp}:27017/?replicaSet=rs-featbit"
                Write-Info "Using replica-set MongoDB connection string: $mongoConnectionString"
            }
            else {
                Write-Warning "LoadBalancer IPs not ready. Falling back to cluster-local MongoDB service names."
                $mongoConnectionString = $null
            }
        }
    }
    else {
        $mongoConnectionString = "mongodb://admin:password@mongodb:27017"
        Write-Info "Using host-bridge MongoDB connection string: $mongoConnectionString"
    }

    Write-Info "Setting west MongoDB connection strings..."
    foreach ($deploymentName in $databaseDeployments) {
        $connStr = if ($mongoConnectionString) { $mongoConnectionString } else { "mongodb://mongodb-headless:27017/?replicaSet=rs-featbit" }
        kubectl --context west -n featbit set env "deployment/$deploymentName" CHECK_DB_LIVNESS=false DB_PROVIDER=MongoDb DbProvider=MongoDb MongoDb__ConnectionString=$connStr | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to set west MongoDB connection string for $deploymentName"
            exit 1
        }
    }

    Write-Info "Setting east MongoDB connection strings..."
    foreach ($deploymentName in $databaseDeployments) {
        $connStr = if ($mongoConnectionString) { $mongoConnectionString } else { "mongodb://mongodb-headless:27017/?replicaSet=rs-featbit" }
        kubectl --context east -n featbit set env "deployment/$deploymentName" CHECK_DB_LIVNESS=false DB_PROVIDER=MongoDb DbProvider=MongoDb MongoDb__ConnectionString=$connStr | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to set east MongoDB connection string for $deploymentName"
            exit 1
        }
    }

    Write-Success "MongoDB connection strings configured"
}
else {
    $postgreSqlConnectionString = "Host=postgresql;Port=5432;Username=postgres;Password=please_change_me;Database=featbit"
    Write-Info "Using PostgreSQL connection string: $postgreSqlConnectionString"

    Write-Info "Setting west PostgreSQL connection strings..."
    foreach ($deploymentName in $databaseDeployments) {
        kubectl --context west -n featbit set env "deployment/$deploymentName" CHECK_DB_LIVNESS=false DB_PROVIDER=Postgres DbProvider=Postgres Postgres__ConnectionString=$postgreSqlConnectionString | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to set west PostgreSQL connection string for $deploymentName"
            exit 1
        }
    }

    Write-Info "Setting east PostgreSQL connection strings..."
    foreach ($deploymentName in $databaseDeployments) {
        kubectl --context east -n featbit set env "deployment/$deploymentName" CHECK_DB_LIVNESS=false DB_PROVIDER=Postgres DbProvider=Postgres Postgres__ConnectionString=$postgreSqlConnectionString | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to set east PostgreSQL connection string for $deploymentName"
            exit 1
        }
    }

    Write-Success "PostgreSQL connection strings configured"
}

# ClickHouse initialization migrations must create the Kafka-engine table and materialized
# view that consume `featbit-insights` topic and persist the analytics data queried by the API server.

Write-Step "Configuring App MQ Provider"

# All scripts in e2e/control-plane always target a Kafka MQ topology.
#
# Advanced mode: Kafka runs inside both clusters with a separate kafka-aggregate broker.
#   - Apps PRODUCE to kafka:9092  (main broker)
#   - Apps CONSUME from kafka-aggregate:9092  (aggregate broker)
#   - MirrorMaker bridges main → local aggregate and main → remote aggregate.
#
# Basic mode: Kafka may run on the host or inside the cluster (no aggregate broker / no MirrorMaker).
#   - Apps PRODUCE to kafka:9092
#   - Apps CONSUME from kafka:9092  (same broker — no aggregate exists)
if ($clusterInfraComponentSet.Contains("kafka")) {
    # Kafka is deployed inside the cluster (Advanced mode or Basic mode with in-cluster kafka).
    # kafka-aggregate exists, so eval-server and api-server consumers point there.
    $kafkaConsumerServers = "kafka-aggregate:9092"
    Write-Info "In-cluster Kafka detected — eval-server/api-server consumers will use kafka-aggregate:9092"
}
else {
    # Kafka is a host Docker service (Basic mode default).
    # No kafka-aggregate or MirrorMaker; consumers use the same main broker.
    $kafkaConsumerServers = "kafka:9092"
    Write-Info "Host Kafka detected — consumers will use kafka:9092"
}
$kafkaProducerServers = "kafka:9092"
# The control-plane always consumes from the main broker directly. Its trigger topic
# (featbit-control-plane-feature-flag-change) is intra-cluster only and must not go
# through the aggregate — consuming from the aggregate would cause each region's
# control-plane to process the same message, double-writing Redis and re-publishing
# downstream events.
$controlPlaneKafkaConsumerServers = "kafka:9092"

Write-Info "Setting Kafka producer/consumer broker endpoints and enabling Kafka MQ provider on all app deployments..."
foreach ($clusterContext in @("west", "east")) {
    foreach ($dep in @("api-server")) {
        kubectl --context $clusterContext -n featbit set env "deployment/$dep" `
            "MqProvider=Kafka" `
            "Kafka__Producer__bootstrap.servers=$kafkaProducerServers" `
            "Kafka__Consumer__bootstrap.servers=$kafkaConsumerServers" | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Failed to set Kafka config on $dep in $clusterContext"
        }
    }

    kubectl --context $clusterContext -n featbit set env deployment/control-plane `
        "MqProvider=Kafka" `
        "Kafka__Producer__bootstrap.servers=$kafkaProducerServers" `
        "Kafka__Consumer__bootstrap.servers=$controlPlaneKafkaConsumerServers" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Failed to set Kafka config on control-plane in $clusterContext"
    }

    # api-server uses the control-plane for publishing flag/segment change events.
    # This is always true when running via the e2e/control-plane scripts.
    # api-server cache must use Redis in this topology.
    kubectl --context $clusterContext -n featbit set env deployment/api-server `
        "UseControlPlane=true" `
        "CacheProvider=Redis" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Failed to set UseControlPlane/CacheProvider on api-server in $clusterContext"
    }

    # evaluation-server: ControlPlane__Enabled enables the heartbeat service.
    # DcId/Region are set UNCONDITIONALLY (both consistency modes), NOT only under GatedCommit:
    # the heartbeat MUST carry a DcId so the control plane records DC leases keyed by cluster
    # ("west"/"east"). Without it the lease falls back to PodId (HeartbeatMessageHandler:
    # DcId ?? PodId), so a deployment brought up in BestEffort and later flipped to GatedCommit
    # has broken commit-coordination/recovery (it targets pod-GUID "DCs"). DcId MUST equal this
    # cluster's control-plane Redis DcId (set below). Harmless under BestEffort (no leases recorded).
    # ControlPlane__HeartbeatIntervalSeconds is set here for the same reason: the ELS appsettings
    # default (previously 60s) was incoherent with the control plane's 15s LeaseTtlSeconds default,
    # so leases flapped and GatedCommit stalled (#99). 5s keeps interval <= LeaseTtlSeconds/3.
    $consistencyMode = if ($env:CONSISTENCY_MODE -eq 'GatedCommit') { 'GatedCommit' } else { 'BestEffort' }
    kubectl --context $clusterContext -n featbit set env deployment/evaluation-server `
        "MqProvider=Kafka" `
        "Kafka__Producer__bootstrap.servers=$kafkaProducerServers" `
        "Kafka__Consumer__bootstrap.servers=$kafkaConsumerServers" `
        "ControlPlane__Enabled=true" `
        "ControlPlane__DcId=$clusterContext" `
        "ControlPlane__Region=$clusterContext" `
        "ControlPlane__ConsistencyMode=$consistencyMode" `
        "ControlPlane__HeartbeatIntervalSeconds=5" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Failed to set Kafka/ControlPlane config on evaluation-server in $clusterContext"
    }

    # Scale evaluation-server to 3 replicas so cp09 can exercise intra-cluster
    # failover (kill one pod, observe clients re-roll to surviving pods in
    # the same cluster via the host nginx LB) in addition to cross-cluster
    # failover. Five port slots per cluster are reserved in nginx.conf to
    # support scale-up beyond 3 without nginx config changes.
    kubectl --context $clusterContext -n featbit scale deployment evaluation-server --replicas=3 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Failed to scale evaluation-server to 3 replicas in $clusterContext"
    }
}
Write-Success "Kafka MQ provider configured for all app deployments (producer=$kafkaProducerServers, api-server/eval-server consumer=$kafkaConsumerServers, control-plane consumer=$controlPlaneKafkaConsumerServers)"

Write-Info "Configuring cross-cluster Redis instances on control-plane deployments..."
# Each control-plane must update the Redis cache of BOTH clusters when it processes a
# control-plane topic message. Instance 0 is the local in-cluster Redis; Instance 1 is
# the remote cluster's Redis reached via the host port-forward on host.minikube.internal.
#   West control-plane → east Redis on host port 6380
#   East control-plane → west Redis on host port 6379
$consistencyMode = if ($env:CONSISTENCY_MODE -eq 'GatedCommit') { 'GatedCommit' } else { 'BestEffort' }
if ($consistencyMode -eq 'GatedCommit') {
    # GatedCommit: label each Redis instance with its DcId — the join key the commit
    # coordinator uses to correlate a DC's Redis with that DC's eval-server leases.
    # Object-form keys (__ConnectionString / __DcId) are REQUIRED to bind to
    # RedisInstanceConfig. Each DcId MUST equal that cluster's eval-server
    # ControlPlane__DcId (the cluster name, set in the per-cluster loop above).
    #   west control-plane: 0 = local west redis (DcId=west), 1 = remote east redis (DcId=east)
    #   east control-plane: 0 = local east redis (DcId=east), 1 = remote west redis (DcId=west)
    #
    # Kafka__Consumer__group.id is set PER CLUSTER (not the shipped default of
    # "featbit-control-plane") so west/east control planes never collide on a shared
    # consumer group.id when they both consume from the same host Kafka broker (#100).
    # A shared group.id makes Kafka hand each topic-partition to exactly ONE group
    # member, so only one DC's control plane processes flag/segment changes and
    # heartbeats at a time — the other silently idles until a rebalance. Each DC needs
    # its own group so both control planes are independent consumers of the change
    # stream (the composite-cache design assumes this; every control plane writes to
    # every DC's Redis and the idempotent/only-advance guards make duplicate
    # processing safe, see #72/#89). auto.offset.reset=latest avoids replaying the
    # entire topic history the first time each new per-DC group is created.
    kubectl --context west -n featbit set env deployment/control-plane `
        "ControlPlane__ConsistencyMode=GatedCommit" `
        "Kafka__Consumer__group.id=featbit-control-plane-west" `
        "Kafka__Consumer__auto.offset.reset=latest" `
        "Redis__Instances__0__ConnectionString=redis:6379" `
        "Redis__Instances__0__DcId=west" `
        "Redis__Instances__1__ConnectionString=${CrossClusterRedisHost}:6380" `
        "Redis__Instances__1__DcId=east" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Failed to set gated-commit Redis/DcId config on control-plane in west"
    }
    kubectl --context east -n featbit set env deployment/control-plane `
        "ControlPlane__ConsistencyMode=GatedCommit" `
        "Kafka__Consumer__group.id=featbit-control-plane-east" `
        "Kafka__Consumer__auto.offset.reset=latest" `
        "Redis__Instances__0__ConnectionString=redis:6379" `
        "Redis__Instances__0__DcId=east" `
        "Redis__Instances__1__ConnectionString=${CrossClusterRedisHost}:6379" `
        "Redis__Instances__1__DcId=west" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Failed to set gated-commit Redis/DcId config on control-plane in east"
    }
    Write-Success "GatedCommit: cross-cluster Redis labeled with DcIds (west 0=west/1=east, east 0=east/1=west); ConsistencyMode=GatedCommit + per-DC Kafka__Consumer__group.id on both control planes + eval servers"
}
else {
    # BestEffort MUST use the SAME object-form keys (__ConnectionString / __DcId) as the
    # GatedCommit branch. The control-plane binds Redis:Instances to RedisInstanceConfig[]
    # (see CacheServiceCollectionExtensions), whose connection comes from the __ConnectionString
    # sub-key. The scalar form ("Redis__Instances__0=host:port") does NOT bind to
    # RedisInstanceConfig.ConnectionString, so the composite cache ends up with empty
    # connection strings and the remote-DC (Instance 1) write SILENTLY no-ops — the remote
    # cluster's Redis never receives flag/secret changes. DcId labels are not required under
    # BestEffort (an empty DcId falls back to the ordinal index with a warning) but are set
    # here for parity with the GatedCommit branch and to suppress that warning.
    #   west control-plane: 0 = local west redis (DcId=west), 1 = remote east redis (DcId=east)
    #   east control-plane: 0 = local east redis (DcId=east), 1 = remote west redis (DcId=west)
    #
    # Kafka__Consumer__group.id is set PER CLUSTER here too — see the GatedCommit branch
    # above for the full rationale (#100). The collision is just as real under BestEffort:
    # without a per-DC group.id, Kafka hands each topic-partition to a single group
    # member and only one DC's control plane processes changes at a time.
    kubectl --context west -n featbit set env deployment/control-plane `
        "ControlPlane__ConsistencyMode=BestEffort" `
        "Kafka__Consumer__group.id=featbit-control-plane-west" `
        "Kafka__Consumer__auto.offset.reset=latest" `
        "Redis__Instances__0__ConnectionString=redis:6379" `
        "Redis__Instances__0__DcId=west" `
        "Redis__Instances__1__ConnectionString=${CrossClusterRedisHost}:6380" `
        "Redis__Instances__1__DcId=east" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Failed to set Redis cross-cluster instance on control-plane in west"
    }
    kubectl --context east -n featbit set env deployment/control-plane `
        "ControlPlane__ConsistencyMode=BestEffort" `
        "Kafka__Consumer__group.id=featbit-control-plane-east" `
        "Kafka__Consumer__auto.offset.reset=latest" `
        "Redis__Instances__0__ConnectionString=redis:6379" `
        "Redis__Instances__0__DcId=east" `
        "Redis__Instances__1__ConnectionString=${CrossClusterRedisHost}:6379" `
        "Redis__Instances__1__DcId=west" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Failed to set Redis cross-cluster instance on control-plane in east"
    }
    Write-Success "Cross-cluster Redis configured (object-form; west→east: ${CrossClusterRedisHost}:6380, east→west: ${CrossClusterRedisHost}:6379); per-DC Kafka__Consumer__group.id set on both control planes"
}

# ── Per-cluster Redis + Sentinel ────────────────────────────────────────────────
# Give each cluster its OWN HA Redis (1 master + 2 replicas + 3 Sentinels) in-cluster
# and point that cluster's FeatBit (api/eval/control-plane) at its own Sentinel
# (Redis__ConnectionString=featbit-redis:26379,serviceName=mymaster). No shared redis
# between DCs. This runs AFTER the redis connection-string config above so it
# overrides the host-redis defaults: Instances__0 -> local Sentinel, and Instances__1
# -> the PEER cluster's master forwarder (<peer-node-ip>:31649), superseding the
# host.minikube.internal cross-cluster defaults set above. The host redis, if still
# deployed by HostInfraComponents, is left orphaned (harmless). FeatBit needs no code
# change — StackExchange.Redis resolves the master from serviceName= (local) and the
# forwarder gives a master-only cross-reachable endpoint (remote). See
# redis-sentinel/README.md for why the peer Sentinel can't be used directly.
if ($UseRedisSentinel) {
    Write-Step "Per-Cluster Redis + Sentinel"
    $redisSentinelScript = Join-Path $PSScriptRoot "redis-sentinel/Deploy-RedisSentinel.ps1"
    if (Test-Path $redisSentinelScript) {
        & $redisSentinelScript -Contexts @("west", "east") -Namespace "featbit"
        if ($LASTEXITCODE -ne 0) { Write-Warning "Per-cluster Redis+Sentinel setup reported an error; review output above." }
    }
    else {
        Write-Warning "redis-sentinel/Deploy-RedisSentinel.ps1 not found — skipping per-cluster Sentinel (FeatBit will use the host redis)."
    }
}

Write-Info "Waiting 45 seconds for application pods to pull images and start..."
Start-Sleep -Seconds 45

Write-Step "Pull-Backoff Verification"
$assertScript = Join-Path $PSScriptRoot "Assert-NoImagePullBackoff.ps1"
if (-not (Test-Path $assertScript)) {
    Write-Warning "Assert-NoImagePullBackoff.ps1 not found at $assertScript — skipping verification."
}
else {
    Write-Info "Verifying no pods are stuck in ImagePullBackOff/ErrImagePull across west and east..."
    & $assertScript -Contexts @("west", "east") -Namespaces @("featbit") -TimeoutSeconds 120 -IntervalSeconds 5
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Pull-backoff verification failed. See Assert-NoImagePullBackoff output above for offending pods."
        Write-Info "Common causes:"
        Write-Info "  • TLS trust not installed for CUSTOM_IMAGE_REGISTRY (configure TRUST_CERTIFICATES or set INSECURE_CUSTOM_REGISTRY=true)."
        Write-Info "  • Image pull credentials missing (set CUSTOM_REGISTRY_USERNAME and CUSTOM_REGISTRY_PASSWORD in deployment.env)."
        Write-Info "  • Image paths in kubernetes\infra-image-map.local.json do not match your registry layout."
        exit 1
    }
}

Write-Step "Deployment Status"

Write-Host "`nWEST CLUSTER:" -ForegroundColor Yellow
kubectl --context west get pods -n featbit

Write-Host "`nEAST CLUSTER:" -ForegroundColor Yellow
kubectl --context east get pods -n featbit

Write-Step "Deployment Complete"

Write-Success "FeatBit Pro has been deployed to both clusters!"

Write-Host "`n⚠️  IMPORTANT: Next Steps" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Start Port Forwards:" -ForegroundColor Cyan
Write-Host "   .\Start-PortForwards.ps1" -ForegroundColor White
Write-Host ""
if ($clusterInfraComponentSet.Contains("mongodb") -and $DeploymentMode -ne "Advanced") {
    Write-Host "2. Initialize MongoDB Replica Set:" -ForegroundColor Cyan
    Write-Host "   .\Initialize-MongoDBReplicaSet.ps1" -ForegroundColor White
    Write-Host "   (Requires port forwards to be running first)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. Configure nginx proxy (optional for DNS routing):" -ForegroundColor Cyan
    Write-Host "   .\Setup-FeatBitProxy.ps1" -ForegroundColor White
}
else {
    Write-Host "2. Configure nginx proxy (optional for DNS routing):" -ForegroundColor Cyan
    Write-Host "   .\Setup-FeatBitProxy.ps1" -ForegroundColor White
}
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host ""

Write-Host "Cluster Information:" -ForegroundColor Cyan
Write-Host "  West Context: west" -ForegroundColor Gray
Write-Host "  East Context: east" -ForegroundColor Gray

Write-Host "`nUseful Commands:" -ForegroundColor Cyan
Write-Host "  View west pods:     kubectl --context west get pods -n featbit" -ForegroundColor Gray
Write-Host "  View east pods:     kubectl --context east get pods -n featbit" -ForegroundColor Gray
Write-Host "  View west services: kubectl --context west get svc -n featbit" -ForegroundColor Gray
Write-Host "  View east services: kubectl --context east get svc -n featbit" -ForegroundColor Gray

if ($DatabaseProvider -eq "MongoDb") {
    if ($clusterInfraComponentSet.Contains("mongodb") -and $DeploymentMode -ne "Advanced") {
        Write-Host "`nMongoDB Replica Set:" -ForegroundColor Cyan
        Write-Host "  Connection String (after initialization):" -ForegroundColor Gray
        Write-Host "  mongodb://mongodb-west:27017 (west) / mongodb://mongodb-east:27017 (east)" -ForegroundColor DarkGray
    }
    else {
        Write-Host "`nMongoDB:" -ForegroundColor Cyan
        Write-Host "  Connection String:" -ForegroundColor Gray
        Write-Host "  mongodb://admin:password@mongodb:27017" -ForegroundColor DarkGray
    }
}
else {
    Write-Host "`nPostgreSQL:" -ForegroundColor Cyan
    Write-Host "  Connection String:" -ForegroundColor Gray
    Write-Host "  Host=postgresql;Port=5432;Username=postgres;Password=please_change_me;Database=featbit" -ForegroundColor DarkGray
}

Write-Host ""
