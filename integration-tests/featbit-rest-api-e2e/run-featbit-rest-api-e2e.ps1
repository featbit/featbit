[CmdletBinding()]
param(
    [string]$AccessToken = $env:FEATBIT_ACCESS_TOKEN,
    [string]$ApiUrl = $env:FEATBIT_API_URL,
    [string]$EventUrl = $env:FEATBIT_EVENT_URL,
    [string]$StreamingUrl = $env:FEATBIT_STREAMING_URL,
    [string]$AuthMode = $env:FEATBIT_AUTH_MODE,
    [string]$Organization = $env:FEATBIT_ORGANIZATION,
    [string]$Workspace = $env:FEATBIT_WORKSPACE,
    [string]$ProjectKey = $env:FEATBIT_PROJECT_KEY,
    [string]$EnvId = $env:FEATBIT_ENV_ID,
    [int]$Users = 1500,
    [int]$MinUsersPerVariant = 500,
    [int]$BatchSize = 100,
    [int]$PostSdkWaitSeconds = 8,
    [string]$ReportDir = $env:FEATBIT_REPORT_DIR,
    [switch]$Cleanup,
    [switch]$SelfCheck,
    [switch]$PrintPlan,
    [switch]$OpenApiPreflight,
    [string]$SwaggerUrl = "",
    [string]$PlanSuffix = "preview"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ApiUrl)) {
    $ApiUrl = "https://app-api.featbit.co"
}

if ([string]::IsNullOrWhiteSpace($EventUrl)) {
    $EventUrl = "https://app-eval.featbit.co"
}

if ([string]::IsNullOrWhiteSpace($StreamingUrl)) {
    $StreamingUrl = "wss://app-eval.featbit.co"
}

if ([string]::IsNullOrWhiteSpace($AuthMode)) {
    $AuthMode = "raw"
}

if ($AuthMode -ne "raw" -and $AuthMode -ne "bearer") {
    throw "AuthMode must be 'raw' or 'bearer'."
}

if ([string]::IsNullOrWhiteSpace($ReportDir)) {
    $ReportDir = Join-Path $PSScriptRoot "reports"
}

$Runner = Join-Path $PSScriptRoot "featbit-rest-api-e2e.cs"

function Invoke-Runner {
    param(
        [string[]]$RunnerArgs
    )

    $DotnetArgs = @("run", $Runner, "--") + $RunnerArgs
    & dotnet @DotnetArgs

    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

if ($SelfCheck) {
    Invoke-Runner @("--self-check")
    return
}

if ($PrintPlan) {
    Invoke-Runner @("--print-plan", "--plan-suffix", $PlanSuffix)
    return
}

if ($OpenApiPreflight) {
    $PreflightArgs = @("--openapi-preflight", "--api-url", $ApiUrl)
    if (-not [string]::IsNullOrWhiteSpace($SwaggerUrl)) {
        $PreflightArgs += @("--swagger-url", $SwaggerUrl)
    }

    Invoke-Runner $PreflightArgs
    return
}

if ([string]::IsNullOrWhiteSpace($AccessToken)) {
    throw "AccessToken is required for live E2E execution. Pass -AccessToken or set FEATBIT_ACCESS_TOKEN."
}

$LiveRunnerArgs = @(
    "--access-token", $AccessToken,
    "--api-url", $ApiUrl,
    "--event-url", $EventUrl,
    "--streaming-url", $StreamingUrl,
    "--auth-mode", $AuthMode,
    "--users", $Users.ToString(),
    "--min-users-per-variant", $MinUsersPerVariant.ToString(),
    "--batch-size", $BatchSize.ToString(),
    "--post-sdk-wait-seconds", $PostSdkWaitSeconds.ToString(),
    "--cleanup", $(if ($Cleanup) { "true" } else { "false" }),
    "--report-dir", $ReportDir
)

if (-not [string]::IsNullOrWhiteSpace($Organization)) {
    $LiveRunnerArgs += @("--organization", $Organization)
}

if (-not [string]::IsNullOrWhiteSpace($Workspace)) {
    $LiveRunnerArgs += @("--workspace", $Workspace)
}

if (-not [string]::IsNullOrWhiteSpace($ProjectKey) -or -not [string]::IsNullOrWhiteSpace($EnvId)) {
    if ([string]::IsNullOrWhiteSpace($ProjectKey) -or [string]::IsNullOrWhiteSpace($EnvId)) {
        throw "ProjectKey and EnvId must be provided together."
    }

    $LiveRunnerArgs += @("--project-key", $ProjectKey, "--env-id", $EnvId)
}

Invoke-Runner $LiveRunnerArgs
