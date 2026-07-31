<#
.SYNOPSIS
    Download and trust certificates inside specified Minikube clusters, with optional
    Docker daemon registry trust.

.DESCRIPTION
    Fetches PEM certificate files defined by TRUST_CERTIFICATES in deployment.env,
    copies them into each cluster's certificate directory, runs update-ca-certificates,
    and (when registry hosts are configured) writes Docker daemon trust entries and
    restarts the daemon.

    Registry host trust defaults to CUSTOM_IMAGE_REGISTRY from deployment.env when
    -RegistryHosts is not supplied explicitly. Docker daemon trust is applied
    automatically whenever registry hosts are resolved, which is the primary fix for
    ImagePullBackOff errors caused by TLS trust gaps.

    After restarting the Docker daemon the script polls until the daemon is responsive
    (up to 60 seconds at 2-second intervals) to avoid race conditions with downstream
    kubectl apply operations.

    Use -DryRun to preview all actions without executing any remote commands or
    downloading any files.

    Certificate sources (evaluated in order):
      1. TRUST_CERTIFICATES in deployment.env  — semicolon-separated "name|url|target" entries.
      2. -WindowsCertStoreSubjects             — subject substring patterns exported directly from
                                                the Windows LocalMachine\Root and CA stores.
                                                Useful when the CA is trusted on the host but not
                                                accessible at a downloadable URL.

.PARAMETER Clusters
    Minikube profile names to update. Defaults to @("west", "east").

.PARAMETER RegistryHosts
    Registry hostnames for which Docker daemon trust entries are written under
    /etc/docker/certs.d/<host>/ca.crt. When not supplied, defaults to
    CUSTOM_IMAGE_REGISTRY from deployment.env. Pass an explicit list to override
    that default. Pass an empty array to suppress Docker daemon trust entirely.

.PARAMETER DeploymentEnvFile
    Full path to the deployment.env file to read CUSTOM_IMAGE_REGISTRY and
    TRUST_CERTIFICATES from. When omitted the script searches in order:
      1. deployment.env in the same directory as this script
      2. deployment.env at the repository root (two levels up)

.PARAMETER DryRun
    Print what would be done — which certificates would be downloaded, on which
    clusters they would be installed, and which Docker hosts would be trusted —
    without executing any minikube or Invoke-WebRequest commands.

.PARAMETER WindowsCertStoreSubjects
    Subject substrings to match against the Windows LocalMachine cert stores (Root + CA).
    All unique matching certs are exported as PEM and installed in the clusters.
    Useful when the CA is trusted on the host but not accessible at a downloadable URL.
    Example: @("My Corp CA", "Corporate Root CA 2024")

.EXAMPLE
    # Trust certs listed in deployment.env
    .\Trust-MinikubeCertificates.ps1

    Uses defaults from deployment.env: TRUST_CERTIFICATES for the certificate list and
    CUSTOM_IMAGE_REGISTRY as the Docker daemon trust host.

.EXAMPLE
    .\Trust-MinikubeCertificates.ps1 -RegistryHosts "registry.example.com"

    Installs certificates on the default west/east clusters and writes Docker daemon
    trust for the specified registry host, ignoring CUSTOM_IMAGE_REGISTRY in
    deployment.env.

.EXAMPLE
    .\Trust-MinikubeCertificates.ps1 -DryRun

    Prints a summary of all actions that would be taken without making any changes.

.EXAMPLE
    .\Trust-MinikubeCertificates.ps1 -Clusters @("dev", "test") -DeploymentEnvFile "C:\projects\myenv\deployment.env"

    Updates the dev and test clusters using an explicit deployment.env path.

.EXAMPLE
    # Export corporate CAs directly from the Windows cert store
    .\Trust-MinikubeCertificates.ps1 -WindowsCertStoreSubjects @("My Corp CA") -RegistryHosts registry.example.com
