#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Shared image-pull-secret helpers for private/custom registries.

.DESCRIPTION
    Dot-sourced by Deploy-FeatBitClusters.ps1 (namespace "featbit") and
    Deploy-OtelDemo.ps1 (namespace "otel-demo") so both scripts wire pull
    secrets the same way instead of maintaining separate copies.

    Credentials are driven by the CUSTOM_REGISTRY_USERNAME / CUSTOM_REGISTRY_PASSWORD
    keys in deployment.env (see Import-DeploymentEnv.ps1), which Import-DeploymentEnv.ps1
    combines into a PSCredential keyed as "CustomRegistryCredential". The secret name
    defaults to "registry-credentials" and can be overridden via CUSTOM_REGISTRY_SECRET_NAME.

    Callers must dot-source this file, e.g.:
        . (Join-Path $PSScriptRoot "Set-RegistryPullSecrets.ps1")

    Output is self-contained (plain Write-Host) rather than relying on a
    caller-defined Write-Success/Write-Warning, since the two callers each
    define their own status-output helpers with different names.
#>

# Creates (or refreshes) a docker-registry image pull secret in the given
# cluster/namespace from the supplied credential. Retries a few times since
# the API server can be briefly unavailable right after cluster bring-up.
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

    $maxAttempts = 4
    $delaySeconds = 5
    $created = $false

    for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
        kubectl --context $ClusterContext --namespace $Namespace delete secret $SecretName --ignore-not-found | Out-Null
        kubectl --context $ClusterContext --namespace $Namespace create secret docker-registry $SecretName --docker-server=$Registry --docker-username=$username --docker-password=$password --docker-email=devnull@$Registry | Out-Null

        if ($LASTEXITCODE -eq 0) {
            $created = $true
            break
        }

        if ($attempt -lt $maxAttempts) {
            Write-Host "⚠ Failed to create $SecretName in $ClusterContext (attempt $attempt/$maxAttempts). Retrying in $delaySeconds seconds..." -ForegroundColor Yellow
            Start-Sleep -Seconds $delaySeconds
        }
    }

    if (-not $created) {
        throw "Failed to create $SecretName secret in $ClusterContext"
    }

    Write-Host "✓ $SecretName secret ready in $ClusterContext" -ForegroundColor Green
}

# Patches the namespace's "default" service account so pods that don't set
# imagePullSecrets explicitly (and don't have their own SA) still authenticate.
# This is a defensive backstop only — charts/manifests that wire imagePullSecrets
# directly onto the pod spec (or use a non-default ServiceAccount) need that done
# separately; see Deploy-OtelDemo.ps1's use of --set-string default.image.pullSecrets.
function Ensure-DefaultServiceAccountImagePullSecret {
    param(
        [string]$ClusterContext,
        [string]$Namespace,
        [string]$SecretName
    )

    $serviceAccountPatch = @{
        imagePullSecrets = @(
            @{
                name = $SecretName
            }
        )
    } | ConvertTo-Json -Depth 4 -Compress

    kubectl --context $ClusterContext --namespace $Namespace patch serviceaccount default --type merge -p $serviceAccountPatch | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to patch default service account imagePullSecrets in $ClusterContext/$Namespace"
    }

    Write-Host "✓ Default service account patched with $SecretName in $ClusterContext" -ForegroundColor Green
}
