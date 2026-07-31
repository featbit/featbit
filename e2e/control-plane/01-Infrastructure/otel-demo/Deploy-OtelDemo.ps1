<#
.SYNOPSIS
    Deploy the FeatBit-instrumented OpenTelemetry Demo to the test clusters.

.DESCRIPTION
    Installs the upstream otel-demo Helm chart (pinned to the chart version whose
    appVersion matches our custom images) with two overlays:
      values-min.yaml      - minimal-footprint resource caps (laptop capacity)
      values-featbit.yaml  - non-image settings (FeatBit eval URLs, etc.)
    Per-component image references (repository/tag/pullPolicy) are injected at
    deploy time via --set-string, built from -Registry/-Repo, so the same
    values-featbit.yaml works for every operator regardless of where images were
    pushed (see Build-OtelDemoImages.ps1). The FeatBit env SECRET is also
    injected at deploy time (--set-string), never stored in git.

    For each FeatBit-instrumented component, a hostAlias is added so the pod
    resolves the eval hostname (featbit-eval.127.0.0.1.sslip.io) to the cluster's
    host gateway, where the host proxy load-balances to the eval-servers
    (west primary / east failover — active/passive, west active). This avoids
    modifying shared cluster DNS (CoreDNS).

.PARAMETER FeatBitSecret
    The environment SERVER SDK secret (from Provision-FeatBitFlags.py). Defaults to
    the FEATBIT_ENV_SECRET environment variable.

.PARAMETER Contexts        kube contexts to deploy to (default west, east).
.PARAMETER Namespace       target namespace (default otel-demo).
.PARAMETER ChartVersion    otel-demo chart version (default 0.40.9 == appVersion 2.2.0).
.PARAMETER FeatBitComponents  components wired to FeatBit needing the eval hostAlias and
                              a custom image. Defaults to every directory under ./custom
                              (the same source of truth Build-OtelDemoImages.ps1 uses),
                              so the two scripts never drift out of sync.
.PARAMETER EvalHost        eval hostname the SDK URLs use (must match values-featbit.yaml).
.PARAMETER Registry        Image registry to pull component images from. Default
                           localhost:5000 (the shared local registry used by
                           Deploy-FeatBitClusters.ps1). Matches Build-OtelDemoImages.ps1's
                           default -Registry.
.PARAMETER Repo            Repository path under -Registry. Default otel-demo.
                           Matches Build-OtelDemoImages.ps1's default -Repo.
.PARAMETER DemoVersion     Upstream opentelemetry-demo version the images were built
                           from; combines with -Registry/-Repo to form the image tag
                           (featbit-<DemoVersion>). Must match Build-OtelDemoImages.ps1's
                           -DemoVersion. Default 2.2.0.
.PARAMETER CustomRegistryCredential
    Credential used to create an image pull secret in the otel-demo namespace when
    -Registry is not the local registry. Defaults to the CUSTOM_REGISTRY_USERNAME /
    CUSTOM_REGISTRY_PASSWORD keys in deployment.env (same mechanism
    Deploy-FeatBitClusters.ps1 uses) via Import-DeploymentEnv.ps1.
.PARAMETER CustomRegistrySecretName
    Name of the image pull secret created/patched when using a non-local registry.
    Defaults to the CUSTOM_REGISTRY_SECRET_NAME deployment.env key, or
    "registry-credentials".

.EXAMPLE
    pwsh ./Deploy-OtelDemo.ps1 -FeatBitSecret nBAn8sn86Uq-...
    Uses the default local registry (localhost:5000/otel-demo); no pull secret needed.

.EXAMPLE
    pwsh ./Deploy-OtelDemo.ps1 -Contexts west -FeatBitSecret $env:FEATBIT_ENV_SECRET

.EXAMPLE
    pwsh ./Deploy-OtelDemo.ps1 -Registry harbor.tekgeek.io -Repo apps/otel-demo -FeatBitSecret ...
    Pre-parameterization ("old flow") equivalent: pulls images from a private Harbor
    instance instead of the local registry. Set CUSTOM_REGISTRY_USERNAME /
    CUSTOM_REGISTRY_PASSWORD in deployment.env (or pass -CustomRegistryCredential) if
    that registry requires authentication, so the otel-demo namespace gets a pull secret.
#>
[CmdletBinding()]
param(
    # JSON emitted by Provision-FeatBitFlags.py: [{component, server_secret, ...}].
    # Each component is its own FeatBit project with its own server secret.
    [string]$ProvisionFile,
    [string[]]$Contexts = @("west", "east"),
    [string]$Namespace = "otel-demo",
    [string]$ChartVersion = "0.40.9",
    [string[]]$FeatBitComponents,
    [string]$EvalHost = "featbit-eval.127.0.0.1.sslip.io",
    # Registry + repo the component images are pulled from. Defaults match
    # Build-OtelDemoImages.ps1's defaults (the local registry). Override both
    # (e.g. -Registry harbor.tekgeek.io -Repo apps/otel-demo) to pull from a
    # private registry instead.
    [string]$Registry = "localhost:5000",
    [string]$Repo = "otel-demo",
    [string]$DemoVersion = "2.2.0",
    [PSCredential]$CustomRegistryCredential,
    [string]$CustomRegistrySecretName = "registry-credentials"
)

