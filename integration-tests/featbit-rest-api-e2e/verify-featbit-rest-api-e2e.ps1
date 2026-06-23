[CmdletBinding()]
param(
    [switch]$SkipOpenApiPreflight,
    [switch]$SkipBackendContractTests
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptDir = $PSScriptRoot
$RepoRoot = Resolve-Path (Join-Path $ScriptDir "..\..\")
$Runner = Join-Path $ScriptDir "featbit-rest-api-e2e.cs"
$Wrapper = Join-Path $ScriptDir "run-featbit-rest-api-e2e.ps1"
$Manifest = Join-Path $ScriptDir "test-manifest.json"
$Audit = Join-Path $ScriptDir "REQUIREMENTS_AUDIT.md"
$ReportsDir = Join-Path $ScriptDir "reports"

function Invoke-Checked {
    param(
        [string]$Name,
        [scriptblock]$Command
    )

    Write-Host "==> $Name"
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Name failed with exit code $LASTEXITCODE."
    }
}

function Invoke-CheckedOutput {
    param(
        [string]$Name,
        [scriptblock]$Command
    )

    Write-Host "==> $Name"
    $output = & $Command
    if ($LASTEXITCODE -ne 0) {
        $output | Write-Host
        throw "$Name failed with exit code $LASTEXITCODE."
    }

    $output | Write-Host
    return ($output -join "`n")
}

function Get-ReportFiles {
    if (-not (Test-Path -LiteralPath $ReportsDir)) {
        return @()
    }

    @(Get-ChildItem -LiteralPath $ReportsDir -File | Where-Object { $_.Name -ne ".gitignore" } | ForEach-Object { $_.FullName })
}

function Assert-NoCjkText {
    param(
        [string[]]$Paths
    )

    foreach ($path in $Paths) {
        $matches = Select-String -LiteralPath $path -Pattern '[\p{IsCJKUnifiedIdeographs}\p{IsHiragana}\p{IsKatakana}\p{IsHangulSyllables}]'
        if ($matches) {
            throw "Non-English CJK text found in $path at line $($matches[0].LineNumber)."
        }
    }
}

Write-Host "==> Validate wrapper PowerShell syntax"
$tokens = $null
$errors = $null
[System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path $Wrapper), [ref]$tokens, [ref]$errors) > $null
if ($errors.Count -gt 0) {
    $errors | Format-List *
    throw "PowerShell syntax validation failed."
}

Write-Host "==> Validate test manifest"
$manifestJson = Get-Content -Raw -LiteralPath $Manifest | ConvertFrom-Json
if ($manifestJson.featureFlags.Count -ne 10) {
    throw "Manifest must define exactly 10 feature flags."
}

if ($manifestJson.keyTemplates.projectKey -ne "e2e-api-{suffix}") {
    throw "Manifest project key template does not match the runner."
}

if ($manifestJson.keyTemplates.metricSuffix -notmatch "hyphens replaced by underscores") {
    throw "Manifest must document metricSuffix normalization."
}

$types = @($manifestJson.featureFlags | ForEach-Object { $_.type } | Sort-Object -Unique)
foreach ($requiredType in @("boolean", "string", "number", "json")) {
    if ($types -notcontains $requiredType) {
        throw "Manifest does not include required feature flag type '$requiredType'."
    }
}

if ($manifestJson.metrics.primary.keyTemplate -ne "e2e_checkout_activated_{metricSuffix}") {
    throw "Manifest primary metric template does not match the runner."
}

$guardrailTemplates = @($manifestJson.metrics.guardrails | ForEach-Object { $_.keyTemplate })
foreach ($requiredTemplate in @("e2e_checkout_error_{metricSuffix}", "e2e_checkout_latency_ms_{metricSuffix}")) {
    if ($guardrailTemplates -notcontains $requiredTemplate) {
        throw "Manifest guardrail metric template '$requiredTemplate' is missing."
    }
}

if (($manifestJson.steps | Where-Object id -eq "4").eventEndpoint -ne "POST /api/public/insight/track") {
    throw "Manifest must document the SDK insight ingest endpoint."
}

$sdkAssertions = @(($manifestJson.steps | Where-Object id -eq "4").assertions)
foreach ($requiredSdkAssertion in @(
    "the two segment users evaluate the experiment flag to treatment=true",
    "an enterprise synthetic user evaluates each non-experiment flag to the expected first variation"
)) {
    if ($sdkAssertions -notcontains $requiredSdkAssertion) {
        throw "Manifest SDK assertions are missing: $requiredSdkAssertion"
    }
}

$mutationAssertions = @(($manifestJson.steps | Where-Object id -eq "2").assertions)
foreach ($requiredMutationAssertion in @(
    "segment includes the two deterministic users, has no excluded users, and has no rules",
    "description and full tag set are persisted"
)) {
    if ($mutationAssertions -notcontains $requiredMutationAssertion) {
        throw "Manifest mutation assertions are missing: $requiredMutationAssertion"
    }
}

if ($manifestJson.expectedFinalState.flags.Count -ne 10) {
    throw "Manifest must define final state for exactly 10 feature flags."
}

