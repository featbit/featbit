<#
.SYNOPSIS
    Build FeatBit-instrumented OpenTelemetry Demo component images and push them
    to the local registry the clusters pull from (localhost:5000).

.DESCRIPTION
    The repo only vendors the otel-demo Helm chart, so to add FeatBit feature
    flags inside a component we fork that component's source, overlay our changes,
    and build a custom image. This script:

      1. Shallow-clones the upstream OpenTelemetry Demo at a PINNED version into
         ./build/otel-demo-src (sparse: only the components we customize + pb).
      2. Overlays our modified files from ./custom/<component>/ onto
         src/<component>/ in the clone.
      3. docker build + push  localhost:5000/otel-demo/<component>:featbit-<ver>.

    Our custom image must match the demo version the chart deploys (proto/gRPC
    contract), hence the pin. No sudo: docker runs as the user (docker group).

.PARAMETER Components
    Which components to build. Default: every directory under ./custom.

.PARAMETER DemoVersion
    Upstream opentelemetry-demo tag to fork from. Default 2.2.0.

.PARAMETER Registry / Repo
    Image destination. Default localhost:5000 / otel-demo.

.EXAMPLE
    pwsh ./Build-OtelDemoImages.ps1
    pwsh ./Build-OtelDemoImages.ps1 -Components recommendation -DemoVersion 2.2.0
#>
[CmdletBinding()]
param(
    [string[]]$Components,
    [string]$DemoVersion = "2.2.0",
    # Registry + repo are configurable; defaults target the shared local registry
    # (localhost:5000/otel-demo) that Deploy-OtelDemo.ps1 also defaults to, so the
    # out-of-the-box flow needs no registry configuration. Override both for a
    # private registry, e.g. -Registry harbor.tekgeek.io -Repo apps/otel-demo
    # (and pass the same -Registry/-Repo to Deploy-OtelDemo.ps1).
    [string]$Registry = "localhost:5000",
    [string]$Repo = "otel-demo"
)

$ErrorActionPreference = "Stop"

function Write-Step { param([string]$M) Write-Host "`n=== $M ===" -ForegroundColor Cyan }
function Write-Ok   { param([string]$M) Write-Host "✓ $M" -ForegroundColor Green }
function Write-Info { param([string]$M) Write-Host "  $M" -ForegroundColor Gray }
function Write-Fail { param([string]$M) Write-Host "✗ $M" -ForegroundColor Red }

$root      = $PSScriptRoot
$customDir = Join-Path $root "custom"
$buildSrc  = Join-Path $root "build/otel-demo-src"
$tag       = "featbit-$DemoVersion"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { Write-Fail "docker not found"; exit 1 }
& docker info *> $null
if ($LASTEXITCODE -ne 0) { Write-Fail "Docker daemon not reachable as this user (docker group?)."; exit 1 }

if (-not $Components -or $Components.Count -eq 0) {
    $Components = Get-ChildItem -Path $customDir -Directory | ForEach-Object { $_.Name }
}
if (-not $Components -or $Components.Count -eq 0) { Write-Fail "No components under $customDir"; exit 1 }
Write-Info "Components: $($Components -join ', ')  |  demo $DemoVersion  |  tag $tag"

# ── 1. Clone / refresh upstream at the pinned version (sparse) ──────────────────
Write-Step "Fetching upstream opentelemetry-demo $DemoVersion"
$sparsePaths = @("pb") + ($Components | ForEach-Object { "src/$_" })

$needClone = $true
if (Test-Path (Join-Path $buildSrc ".git")) {
    $have = (& git -C $buildSrc describe --tags 2>$null | Out-String).Trim()
    if ($have -eq $DemoVersion) { $needClone = $false }
}
if ($needClone) {
    if (Test-Path $buildSrc) { Remove-Item -Recurse -Force $buildSrc }
    & git clone --depth 1 --branch $DemoVersion --filter=blob:none --sparse `
        https://github.com/open-telemetry/opentelemetry-demo $buildSrc
    if ($LASTEXITCODE -ne 0) { Write-Fail "git clone failed"; exit 1 }
}
& git -C $buildSrc sparse-checkout set @sparsePaths
if ($LASTEXITCODE -ne 0) { Write-Fail "sparse-checkout failed"; exit 1 }
Write-Ok "Upstream source ready at $buildSrc"

# ── 2 + 3. Overlay our changes and build each component ─────────────────────────
$built = @()
foreach ($comp in $Components) {
    Write-Step "Building $comp"
    $compCustom = Join-Path $customDir $comp
    $compSrc    = Join-Path $buildSrc "src/$comp"
    if (-not (Test-Path $compCustom)) { Write-Fail "No custom overlay at $compCustom"; exit 1 }
    if (-not (Test-Path $compSrc))    { Write-Fail "Upstream src/$comp not found (bad component or version)"; exit 1 }

    Write-Info "Overlaying $compCustom -> src/$comp"
    Copy-Item -Path (Join-Path $compCustom "*") -Destination $compSrc -Recurse -Force

    $image      = "$Registry/$Repo/${comp}:$tag"
    # Most components keep their Dockerfile at src/<comp>/Dockerfile, but a few
    # (e.g. cart) nest it at src/<comp>/src/Dockerfile. Detect it.
    $dockerfile = @("src/$comp/Dockerfile", "src/$comp/src/Dockerfile") |
        Where-Object { Test-Path (Join-Path $buildSrc $_) } | Select-Object -First 1
    if (-not $dockerfile) { Write-Fail "No Dockerfile found for $comp"; exit 1 }

    # Some component Dockerfiles need build args the demo normally sets via its
    # compose/Makefile (e.g. ad needs OTEL_JAVA_AGENT_VERSION for the agent
    # download). Source them from the demo's .env so direct docker build works.
    $buildArgs = @()
    $envFile = Join-Path $buildSrc ".env"
    if (Test-Path $envFile) {
        foreach ($k in @("OTEL_JAVA_AGENT_VERSION")) {
            $m = Select-String -Path $envFile -Pattern "^$k=(.+)$" | Select-Object -First 1
            if ($m) { $buildArgs += @("--build-arg", "$k=$($m.Matches[0].Groups[1].Value.Trim())") }
        }
    }
    Write-Info "docker build -f $dockerfile -t $image (context: $buildSrc) $($buildArgs -join ' ')"
    & docker build --pull -f (Join-Path $buildSrc $dockerfile) -t $image @buildArgs $buildSrc
    if ($LASTEXITCODE -ne 0) { Write-Fail "docker build failed for $comp"; exit 1 }

    & docker push $image
    if ($LASTEXITCODE -ne 0) { Write-Fail "docker push failed for $image"; exit 1 }
    Write-Ok "$image"
    $built += $image
}

Write-Step "Done"
$built | ForEach-Object { Write-Host "  $_" -ForegroundColor Green }