#>
[CmdletBinding()]
param(
    [string[]] $Clusters                 = @("west", "east"),
    [string[]] $RegistryHosts            = @(),
    [string]   $DeploymentEnvFile        = "",
    [string[]] $WindowsCertStoreSubjects = @(),
    [switch]   $DryRun
)

$ErrorActionPreference = "Stop"

# ─── Resolve deployment.env (same search order as Import-DeploymentEnv.ps1) ──

$scriptDir = $PSScriptRoot
$repoRoot  = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $scriptDir))

if ($DeploymentEnvFile) {
    $resolvedEnvFile = $DeploymentEnvFile
} elseif (Test-Path (Join-Path $scriptDir "deployment.env")) {
    $resolvedEnvFile = Join-Path $scriptDir "deployment.env"
} elseif (Test-Path (Join-Path $repoRoot "deployment.env")) {
    $resolvedEnvFile = Join-Path $repoRoot "deployment.env"
} else {
    $resolvedEnvFile = $null
}

# ─── Parse a single KEY= from the resolved env file ──────────────────────────

function Get-DeploymentEnvValue {
    param([string]$EnvFilePath, [string]$Key)
    if (-not $EnvFilePath -or -not (Test-Path $EnvFilePath)) { return "" }
    foreach ($line in Get-Content $EnvFilePath) {
        $trimmed = $line.Trim()
        if ($trimmed -and -not $trimmed.StartsWith("#") -and $trimmed.StartsWith("${Key}=")) {
            return $trimmed.Substring($Key.Length + 1).Trim()
        }
    }
    return ""
}

# ─── Default RegistryHosts from CUSTOM_IMAGE_REGISTRY when not supplied ──────

if (-not $PSBoundParameters.ContainsKey('RegistryHosts')) {
    $customRegistry = Get-DeploymentEnvValue -EnvFilePath $resolvedEnvFile -Key "CUSTOM_IMAGE_REGISTRY"
    if ($customRegistry) {
        $RegistryHosts = @($customRegistry)
        Write-Host "  Registry trust host defaulted from deployment.env: $customRegistry" -ForegroundColor DarkGray
    }
}

# ─── Load TRUST_CERTIFICATES ─────────────────────────────────────────────────
#
# Certificate sources (both may be combined):
#   1. TRUST_CERTIFICATES in deployment.env  — semicolon-separated "name|url|target" entries.
#   2. -WindowsCertStoreSubjects             — subject substrings matched against the Windows
#                                             LocalMachine\Root and CA stores, exported as PEM.

$trustCertificatesRaw = Get-DeploymentEnvValue -EnvFilePath $resolvedEnvFile -Key "TRUST_CERTIFICATES"

if (-not $trustCertificatesRaw -and $WindowsCertStoreSubjects.Count -eq 0 -and $RegistryHosts.Count -eq 0) {
    Write-Host "TRUST_CERTIFICATES is not configured, no -WindowsCertStoreSubjects supplied, and no registry hosts are specified — nothing to do." -ForegroundColor DarkGray
    return
}

if (-not $trustCertificatesRaw -and $WindowsCertStoreSubjects.Count -eq 0 -and $RegistryHosts.Count -gt 0) {
    throw "No certificate sources configured but -RegistryHosts was supplied. Set TRUST_CERTIFICATES in deployment.env or pass -WindowsCertStoreSubjects."
}

# Typed list so both sources (TRUST_CERTIFICATES and Windows cert store) can .Add().
$certificates = [System.Collections.Generic.List[hashtable]]::new()

if ($trustCertificatesRaw) {
    foreach ($entry in ($trustCertificatesRaw -split ";" | Where-Object { $_ })) {
        $parts = $entry -split "\|"
        $certificates.Add(@{ Name = $parts[0].Trim(); Url = $parts[1].Trim(); Target = $parts[2].Trim() })
    }
}

# ─── Dry run: preview all actions and return ─────────────────────────────────