$finalStateTypes = @($manifestJson.expectedFinalState.flags | ForEach-Object { $_.type } | Sort-Object -Unique)
foreach ($requiredType in @("boolean", "string", "number", "json")) {
    if ($finalStateTypes -notcontains $requiredType) {
        throw "Manifest final state does not include required feature flag type '$requiredType'."
    }
}

$boundFlags = @($manifestJson.expectedFinalState.flags | Where-Object { $_.experimentation -eq "bound" })
if ($boundFlags.Count -ne 1 -or $boundFlags[0].keyTemplate -ne "rd-checkout-treatment-{suffix}") {
    throw "Manifest must define only the checkout treatment flag as bound to release-decision."
}

$experimentTargeting = $manifestJson.expectedFinalState.targeting.experimentFlag
if ($experimentTargeting.fallthroughTraffic -ne "50% control, 50% treatment" -or
    $experimentTargeting.ruleTraffic -ne "100% treatment") {
    throw "Manifest must define experiment flag traffic split."
}

$nonExperimentTargeting = $manifestJson.expectedFinalState.targeting.nonExperimentFlags
if ($nonExperimentTargeting.condition -ne "plan Equal enterprise" -or
    $nonExperimentTargeting.fallthroughTraffic -ne "100% first variation") {
    throw "Manifest must define non-experiment flag targeting and traffic."
}

if ($manifestJson.expectedFinalState.analyze.runStatus -ne "analyzing") {
    throw "Manifest must define expected analyze run status."
}

$finalStepAssertions = @(($manifestJson.steps | Where-Object id -eq "9").assertions)
foreach ($requiredFinalAssertion in @(
    "all 10 flags match expected final enabled state",
    "all 10 flags match expected final variants",
    "all 10 flags match expected final rule condition",
    "all 10 flags match expected rule traffic, fallthrough traffic, includedInExpt, and exptIncludeAllTargets",
    "analyze status, inputData, and analysisResult match expected final state"
)) {
    if ($finalStepAssertions -notcontains $requiredFinalAssertion) {
        throw "Manifest final verification assertions are missing: $requiredFinalAssertion"
    }
}

if ($manifestJson.reporting.offlineModesWriteReports -ne $false) {
    throw "Manifest must state that offline modes do not write reports."
}

$auditText = Get-Content -Raw -LiteralPath $Audit
foreach ($requiredAuditText in @(
    "Full completion requires a live run with a real FeatBit access token",
    "Live evidence required",
    "offline modes intentionally write no reports"
)) {
    if (-not $auditText.Contains($requiredAuditText)) {
        throw "Requirements audit is missing required text: $requiredAuditText"
    }
}

$reportsBefore = @(Get-ReportFiles)
if ($reportsBefore.Count -gt 0) {
    throw "Report directory already contains live-looking report file(s): $($reportsBefore -join ', '). Remove them before offline verification."
}

Write-Host "==> Validate English-only E2E docs"
Assert-NoCjkText @(
    $Runner,
    $Wrapper,
    $Manifest,
    (Join-Path $ScriptDir "README.md"),
    (Join-Path $ScriptDir "TEST_SCRIPT.md"),
    $Audit
)

Push-Location $RepoRoot
try {
    Invoke-Checked "Runner help" {
        dotnet run $Runner -- --help
    }

    Invoke-Checked "Runner self-check" {
        powershell -NoProfile -ExecutionPolicy Bypass -File $Wrapper -SelfCheck
    }

    $planOutput = Invoke-CheckedOutput "Runner plan print" {
        powershell -NoProfile -ExecutionPolicy Bypass -File $Wrapper -PrintPlan -PlanSuffix preview
    }
    foreach ($requiredPlanText in @(
        '## Expected Final Feature Flag State',
        '| Key | Type | Final enabled | Final variants | Rule | Traffic | Experimentation |',
        '## Expected Insight, Stats, And Analyze State',
        'fallthrough control 50%, treatment 50%',
        'Analyze should set run status to `analyzing`'
    )) {
        if (-not $planOutput.Contains($requiredPlanText)) {
            throw "Runner plan output is missing required text: $requiredPlanText"
        }
    }

    if (-not $SkipOpenApiPreflight) {
        Invoke-Checked "OpenAPI preflight" {
            powershell -NoProfile -ExecutionPolicy Bypass -File $Wrapper -OpenApiPreflight
        }
    }

    if (-not $SkipBackendContractTests) {
        Invoke-Checked "Backend release-decision/stats contract tests" {
            dotnet test modules\back-end\tests\Application.IntegrationTests\Application.IntegrationTests.csproj --filter "FullyQualifiedName~ReleaseDecisionExperimentControllerTests|FullyQualifiedName~ExperimentStatsControllerTests"
        }
    }
}
finally {
    Pop-Location
}

$reportsAfter = @(Get-ReportFiles)
$newReports = @($reportsAfter | Where-Object { $reportsBefore -notcontains $_ })
if ($newReports.Count -gt 0) {
    throw "Offline verification created report file(s): $($newReports -join ', ')"
}

Write-Host "==> Verification complete"
Write-Host "No-token E2E assets are ready. Live E2E still requires a real FeatBit access token."
