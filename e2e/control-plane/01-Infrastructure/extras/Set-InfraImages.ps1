#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Rewrites infrastructure YAML image references for a custom container registry.

.DESCRIPTION
    Scans all YAML files under the kubernetes/ directory and rewrites image
    references defined in kubernetes/infra-image-map.json so they point to
    your custom or corporate registry.

    Each image is rewritten as:
        {CustomImageRegistry}/{registryPath}

    The registryPath for each image is the value defined in infra-image-map.json.
    By default these equal the standard Docker Hub paths, making a simple mirror
    (Nexus, Artifactory, ECR) work without any extra configuration.

    For proxies with non-standard namespacing (e.g. Harbor), edit the
    registryPath values in kubernetes/infra-image-map.json to match your
    registry's layout before running this script.

    Generated YAML files are written to kubernetes/.generated/ (gitignored) by
    default, mirroring the source directory structure.  Source-controlled files
    are never modified.

    Use -Reset to produce reset copies (plain Docker Hub image names) in the
    generated directory instead of applying the custom registry prefix.

    Use -WhatIf to preview which files would be generated without writing anything.

.PARAMETER CustomImageRegistry
    Hostname (and optional port) of the custom registry, e.g. myregistry.example.com
    or myregistry.example.com:5000.

.PARAMETER Reset
    Generate YAML copies with all image references reverted to their default
    Docker Hub names.  Cannot be combined with -CustomImageRegistry.

.PARAMETER MapFile
    Path to a custom image-map JSON file.
    Defaults to kubernetes/infra-image-map.json relative to this script.

.PARAMETER OutputDirectory
    Root directory for generated YAML files.  Defaults to kubernetes/.generated/
    relative to the repository root.  The source directory structure is mirrored
    beneath this path so files are easy to locate and apply directly with kubectl.

.PARAMETER PullSecretName
    Name of the image pull secret referenced in generated YAML files.  Defaults
    to "registry-credentials" (the baked-in name in every committed manifest).
    Set this when CUSTOM_REGISTRY_SECRET_NAME is overridden in deployment.env
    so the imagePullSecrets entries in generated YAML match the actual secret
    that Deploy-FeatBitClusters.ps1 created in each namespace.

.PARAMETER Apply
    One or more kubectl context names to apply the generated manifests to after
    generating them.  Example: -Apply west,east
    The infrastructure manifests are applied from .generated/<context>/infrastructure/
    and the application manifests from .generated/<context>/application/.

.EXAMPLE
    .\Set-InfraImages.ps1 -CustomImageRegistry myregistry.example.com
    Generates all infra images to kubernetes/.generated/ using myregistry.example.com.

.EXAMPLE
    .\Set-InfraImages.ps1 -CustomImageRegistry myregistry.example.com -WhatIf
    Preview changes without writing any files.

.EXAMPLE
    .\Set-InfraImages.ps1 -CustomImageRegistry myregistry.example.com -Apply west,east
    Generate manifests, then apply to both west and east clusters.

.EXAMPLE
    .\Set-InfraImages.ps1 -Reset
    Generate YAML copies with plain Docker Hub image names.
#>
[CmdletBinding(SupportsShouldProcess, DefaultParameterSetName = "Apply")]
param(
    [Parameter(ParameterSetName = "Apply", Mandatory)]
    [string]$CustomImageRegistry,

    [Parameter(ParameterSetName = "Reset", Mandatory)]
    [switch]$Reset,

    [string]$MapFile = "",

    # Where to write the generated YAML files.  Defaults to kubernetes/.generated/
    # relative to the repository root.  Source-controlled files are never modified.
    [string]$OutputDirectory = "",

    # Rewrites the `name: registry-credentials` entries inside imagePullSecrets
    # blocks to the supplied secret name. Leave at the default to keep manifests
    # using the committed default secret name.
    [string]$PullSecretName = "registry-credentials",

    # Kubectl contexts to apply the generated manifests to after generating them.
    # E.g. -Apply west,east
    [string[]]$Apply = @()
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)))
$defaultMapPath = Join-Path $repoRoot "kubernetes\infra-image-map.json"
$localMapPath   = Join-Path $repoRoot "kubernetes\infra-image-map.local.json"
$mapPath = if ($MapFile) { $MapFile } else { $defaultMapPath }

# Root for generated output files.  Source files under kubernetes/ are mirrored
# here so the directory structure is preserved and files can be applied directly.
$kubernetesRoot  = Join-Path $repoRoot "kubernetes"
$generatedRoot   = if ($OutputDirectory) { $OutputDirectory } else { Join-Path $repoRoot "kubernetes\.generated" }

if (-not (Test-Path $mapPath)) {
    Write-Error "Image map file not found: $mapPath"
    exit 1
}

# Load the image map as a plain hashtable (compatible with PS 5.1 and PS 7+).
$imageMap = @{}
$jsonData = Get-Content $mapPath -Raw | ConvertFrom-Json
$jsonData.images.PSObject.Properties | ForEach-Object {
    $imageMap[$_.Name] = $_.Value
}

