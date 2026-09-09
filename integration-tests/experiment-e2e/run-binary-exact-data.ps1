[CmdletBinding()]
param(
    [ValidateSet('preview', 'inject', 'verify', 'self-check')]
    [string]$Action = 'preview',
    [string]$SessionId,
    [string]$Config = $env:FEATBIT_UI_CONFIG,
    [string]$ReportRoot,
    [switch]$NoBuild
)

$ErrorActionPreference = 'Stop'
if ($Action -ne 'self-check' -and -not $SessionId) {
    throw 'Provide -SessionId, for example binary-exact-20260909. Preview is offline; inject must be explicitly selected.'
}
if (-not $Config) {
    $localConfig = Join-Path $PSScriptRoot 'ui-data-runner/config.local.json'
    if (Test-Path -LiteralPath $localConfig -PathType Leaf) { $Config = $localConfig }
}
if (-not $ReportRoot) { $ReportRoot = Join-Path $PSScriptRoot 'reports' }
$projectFile = Join-Path $PSScriptRoot 'ui-data-runner/UiExperimentData.csproj'
$outputDll = Join-Path $PSScriptRoot 'ui-data-runner/bin/Debug/net10.0/UiExperimentData.dll'
if (-not $NoBuild) {
    $restoreArgs = @('restore', $projectFile, '--locked-mode', '--verbosity', 'quiet')
    if ($env:FEATBIT_UI_NUGET_SOURCE) { $restoreArgs += @('--source', $env:FEATBIT_UI_NUGET_SOURCE) }
    if ($env:FEATBIT_UI_PACKAGES) { $restoreArgs += @('--packages', $env:FEATBIT_UI_PACKAGES) }
    & dotnet @restoreArgs
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & dotnet build $projectFile --no-restore --verbosity quiet
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
if (-not (Test-Path -LiteralPath $outputDll -PathType Leaf)) { throw 'Build the program first (omit -NoBuild).' }
$runnerArgs = @($outputDll, '--action', ('exact-' + $Action), '--report-root', $ReportRoot)
if ($SessionId) { $runnerArgs += @('--session-id', $SessionId) }
if ($Config) { $runnerArgs += @('--config', $Config) }
& dotnet @runnerArgs
exit $LASTEXITCODE
