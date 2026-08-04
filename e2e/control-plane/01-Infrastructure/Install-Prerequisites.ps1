<#
.SYNOPSIS
    Installs and configures all prerequisites required to run the FeatBit QA deployment scripts.

.DESCRIPTION
    Checks for the presence of each prerequisite and installs it if missing.
    Supports Windows (via winget) and Ubuntu/Debian Linux (via apt).

    Prerequisites managed:
    - PowerShell 7.6 or later  (check only — cannot self-upgrade)
    - Docker Desktop (Windows) / Docker Engine (Linux)
    - Minikube
    - kubectl
    - Chocolatey (Windows only, optional — required by Setup-FeatBitProxy.ps1)

    The script is idempotent: tools that are already present and meet the minimum
    version requirement are skipped without modification.

    Windows: Winget (Windows Package Manager) must be available. It ships with
    Windows 10 1709+ and can be installed from https://aka.ms/getwinget if missing.

    Linux: apt and curl must be available. Run as root or with sudo access.

.PARAMETER SkipChocolatey
    Skip the optional Chocolatey installation step (Windows only).
    Chocolatey is only required if you intend to run Setup-FeatBitProxy.ps1.

.PARAMETER Force
    Reinstall tools that are already present, regardless of their current version.

.PARAMETER WhatIf
    Dry-run mode. Reports what would be installed or upgraded without making any changes.

.EXAMPLE
    .\Install-Prerequisites.ps1
    Checks and installs all prerequisites including Chocolatey (Windows).

.EXAMPLE
    .\Install-Prerequisites.ps1 -SkipChocolatey
    Checks and installs core prerequisites only (Docker, Minikube, kubectl).

.EXAMPLE
    .\Install-Prerequisites.ps1 -WhatIf
    Reports which prerequisites are missing or outdated without installing anything.

.NOTES
    Windows: Docker Desktop installation requires you to log out and back in (or
    restart) before the Docker daemon is available. The script will warn you.
    Run from an elevated (Administrator) PowerShell session when installing
    Docker Desktop or Chocolatey, as both require elevated privileges.

    Linux: Docker Engine installation adds the current user to the 'docker' group.
    You must start a new shell session before running Docker without sudo.
    Run as root or ensure your account has passwordless sudo access.
#>

[CmdletBinding(SupportsShouldProcess)]
param(
    [switch]$SkipChocolatey,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

Set-StrictMode -Version Latest

# ── Platform detection ────────────────────────────────────────────────────────

$script:onWindows = $IsWindows -or ($PSVersionTable.PSVersion.Major -le 5)
$script:onLinux   = $IsLinux

if (-not $script:onWindows -and -not $script:onLinux)
{
    Write-Host "✗ This script supports Windows and Ubuntu/Debian Linux only." -ForegroundColor Red
    exit 1
}

# ── Minimum version requirements ─────────────────────────────────────────────

$minimumPowerShellMajor = 7
$minimumPowerShellMinor = 6
$minimumMinikubeVersion = [Version]"1.32.0"
$minimumKubectlVersion  = [Version]"1.28.0"

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

# ── Privilege helpers ─────────────────────────────────────────────────────────

function Test-Administrator
{
    if ($script:onWindows)
    {
        $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
        $principal   = New-Object Security.Principal.WindowsPrincipal($currentUser)
        return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    }
    else
    {
        # On Linux, check if running as root (UID 0)
        return ((id -u) -eq "0")
    }
}

# Shared privilege/sudo-session helpers (Linux). Provides Initialize-FbSudoSession
# / Get-FbSudoMode so root is acquired at most once and never prompts mid-run.
if ($script:onLinux)
{
    $privHelper = Join-Path $PSScriptRoot "Initialize-Privilege.ps1"
    if (-not (Test-Path $privHelper)) { Write-Fail "Initialize-Privilege.ps1 not found at $privHelper"; exit 1 }
    . $privHelper
}

# Runs a command with sudo on Linux when not already root; runs directly on Windows.
function Invoke-Elevated
{
    param([string[]]$ArgumentList)

    if ($script:onLinux -and -not (Test-Administrator))
    {
        # Prime the sudo session on the FIRST escalation only (i.e. only when a
        # tool is actually missing and must be installed) — a single password
        # prompt, passwordless sudo, or fast-fail if neither is available. Then
        # run non-interactively so the rest never prompts.
        if (-not (Get-FbSudoMode)) {
            [void](Initialize-FbSudoSession -Required -Purpose "installing developer prerequisites via apt")
        }
        & sudo -n @ArgumentList
    }
    else
    {
        & $ArgumentList[0] $ArgumentList[1..($ArgumentList.Length - 1)]
    }

    return $LASTEXITCODE
}

# ── Package manager checks ────────────────────────────────────────────────────

function Assert-Winget
{
    if (-not (Get-Command winget -ErrorAction SilentlyContinue))
    {
        Write-Fail "winget (Windows Package Manager) is not available."
        Write-Info "Install it from https://aka.ms/getwinget and re-run this script."
        exit 1
    }
}

function Assert-Apt
{
    if (-not (Get-Command apt-get -ErrorAction SilentlyContinue))
    {
        Write-Fail "apt-get is not available. This script requires Ubuntu or Debian Linux."
        exit 1
    }

    if (-not (Get-Command curl -ErrorAction SilentlyContinue))
    {
        Write-Fail "curl is required but not installed. Install it with: sudo apt-get install -y curl"
        exit 1
    }
}

# ── Generic package installers ────────────────────────────────────────────────

function Install-WingetPackage
{
    param(
        [string]$PackageId,
        [string]$DisplayName
    )

    if ($WhatIfPreference)
    {
        Write-Warn "[WhatIf] Would install $DisplayName via: winget install --id $PackageId"
        return
    }

    Write-Info "Installing $DisplayName via winget..."
    winget install --id $PackageId --silent --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0)
    {
        Write-Fail "winget reported a failure installing $DisplayName (exit code $LASTEXITCODE)."
        Write-Info "Retry manually: winget install --id $PackageId"
        exit 1
    }
    Write-Success "$DisplayName installed."
}

