<#
.SYNOPSIS
    Creates the local Docker registry (if not running) and builds, tags, and pushes
    all FeatBit images required by the control-plane QA deployment.

.DESCRIPTION
    This script performs the following operations:
    1. Ensures a local Docker registry container is running on localhost:5000
    2. Builds each FeatBit service image from its Dockerfile
    3. Tags each image as localhost:5000/featbit/<name>:latest
    4. Pushes each tagged image to the local registry

    Images built:
    - featbit-api-server        (modules/back-end)
    - featbit-ui                (modules/front-end)
    - featbit-evaluation-server (modules/evaluation-server)
    - featbit-control-plane     (modules/control-plane — build context is modules/)

    After this script completes successfully, run Deploy-FeatBitClusters.ps1 to
    stand up the Minikube clusters.

.PARAMETER RegistryPort
    Host port the local registry container listens on. Default: 5000.

.PARAMETER Tag
    Image tag applied to every built image. Default: latest.

.PARAMETER Images
    Subset of images to build. Omit to build all four. Valid values:
    api-server, ui, evaluation-server, control-plane.

.PARAMETER NoPush
    Build and tag images but do not push them to the local registry.

.PARAMETER ContainerRuntime
    Container runtime to use: auto (default), docker, or podman.
    When auto, docker is preferred if both are present.

.PARAMETER NoCache
    Pass --no-cache to every build invocation.

.EXAMPLE
    .\Initialize-LocalRegistry.ps1
    Ensures the registry is running, then builds and pushes all four images.

.EXAMPLE
    .\Initialize-LocalRegistry.ps1 -Images control-plane, evaluation-server
    Builds and pushes only the control-plane and evaluation-server images.

.EXAMPLE
    .\Initialize-LocalRegistry.ps1 -NoPush
    Builds and tags images locally without pushing to the registry.

.EXAMPLE
    .\Initialize-LocalRegistry.ps1 -NoCache
    Performs a clean build (no Docker layer cache) for all images.

.NOTES
    Docker Desktop or Podman must be running before executing this script.
    The local registry container is named 'featbit-registry' and is attached to
    the 'featbit-cluster-network' bridge network so Minikube nodes can reach it.
#>

[CmdletBinding(SupportsShouldProcess)]
param(
    [ValidateSet("auto", "docker", "podman")]
    [string]$ContainerRuntime = "auto",

    [int]$RegistryPort = 5000,

    [string]$Tag = "latest",

    [ValidateSet("api-server", "ui", "evaluation-server", "control-plane")]
    [string[]]$Images = @("api-server", "ui", "evaluation-server", "control-plane"),

    [switch]$NoPush,

    [switch]$NoCache
)

$ErrorActionPreference = "Stop"

Set-StrictMode -Version Latest

# ── Paths ─────────────────────────────────────────────────────────────────────

$repoRoot   = (Resolve-Path (Join-Path $PSScriptRoot "../../..")).Path
$modulesDir = Join-Path $repoRoot "modules"

# ── Image definitions ─────────────────────────────────────────────────────────
# Each entry describes how to build one image.
# BuildContext is relative to $repoRoot.
# Dockerfile is relative to BuildContext unless DockerfileRelative is $false,
# in which case it is relative to $repoRoot directly.

$imageDefinitions = [ordered]@{
    "api-server" = @{
        LocalName    = "featbit-api-server"
        BuildContext = "modules/back-end"
        Dockerfile   = "modules/back-end/deploy/Dockerfile"
    }
    "ui" = @{
        LocalName    = "featbit-ui"
        BuildContext = "modules/front-end"
        Dockerfile   = "modules/front-end/Dockerfile"
    }
    "evaluation-server" = @{
        LocalName    = "featbit-evaluation-server"
        BuildContext = "modules/evaluation-server"
        Dockerfile   = "modules/evaluation-server/deploy/Dockerfile"
    }
    "control-plane" = @{
        LocalName    = "featbit-control-plane"
        # The Dockerfile COPYs from both control-plane/ and back-end/ subdirectories,
        # so the build context must be the parent modules/ directory.
        BuildContext = "modules"
        Dockerfile   = "modules/control-plane/deploy/Dockerfile"
    }
}

# ── Console helpers ───────────────────────────────────────────────────────────

function Write-Step
{
    param([string]$Message)
    Write-Host "`n=== $Message ===" -ForegroundColor Cyan
}