if ($DryRun) {
    Write-Host "`n[DRY RUN] Trust-MinikubeCertificates — no changes will be made." -ForegroundColor Cyan
    Write-Host "`nClusters : $($Clusters -join ', ')" -ForegroundColor Cyan
    Write-Host "`nCertificates from TRUST_CERTIFICATES that would be downloaded and installed:" -ForegroundColor Cyan
    if ($certificates.Count -eq 0) {
        Write-Host "  (none)" -ForegroundColor DarkGray
    } else {
        foreach ($cert in $certificates) {
            Write-Host "  [$($cert.Name)]  url=$($cert.Url)  target=$($cert.Target)" -ForegroundColor Cyan
        }
    }
    Write-Host "`nWindows cert store subjects that would be exported and installed:" -ForegroundColor Cyan
    if ($WindowsCertStoreSubjects.Count -eq 0) {
        Write-Host "  (none)" -ForegroundColor DarkGray
    } else {
        foreach ($subject in $WindowsCertStoreSubjects) {
            Write-Host "  $subject" -ForegroundColor Cyan
        }
    }
    if ($RegistryHosts.Count -gt 0) {
        Write-Host "`nDocker daemon trust would be written for:" -ForegroundColor Cyan
        foreach ($h in $RegistryHosts) {
            Write-Host "  /etc/docker/certs.d/$h/ca.crt" -ForegroundColor Cyan
        }
    } else {
        Write-Host "`nDocker daemon trust: skipped (no registry hosts configured)." -ForegroundColor DarkGray
    }
    return
}

# ─── Download all certificates before touching any cluster ───────────────────

$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) "featbit-cert-trust"
if (-not (Test-Path $tempDir)) {
    New-Item -ItemType Directory -Path $tempDir | Out-Null
}

# Source 2: Windows LocalMachine cert store export (no URL required)
if ($WindowsCertStoreSubjects.Count -gt 0) {
    $seen = @{}
    $allStoreCerts = @(Get-ChildItem Cert:\LocalMachine\Root) + @(Get-ChildItem Cert:\LocalMachine\CA)
    foreach ($subject in $WindowsCertStoreSubjects) {
        foreach ($cert in ($allStoreCerts | Where-Object { $_.Subject -match [regex]::Escape($subject) })) {
            if ($seen.ContainsKey($cert.Thumbprint)) { continue }
            $seen[$cert.Thumbprint] = $true
            $safeName = "wincert-$($cert.Thumbprint.Substring(0,8).ToLower())"
            $localPath = Join-Path $tempDir "$safeName.crt"
            $pem = "-----BEGIN CERTIFICATE-----`r`n" +
                   [Convert]::ToBase64String($cert.RawData, [System.Base64FormattingOptions]::InsertLineBreaks) +
                   "`r`n-----END CERTIFICATE-----"
            [System.IO.File]::WriteAllText($localPath, $pem, [System.Text.Encoding]::ASCII)
            $certificates.Add(@{
                Name      = $safeName
                Url       = ""         # already on disk — skip download
                Target    = "/usr/local/share/ca-certificates/$safeName.crt"
                LocalPath = $localPath
            })
            Write-Host "  Exported from Windows store: $($cert.Subject)"
        }
    }
}

if ($certificates.Count -eq 0) {
    Write-Warning "No certificates to install. Set TRUST_CERTIFICATES in deployment.env or pass -WindowsCertStoreSubjects."
    exit 0
}

