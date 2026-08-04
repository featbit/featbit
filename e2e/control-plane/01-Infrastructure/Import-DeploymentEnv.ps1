#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Loads deployment.env into script-scoped variables and returns a splatting hashtable.

.DESCRIPTION
    Reads a KEY=VALUE env file (ignoring blank lines and # comments), maps each key
    to the corresponding script parameter name, and returns a hashtable suitable for
    splatting into a deploy script.

    Credential parameters (CUSTOM_REGISTRY_USERNAME / CUSTOM_REGISTRY_PASSWORD) are
    combined into a PSCredential and keyed as "CustomRegistryCredential".

    Scripts call this as:
        $envParams = & (Join-Path $PSScriptRoot "Import-DeploymentEnv.ps1")
        # merge with any explicitly-passed bound parameters, then splat the rest

.PARAMETER EnvFile
    Path to the env file. Defaults to deployment.env in the same directory as this script.
#>
param(
    [string]$EnvFile = ""
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot  = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $scriptDir))

# Resolve the env file path. Search order:
#   1. Explicit -EnvFile argument.
#   2. deployment.env next to the scripts (e2e/control-plane/).
#   3. deployment.env at the repository root.
if ($EnvFile) {
    $resolved = $EnvFile
}
elseif (Test-Path (Join-Path $scriptDir "deployment.env")) {
    $resolved = Join-Path $scriptDir "deployment.env"
}
elseif (Test-Path (Join-Path $repoRoot "deployment.env")) {
    $resolved = Join-Path $repoRoot "deployment.env"
}
else {
    return @{}
}

Write-Host "  Loading deployment config from: $resolved" -ForegroundColor DarkGray

# Parse KEY=VALUE lines.
$raw = @{}
foreach ($line in Get-Content $resolved) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) {
        continue
    }

    $eqIdx = $trimmed.IndexOf("=")
    if ($eqIdx -lt 1) {
        continue
    }

    $key   = $trimmed.Substring(0, $eqIdx).Trim()
    $value = $trimmed.Substring($eqIdx + 1).Trim()

    if ($value) {
        $raw[$key] = $value
    }
}

# Map env keys to PowerShell parameter names.
$keyMap = @{
    "DEPLOYMENT_MODE"              = "DeploymentMode"
    "DATABASE_PROVIDER"            = "DatabaseProvider"
    "CUSTOM_IMAGE_REGISTRY"        = "CustomImageRegistry"
    "FEATBIT_IMAGE_REGISTRY"       = "FeatBitImageRegistry"
    "INFRA_IMAGE_REPOSITORY"       = "InfraImageRepository"
    "INFRA_IMAGE_MAP_FILE"         = "InfraImageMapFile"
    "CUSTOM_REGISTRY_SECRET_NAME"  = "CustomRegistrySecretName"
    "MONGO_IMAGE"                  = "MongoImage"
    "POSTGRES_IMAGE"               = "PostgresImage"
    "MINIKUBE_BASE_IMAGE"          = "MinikubeBaseImage"
    "WEST_CPUS"                    = "WestCpus"
    "WEST_MEMORY"                  = "WestMemory"
    "EAST_CPUS"                    = "EastCpus"
    "EAST_MEMORY"                  = "EastMemory"
    "HOST_INFRA_COMPONENTS"        = "HostInfraComponents"
    "INSECURE_CUSTOM_REGISTRY"     = "InsecureCustomRegistry"
}

$params = @{}

foreach ($envKey in $raw.Keys) {
    if ($keyMap.ContainsKey($envKey)) {
        $paramName = $keyMap[$envKey]
        $value     = $raw[$envKey]

        # Type coercion for numeric / array params.
        switch ($paramName) {
            { $_ -in "WestCpus", "WestMemory", "EastCpus", "EastMemory" } {
                $params[$paramName] = [int]$value
            }
            "HostInfraComponents" {
                $params[$paramName] = $value -split "," | ForEach-Object { $_.Trim() } | Where-Object { $_ }
            }
            "InsecureCustomRegistry" {
                $params[$paramName] = $value -match '^(true|1|yes|on)$'
            }
            default {
                $params[$paramName] = $value
            }
        }
    }
}

# Some settings are read by deploy scripts as process env vars rather than
# parameters (Deploy-FeatBitClusters.ps1 reads $env:CONSISTENCY_MODE). Export
# those explicitly — before this, CONSISTENCY_MODE in deployment.env was
# silently ignored and a "GatedCommit" deploy came up BestEffort (#113).
$envExportKeys = @("CONSISTENCY_MODE")
foreach ($envKey in $envExportKeys) {
    if ($raw.ContainsKey($envKey)) {
        Set-Item -Path "env:$envKey" -Value $raw[$envKey]
    }
}

# Build a PSCredential if username + password are both provided.
$user = $raw["CUSTOM_REGISTRY_USERNAME"]
$pass = $raw["CUSTOM_REGISTRY_PASSWORD"]
if ($user -and $pass) {
    $securePass = ConvertTo-SecureString $pass -AsPlainText -Force
    $params["CustomRegistryCredential"] = New-Object System.Management.Automation.PSCredential($user, $securePass)
}

return $params
