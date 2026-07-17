<#
.SYNOPSIS
    Sets up nginx reverse proxy for FeatBit with DNS-based access.

.DESCRIPTION
    This script performs the following operations:
    1. Installs nginx if not already present
       - Windows: via Chocolatey (requires Administrator)
       - Linux:   via apt-get (requires root or sudo)
    2. Configures nginx as a reverse proxy for both clusters
    3. Updates the hosts file with DNS entries
    4. Updates FeatBit UI deployments with correct URLs
    5. Starts port forwarding and nginx

    DNS Names:
    - featbit.west.local                  -> West UI
    - featbit-api.west.local              -> West API
    - featbit-eval.west.local             -> West Evaluation
    - featbit-kafka.west.local            -> West Kafka UI
    - featbit-control-plane.west.local    -> West Control Plane
    - redis.west.local                    -> West Redis (port 6379)
    - featbit.east.local                  -> East UI
    - featbit-api.east.local              -> East API
    - featbit-eval.east.local             -> East Evaluation
    - featbit-kafka.east.local            -> East Kafka UI
    - featbit-control-plane.east.local    -> East Control Plane
    - redis.east.local                    -> East Redis (port 6380)

.PARAMETER NginxPath
    (Windows only) Path to nginx installation directory. Default: C:\nginx

.PARAMETER SkipNginxInstall
    Skip nginx installation if it is already installed.

.EXAMPLE
    .\Setup-FeatBitProxy.ps1
    Installs and configures nginx with default settings.

.EXAMPLE
    .\Setup-FeatBitProxy.ps1 -SkipNginxInstall
    Configures nginx assuming it is already installed.

.NOTES
    Requires elevated privileges:
    - Windows: run from an Administrator PowerShell session
    - Linux:   run as your normal user. The script acquires root ONCE (a single
               password prompt, passwordless sudo, or already-root) and escalates
               only the nginx/hosts/systemd commands via `sudo -n`; kubectl runs
               as you so it uses your kubeconfig. Do NOT prefix with sudo — that
               makes kubectl use root's kubeconfig. If root is needed but there's
               no terminal and no passwordless sudo, it fails fast with guidance.

    On Linux, nginx is managed as a systemd service and configuration is
    written to /etc/nginx/sites-available/featbit (symlinked into sites-enabled).
#>

[CmdletBinding()]
param(
    [string]$NginxPath = "C:\nginx",
    [switch]$SkipNginxInstall
)

$ErrorActionPreference = "Stop"

# ── Platform detection ────────────────────────────────────────────────────────

$script:onWindows = $IsWindows -or ($PSVersionTable.PSVersion.Major -le 5)
$script:onLinux   = $IsLinux

if (-not $script:onWindows -and -not $script:onLinux)
{
    Write-Host "✗ This script supports Windows and Ubuntu/Debian Linux only." -ForegroundColor Red
    exit 1
}

# ── Shared privilege/sudo-session helpers (Linux) ───────────────────────────────
# Provides Initialize-FbSudoSession / Invoke-FbSudo so root is acquired at most
# once per run and never prompts mid-run. The helper is a no-op on Windows.
if ($script:onLinux)
{
    $privHelper = Join-Path $PSScriptRoot "Initialize-Privilege.ps1"
    if (-not (Test-Path $privHelper)) { Write-Host "✗ Initialize-Privilege.ps1 not found at $privHelper" -ForegroundColor Red; exit 1 }
    . $privHelper
}

# ── Console helpers ───────────────────────────────────────────────────────────

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

