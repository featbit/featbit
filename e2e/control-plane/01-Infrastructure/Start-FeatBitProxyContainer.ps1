<#
.SYNOPSIS
    Rootless, containerized nginx reverse proxy for FeatBit (Linux) — no sudo.

.DESCRIPTION
    Runs the FeatBit reverse proxy as a Docker container instead of system nginx,
    eliminating every privileged step the system-nginx model needs:

      - no `apt-get install nginx`        (uses the nginx container image)
      - no writes to /etc/nginx           (config is mounted from a user file)
      - no writes to /etc/hosts           (uses *.<BaseDomain> wildcard DNS)
      - no systemctl / root port-80 bind  (the Docker daemon binds the port)

    It runs with --network host, so it reuses the SAME 127.0.0.1 port-forwards
    the rest of the toolchain already uses (Start-PortForwards.ps1) and needs no
    host.docker.internal plumbing. The only requirement is Docker group
    membership, which is already required for Minikube's docker driver — so on a
    machine that can run the clusters, this proxy needs no further privilege.

    Single source of truth: the container config is DERIVED from the shared
    nginx.conf in this directory (same upstreams, CORS, WebSocket, SPA-fallback
    logic). We only rewrite the *.local server names to *.<BaseDomain>, set the
    listen port, and send logs to the container's stdout.

    Default hostnames (resolve to 127.0.0.1 via public wildcard DNS, no setup):
      http://featbit.<BaseDomain>                  load-balanced UI (west+east)
      http://featbit-west.<BaseDomain>             west UI
      http://featbit-east.<BaseDomain>             east UI
      http://featbit-api-west.<BaseDomain>         west API     (api-east, etc.)
      http://featbit-eval-west.<BaseDomain>        west eval
      http://featbit-control-plane-west.<BaseDomain>
      http://featbit-kafka-west.<BaseDomain>

.PARAMETER HostPort
    Host port the proxy listens on. Default 80. Use a high port (e.g. 8080) if
    something already holds 80 (such as a leftover system nginx from the old
    model) and you don't want to remove it.

.PARAMETER BaseDomain
    Wildcard-DNS base that resolves to 127.0.0.1. Default 127.0.0.1.sslip.io.
    Any label under it (e.g. featbit-west.127.0.0.1.sslip.io) resolves to
    127.0.0.1 with no /etc/hosts entry. nip.io works too: 127.0.0.1.nip.io.

.PARAMETER Image
    nginx image to run. Default nginx:1.27-alpine.

.PARAMETER Name
    Container name. Default featbit-proxy.

.PARAMETER Remove
    Stop and remove the proxy container, then exit.

.EXAMPLE
    pwsh ./Start-FeatBitProxyContainer.ps1
    Start the proxy on port 80 (zero sudo) using 127.0.0.1.sslip.io names.

.EXAMPLE
    pwsh ./Start-FeatBitProxyContainer.ps1 -HostPort 8080
    Start on 8080 (e.g. when a legacy system nginx still holds 80).

.NOTES
    Linux only. The system-nginx model (Setup-FeatBitProxy.ps1) is unchanged and
    still used by the Windows WSL/Hyper-V quickstarts.
#>
[CmdletBinding()]
param(
    [int]$HostPort      = 80,
    [string]$BaseDomain = "127.0.0.1.sslip.io",
    [string]$Image      = "nginx:1.27-alpine",
    [string]$Name       = "featbit-proxy",
    [switch]$Remove
)

$ErrorActionPreference = "Stop"

function Write-Step    { param([string]$M) Write-Host "`n=== $M ===" -ForegroundColor Cyan }
function Write-Success { param([string]$M) Write-Host "✓ $M" -ForegroundColor Green }
function Write-Info    { param([string]$M) Write-Host "  $M" -ForegroundColor Gray }
function Write-Warn    { param([string]$M) Write-Host "⚠ $M" -ForegroundColor Yellow }
function Write-Fail    { param([string]$M) Write-Host "✗ $M" -ForegroundColor Red }

if (-not $IsLinux) {
    Write-Fail "Start-FeatBitProxyContainer.ps1 is Linux-only. On Windows use Setup-FeatBitProxy.ps1."
    exit 1
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Fail "docker is not available. Install Docker Engine and ensure your user is in the 'docker' group."
    exit 1
}

# Verify the Docker daemon is reachable as this user (no sudo).
& docker info *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Cannot talk to the Docker daemon as $((& id -un).Trim())."
    Write-Info "Add yourself to the docker group (then start a new shell):"
    Write-Info "  sudo usermod -aG docker `$USER"
    exit 1
}

if ($Remove) {
    Write-Step "Removing FeatBit proxy container"
    & docker rm -f $Name *> $null
    Write-Success "Container '$Name' removed (if it existed)."
    exit 0
}

# ── Derive the container config from the shared nginx.conf ──────────────────────
Write-Step "Generating proxy config"

$sourceConf = Join-Path $PSScriptRoot "nginx.conf"
if (-not (Test-Path $sourceConf)) { Write-Fail "Source nginx.conf not found at $sourceConf"; exit 1 }