function Install-AptPackage
{
    param(
        [string[]]$Packages,
        [string]$DisplayName
    )

    if ($WhatIfPreference)
    {
        Write-Warn "[WhatIf] Would install $DisplayName via: apt-get install -y $($Packages -join ' ')"
        return
    }

    Write-Info "Installing $DisplayName via apt-get..."
    $exitCode = Invoke-Elevated @("apt-get", "install", "-y") + $Packages
    if ($exitCode -ne 0)
    {
        Write-Fail "apt-get reported a failure installing $DisplayName (exit code $exitCode)."
        Write-Info "Retry manually: sudo apt-get install -y $($Packages -join ' ')"
        exit 1
    }
    Write-Success "$DisplayName installed."
}

# ── PowerShell version ────────────────────────────────────────────────────────

function Test-PowerShellVersion
{
    Write-Step "PowerShell Version"

    $current = $PSVersionTable.PSVersion
    $meetsRequirement = ($current.Major -gt $minimumPowerShellMajor) -or
                        ($current.Major -eq $minimumPowerShellMajor -and $current.Minor -ge $minimumPowerShellMinor)

    if ($meetsRequirement)
    {
        Write-Success "PowerShell $current — OK (minimum $minimumPowerShellMajor.$minimumPowerShellMinor required)."
        return
    }

    Write-Fail "PowerShell $current is below the minimum required version ($minimumPowerShellMajor.$minimumPowerShellMinor)."
    Write-Info "Download the latest release from https://github.com/PowerShell/PowerShell/releases"

    if ($script:onWindows)
    {
        Write-Info "Or install via winget: winget install --id Microsoft.PowerShell"
    }
    else
    {
        Write-Info "Or install via snap: sudo snap install powershell --classic"
    }

    exit 1
}

# ── Docker ────────────────────────────────────────────────────────────────────

function Install-DockerWindows
{
    $dockerCmd  = Get-Command docker -ErrorAction SilentlyContinue
    $rancherCmd = Get-Command nerdctl -ErrorAction SilentlyContinue  # Rancher Desktop ships nerdctl

    if ($dockerCmd -and -not $Force)
    {
        $versionOutput = docker version --format '{{.Server.Version}}' 2>$null
        Write-Success "Docker is already available (server version: $versionOutput)."
        return
    }

    if ($rancherCmd -and -not $Force)
    {
        Write-Success "Rancher Desktop is already available — skipping Docker Desktop installation."
        return
    }

    if (-not (Test-Administrator))
    {
        Write-Fail "Installing Docker Desktop requires an Administrator session."
        Write-Info "Re-run this script from an elevated PowerShell prompt."
        exit 1
    }

    Install-WingetPackage -PackageId "Docker.DockerDesktop" -DisplayName "Docker Desktop"

    if (-not $WhatIfPreference)
    {
        Write-Warn "Docker Desktop was just installed."
        Write-Info "You must log out and back in (or restart) before the Docker daemon is available."
        Write-Info "Re-run this script after restarting to verify Docker is running."
        $script:restartRequired = $true
    }
}