$ErrorActionPreference = "Stop"
function Write-Step { param([string]$M) Write-Host "`n=== $M ===" -ForegroundColor Cyan }
function Write-Ok   { param([string]$M) Write-Host "✓ $M" -ForegroundColor Green }
function Write-Info { param([string]$M) Write-Host "  $M" -ForegroundColor Gray }
function Write-Fail { param([string]$M) Write-Host "✗ $M" -ForegroundColor Red }

# Tracks whether any per-component step failed so the script's own exit code
# reflects the whole run, not just the last kubectl call (a failure earlier in
# the per-component loop must not be silently overwritten/masked by later
# successful calls).
$script:hadFailure = $false

$root       = $PSScriptRoot
$infraRoot  = Split-Path $root -Parent
$valuesMin  = Join-Path $root "values-min.yaml"
$valuesFb   = Join-Path $root "values-featbit.yaml"
foreach ($f in @($valuesMin, $valuesFb)) { if (-not (Test-Path $f)) { Write-Fail "Missing $f"; exit 1 } }

# Ensure-CustomRegistryImagePullSecret / Ensure-DefaultServiceAccountImagePullSecret,
# shared with Deploy-FeatBitClusters.ps1 so both scripts wire pull secrets identically.
. (Join-Path $infraRoot "Set-RegistryPullSecrets.ps1")
# Get-OtelImageArgs — see Get-OtelImageArgs.ps1 for why it's split out (testability).
. (Join-Path $root "Get-OtelImageArgs.ps1")

# Single source of truth for the component list: every directory under ./custom
# (the same list Build-OtelDemoImages.ps1 builds images for by default), so the
# two scripts can never drift out of sync.
if (-not $FeatBitComponents -or $FeatBitComponents.Count -eq 0) {
    $customDir = Join-Path $root "custom"
    $FeatBitComponents = Get-ChildItem -Path $customDir -Directory | ForEach-Object { $_.Name }
}
if (-not $FeatBitComponents -or $FeatBitComponents.Count -eq 0) { Write-Fail "No components found (pass -FeatBitComponents or check ./custom)"; exit 1 }

$imageTag = "featbit-$DemoVersion"

# Only the local registry is assumed to need no authentication; anything else
# gets a pull secret wired into the chart (see -CustomRegistryCredential).
$isLocalRegistry = $Registry -match '^(localhost|127\.0\.0\.1|host\.minikube\.internal)(:\d+)?$'

# Load deployment.env defaults for the pull-secret credential/name only (Registry/Repo
# are otel-demo-specific and are NOT tied to Deploy-FeatBitClusters.ps1's
# CUSTOM_IMAGE_REGISTRY, which serves a different purpose/registry).
$envDefaults = & (Join-Path $infraRoot "Import-DeploymentEnv.ps1")
if (-not $PSBoundParameters.ContainsKey('CustomRegistryCredential') -and $envDefaults.ContainsKey('CustomRegistryCredential')) {
    $CustomRegistryCredential = $envDefaults['CustomRegistryCredential']
}
if (-not $PSBoundParameters.ContainsKey('CustomRegistrySecretName') -and $envDefaults.ContainsKey('CustomRegistrySecretName')) {
    $CustomRegistrySecretName = $envDefaults['CustomRegistrySecretName']
}

if (-not $isLocalRegistry -and -not $CustomRegistryCredential) {
    Write-Info "Registry '$Registry' is not the local registry and no pull credentials were supplied"
    Write-Info "(via deployment.env CUSTOM_REGISTRY_USERNAME/CUSTOM_REGISTRY_PASSWORD or -CustomRegistryCredential)."
    Write-Info "If '$Registry' requires authentication, otel-demo pods will fail with ImagePullBackOff."
}

# Map component -> server secret from the provision file.
if (-not $ProvisionFile) { $ProvisionFile = Join-Path $root "build/featbit-otel-provision.json" }
if (-not (Test-Path $ProvisionFile)) {
    Write-Fail "Provision file not found: $ProvisionFile"
    Write-Info "Run: python3 Provision-FeatBitFlags.py --api http://featbit-api-west.127.0.0.1.sslip.io:8080 > $ProvisionFile"
    exit 1
}
$secretByComp = @{}
foreach ($r in (Get-Content $ProvisionFile -Raw | ConvertFrom-Json)) { $secretByComp[$r.component] = $r.server_secret }
foreach ($comp in $FeatBitComponents) {
    if (-not $secretByComp[$comp]) { Write-Fail "No server secret for '$comp' in $ProvisionFile (provision it first)"; exit 1 }
}

