# setup-ratelimit-test.ps1
# Sets up a FeatBit project with two environments and outputs their SDK secrets
# for the rate-limit validation script to consume.

param(
    [string]$ApiBase = "http://localhost:5000",
    [string]$EvalBase = "http://localhost:5100",
    [string]$OutputFile = "$PSScriptRoot\test-secrets.json",
    [int]$MaxWaitSeconds = 120
)

$ErrorActionPreference = "Stop"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host " FeatBit Rate-Limit Test Setup" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# ── 1. Wait for API server to be ready ────────────────────────────────────────
Write-Host "`n[1/4] Waiting for API server at $ApiBase ..." -ForegroundColor Yellow
$deadline = (Get-Date).AddSeconds($MaxWaitSeconds)
$apiReady = $false
while ((Get-Date) -lt $deadline) {
    try {
        $r = Invoke-WebRequest -Uri "$ApiBase/health/liveness" -UseBasicParsing -TimeoutSec 3 -ErrorAction SilentlyContinue
        if ($r.StatusCode -eq 200) { $apiReady = $true; break }
    } catch { }
    Start-Sleep -Seconds 3
    Write-Host "  ... still waiting" -ForegroundColor DarkGray
}
if (-not $apiReady) {
    Write-Error "API server did not become ready within $MaxWaitSeconds seconds."
    exit 1
}
Write-Host "  API server is ready." -ForegroundColor Green

# ── 2. Wait for Evaluation server to be ready ─────────────────────────────────
Write-Host "`n[2/4] Waiting for Evaluation server at $EvalBase ..." -ForegroundColor Yellow
$deadline = (Get-Date).AddSeconds($MaxWaitSeconds)
$evalReady = $false
while ((Get-Date) -lt $deadline) {
    try {
        $r = Invoke-WebRequest -Uri "$EvalBase/health/liveness" -UseBasicParsing -TimeoutSec 3 -ErrorAction SilentlyContinue
        if ($r.StatusCode -eq 200) { $evalReady = $true; break }
    } catch { }
    Start-Sleep -Seconds 3
    Write-Host "  ... still waiting" -ForegroundColor DarkGray
}
if (-not $evalReady) {
    Write-Error "Evaluation server did not become ready within $MaxWaitSeconds seconds."
    exit 1
}
Write-Host "  Evaluation server is ready." -ForegroundColor Green

# ── 3. Login ──────────────────────────────────────────────────────────────────
Write-Host "`n[3/4] Logging in as test@featbit.com ..." -ForegroundColor Yellow
$loginBody = @{
    email        = "test@featbit.com"
    password     = "123456"
    workspaceKey = ""
} | ConvertTo-Json