function Install-DockerLinux
{
    $dockerCmd = Get-Command docker -ErrorAction SilentlyContinue

    if ($dockerCmd -and -not $Force)
    {
        $versionOutput = docker version --format '{{.Server.Version}}' 2>$null
        Write-Success "Docker Engine is already available (server version: $versionOutput)."
        return
    }

    if ($WhatIfPreference)
    {
        Write-Warn "[WhatIf] Would install Docker Engine via the official apt repository."
        return
    }

    Write-Info "Setting up Docker Engine repository..."

    # Install prerequisites for adding the repository
    $exitCode = Invoke-Elevated @("apt-get", "update")
    if ($exitCode -ne 0) { Write-Fail "apt-get update failed."; exit 1 }

    $exitCode = Invoke-Elevated @("apt-get", "install", "-y",
        "ca-certificates", "curl", "gnupg", "lsb-release")
    if ($exitCode -ne 0) { Write-Fail "Failed to install Docker repository prerequisites."; exit 1 }

    # Add Docker's official GPG key
    $exitCode = Invoke-Elevated @("install", "-m", "0755", "-d", "/etc/apt/keyrings")
    if ($exitCode -ne 0) { Write-Fail "Failed to create /etc/apt/keyrings directory."; exit 1 }

    # Detect Ubuntu vs Debian and set the repo URL accordingly
    $osId = (& bash -c ". /etc/os-release && echo \$ID").Trim()
    $repoUrl = if ($osId -eq "ubuntu") {
        "https://download.docker.com/linux/ubuntu"
    } else {
        "https://download.docker.com/linux/debian"
    }

    Write-Info "Downloading Docker GPG key..."
    $exitCode = Invoke-Elevated @("bash", "-c",
        "curl -fsSL $repoUrl/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg && chmod a+r /etc/apt/keyrings/docker.gpg")
    if ($exitCode -ne 0) { Write-Fail "Failed to add Docker GPG key."; exit 1 }

    Write-Info "Adding Docker apt repository..."
    $arch         = (& dpkg --print-architecture).Trim()
    $versionCodename = (& bash -c ". /etc/os-release && echo \$VERSION_CODENAME").Trim()
    $repoLine     = "deb [arch=$arch signed-by=/etc/apt/keyrings/docker.gpg] $repoUrl $versionCodename stable"
    $exitCode = Invoke-Elevated @("bash", "-c", "echo '$repoLine' > /etc/apt/sources.list.d/docker.list")
    if ($exitCode -ne 0) { Write-Fail "Failed to add Docker apt repository."; exit 1 }

    $exitCode = Invoke-Elevated @("apt-get", "update")
    if ($exitCode -ne 0) { Write-Fail "apt-get update failed after adding Docker repository."; exit 1 }

    Write-Info "Installing Docker Engine..."
    $exitCode = Invoke-Elevated @("apt-get", "install", "-y",
        "docker-ce", "docker-ce-cli", "containerd.io",
        "docker-buildx-plugin", "docker-compose-plugin")
    if ($exitCode -ne 0) { Write-Fail "Docker Engine installation failed."; exit 1 }

    # Add current user to the docker group so Docker can be used without sudo
    $currentUser = $env:USER
    if ($currentUser -and $currentUser -ne "root")
    {
        Write-Info "Adding '$currentUser' to the 'docker' group..."
        Invoke-Elevated @("usermod", "-aG", "docker", $currentUser) | Out-Null
        Write-Warn "You must start a new shell session before running Docker without sudo."
        $script:newSessionRequired = $true
    }

    Write-Success "Docker Engine installed."
}

function Install-Docker
{
    Write-Step "Docker"

    if ($script:onWindows) { Install-DockerWindows }
    else                    { Install-DockerLinux }
}

# ── Minikube ──────────────────────────────────────────────────────────────────

function Install-MinikubeLinux
{
    if ($WhatIfPreference)
    {
        Write-Warn "[WhatIf] Would download and install minikube binary to /usr/local/bin/minikube."
        return
    }

    Write-Info "Detecting system architecture..."
    $arch = (& uname -m).Trim()
    $minikubeArch = switch ($arch)
    {
        "x86_64"  { "amd64" }
        "aarch64" { "arm64" }
        "armv7l"  { "arm" }
        default
        {
            Write-Fail "Unsupported architecture: $arch"
            exit 1
        }
    }

    $minikubeUrl = "https://storage.googleapis.com/minikube/releases/latest/minikube-linux-$minikubeArch"
    $tmpFile     = "/tmp/minikube-linux-$minikubeArch"

    Write-Info "Downloading minikube ($minikubeArch)..."
    & curl -fsSL -o $tmpFile $minikubeUrl
    if ($LASTEXITCODE -ne 0) { Write-Fail "Failed to download minikube."; exit 1 }

    $exitCode = Invoke-Elevated @("install", $tmpFile, "/usr/local/bin/minikube")
    Remove-Item $tmpFile -ErrorAction SilentlyContinue

    if ($exitCode -ne 0) { Write-Fail "Failed to install minikube to /usr/local/bin."; exit 1 }

    Write-Success "Minikube installed."
}