# Rewrite the system-nginx config into a container-friendly one:
#   *.west.local -> *-west.<BaseDomain>, *.east.local -> *-east.<BaseDomain>,
#   remaining *.local -> *.<BaseDomain>; listen 80 -> listen $HostPort;
#   relative access_log path -> the container's stdout.
# The proxy_pass 127.0.0.1:<port> targets are kept verbatim — with --network host
# they hit the same host port-forwards everything else uses.
$cfg = (Get-Content $sourceConf -Raw) `
    -replace '\.west\.local', "-west.$BaseDomain" `
    -replace '\.east\.local', "-east.$BaseDomain" `
    -replace '\.local',       ".$BaseDomain" `
    -replace 'listen 80;',    "listen $HostPort;" `
    -replace 'access_log logs/access\.log upstream;', 'access_log /dev/stdout upstream;'

# Replace the static $cors_origin map with a regex that echoes back ANY origin
# under the base domain regardless of port. The browser's Origin header includes
# the port (e.g. http://featbit-west.<base>:8080), but the static map keys are
# portless, so logins fail CORS. Echoing the matched origin (not "*") is required
# because the API responses set Access-Control-Allow-Credentials: true.
$escapedBase = [regex]::Escape($BaseDomain)
$corsMap =
    '    map $http_origin $cors_origin {' + "`n" +
    '        default "";' + "`n" +
    '        "~^http://([a-z0-9-]+\.)?' + $escapedBase + '(:[0-9]+)?$" $http_origin;' + "`n" +
    '    }'
# Use a MatchEvaluator so $ in the replacement is treated literally (not as a
# .NET substitution token). The map block contains no nested braces.
$cfg = [regex]::Replace(
    $cfg,
    '(?s)map\s+\$http_origin\s+\$cors_origin\s*\{.*?\}',
    { param($m) $corsMap })

# Persist the config where the container can mount it for its whole lifetime
# (a temp file could be reaped; the container re-reads this on restart).
$confDir  = Join-Path $HOME ".featbit/proxy"
$confPath = Join-Path $confDir "nginx.conf"
New-Item -ItemType Directory -Path $confDir -Force | Out-Null
Set-Content -Path $confPath -Value $cfg -Encoding UTF8
Write-Success "Config written to $confPath (listen $HostPort, base $BaseDomain)."

# ── Run the container ──────────────────────────────────────────────────────────
Write-Step "Starting containerized proxy"

# Remove any previous instance of OUR container first, so its --network host
# listener (which appears as an 'nginx' process, not 'docker') frees the port
# before the conflict check and a restart picks up regenerated config.
& docker rm -f $Name *> $null

# Pre-flight: if the port is still held after that, something else owns it (e.g. a
# leftover system nginx from the old model); --network host can't bind it.
$portOwner = (& bash -c "ss -ltnp 2>/dev/null | grep -E ':$HostPort\b' | head -1" | Out-String).Trim()
if ($portOwner) {
    Write-Warn "Port $HostPort is already in use by another process:"
    Write-Info "  $portOwner"
    Write-Info "If this is a leftover system nginx from the old proxy model, remove it once:"
    Write-Info "  sudo systemctl disable --now nginx"
    Write-Info "…or re-run with a different port: -HostPort 8080"
    exit 1
}

& docker run -d --name $Name `
    --network host `
    --restart unless-stopped `
    -v "${confPath}:/etc/nginx/nginx.conf:ro" `
    $Image *> $null
if ($LASTEXITCODE -ne 0) { Write-Fail "docker run failed for '$Name'."; exit 1 }

Start-Sleep -Seconds 1

# Validate the running config inside the container.
& docker exec $Name nginx -t *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Fail "nginx config test failed inside the container. Logs:"
    & docker logs --tail 30 $Name
    exit 1
}

$running = (& docker inspect -f '{{.State.Running}}' $Name 2>$null | Out-String).Trim()
if ($running -ne 'true') {
    Write-Fail "Container '$Name' is not running. Logs:"
    & docker logs --tail 30 $Name
    exit 1
}
Write-Success "Containerized proxy '$Name' is running (rootless, no sudo)."

# ── Summary ────────────────────────────────────────────────────────────────────
$portSuffix = if ($HostPort -eq 80) { "" } else { ":$HostPort" }
Write-Step "Proxy ready"
Write-Host ""
Write-Host "Access FeatBit (no /etc/hosts needed — public wildcard DNS):" -ForegroundColor Green
Write-Host "  Load-balanced UI : http://featbit.$BaseDomain$portSuffix" -ForegroundColor Cyan
Write-Host "  West UI          : http://featbit-west.$BaseDomain$portSuffix" -ForegroundColor Cyan
Write-Host "  East UI          : http://featbit-east.$BaseDomain$portSuffix" -ForegroundColor Cyan
Write-Host "  West API         : http://featbit-api-west.$BaseDomain$portSuffix" -ForegroundColor Gray
Write-Host "  East API         : http://featbit-api-east.$BaseDomain$portSuffix" -ForegroundColor Gray
Write-Host ""
Write-Host "Manage:" -ForegroundColor Yellow
Write-Host "  Logs:   docker logs -f $Name" -ForegroundColor Gray
Write-Host "  Stop:   pwsh $PSCommandPath -Remove" -ForegroundColor Gray
Write-Host ""
Write-Info "Port forwards must be running (Start-PortForwards.ps1) for upstreams to resolve."