Write-Step "Helm repo"
& helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts *> $null
& helm repo update open-telemetry *> $null
Write-Ok "open-telemetry/opentelemetry-demo $ChartVersion"

function Get-HostGatewayIp([string]$ctx) {
    # CoreDNS maps host.minikube.internal -> the cluster's host gateway IP.
    $corefile = & kubectl --context $ctx -n kube-system get cm coredns -o jsonpath='{.data.Corefile}'
    foreach ($line in ($corefile -split "`n")) {
        if ($line -match '^\s*([0-9.]+)\s+host\.minikube\.internal\s*$') { return $Matches[1] }
    }
    throw "Could not resolve host gateway IP (host.minikube.internal) for context $ctx"
}

foreach ($ctx in $Contexts) {
    Write-Step "Deploying otel-demo to '$ctx'"

    # Namespace must exist before we can create the pull secret in it; helm's
    # --create-namespace would otherwise race the kubectl secret creation below.
    & kubectl --context $ctx create namespace $Namespace --dry-run=client -o yaml | & kubectl --context $ctx apply -f - *> $null
    if ($LASTEXITCODE -ne 0) { Write-Fail "namespace ensure failed for $ctx"; exit 1 }

    $pullSecretArgs = @()
    if (-not $isLocalRegistry -and $CustomRegistryCredential) {
        Ensure-CustomRegistryImagePullSecret -ClusterContext $ctx -Namespace $Namespace -Registry $Registry -Credential $CustomRegistryCredential -SecretName $CustomRegistrySecretName
        # Defensive backstop for anything that falls back to the namespace's
        # default ServiceAccount. The otel-demo chart itself does NOT use it
        # (it assigns its own release-scoped ServiceAccount), so the pull
        # secret must ALSO be wired directly via default.image.pullSecrets,
        # which templates/_objects.tpl applies to every component's pod spec.
        Ensure-DefaultServiceAccountImagePullSecret -ClusterContext $ctx -Namespace $Namespace -SecretName $CustomRegistrySecretName
        $pullSecretArgs = @("--set-string", "default.image.pullSecrets[0].name=$CustomRegistrySecretName")
    }

    $imageArgs = Get-OtelImageArgs -Components $FeatBitComponents -Registry $Registry -Repo $Repo -Tag $imageTag

    # Each FeatBit component's OWN secret, appended as its envOverrides[2]
    # (values-featbit.yaml supplies [0]=EVENT_URL, [1]=STREAMING_URL).
    $secretArgs = @()
    foreach ($comp in $FeatBitComponents) {
        $secretArgs += @(
            "--set-string", "components.$comp.envOverrides[2].name=FEATBIT_ENV_SECRET",
            "--set-string", "components.$comp.envOverrides[2].value=$($secretByComp[$comp])"
        )
    }

    & helm upgrade --install otel-demo open-telemetry/opentelemetry-demo `
        --version $ChartVersion --kube-context $ctx `
        --namespace $Namespace --create-namespace `
        -f $valuesMin -f $valuesFb @imageArgs @pullSecretArgs @secretArgs --timeout 10m
    if ($LASTEXITCODE -ne 0) { Write-Fail "helm upgrade failed for $ctx"; exit 1 }
    Write-Ok "helm release applied to $ctx"

    # hostAlias so FeatBit-wired pods resolve the eval hostname to the host proxy.
    $gw = Get-HostGatewayIp $ctx
    Write-Info "host gateway for ${ctx}: $gw  ($EvalHost -> $gw)"
    foreach ($comp in $FeatBitComponents) {
        $patch = @{ spec = @{ template = @{ spec = @{ hostAliases = @(@{ ip = $gw; hostnames = @($EvalHost) }) } } } } | ConvertTo-Json -Depth 10 -Compress
        & kubectl --context $ctx -n $Namespace patch deployment $comp --type merge -p $patch *> $null
        if ($LASTEXITCODE -eq 0) { Write-Ok "hostAlias patched on $comp ($ctx)" }
        else { Write-Fail "hostAlias patch failed on $comp ($ctx)"; $script:hadFailure = $true }
        & kubectl --context $ctx -n $Namespace rollout status deployment/$comp --timeout=180s *> $null
        if ($LASTEXITCODE -eq 0) { Write-Ok "rollout ready: $comp ($ctx)" }
        else { Write-Fail "rollout not ready: $comp ($ctx)"; $script:hadFailure = $true }
    }
    Write-Ok "$ctx deploy complete"
}

Write-Step "Done"
Write-Info "Access (host proxy): http://featbit.127.0.0.1.sslip.io:8080"
Write-Info "Recommendation flags: otel-recommendation project in FeatBit"

if ($script:hadFailure) {
    Write-Fail "One or more components failed to patch/roll out (see ✗ lines above) — exiting non-zero."
    exit 1
}