function Install-Minikube
{
    Write-Step "Minikube"

    $minikubeCmd = Get-Command minikube -ErrorAction SilentlyContinue

    if ($minikubeCmd -and -not $Force)
    {
        $rawVersion    = minikube version --short 2>$null
        $versionString = $rawVersion -replace '^v', ''
        $parsedVersion = [Version]::new(0, 0, 0)
        [void][Version]::TryParse($versionString, [ref]$parsedVersion)

        if ($parsedVersion -ge $minimumMinikubeVersion)
        {
            Write-Success "Minikube $rawVersion — OK (minimum v$minimumMinikubeVersion required)."
            return
        }

        Write-Warn "Minikube $rawVersion is below the minimum required version (v$minimumMinikubeVersion)."
        Write-Info "Upgrading Minikube..."
    }

    if ($script:onWindows)
    {
        Install-WingetPackage -PackageId "Kubernetes.minikube" -DisplayName "Minikube"

        # Refresh PATH so minikube is immediately available in this session.
        $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" +
                    [System.Environment]::GetEnvironmentVariable("PATH", "User")
    }
    else
    {
        Install-MinikubeLinux
    }
}

# ── kubectl ───────────────────────────────────────────────────────────────────

function Install-KubectlLinux
{
    if ($WhatIfPreference)
    {
        Write-Warn "[WhatIf] Would install kubectl via the Kubernetes apt repository."
        return
    }

    Write-Info "Setting up Kubernetes apt repository..."

    $exitCode = Invoke-Elevated @("apt-get", "install", "-y",
        "apt-transport-https", "ca-certificates", "curl", "gnupg")
    if ($exitCode -ne 0) { Write-Fail "Failed to install kubectl repository prerequisites."; exit 1 }

    $exitCode = Invoke-Elevated @("install", "-m", "0755", "-d", "/etc/apt/keyrings")
    if ($exitCode -ne 0) { Write-Fail "Failed to create /etc/apt/keyrings directory."; exit 1 }

    # Use a stable channel matching the minimum version (v1.28)
    $k8sChannel = "v$($minimumKubectlVersion.Major).$($minimumKubectlVersion.Minor)"
    $k8sRepoUrl = "https://pkgs.k8s.io/core:/stable:/$k8sChannel/deb"

    Write-Info "Downloading Kubernetes GPG key..."
    $exitCode = Invoke-Elevated @("bash", "-c",
        "curl -fsSL $k8sRepoUrl/Release.key | gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg")
    if ($exitCode -ne 0) { Write-Fail "Failed to add Kubernetes GPG key."; exit 1 }

    $repoLine = "deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] $k8sRepoUrl/ /"
    $exitCode = Invoke-Elevated @("bash", "-c",
        "echo '$repoLine' > /etc/apt/sources.list.d/kubernetes.list")
    if ($exitCode -ne 0) { Write-Fail "Failed to add Kubernetes apt repository."; exit 1 }

    $exitCode = Invoke-Elevated @("apt-get", "update")
    if ($exitCode -ne 0) { Write-Fail "apt-get update failed after adding Kubernetes repository."; exit 1 }

    $exitCode = Invoke-Elevated @("apt-get", "install", "-y", "kubectl")
    if ($exitCode -ne 0) { Write-Fail "kubectl installation failed."; exit 1 }

    Write-Success "kubectl installed."
}