function Write-Warn {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

function Write-Fail {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

# Runs a kubectl invocation and checks $LASTEXITCODE afterward. On non-zero
# exit, Write-Fail's the given message and exits 1 immediately — without this,
# an early failure (e.g. apply) is masked once a later call (e.g. rollout
# status) in the same block runs and overwrites $LASTEXITCODE.
function Invoke-Checked
{
    param(
        [Parameter(Mandatory)][scriptblock]$Command,
        [Parameter(Mandatory)][string]$FailureMessage
    )
    & $Command
    if ($LASTEXITCODE -ne 0)
    {
        Write-Fail $FailureMessage
        exit 1
    }
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
        return ((id -u) -eq "0")
    }
}

function Invoke-Elevated
{
    param([string[]]$ArgumentList)

    if ($script:onLinux -and -not (Test-Administrator))
    {
        # Non-interactive (-n): the sudo session was primed once up front by
        # Initialize-FbSudoSession, so this reuses the cached ticket (or NOPASSWD)
        # and never stops to prompt mid-run.
        & sudo -n @ArgumentList
    }
    else
    {
        & $ArgumentList[0] $ArgumentList[1..($ArgumentList.Length - 1)]
    }

    return $LASTEXITCODE
}

# ── Privilege check ───────────────────────────────────────────────────────────

if ($script:onWindows)
{
    if (-not (Test-Administrator))
    {
        Write-Fail "This script requires an Administrator PowerShell session."
        Write-Info "Re-run from an elevated prompt."
        exit 1
    }
}
else
{
    # Linux: acquire root ONCE up front — interactive prompt (single password),
    # passwordless sudo, or already-root — and keep the ticket warm for the run.
    # If root is needed but there's no terminal and no passwordless sudo, fail
    # fast here with guidance instead of part-applying config. Only the specific
    # nginx/hosts/systemd commands escalate (Invoke-Elevated -> sudo -n); the
    # kubectl UI-deploy calls run as the normal user so they use the caller's
    # kubeconfig rather than root's.
    [void](Initialize-FbSudoSession -Required -Purpose "nginx config, /etc/hosts, and the nginx reload")
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# ── kubeconfig under sudo ─────────────────────────────────────────────────────
# When invoked as "sudo pwsh ...", the process runs as root but HOME may resolve
# to /root, which has no kubeconfig.  Detect the original caller via SUDO_USER
# and point KUBECONFIG at their config so kubectl can find the west/east contexts.

if ($script:onLinux -and $env:SUDO_USER -and -not $env:KUBECONFIG)
{
    $sudoUserHome = (& getent passwd $env:SUDO_USER 2>$null) -split ":" | Select-Object -Index 5
    if (-not $sudoUserHome) { $sudoUserHome = "/home/$env:SUDO_USER" }
    $candidateKube = "$sudoUserHome/.kube/config"
    if (Test-Path $candidateKube)
    {
        $env:KUBECONFIG = $candidateKube
        Write-Info "Running as sudo — using kubeconfig: $candidateKube"
    }
}

# ── nginx install ─────────────────────────────────────────────────────────────

Write-Step "nginx"

if ($script:onWindows)
{
    # Auto-detect nginx installation from common locations
    $detectedNginxPath = $null
    $searchPaths = @("C:\nginx", "C:\tools\nginx", "C:\tools\nginx-*")

    foreach ($path in $searchPaths)
    {
        $resolved = Resolve-Path $path -ErrorAction SilentlyContinue
        if ($resolved)
        {
            foreach ($resolvedPath in $resolved)
            {
                if (Test-Path "$resolvedPath\nginx.exe")
                {
                    $detectedNginxPath = $resolvedPath.Path
                    break
                }
            }
        }
        if ($detectedNginxPath) { break }
    }

    if ($detectedNginxPath)
    {
        $NginxPath = $detectedNginxPath
        Write-Success "Found nginx at $NginxPath"
    }
    elseif (-not $SkipNginxInstall)
    {
        Write-Info "Installing nginx via Chocolatey..."
        choco install nginx -y
        if ($LASTEXITCODE -ne 0) { Write-Fail "Failed to install nginx."; exit 1 }

        # Chocolatey may install to a versioned directory (e.g. C:\tools\nginx-1.29.8)
        # rather than the default $NginxPath. Re-run detection to find the real path.
        $detectedNginxPath = $null
        foreach ($path in $searchPaths)
        {
            $resolved = Resolve-Path $path -ErrorAction SilentlyContinue
            if ($resolved)
            {
                foreach ($resolvedPath in $resolved)
                {
                    if (Test-Path "$resolvedPath\nginx.exe")
                    {
                        $detectedNginxPath = $resolvedPath.Path
                        break
                    }
                }
            }
            if ($detectedNginxPath) { break }
        }
        if ($detectedNginxPath) { $NginxPath = $detectedNginxPath }
        Write-Success "nginx installed at $NginxPath"
    }
}
else
{
    # Linux
    # Get-Command searches PATH only; nginx lives in /usr/sbin which may be absent
    # from root's PATH when invoked via sudo. Fall back to probing well-known paths.
    $nginxCmd = Get-Command nginx -ErrorAction SilentlyContinue
    if (-not $nginxCmd) {
        $wellKnown = @("/usr/sbin/nginx", "/usr/local/sbin/nginx", "/usr/local/bin/nginx")
        foreach ($p in $wellKnown) {
            if (Test-Path $p) { $nginxCmd = $p; break }
        }
    }

    if ($nginxCmd)
    {
        $nginxBin = if ($nginxCmd -is [string]) { $nginxCmd } else { $nginxCmd.Source }
        $nginxVersion = (& $nginxBin -v 2>&1)
        Write-Success "nginx is already installed ($nginxVersion)."
    }
    elseif (-not $SkipNginxInstall)
    {
        Write-Info "Installing nginx via apt-get..."
        $exitCode = Invoke-Elevated @("apt-get", "update")
        if ($exitCode -ne 0) { Write-Warn "apt-get update returned non-zero (possibly a broken third-party repo). Attempting install anyway..." }

        $exitCode = Invoke-Elevated @("apt-get", "install", "-y", "nginx")
        if ($exitCode -ne 0) { Write-Fail "Failed to install nginx."; exit 1 }

        Write-Success "nginx installed."
    }
    else
    {
        Write-Warn "-SkipNginxInstall specified but nginx was not found on PATH."
        Write-Info "Install it manually: sudo apt-get install -y nginx"
        exit 1
    }
}

# ── nginx configuration ───────────────────────────────────────────────────────

Write-Step "Configuring nginx"

$sourceNginxConf = Join-Path $scriptDir "nginx.conf"
if (-not (Test-Path $sourceNginxConf))
{
    Write-Fail "Could not find nginx.conf in script directory."
    Write-Info "Expected: $sourceNginxConf"
    exit 1
}

if ($script:onWindows)
{
    $nginxConfDir  = Join-Path $NginxPath "conf"
    $nginxConfPath = Join-Path $nginxConfDir "nginx.conf"
    $nginxLogsDir  = Join-Path $NginxPath "logs"

    if (-not (Test-Path $nginxConfDir))
    {
        New-Item -ItemType Directory -Path $nginxConfDir -Force | Out-Null
    }
    if (-not (Test-Path $nginxLogsDir))
    {
        New-Item -ItemType Directory -Path $nginxLogsDir -Force | Out-Null
    }

    Write-Info "Writing nginx.conf to $nginxConfPath..."
    Copy-Item $sourceNginxConf $nginxConfPath -Force
    Write-Success "nginx configuration written."
}
else
{
    # On Ubuntu/Debian nginx includes /etc/nginx/sites-enabled/* from the
    # main nginx.conf, so we drop our config there rather than replacing
    # the main file.  The source nginx.conf is a full standalone config
    # (worker_processes / events / http { ... }) valid for Windows nginx.
    # For sites-available we need only the server {} blocks from inside http {}.
    $sitesAvailable = "/etc/nginx/sites-available/featbit"
    $sitesEnabled   = "/etc/nginx/sites-enabled/featbit"

    Write-Info "Writing nginx config to $sitesAvailable..."

    # nginx.conf is a full standalone config (worker_processes/events/http{})
    # valid for Windows nginx.  For Ubuntu sites-available we keep the
    # http{}-context blocks the server blocks DEPEND ON — the upstream {}
    # groups (referenced via proxy_pass http://featbit_ui|api|eval) and the
    # $cors_origin map {} — alongside the server {} blocks themselves.
    # Dropping the upstream/map blocks (server-only extraction) makes nginx
    # treat "featbit_ui" as a DNS name => "host not found in upstream".
    # The system nginx.conf's http {} already provides mime.types,
    # default_type, sendfile, etc., so those scalars are left out.
    # Use brace-depth counting so we don't need a full parser.
    $lines = Get-Content $sourceNginxConf
    $serverBlocks = [System.Collections.Generic.List[string]]::new()
    $depth = 0
    $inServer = $false
    $currentBlock = [System.Collections.Generic.List[string]]::new()

    foreach ($line in $lines)
    {
        # Match the opening line of a top-level http{} block we need to keep:
        # server {}, upstream <name> {}, or map <args> {}. The \b after the
        # keyword prevents matching the map_hash_bucket_size /
        # server_names_hash_bucket_size scalar directives. Inner "server
        # 127.0.0.1:..." lines of an upstream block are skipped because the
        # match is guarded by -not $inServer (we're already capturing).
        if (-not $inServer -and $line -match '^\s*(server|upstream|map)\b.*\{')
        {
            $inServer = $true
            $depth = 0
        }

        if ($inServer)
        {
            $currentBlock.Add($line)
            $depth += ($line.ToCharArray() | Where-Object { $_ -eq '{' }).Count
            $depth -= ($line.ToCharArray() | Where-Object { $_ -eq '}' }).Count

            if ($depth -le 0 -and $currentBlock.Count -gt 0)
            {
                $serverBlocks.AddRange($currentBlock)
                $serverBlocks.Add("")   # blank line between blocks
                $currentBlock.Clear()
                $inServer = $false
            }
        }
    }
    $siteConf = $serverBlocks -join "`n"

    $tmpFile = [System.IO.Path]::GetTempFileName()
    Set-Content -Path $tmpFile -Value $siteConf -Encoding UTF8
    $exitCode = Invoke-Elevated @("cp", $tmpFile, $sitesAvailable)
    Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue
    if ($exitCode -ne 0) { Write-Fail "Failed to write nginx config."; exit 1 }

    if (-not (Test-Path $sitesEnabled))
    {
        Write-Info "Creating symlink in sites-enabled..."
        $exitCode = Invoke-Elevated @("ln", "-s", $sitesAvailable, $sitesEnabled)
        if ($exitCode -ne 0) { Write-Fail "Failed to create sites-enabled symlink."; exit 1 }
    }

    Write-Success "nginx configuration written."
}

# ── Hosts file ────────────────────────────────────────────────────────────────

Write-Step "Updating hosts file"

$hostsFile = if ($script:onWindows) {
    "C:\Windows\System32\drivers\etc\hosts"
} else {
    "/etc/hosts"
}

$hostsEntries = @(
    "127.0.0.1 featbit.local featbit-api.local featbit-eval.local",
    "127.0.0.1 featbit.west.local featbit-api.west.local featbit-eval.west.local featbit-kafka.west.local featbit-control-plane.west.local redis.west.local",
    "127.0.0.1 featbit.east.local featbit-api.east.local featbit-eval.east.local featbit-kafka.east.local featbit-control-plane.east.local redis.east.local",
    "127.0.0.1 mongodb-0.west.local mongodb-1.west.local mongodb-2.east.local"
)

$hostsContent = Get-Content $hostsFile -Raw

$needsUpdate = $false
foreach ($entry in $hostsEntries)
{
    if ($hostsContent -notmatch [regex]::Escape($entry)) { $needsUpdate = $true; break }
}

if ($needsUpdate)
{
    Write-Info "Adding DNS entries to $hostsFile..."

    $linesToAdd = "`n# FeatBit DNS Entries"
    foreach ($entry in $hostsEntries)
    {
        if ($hostsContent -notmatch [regex]::Escape($entry))
        {
            $linesToAdd += "`n$entry"
        }
    }

    if ($script:onWindows)
    {
        Add-Content -Path $hostsFile -Value $linesToAdd
    }
    else
    {
        $exitCode = Invoke-Elevated @("bash", "-c", "printf '%s\n' '$linesToAdd' >> $hostsFile")
        if ($exitCode -ne 0) { Write-Fail "Failed to update $hostsFile."; exit 1 }
    }

    Write-Success "Hosts file updated."
}
else
{
    Write-Success "Hosts file already configured."
}

# ── FeatBit UI deployments ────────────────────────────────────────────────────

Write-Step "Updating FeatBit UI Deployments"

$westUIYaml = @'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ui
  namespace: featbit
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ui
  template:
    metadata:
      labels:
        app: ui
    spec:
      containers:
        - env:
            - name: API_URL
              value: http://featbit-api.west.local
            - name: DEMO_URL
              value: https://featbit-samples.vercel.app
            - name: EVALUATION_URL
              value: http://featbit-eval.west.local
            - name: DISPLAY_API_URL
              value: http://featbit.local
            - name: DISPLAY_EVALUATION_URL
              value: http://featbit.local
          image: host.minikube.internal:5000/featbit/featbit-ui:latest
          name: ui
          ports:
            - containerPort: 80
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
'@

$eastUIYaml = @'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ui
  namespace: featbit
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ui
  template:
    metadata:
      labels:
        app: ui
    spec:
      containers:
        - env:
            - name: API_URL
              value: http://featbit-api.east.local
            - name: DEMO_URL
              value: https://featbit-samples.vercel.app
            - name: EVALUATION_URL
              value: http://featbit-eval.east.local
            - name: DISPLAY_API_URL
              value: http://featbit.local
            - name: DISPLAY_EVALUATION_URL
              value: http://featbit.local
          image: host.minikube.internal:5000/featbit/featbit-ui:latest
          name: ui
          ports:
            - containerPort: 80
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
'@

Write-Info "Updating west UI..."
Invoke-Checked -FailureMessage "west UI apply failed" -Command { $westUIYaml | kubectl --context west apply -f - | Out-Null }
Invoke-Checked -FailureMessage "west UI rollout restart failed" -Command { kubectl --context west -n featbit rollout restart deployment/ui | Out-Null }
Invoke-Checked -FailureMessage "west UI rollout not ready" -Command { kubectl --context west -n featbit rollout status deployment/ui --timeout=180s | Out-Null }
Write-Success "West UI updated."

Write-Info "Updating east UI..."
Invoke-Checked -FailureMessage "east UI apply failed" -Command { $eastUIYaml | kubectl --context east apply -f - | Out-Null }
Invoke-Checked -FailureMessage "east UI rollout restart failed" -Command { kubectl --context east -n featbit rollout restart deployment/ui | Out-Null }
Invoke-Checked -FailureMessage "east UI rollout not ready" -Command { kubectl --context east -n featbit rollout status deployment/ui --timeout=180s | Out-Null }
Write-Success "East UI updated."

Write-Info "Waiting for UI pods to restart..."
Start-Sleep -Seconds 15

# ── Port forwards ─────────────────────────────────────────────────────────────

Write-Step "Starting Port Forwards"

$portForwardScript = Join-Path $scriptDir "Start-PortForwards.ps1"

if ($script:onWindows)
{
    Start-Process pwsh -ArgumentList @(
        "-NoExit",
        "-WindowStyle", "Minimized",
        "-File", $portForwardScript
    ) -WindowStyle Minimized
    Write-Success "Port forward manager started (minimized window)."
}
else
{
    # On Linux there is no window manager — start as a detached background process.
    Start-Process pwsh -ArgumentList @("-NoExit", "-File", $portForwardScript)
    Write-Success "Port forward manager started in the background."
    Write-Info "Run './Stop-PortForwards.ps1' or 'pkill kubectl' to stop port forwards."
}

Start-Sleep -Seconds 10

# ── Port 80 pre-flight (Windows) ──────────────────────────────────────────────
# WSL's wslrelay.exe will bind 127.0.0.1:80 whenever a process inside a running
# distro listens on :80. That loopback listener is more specific than Windows
# nginx's 0.0.0.0:80 bind, so browser requests to featbit.*.local (which
# resolve to 127.0.0.1) get routed into WSL instead of our proxy — users see
# the WSL distro's default "Welcome to nginx!" page. Detect and remediate.

if ($script:onWindows)
{
    Write-Step "Checking port 80 availability"

    $loopbackListeners = Get-NetTCPConnection -LocalPort 80 -State Listen -ErrorAction SilentlyContinue |
        Where-Object { $_.LocalAddress -eq '127.0.0.1' -or $_.LocalAddress -eq '::1' }

    $hijacker = $null
    foreach ($conn in $loopbackListeners)
    {
        $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $($conn.OwningProcess)" -ErrorAction SilentlyContinue
        if ($proc -and $proc.Name -ne 'nginx.exe')
        {
            $hijacker = $proc
            break
        }
    }

    if (-not $hijacker)
    {
        Write-Success "127.0.0.1:80 is free (or held by nginx) — nothing to do."
    }
    elseif ($hijacker.Name -ieq 'wslrelay.exe')
    {
        Write-Warn "127.0.0.1:80 is held by wslrelay.exe (PID $($hijacker.ProcessId))."
        Write-Info "A service inside WSL is listening on port 80 — requests to featbit.*.local"
        Write-Info "would be routed into WSL instead of the Windows nginx proxy."
        Write-Info "Attempting to stop nginx inside WSL..."

        & wsl -u root -- bash -c "service nginx stop 2>/dev/null; systemctl stop nginx 2>/dev/null; systemctl disable nginx 2>/dev/null; true" 2>$null | Out-Null
        Start-Sleep -Seconds 3

        $stillBlocked = Get-NetTCPConnection -LocalPort 80 -State Listen -ErrorAction SilentlyContinue |
            Where-Object { $_.LocalAddress -eq '127.0.0.1' -or $_.LocalAddress -eq '::1' } |
            Where-Object {
                $p = Get-CimInstance Win32_Process -Filter "ProcessId = $($_.OwningProcess)" -ErrorAction SilentlyContinue
                $p -and $p.Name -ne 'nginx.exe'
            }

        if ($stillBlocked)
        {
            Write-Fail "127.0.0.1:80 is still held by a non-nginx process after stopping WSL nginx."
            Write-Info "Remediate manually, then re-run this script:"
            Write-Info "  wsl -u root service nginx stop"
            Write-Info "  wsl -u root systemctl disable nginx"
            Write-Info "  wsl --shutdown    # last resort — kills the wslrelay forwarder"
            exit 1
        }
        Write-Success "WSL port 80 listener stopped."
    }
    else
    {
        Write-Fail "127.0.0.1:80 is held by $($hijacker.Name) (PID $($hijacker.ProcessId)) — not nginx, not WSL."
        Write-Info "Stop that process, then re-run this script."
        exit 1
    }
}

# ── nginx test and start ──────────────────────────────────────────────────────

Write-Step "Starting nginx"

if ($script:onWindows)
{
    Set-Location $NginxPath
    $testResult = & .\nginx.exe -t 2>&1
    if ($LASTEXITCODE -ne 0)
    {
        Write-Fail "nginx configuration test failed:"
        Write-Host $testResult
        exit 1
    }
    Write-Success "nginx configuration is valid."

    $nginxRunning = Get-Process nginx -ErrorAction SilentlyContinue
    if ($nginxRunning)
    {
        # nginx -s reload uses a named Win32 event tied to the master's PID and session.
        # If nginx was started in a different elevated session the OpenEvent call fails
        # with "Access is denied" even from an admin prompt. Always stop + restart so
        # the new master is owned by the current session and future reloads work.
        Write-Info "Stopping existing nginx to pick up new configuration..."
        taskkill /F /IM nginx.exe 2>&1 | Out-Null
        Start-Sleep -Seconds 2
        Start-Process -FilePath "$NginxPath\nginx.exe" -WorkingDirectory $NginxPath -WindowStyle Hidden
    }
    else
    {
        Start-Process -FilePath "$NginxPath\nginx.exe" -WorkingDirectory $NginxPath -WindowStyle Hidden
    }

    Start-Sleep -Seconds 3

    if (Get-Process nginx -ErrorAction SilentlyContinue)
    {
        Write-Success "nginx is running."
    }
    else
    {
        Write-Fail "Failed to start nginx."
        exit 1
    }
}
else
{
    $testResult = Invoke-Elevated @("nginx", "-t")
    if ($testResult -ne 0)
    {
        Write-Fail "nginx configuration test failed (exit code $testResult)."
        Write-Info "Check: sudo nginx -t"
        exit 1
    }
    Write-Success "nginx configuration is valid."

    # Use systemctl if available, otherwise invoke nginx directly
    $systemctl = Get-Command systemctl -ErrorAction SilentlyContinue
    if ($systemctl)
    {
        $status = Invoke-Elevated @("systemctl", "is-active", "--quiet", "nginx")
        if ($status -eq 0)
        {
            Write-Info "nginx is already running — reloading configuration..."
            Invoke-Elevated @("systemctl", "reload", "nginx") | Out-Null
        }
        else
        {
            Invoke-Elevated @("systemctl", "start", "nginx") | Out-Null
        }

        Start-Sleep -Seconds 2

        $status = Invoke-Elevated @("systemctl", "is-active", "--quiet", "nginx")
        if ($status -eq 0)
        {
            Write-Success "nginx is running."
        }
        else
        {
            Write-Fail "Failed to start nginx. Check: sudo systemctl status nginx"
            exit 1
        }
    }
    else
    {
        # Fallback for non-systemd environments
        Invoke-Elevated @("nginx") | Out-Null
        Start-Sleep -Seconds 2

        if (Get-Command nginx -ErrorAction SilentlyContinue)
        {
            Write-Success "nginx started."
        }
        else
        {
            Write-Fail "Failed to start nginx."
            exit 1
        }
    }
}

# ── Summary ───────────────────────────────────────────────────────────────────

Write-Step "Setup Complete"

Write-Host ""
Write-Host "Access FeatBit using DNS names:" -ForegroundColor Green
Write-Host "  West Cluster: http://featbit.west.local" -ForegroundColor Cyan
Write-Host "  East Cluster: http://featbit.east.local" -ForegroundColor Cyan

Write-Host ""
Write-Host "Direct API Access:" -ForegroundColor Yellow
Write-Host "  West API:           http://featbit-api.west.local" -ForegroundColor Gray
Write-Host "  East API:           http://featbit-api.east.local" -ForegroundColor Gray
Write-Host "  West Control Plane: http://featbit-control-plane.west.local" -ForegroundColor Gray
Write-Host "  East Control Plane: http://featbit-control-plane.east.local" -ForegroundColor Gray

Write-Host ""
Write-Host "Redis Access (via redis-cli):" -ForegroundColor Yellow
Write-Host "  West Redis: redis-cli -h redis.west.local -p 6379" -ForegroundColor Gray
Write-Host "  East Redis: redis-cli -h redis.east.local -p 6380" -ForegroundColor Gray

Write-Host ""
Write-Host "Management Commands:" -ForegroundColor Yellow
if ($script:onWindows)
{
    Write-Host "  Stop nginx:    Stop-Process -Name nginx" -ForegroundColor Gray
    Write-Host "  Reload nginx:  Push-Location '$NginxPath'; .\nginx.exe -s reload; Pop-Location" -ForegroundColor Gray
    Write-Host "  View logs:     Get-Content '$NginxPath\logs\error.log' -Tail 50" -ForegroundColor Gray
}
else
{
    Write-Host "  Stop nginx:    sudo systemctl stop nginx" -ForegroundColor Gray
    Write-Host "  Reload nginx:  sudo systemctl reload nginx" -ForegroundColor Gray
    Write-Host "  View logs:     sudo tail -50 /var/log/nginx/error.log" -ForegroundColor Gray
    Write-Host "  Stop forwards: pkill kubectl" -ForegroundColor Gray
}

Write-Host ""