# Merge the local override (gitignored) when using the default map path.
# Entries in the local file take precedence, allowing per-registry path overrides
# without touching committed files.
if (-not $MapFile -and (Test-Path $localMapPath)) {
    Write-Host "  Merging local overlay: kubernetes\infra-image-map.local.json" -ForegroundColor DarkGray
    $localData = Get-Content $localMapPath -Raw | ConvertFrom-Json
    $localData.images.PSObject.Properties | ForEach-Object {
        $imageMap[$_.Name] = $_.Value
    }
}

if ($imageMap.Count -eq 0) {
    Write-Warning "Image map is empty. Nothing to do."
    exit 0
}

Write-Host ""
if ($Reset) {
    Write-Host "Mode: Reset to Docker Hub defaults" -ForegroundColor Cyan
}
else {
    Write-Host "Mode: Apply custom registry '$CustomImageRegistry'" -ForegroundColor Cyan
}
Write-Host ""

$yamlFiles = Get-ChildItem (Join-Path $repoRoot "kubernetes") -Recurse -Include "*.yaml", "*.yml"

$changedCount = 0

foreach ($file in $yamlFiles) {
    $content = Get-Content $file.FullName -Raw
    if (-not $content) {
        continue
    }

    $modified = $content

    foreach ($defaultImage in $imageMap.Keys) {
        $registryPath = $imageMap[$defaultImage]
        $escapedDefault = [regex]::Escape($defaultImage)
        $escapedPath    = [regex]::Escape($registryPath)

        if ($Reset) {
            # Replace <any-registry>/registryPath with the bare defaultImage.
            # The \S+ before the first / matches any registry hostname.
            $modified = $modified -replace "(\bimage:\s+)\S+/${escapedPath}\b", "`${1}${defaultImage}"
        }
        else {
            # Replace bare defaultImage with <registry>/registryPath.
            # Only match if not already prefixed by a registry hostname.
            $modified = $modified -replace "(\bimage:\s+)${escapedDefault}\b", "`${1}${CustomImageRegistry}/${registryPath}"
        }
    }

    # Rewrite the imagePullSecrets reference to use the supplied secret name when
    # it differs from the committed default. Skipped in -Reset mode so the
    # generated copies restore the manifest defaults exactly.
    if (-not $Reset -and $PullSecretName -and $PullSecretName -ne "registry-credentials") {
        $modified = $modified -replace "(\bname:\s+)registry-credentials\b", "`${1}${PullSecretName}"
    }

    if ($modified -ne $content) {
        $changedCount++

        # Compute the relative path from the kubernetes/ root and mirror it
        # under the generated root so the layout is predictable and inspectable.
        $relPath  = $file.FullName.Substring($kubernetesRoot.Length).TrimStart('\', '/')
        $destPath = Join-Path $generatedRoot $relPath

        if ($PSCmdlet.ShouldProcess($relPath, "Generate into $destPath")) {
            # Preserve the original line ending style.
            $hasCrlf = $content -match "`r`n"
            if ($hasCrlf) {
                $modified = $modified -replace "(?<!`r)`n", "`r`n"
            }

            $destDir = Split-Path $destPath -Parent
            if (-not (Test-Path $destDir)) {
                New-Item $destDir -ItemType Directory -Force | Out-Null
            }
            [System.IO.File]::WriteAllText($destPath, $modified)
            Write-Host "  Generated : $relPath" -ForegroundColor Green
        }
        else {
            Write-Host "  Would generate: $relPath -> $destPath" -ForegroundColor Cyan
        }
    }
}

Write-Host ""
if ($WhatIfPreference) {
    Write-Host "$changedCount file(s) would be generated." -ForegroundColor Cyan
}
else {
    Write-Host "$changedCount file(s) generated under: $generatedRoot" -ForegroundColor Green

    if ($changedCount -gt 0 -and $Apply.Count -gt 0) {
        Write-Host ""
        Write-Host "Applying generated manifests..." -ForegroundColor Cyan
        foreach ($ctx in $Apply) {
            $infraDir = Join-Path $generatedRoot "pro\infrastructure"
            $appDir   = Join-Path $generatedRoot "pro\application"

            if (Test-Path $infraDir) {
                Write-Host "  [$ctx] Applying infrastructure..." -ForegroundColor DarkGray
                kubectl --context $ctx apply -f $infraDir -n featbit | Out-Null
            }
            if (Test-Path $appDir) {
                Write-Host "  [$ctx] Applying application..." -ForegroundColor DarkGray
                kubectl --context $ctx apply -f $appDir -n featbit | Out-Null
            }
        }
        Write-Host "Done." -ForegroundColor Green
    }
    elseif ($changedCount -gt 0) {
        Write-Host ""
        Write-Host "To apply the generated manifests, run:" -ForegroundColor Cyan
        Write-Host "  kubectl --context <ctx> apply -f `"$generatedRoot\pro\infrastructure`" -n featbit" -ForegroundColor Gray
        Write-Host "  kubectl --context <ctx> apply -f `"$generatedRoot\pro\application`" -n featbit" -ForegroundColor Gray
        Write-Host "Or pass -Apply west,east to apply automatically." -ForegroundColor Gray
    }
}
