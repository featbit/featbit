<#
.SYNOPSIS
    Starts (or tears down) the Docker infrastructure required to run the
    .NET integration tests locally.

.DESCRIPTION
    LOCAL USE ONLY. The GitHub Actions workflows deliberately skip these
    tests (dotnet test --filter "Category!=Integration") because they need
    real external infrastructure; any CI/CD pipeline that does run them has
    its own provisioning mechanism. This script exists so a developer can
    run the FULL suite on their workstation:

        pwsh ./Start-IntegrationTestInfra.ps1
        dotnet test modules/control-plane
        dotnet test modules/back-end
        dotnet test modules/evaluation-server

    What the tests expect (and what this script provides):

    - Shared infra from docker/composes/docker-compose-infra.yml:
        MongoDB 27017 (admin/password), Redis 6379, Kafka 29092, ClickHouse.
      The compose postgresql service is NOT started because it binds 5432,
      which commonly collides with an unrelated local Postgres — the tests
      don't use 5432.
    - Throwaway Postgres instances on ports 5433-5436
      (postgres / please_change_me / featbit) used by the back-end
      lease-store and committed/pending-changes tests. Each test class
      owns one port so parallel classes never share state.
    - Dedicated Redis instances on ports 6380-6394 used by the
      control-plane coordinator/recovery/metrics tests and the
      evaluation-server store tests (fixture prefixes B1/B2/B5, C3B1/C3B2,
      E1, F1, S2, S3, ...). Each fixture's InitializeAsync names the exact
      port it wants; the 6380-6394 range covers all of them with headroom.
      A fixture can be pointed elsewhere via its <PREFIX>_REDIS env var.

    Everything is idempotent: already-running containers are left alone.

.PARAMETER Down
    Tear down the throwaway test containers (featbit-test-*) and stop the
    shared compose services this script started. Volumes are kept.

.EXAMPLE
    pwsh ./Start-IntegrationTestInfra.ps1

.EXAMPLE
    pwsh ./Start-IntegrationTestInfra.ps1 -Down
#>

[CmdletBinding()]
param(
    [switch]$Down
)

$ErrorActionPreference = "Stop"

function Write-Info { param([string]$Message) Write-Host "  $Message" -ForegroundColor Cyan }
function Write-Success { param([string]$Message) Write-Host "  $Message" -ForegroundColor Green }
function Write-Warn { param([string]$Message) Write-Host "  $Message" -ForegroundColor Yellow }

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../../..")).Path
$composeFile = Join-Path $repoRoot "docker/composes/docker-compose-infra.yml"
# The compose file's relative bind mounts (./infra/...) point at the tracked
# config files in <repo root>/infra, so the project directory MUST be the repo
# root. Without this, Docker resolves them against docker/composes/, silently
# creates empty directories there, and ClickHouse fails to start (a directory
# gets mounted over /etc/clickhouse-server/config.xml).
$composeArgs = @("-f", $composeFile, "--project-directory", $repoRoot)
$composeServices = @("mongodb", "redis", "kafka", "init-kafka-topics", "clickhouse-server")

# Ports the test fixtures hard-code (see the InitializeAsync of each
# integration test class — its failure message names the port/prefix).
$postgresPorts = 5433..5436
$redisPorts = 6380..6394

$postgresImage = "postgres:15.10"   # matches docker-compose-infra.yml default
$redisImage = "redis:7-alpine"      # matches the image the test error messages suggest

if ($Down) {
    Write-Info "Removing throwaway test containers..."
    $names = @($postgresPorts | ForEach-Object { "featbit-test-pg-$_" }) +
             @($redisPorts | ForEach-Object { "featbit-test-redis-$_" })
    foreach ($name in $names) {
        if (docker ps -aq --filter "name=^$name$") {
            docker rm -f $name | Out-Null
            Write-Success "removed $name"
        }
    }
    Write-Info "Stopping shared compose services (volumes kept)..."
    docker compose @composeArgs stop $composeServices
    Write-Success "Integration test infrastructure stopped."
    return
}

Write-Info "Starting shared infra (Mongo 27017, Redis 6379, Kafka 29092, ClickHouse)..."
docker compose @composeArgs up -d $composeServices

Write-Info "Starting throwaway Postgres instances ($($postgresPorts -join ', '))..."
foreach ($port in $postgresPorts) {
    $name = "featbit-test-pg-$port"
    if (docker ps -q --filter "name=^$name$") {
        Write-Success "$name already running"
        continue
    }
    docker rm -f $name 2>$null | Out-Null
    docker run -d --name $name -p "${port}:5432" `
        -e POSTGRES_USER=postgres `
        -e POSTGRES_PASSWORD=please_change_me `
        -e POSTGRES_DB=featbit `
        $postgresImage | Out-Null
    Write-Success "$name up"
}

Write-Info "Starting dedicated Redis instances ($($redisPorts[0])-$($redisPorts[-1]))..."
foreach ($port in $redisPorts) {
    $name = "featbit-test-redis-$port"
    if (docker ps -q --filter "name=^$name$") {
        Write-Success "$name already running"
        continue
    }
    docker rm -f $name 2>$null | Out-Null
    docker run -d --name $name -p "${port}:6379" $redisImage | Out-Null
    Write-Success "$name up"
}

Write-Host ""
Write-Success "Integration test infrastructure is up. Run the full suites with:"
Write-Host "    dotnet test modules/control-plane"
Write-Host "    dotnet test modules/back-end"
Write-Host "    dotnet test modules/evaluation-server"
Write-Host ""
Write-Warn "Reminder: CI skips Category=Integration on purpose; this setup is for local runs only."