function Install-Kubectl
{
    Write-Step "kubectl"

    $kubectlCmd = Get-Command kubectl -ErrorAction SilentlyContinue

    if ($kubectlCmd -and -not $Force)
    {
        $rawVersion    = kubectl version --client --output=json 2>$null | ConvertFrom-Json
        $versionString = $rawVersion.clientVersion.gitVersion -replace '^v', ''
        $parsedVersion = [Version]::new(0, 0, 0)
        [void][Version]::TryParse($versionString, [ref]$parsedVersion)

        if ($parsedVersion -ge $minimumKubectlVersion)
        {
            Write-Success "kubectl v$versionString — OK (minimum v$minimumKubectlVersion required)."
            return
        }

        Write-Warn "kubectl v$versionString is below the minimum required version (v$minimumKubectlVersion)."
        Write-Info "Upgrading kubectl..."
    }

    if ($script:onWindows)
    {
        Install-WingetPackage -PackageId "Kubernetes.kubectl" -DisplayName "kubectl"

        # Refresh PATH.
        $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" +
                    [System.Environment]::GetEnvironmentVariable("PATH", "User")
    }
    else
    {
        Install-KubectlLinux
    }
}

# ── Chocolatey (Windows only) ─────────────────────────────────────────────────

function Install-Chocolatey
{
    Write-Step "Chocolatey (optional — required for Setup-FeatBitProxy.ps1)"

    if ($script:onLinux)
    {
        Write-Info "Chocolatey is a Windows-only package manager — skipping on Linux."
        return
    }

    $chocoCmd = Get-Command choco -ErrorAction SilentlyContinue

    if ($chocoCmd -and -not $Force)
    {
        $chocoVersion = choco --version 2>$null
        Write-Success "Chocolatey $chocoVersion is already installed."
        return
    }

    if (-not (Test-Administrator))
    {
        Write-Warn "Installing Chocolatey requires an Administrator session — skipping."
        Write-Info "To install manually, open an elevated PowerShell and run:"
        Write-Info "  Set-ExecutionPolicy Bypass -Scope Process -Force"
        Write-Info "  [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072"
        Write-Info "  Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))"
        return
    }

    if ($WhatIfPreference)
    {
        Write-Warn "[WhatIf] Would install Chocolatey via the official install script."
        return
    }

    Write-Info "Installing Chocolatey..."

    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol =
        [System.Net.ServicePointManager]::SecurityProtocol -bor 3072

    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString(
        'https://community.chocolatey.org/install.ps1'))

    # Reload profile so choco is on PATH.
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("PATH", "User")

    $chocoCmd = Get-Command choco -ErrorAction SilentlyContinue
    if (-not $chocoCmd)
    {
        Write-Fail "Chocolatey installation appeared to succeed but 'choco' was not found on PATH."
        Write-Info "Open a new PowerShell session and run 'choco --version' to verify."
        return
    }

    Write-Success "Chocolatey installed successfully."
}

# ── Summary ───────────────────────────────────────────────────────────────────

function Write-Summary
{
    Write-Step "Summary"

    $tools = @(
        @{ Name = "PowerShell"; Command = "pwsh" },
        @{ Name = "Docker";     Command = "docker" },
        @{ Name = "Minikube";   Command = "minikube" },
        @{ Name = "kubectl";    Command = "kubectl" }
    )

    if ($script:onWindows -and -not $SkipChocolatey)
    {
        $tools += @{ Name = "Chocolatey"; Command = "choco" }
    }

    foreach ($tool in $tools)
    {
        $found = Get-Command $tool.Command -ErrorAction SilentlyContinue
        if ($found)
        {
            Write-Success "$($tool.Name) is available at $($found.Source)"
        }
        else
        {
            Write-Warn "$($tool.Name) was not found on PATH — a new terminal session may be required."
        }
    }

    Write-Host ""

    if ($script:restartRequired)
    {
        Write-Warn "A restart or log-out/log-in is required before Docker Desktop is fully operational."
        Write-Info "After restarting, re-run this script to confirm all prerequisites are met."
    }
    elseif ($script:newSessionRequired)
    {
        Write-Warn "Start a new shell session before running Docker without sudo (docker group membership)."
        Write-Info "After opening a new session, re-run this script to confirm all prerequisites are met."
    }
    else
    {
        Write-Success "All prerequisites are present. You are ready to run Deploy-FeatBitClusters.ps1."
    }
}

# ── Entry point ───────────────────────────────────────────────────────────────

$script:restartRequired    = $false
$script:newSessionRequired = $false

if ($WhatIfPreference)
{
    Write-Host "`n[WhatIf] Dry-run mode — no changes will be made.`n" -ForegroundColor Magenta
}

$platform = if ($script:onWindows) { "Windows" } else { "Linux (Ubuntu/Debian)" }
Write-Host "Platform detected: $platform" -ForegroundColor Cyan

if ($script:onWindows) { Assert-Winget }
else                   { Assert-Apt }

Test-PowerShellVersion
Install-Docker
Install-Minikube
Install-Kubectl

if (-not $SkipChocolatey)
{
    Install-Chocolatey
}

Write-Summary