function Write-Success
{
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Info
{
    param([string]$Message)
    Write-Host "  $Message" -ForegroundColor Gray
}

function Write-Warn
{
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

function Write-Fail
{
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

# ── Container runtime detection ──────────────────────────────────────────────

# Resolved at startup; used by all functions via $script:runtime.
$script:runtime = ""

# Known installation paths for runtimes that may not be on PATH (Windows).
$knownRuntimePaths = @{
    "docker" = @(
        "C:\Program Files\Docker\Docker\resources\bin\docker.exe"
    )
    "podman" = @(
        "C:\Program Files\RedHat\Podman\podman.exe",
        "C:\Program Files\Podman Desktop\resources\podman\bin\podman.exe"
    )
}

function Find-RuntimeExecutable
{
    param([string]$Name)

    # Prefer whatever is already on PATH.
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if ($cmd)
    {
        return $cmd.Source
    }

    # Fall back to well-known install locations.
    foreach ($path in $knownRuntimePaths[$Name])
    {
        if (Test-Path $path)
        {
            return $path
        }
    }

    return $null
}

function Resolve-ContainerRuntime
{
    if ($ContainerRuntime -ne "auto")
    {
        $exe = Find-RuntimeExecutable -Name $ContainerRuntime
        if (-not $exe)
        {
            Write-Fail "Requested runtime '$ContainerRuntime' was not found on PATH or in known install locations."
            Write-Info "Known locations checked:"
            foreach ($path in $knownRuntimePaths[$ContainerRuntime])
            {
                Write-Info "  $path"
            }
            exit 1
        }

        $script:runtime = $exe
        Write-Info "Using container runtime: $($script:runtime)"
        return
    }

    # Auto-detect: prefer docker, fall back to podman.
    foreach ($candidate in @("docker", "podman"))
    {
        $exe = Find-RuntimeExecutable -Name $candidate
        if ($exe)
        {
            $script:runtime = $exe
            Write-Info "Auto-detected container runtime: $($script:runtime)"
            return
        }
    }

    Write-Fail "Neither 'docker' nor 'podman' was found on PATH or in known install locations."
    Write-Info "Install Docker Desktop or Podman Desktop and ensure it is running, then retry."
    exit 1
}

function Assert-RuntimeDaemon
{
    $result = & $script:runtime info 2>&1
    if ($LASTEXITCODE -ne 0)
    {
        Write-Fail "$($script:runtime) daemon is not responding."
        Write-Info "Start $($script:runtime) Desktop and wait for it to be ready, then retry."
        exit 1
    }
}

# ── Registry setup ────────────────────────────────────────────────────────────

function Initialize-Registry
{
    Write-Step "Local Docker Registry (localhost:$RegistryPort)"

    # Check whether any container is already bound to the registry port — this
    # catches registries started under a different name (e.g. 'registry') as well
    # as the expected 'featbit-registry' container.
    $portBinding  = ":${RegistryPort}->"
    $anyOnPort    = & $script:runtime ps --format "{{.Names}}\t{{.Ports}}" 2>$null |
        Where-Object { $_ -like "*${portBinding}*" }

    if ($anyOnPort)
    {
        $containerName = ($anyOnPort -split "`t")[0].Trim()
        if ($containerName -eq "featbit-registry")
        {
            Write-Success "Registry container 'featbit-registry' is already running on port $RegistryPort."
        }
        else
        {
            Write-Success "A registry container ('$containerName') is already running on port $RegistryPort — reusing it."
            Write-Info "To use a dedicated 'featbit-registry' container instead, stop '$containerName' and re-run this script."
        }

        return
    }

    # Check whether the named container exists but is stopped.
    $stopped = & $script:runtime ps -a --filter "name=featbit-registry" --format "{{.Names}}" 2>$null
    if ($stopped -match "featbit-registry")
    {
        if ($WhatIfPreference)
        {
            Write-Warn "[WhatIf] Would start existing stopped registry container 'featbit-registry'."
            return
        }

        Write-Info "Starting existing registry container 'featbit-registry'..."
        & $script:runtime start featbit-registry | Out-Null
        Write-Success "Registry container started."
        return
    }

    # Ensure the shared bridge network exists so Minikube nodes can reach the registry.
    $networkExists = & $script:runtime network ls --filter "name=featbit-cluster-network" --format "{{.Name}}" 2>$null
    if ($networkExists -ne "featbit-cluster-network")
    {
        if ($WhatIfPreference)
        {
            Write-Warn "[WhatIf] Would create bridge network 'featbit-cluster-network'."
        }
        else
        {
            Write-Info "Creating bridge network 'featbit-cluster-network'..."
            & $script:runtime network create --driver bridge --subnet 172.31.0.0/16 featbit-cluster-network | Out-Null
            Write-Success "Network created."
        }
    }

    if ($WhatIfPreference)
    {
        Write-Warn "[WhatIf] Would create and start registry container 'featbit-registry' on port $RegistryPort."
        return
    }

    Write-Info "Creating registry container 'featbit-registry' on port $RegistryPort..."

    # --restart is not supported by rootless Podman; only pass it for Docker.
    $isDocker = (Split-Path $script:runtime -Leaf) -like "docker*"
    $runArgs = @(
        "run", "-d",
        "--name", "featbit-registry",
        "--network", "featbit-cluster-network",
        "-p", "${RegistryPort}:5000"
    )

    if ($isDocker)
    {
        $runArgs += @("--restart", "unless-stopped")
    }

    $runArgs += "registry:2"

    & $script:runtime @runArgs | Out-Null

    if ($LASTEXITCODE -ne 0)
    {
        Write-Fail "Failed to start the local registry container."
        exit 1
    }

    Write-Success "Registry container started on localhost:$RegistryPort."
}

# ── Build, tag, push ──────────────────────────────────────────────────────────

function Invoke-ImageBuild
{
    param(
        [string]$ImageKey,
        [hashtable]$Definition
    )

    $localName   = $Definition.LocalName
    $contextPath = Join-Path $repoRoot $Definition.BuildContext
    $dockerfilePath = Join-Path $repoRoot $Definition.Dockerfile
    $registryTag = "localhost:$RegistryPort/featbit/${localName}:$Tag"

    Write-Step "Building $localName"
    Write-Info "Context:    $contextPath"
    Write-Info "Dockerfile: $dockerfilePath"
    Write-Info "Tag:        $registryTag"

    if ($WhatIfPreference)
    {
        Write-Warn "[WhatIf] Would run: $($script:runtime) build -t $registryTag -f `"$dockerfilePath`" `"$contextPath`""
        return
    }

    $buildArgs = @(
        "build",
        "-t", $registryTag,
        "-f", $dockerfilePath,
        # --load forces the image into the local Docker image store.
        # Required when the active buildx driver is 'docker-container' (e.g.
        # Rancher Desktop), which otherwise keeps results only in the build
        # cache and makes them invisible to 'docker push'.
        "--load"
    )

    if ($NoCache)
    {
        $buildArgs += "--no-cache"
    }

    $buildArgs += $contextPath

    & $script:runtime @buildArgs

    if ($LASTEXITCODE -ne 0)
    {
        Write-Fail "$($script:runtime) build failed for $localName (exit code $LASTEXITCODE)."
        exit 1
    }

    Write-Success "$localName built and tagged as $registryTag."

    if ($NoPush)
    {
        Write-Info "Skipping push (-NoPush specified)."
        return
    }

    Write-Info "Pushing $registryTag..."
    & $script:runtime push $registryTag

    if ($LASTEXITCODE -ne 0)
    {
        Write-Fail "$($script:runtime) push failed for $registryTag (exit code $LASTEXITCODE)."
        exit 1
    }

    Write-Success "$localName pushed to local registry."
}

# ── Summary ───────────────────────────────────────────────────────────────────

function Write-Summary
{
    Write-Step "Summary"

    foreach ($key in $Images)
    {
        $def = $imageDefinitions[$key]
        if (-not $def)
        {
            continue
        }

        $registryTag = "localhost:$RegistryPort/featbit/$($def.LocalName):$Tag"
        $exists = & $script:runtime images --format "{{.Repository}}:{{.Tag}}" 2>$null |
            Select-String -Pattern ([regex]::Escape($registryTag)) -Quiet

        if ($exists)
        {
            Write-Success "$registryTag"
        }
        else
        {
            Write-Warn "$registryTag — not found in local image store"
        }
    }

    if (-not $NoPush -and -not $WhatIfPreference)
    {
        Write-Host ""
        Write-Info "Verify images are reachable in the registry:"
        Write-Info "  curl http://localhost:$RegistryPort/v2/_catalog"
        Write-Host ""
        Write-Success "Registry is ready. Run Deploy-FeatBitClusters.ps1 to deploy to Minikube."
    }
}

# ── Entry point ───────────────────────────────────────────────────────────────

if ($WhatIfPreference)
{
    Write-Host "`n[WhatIf] Dry-run mode — no changes will be made.`n" -ForegroundColor Magenta
}

Resolve-ContainerRuntime
Assert-RuntimeDaemon
Initialize-Registry

foreach ($key in $Images)
{
    $def = $imageDefinitions[$key]
    if (-not $def)
    {
        Write-Warn "Unknown image key '$key' — skipping."
        continue
    }

    Invoke-ImageBuild -ImageKey $key -Definition $def
}

Write-Summary