try {
    foreach ($certificate in $certificates) {
        if ($certificate.LocalPath) {
            # Already exported from the Windows cert store — no download needed.
            continue
        }
        $localPath = Join-Path $tempDir "$($certificate.Name).crt"
        Write-Host "Downloading $($certificate.Url)..."
        try {
            Invoke-WebRequest -Uri $certificate.Url -OutFile $localPath | Out-Null
        } catch {
            Write-Host ""
            Write-Host "  ERROR: Failed to download certificate '$($certificate.Name)'." -ForegroundColor Red
            Write-Host "         URL     : $($certificate.Url)" -ForegroundColor Red
            Write-Host "         Clusters: $($Clusters -join ', ')" -ForegroundColor Red
            Write-Host "         Action  : Verify network access to the certificate authority server." -ForegroundColor Red
            throw "Certificate download failed for '$($certificate.Name)' (URL: $($certificate.Url)): $_"
        }
        $certificate.LocalPath = $localPath
    }

    # ─── Per-cluster trust installation ──────────────────────────────────────

    foreach ($cluster in $Clusters) {
        Write-Host "`nUpdating Minikube cluster: $cluster"

        foreach ($certificate in $certificates) {
            $localPath      = $certificate.LocalPath
            $remoteTempPath = "/tmp/$($certificate.Name).crt"
            Write-Host "  Copying $($certificate.Name) certificate into cluster..."
            & minikube -p $cluster cp $localPath $remoteTempPath | Out-Null
            if ($LASTEXITCODE -ne 0) {
                throw "Failed to copy $($certificate.Name) to $cluster"
            }

            $targetPath      = $certificate.Target
            $targetDirectory = $targetPath -replace '/[^/]+$', ''
            $installCommand  = "sudo mkdir -p $targetDirectory && sudo mv $remoteTempPath $targetPath && sudo chmod 644 $targetPath"
            & minikube ssh -p $cluster -- "$installCommand" | Out-Null
            if ($LASTEXITCODE -ne 0) {
                throw "Failed to install $($certificate.Name) on $cluster"
            }
        }

        Write-Host "  Refreshing CA trust store..."
        & minikube ssh -p $cluster -- "sudo update-ca-certificates" | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to refresh CA store on $cluster"
        }

        # ─── Docker daemon trust ─────────────────────────────────────────────
        # The foreach loop is the natural gate: skipped entirely when RegistryHosts
        # is empty, runs unconditionally for each host when non-empty.

        $certPaths = ($certificates | ForEach-Object { $_.Target }) -join " "

        foreach ($registry in $RegistryHosts) {
            Write-Host "  Configuring Docker daemon trust for $registry..."
            $dockerCommand = "sudo mkdir -p /etc/docker/certs.d/$registry && sudo bash -c 'cat $certPaths > /etc/docker/certs.d/$registry/ca.crt'"
            & minikube ssh -p $cluster -- $dockerCommand | Out-Null
            if ($LASTEXITCODE -ne 0) {
                throw "Failed to install Docker certs for $registry on $cluster"
            }
        }

        if ($RegistryHosts.Count -gt 0) {
            $restartCommand = "if command -v systemctl >/dev/null 2>&1; then sudo systemctl restart docker || true; elif command -v service >/dev/null 2>&1; then sudo service docker restart || true; elif [ -x /etc/init.d/docker ]; then sudo /etc/init.d/docker restart || true; fi"
            Write-Host "  Restarting Docker daemon..."
            & minikube ssh -p $cluster -- $restartCommand | Out-Null

            # Poll until the daemon is responsive (30 attempts × 2 s = 60 s max).
            Write-Host "  Waiting for Docker daemon to become responsive..."
            $maxAttempts = 30
            $attempt     = 0
            $daemonReady = $false
            while ($attempt -lt $maxAttempts) {
                Start-Sleep -Seconds 2
                $attempt++
                $pollResult = & minikube ssh -p $cluster -- "docker info >/dev/null 2>&1 && echo OK" 2>&1
                if ($pollResult -match "OK") {
                    $daemonReady = $true
                    break
                }
            }
            if (-not $daemonReady) {
                throw "Docker daemon did not become responsive in cluster $cluster within 60s after trust update."
            }
            Write-Host "  Docker daemon ready." -ForegroundColor Green
        }

        Write-Host "✓ Cluster $cluster trust store updated." -ForegroundColor Green
    }
}
finally {
    if (Test-Path $tempDir) {
        Remove-Item -Path $tempDir -Recurse -Force
    }
}
