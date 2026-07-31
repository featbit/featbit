<#
.SYNOPSIS
    Builds FeatBit Docker images from source and pushes them to the local registry.

.DESCRIPTION
    Builds one or more FeatBit application images from the repository source and
    pushes them to a Docker registry (default: localhost:5000).

    Images built:
    - featbit-api-server         (modules/back-end)
    - featbit-ui                 (modules/front-end)
    - featbit-evaluation-server  (modules/evaluation-server)
    - featbit-control-plane      (modules/control-plane)
    - featbit-data-analytics-server (modules/data-analytics)

    The local registry container (localhost:5000) is started automatically if it
    is not already running.

.PARAMETER Images
    One or more image names to build. Defaults to all five images.
    Valid values: api-server, ui, evaluation-server, control-plane, data-analytics-server

.PARAMETER Registry
    Registry to tag and push images to. Defaults to localhost:5000.

.PARAMETER Tag
    Image tag to apply. Defaults to latest.

.PARAMETER NoPush
    Build images but do not push them to the registry.

.PARAMETER Force
    Rebuild images even if they are already present locally.

.PARAMETER WhatIf
    Dry-run mode. Reports what would be built and pushed without making any changes.

.EXAMPLE
    .\Build-FeatBitImages.ps1
    Builds all five images and pushes them to localhost:5000.

.EXAMPLE
    .\Build-FeatBitImages.ps1 -Images api-server, ui
    Builds only the API server and UI images.

.EXAMPLE
    .\Build-FeatBitImages.ps1 -Registry myregistry.example.com:5000 -Tag 1.2.3
    Builds all images and pushes them to a custom registry with a specific tag.

.EXAMPLE
    .\Build-FeatBitImages.ps1 -NoPush
    Builds all images locally without pushing.
#>

[CmdletBinding(SupportsShouldProcess)]
param(
    [ValidateSet("api-server", "ui", "evaluation-server", "control-plane", "data-analytics-server")]
    [string[]]$Images = @("api-server", "ui", "evaluation-server", "control-plane", "data-analytics-server"),

    [string]$Registry = "localhost:5000",

    [string]$Tag = "latest",

    [switch]$NoPush,

    # Deprecated (rebuild is now the default); kept so existing invocations don't break.
    [switch]$Force,

    # Opt-in: skip the docker build when the local tag already exists and only push it.
    # DANGEROUS with a floating tag like :latest — the local tag can be arbitrarily stale
    # (this exact trap shipped 11-day-old images while reporting "built and pushed"; #112).
    # Docker's own layer cache already makes a no-change rebuild take seconds, so the
    # default is to ALWAYS rebuild.
    [switch]$SkipIfExists
)

$ErrorActionPreference = "Stop"

Set-StrictMode -Version Latest

# ── Paths ─────────────────────────────────────────────────────────────────────

$repoRoot   = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)))
$modulesDir = Join-Path $repoRoot "modules"

# Map each short name to its Dockerfile path and build context (both relative to repo root).
$imageDefs = [ordered]@{
    "api-server" = @{
        ImageName  = "featbit-api-server"
        Dockerfile = "modules/back-end/deploy/Dockerfile"
        Context    = "modules/back-end"
    }
    "ui" = @{
        ImageName  = "featbit-ui"
        Dockerfile = "modules/front-end/Dockerfile"
        Context    = "modules/front-end"
    }
    "evaluation-server" = @{
        ImageName  = "featbit-evaluation-server"
        Dockerfile = "modules/evaluation-server/deploy/Dockerfile"
        Context    = "modules/evaluation-server"
    }
    "control-plane" = @{
        ImageName  = "featbit-control-plane"
        # The Dockerfile copies from both control-plane/ and back-end/ so the
        # build context must be the modules/ directory.
        Dockerfile = "modules/control-plane/deploy/Dockerfile"
        Context    = "modules"
    }
    "data-analytics-server" = @{
        ImageName  = "featbit-data-analytics-server"
        Dockerfile = "modules/data-analytics/Dockerfile"
        Context    = "modules/data-analytics"
    }
}

# ── Console helpers ───────────────────────────────────────────────────────────

function Write-Step  { param([string]$m) Write-Host "`n=== $m ===" -ForegroundColor Cyan }
function Write-Success { param([string]$m) Write-Host "✓ $m" -ForegroundColor Green }
function Write-Info  { param([string]$m) Write-Host "  $m" -ForegroundColor Gray }
function Write-Warn  { param([string]$m) Write-Host "⚠ $m" -ForegroundColor Yellow }
function Write-Fail  { param([string]$m) Write-Host "✗ $m" -ForegroundColor Red }

# ── Local registry ────────────────────────────────────────────────────────────