# Retry login a few times — DB migrations may still be running
$loginResp = $null
$loginRetries = 10
for ($attempt = 1; $attempt -le $loginRetries; $attempt++) {
    try {
        $loginResp = Invoke-RestMethod -Uri "$ApiBase/api/v1/identity/login-by-email" `
            -Method Post -ContentType "application/json" -Body $loginBody
        if ($loginResp.success) { break }
        Write-Host "  Login attempt $attempt returned success=false ($($loginResp.errors -join ', ')). Retrying in 5s..." -ForegroundColor DarkGray
    } catch {
        Write-Host "  Login attempt $attempt failed: $($_.Exception.Message). Retrying in 5s..." -ForegroundColor DarkGray
    }
    Start-Sleep -Seconds 5
}

if (-not $loginResp -or -not $loginResp.success) {
    Write-Error "Login failed after $loginRetries attempts: $($loginResp | ConvertTo-Json -Depth 5)"
    exit 1
}

$token = $loginResp.data.token
Write-Host "  Logged in. JWT obtained." -ForegroundColor Green

# Note: The FeatBit API requires an "Organization" header with the org GUID.
# We'll add it after we fetch the org list.
$authHeaders = @{ Authorization = "Bearer $token" }

# ── 4. Onboard + Create project (gets us two envs with secrets) ───────────────
Write-Host "`n[4/4] Creating project with two environments ..." -ForegroundColor Yellow

# First, get the organization list to find the orgId
$orgsResp = Invoke-RestMethod -Uri "$ApiBase/api/v1/organizations" `
    -Method Get -Headers $authHeaders

$org = $orgsResp.data | Select-Object -First 1
if (-not $org) {
    Write-Error "No organization found."
    exit 1
}
$orgId = $org.id
Write-Host "  Organization: $($org.name) (id: $orgId)" -ForegroundColor DarkGray

# Add Organization header required by the API
$authHeaders["Organization"] = $orgId

# Check if the org needs onboarding (initialized == false)
if ($org.initialized -eq $false) {
    Write-Host "  Organization not initialized — running onboarding ..." -ForegroundColor Yellow
    $onboardingBody = @{
        organizationName = "RateLimitTest"
        organizationKey  = "rate-limit-test"
        projectName      = "RateLimitProject"
        projectKey       = "rate-limit-project"
        environments     = @("env-a", "env-b")
    } | ConvertTo-Json

    $onboardResp = Invoke-RestMethod -Uri "$ApiBase/api/v1/organizations/onboarding" `
        -Method Post -ContentType "application/json" -Headers $authHeaders -Body $onboardingBody

    if (-not $onboardResp.success) {
        Write-Error "Onboarding failed: $($onboardResp | ConvertTo-Json -Depth 5)"
        exit 1
    }
    Write-Host "  Onboarding complete." -ForegroundColor Green
}

# List projects to find the one we created (or that already existed)
$projectsResp = Invoke-RestMethod -Uri "$ApiBase/api/v1/projects" `
    -Method Get -Headers $authHeaders

$project = $null
# Prefer the project we just created via onboarding
foreach ($p in $projectsResp.data) {
    if ($p.key -eq "rate-limit-project") { $project = $p; break }
}
# Fall back to any project
if (-not $project) {
    $project = $projectsResp.data | Select-Object -First 1
}

if (-not $project) {
    Write-Error "No project found. Please ensure onboarding or project creation succeeded."
    exit 1
}

$projectId = $project.id
Write-Host "  Project: $($project.name) (id: $projectId)" -ForegroundColor DarkGray

# If onboarding created the project it already has environments, but let's also
# handle the case where the org was already initialized — create 2 extra envs.
$environments = $project.environments
if ($environments.Count -lt 2) {
    Write-Host "  Creating additional environments ..." -ForegroundColor Yellow
    foreach ($envName in @("env-a", "env-b")) {
        $envBody = @{
            name        = $envName
            key         = $envName
            description = "Rate limit test environment $envName"
        } | ConvertTo-Json

        $envResp = Invoke-RestMethod -Uri "$ApiBase/api/v1/projects/$projectId/envs" `
            -Method Post -ContentType "application/json" -Headers $authHeaders -Body $envBody

        if ($envResp.success) {
            Write-Host "    Created environment: $envName" -ForegroundColor Green
        } else {
            Write-Host "    Warning creating $envName : $($envResp | ConvertTo-Json -Depth 3)" -ForegroundColor DarkYellow
        }
    }
    # Re-fetch the project to get the updated environment list with secrets
    $projectsResp = Invoke-RestMethod -Uri "$ApiBase/api/v1/projects" `
        -Method Get -Headers $authHeaders
    $project = $projectsResp.data | Where-Object { $_.id -eq $projectId } | Select-Object -First 1
    $environments = $project.environments
}

if ($environments.Count -lt 2) {
    Write-Error "Expected at least 2 environments, got $($environments.Count)."
    exit 1
}

# Pick the first two environments and extract server-type secrets
$envA = $environments[0]
$envB = $environments[1]

$secretA = ($envA.secrets | Where-Object { $_.type -eq "server" } | Select-Object -First 1).value
$secretB = ($envB.secrets | Where-Object { $_.type -eq "server" } | Select-Object -First 1).value

if (-not $secretA -or -not $secretB) {
    Write-Error "Could not extract server secrets from environments."
    Write-Host "Env A secrets: $($envA.secrets | ConvertTo-Json -Depth 3)" -ForegroundColor Red
    Write-Host "Env B secrets: $($envB.secrets | ConvertTo-Json -Depth 3)" -ForegroundColor Red
    exit 1
}

# ── Output ────────────────────────────────────────────────────────────────────
$output = @{
    envA = @{
        name   = $envA.name
        id     = $envA.id
        secret = $secretA
    }
    envB = @{
        name   = $envB.name
        id     = $envB.id
        secret = $secretB
    }
    evalBase     = $EvalBase
    permitLimit  = 5
    windowSeconds = 60
} | ConvertTo-Json -Depth 3

$output | Set-Content -Path $OutputFile -Encoding UTF8

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host " Setup Complete!" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Env A: $($envA.name) — secret: $($secretA.Substring(0,10))..." -ForegroundColor Green
Write-Host "  Env B: $($envB.name) — secret: $($secretB.Substring(0,10))..." -ForegroundColor Green
Write-Host "  Rate limit: 5 requests / 60s (FixedWindow, Redis Lua)" -ForegroundColor Green
Write-Host "  Secrets written to: $OutputFile" -ForegroundColor Green
Write-Host "`nRun .\validate-ratelimit.ps1 next." -ForegroundColor Yellow
