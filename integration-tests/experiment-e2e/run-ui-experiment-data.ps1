[CmdletBinding()]
param(
    [ValidateSet('help', 'plan', 'preflight', 'inject', 'verify')]
    [string]$Action = 'help',
    [string]$SessionId,
    [string]$Case,
    [string]$Batch,
    [string]$Config = $env:FEATBIT_UI_CONFIG,
    [string]$Scenarios,
    [string]$ReportRoot,
    [switch]$NoBuild
)

$ErrorActionPreference = 'Stop'
$projectFile = Join-Path $PSScriptRoot 'ui-data-runner/UiExperimentData.csproj'
$outputDll = Join-Path $PSScriptRoot 'ui-data-runner/bin/Debug/net10.0/UiExperimentData.dll'
if (-not $Config) {
    $localConfig = Join-Path $PSScriptRoot 'ui-data-runner/config.local.json'
    if (Test-Path -LiteralPath $localConfig -PathType Leaf) { $Config = $localConfig }
}
if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    Write-Error 'Install the .NET 10 SDK before running this program.'
    exit 2
}
if (-not $ReportRoot) {
    $ReportRoot = if ($env:FEATBIT_UI_REPORT_ROOT) { $env:FEATBIT_UI_REPORT_ROOT } else { Join-Path $PSScriptRoot 'reports' }
}
if (-not $NoBuild) {
    $restoreArgs = @('restore', $projectFile, '--locked-mode', '--verbosity', 'quiet')
    # Optional local NuGet feed/cache. These are paths, never command strings.
    if ($env:FEATBIT_UI_NUGET_SOURCE) { $restoreArgs += @('--source', $env:FEATBIT_UI_NUGET_SOURCE) }
    if ($env:FEATBIT_UI_PACKAGES) { $restoreArgs += @('--packages', $env:FEATBIT_UI_PACKAGES) }
    & dotnet @restoreArgs
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & dotnet build $projectFile --no-restore --verbosity quiet
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
if (-not (Test-Path -LiteralPath $outputDll -PathType Leaf)) {
    Write-Error 'Runner is not built. Run once without -NoBuild.'
    exit 2
}
$runnerArgs = @($outputDll, '--action', $Action, '--report-root', $ReportRoot)
foreach ($entry in @(
    @('--session-id', $SessionId), @('--case', $Case), @('--batch', $Batch),
    @('--config', $Config), @('--scenarios', $Scenarios)
)) {
    if ($entry[1]) { $runnerArgs += $entry }
}
& dotnet @runnerArgs
exit $LASTEXITCODE