function Assert-LocalRegistry
{
    if ($Registry -ne "localhost:5000") { return }  # User is targeting a different registry

    $running = docker ps --filter "name=^registry$" --filter "status=running" --format "{{.Names}}" 2>$null |
               Where-Object { $_ -eq "registry" }

    if ($running)
    {
        Write-Success "Local registry is running."
        return
    }

    if ($WhatIfPreference)
    {
        Write-Warn "[WhatIf] Would start local registry container."
        return
    }

    Write-Info "Starting local registry..."
    $stopped = docker ps -a --filter "name=^registry$" --format "{{.Names}}" 2>$null |
               Where-Object { $_ -eq "registry" }

    if ($stopped)
    {
        docker start registry | Out-Null
    }
    else
    {
        docker run -d --restart=always --name registry -p 5000:5000 registry:2 | Out-Null
    }

    if ($LASTEXITCODE -ne 0)
    {
        Write-Fail "Failed to start local registry."
        exit 1
    }

    Write-Success "Local registry started."
}

# ── Build + push ──────────────────────────────────────────────────────────────

function Build-Image
{
    param(
        [string]$ShortName,
        [hashtable]$Def
    )

    $fullTag    = "$Registry/featbit/$($Def.ImageName):$Tag"
    $dockerfile = Join-Path $repoRoot $Def.Dockerfile
    $context    = Join-Path $repoRoot $Def.Context

    Write-Step "$ShortName → $fullTag"

    if (-not (Test-Path $dockerfile))
    {
        Write-Fail "Dockerfile not found: $dockerfile"
        exit 1
    }

    if (-not (Test-Path $context))
    {
        Write-Fail "Build context not found: $context"
        exit 1
    }

    # Rebuild by default (#112): docker's layer cache makes no-change rebuilds cheap, and
    # skipping on tag existence silently shipped stale images while the summary claimed
    # "built and pushed". Only -SkipIfExists (and not -Force) takes the fast path, and the
    # skip is recorded so the summary tells the truth.
    if ($SkipIfExists -and -not $Force)
    {
        $existing = docker images --format "{{.Repository}}:{{.Tag}}" 2>$null |
                    Where-Object { $_ -eq $fullTag }
        if ($existing)
        {
            $created = docker inspect $fullTag --format '{{.Created}}' 2>$null
            Write-Warn "Skipping build (-SkipIfExists): pushing EXISTING local image created $created"
            $script:skippedBuilds += $ShortName
            if (-not $NoPush)
            {
                Push-Image -FullTag $fullTag
            }
            return
        }
    }

    if ($WhatIfPreference)
    {
        Write-Warn "[WhatIf] Would run: docker build -f $dockerfile -t $fullTag $context"
        return
    }

    Write-Info "Building..."
    docker build -f $dockerfile -t $fullTag $context
    if ($LASTEXITCODE -ne 0)
    {
        Write-Fail "Build failed for $ShortName."
        exit 1
    }

    # Provenance: pin what source this image was built from, so deploy logs can verify
    # the running image matches the intended commit (#112).
    $describe = git -C $repoRoot describe --always --dirty 2>$null
    Write-Success "Built $fullTag (source: $describe)"

    if (-not $NoPush)
    {
        Push-Image -FullTag $fullTag
    }
}

function Push-Image
{
    param([string]$FullTag)

    if ($WhatIfPreference)
    {
        Write-Warn "[WhatIf] Would run: docker push $FullTag"
        return
    }

    Write-Info "Pushing $FullTag..."
    docker push $FullTag
    if ($LASTEXITCODE -ne 0)
    {
        Write-Fail "Push failed for $FullTag."
        exit 1
    }

    Write-Success "Pushed $FullTag"
}

# ── Entry point ───────────────────────────────────────────────────────────────

if ($WhatIfPreference)
{
    Write-Host "`n[WhatIf] Dry-run mode — no changes will be made.`n" -ForegroundColor Magenta
}

Write-Host "Registry : $Registry" -ForegroundColor Cyan
Write-Host "Tag      : $Tag"      -ForegroundColor Cyan
Write-Host "Images   : $($Images -join ', ')" -ForegroundColor Cyan

if (-not $NoPush)
{
    Assert-LocalRegistry
}

$failed = @()
$script:skippedBuilds = @()

foreach ($name in $Images)
{
    $def = $imageDefs[$name]
    try
    {
        Build-Image -ShortName $name -Def $def
    }
    catch
    {
        Write-Fail "Unexpected error building ${name}: $_"
        $failed += $name
    }
}

# ── Summary ───────────────────────────────────────────────────────────────────

Write-Step "Summary"

foreach ($name in $Images)
{
    $def     = $imageDefs[$name]
    $fullTag = "$Registry/featbit/$($def.ImageName):$Tag"

    if ($name -in $failed)
    {
        Write-Fail "$name — FAILED"
    }
    elseif ($name -in $script:skippedBuilds)
    {
        # Truthful summary (#112): a skipped build must never read as a fresh one.
        Write-Warn "$($def.ImageName):$Tag — pushed EXISTING image (build skipped via -SkipIfExists)"
    }
    else
    {
        $verb = if ($NoPush) { "built" } else { "built and pushed" }
        if ($WhatIfPreference) { $verb = "would be built" }
        Write-Success "$($def.ImageName):$Tag — $verb"
    }
}

if ($failed.Count -gt 0)
{
    Write-Host ""
    Write-Fail "$($failed.Count) image(s) failed to build: $($failed -join ', ')"
    exit 1
}

Write-Host ""
Write-Success "Done. Run .\Deploy-FeatBitClusters.ps1 to deploy."
