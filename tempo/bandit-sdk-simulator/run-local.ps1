# This helper operates only on the local Aspire environment in local-target.json.
# The console app itself only evaluates flags and tracks SDK events.
[CmdletBinding()]
param(
    [ValidateRange(1, 100000)][int]$Users = 4000,
    [int]$Seed = 20260907,
    [switch]$PlanOnly,
    [switch]$PrepareTraffic
)
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$target = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'local-target.json') -Raw | ConvertFrom-Json
$config = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'simulation.json') -Raw | ConvertFrom-Json
if (!$PSBoundParameters.ContainsKey('Users')) { $Users = $config.users }
if (!$PSBoundParameters.ContainsKey('Seed')) { $Seed = $config.seed }
$resultDir = Join-Path $PSScriptRoot 'results'
[void](New-Item -ItemType Directory -Force -Path $resultDir)

Push-Location $repoRoot
try {
    $descriptionText = aspire describe --format Json --non-interactive | Out-String
    if ($LASTEXITCODE -ne 0 -or $descriptionText.IndexOf('{') -lt 0) { throw 'Start the local Aspire stack first; see .aspire/README.md.' }
    $resources = ($descriptionText.Substring($descriptionText.IndexOf('{')) | ConvertFrom-Json).resources
    $apiResource = $resources | Where-Object displayName -eq 'api-server'
    $evalResource = $resources | Where-Object displayName -eq 'evaluation-server'
    $uiResource = $resources | Where-Object displayName -eq 'ui'
    function Get-LocalEndpoint($resource) {
        $urls = @($resource.urls | Where-Object { ([uri]$_.url).IsLoopback -and ([uri]$_.url).Scheme -in @('http','https') })
        $chosen = $urls | Sort-Object { if (([uri]$_.url).Scheme -eq 'http') { 0 } else { 1 } } | Select-Object -First 1
        if (!$chosen) { throw "No loopback HTTP endpoint for $($resource.displayName)." }
        return ([uri]$chosen.url).GetLeftPart([System.UriPartial]::Authority)
    }
    $apiBase = Get-LocalEndpoint $apiResource
    $evalBase = Get-LocalEndpoint $evalResource
    foreach ($resourceName in @('api-server','evaluation-server')) {
        aspire wait $resourceName --timeout 30 --non-interactive
        if ($LASTEXITCODE -ne 0) { throw "$resourceName is not ready." }
    }

    # Seeded local credentials documented in .aspire/README.md; optional overrides for a different local account.
    $email = if ($env:FEATBIT_SIM_LOGIN_EMAIL) { $env:FEATBIT_SIM_LOGIN_EMAIL } else { 'test@featbit.com' }
    $password = if ($env:FEATBIT_SIM_LOGIN_PASSWORD) { $env:FEATBIT_SIM_LOGIN_PASSWORD } else { '123456' }
    $login = Invoke-RestMethod "$apiBase/api/v1/identity/login-by-email" -Method Post -ContentType 'application/json' -TimeoutSec 30 -Body (@{ email=$email; password=$password } | ConvertTo-Json)
    if (!$login.success -or !$login.data.token) { throw 'Local login failed.' }
    $headers = @{ Authorization="Bearer $($login.data.token)"; Organization=$target.organizationId; Workspace=$target.workspaceId }
    function Invoke-Api([string]$Method, [string]$Path, $Body = $null) {
        $request = @{ Uri="$apiBase$Path"; Method=$Method; Headers=$headers; TimeoutSec=30 }
        if ($null -ne $Body) { $request.ContentType='application/json'; $request.Body=ConvertTo-Json -InputObject $Body -Depth 40 -Compress }
        $response = Invoke-RestMethod @request
        if (!$response.success) { throw "$Method $Path failed: $($response.errors -join ', ')" }
        return $response.data
    }
    $envPath = "/api/v1/envs/$($target.environmentId)"
    $experimentPath = "$envPath/experiments/$($target.experimentId)"
    $experiment = Invoke-Api 'Get' $experimentPath
    $run = $experiment.experimentRuns | Where-Object id -eq $target.runId
    if (!$run -or $experiment.flagKey -cne $config.flagKey -or $run.method -ne 'bandit') { throw 'Experiment/run/flag mismatch.' }
    if ($run.primaryMetricEvent -cne $config.primaryMetric -or $run.primaryMetricType -ne 'binary' -or $run.primaryMetricAgg -ne 'once') {
        throw 'This simulator expects a binary/once primary metric.'
    }
    $guardrail = @($run.guardrailEvents | ConvertFrom-Json) | Where-Object event -eq $config.guardrailMetric
    if (!$guardrail -or $guardrail.metricAgg -ne 'count') { throw 'This simulator expects a count guardrail.' }
    if (!$run.observationStart -or [datetimeoffset]$run.observationStart -gt [datetimeoffset]::UtcNow -or $run.observationEnd) {
        throw 'Use an ongoing observation window that has already started.'
    }
    if ($run.analysisSamplingPlan -or $run.allocationPlan -or $run.audienceFilters -or $run.layerId -or
        ($null -ne $run.sliceStart -and $run.sliceStart -ne 0) -or ($null -ne $run.sliceEnd -and $run.sliceEnd -ne 100) -or
        ($null -ne $run.trafficPercent -and $run.trafficPercent -ne 100)) {
        throw 'Local verification requires all users, no layer/audience filtering, and 100% analysis sampling.'
    }
    $flagPath = "$envPath/feature-flags/$([uri]::EscapeDataString($config.flagKey))"
    $flag = Invoke-Api 'Get' $flagPath
    if (!$flag.isEnabled -or $flag.variationType -ne 'string') { throw 'Expected an enabled string flag.' }
    $selectedVariants = @($run.controlVariant) + @($run.treatmentVariant -split '\|')
    if ($selectedVariants.Count -ne $config.arms.Count -or $flag.variations.Count -ne $config.arms.Count) { throw 'Run and flag must select exactly the configured arms.' }
    foreach ($arm in $config.arms) {
        if ($arm.variationId -notin $selectedVariants -or !($flag.variations | Where-Object { $_.id -eq $arm.variationId -and $_.value -ceq $arm.value })) {
            throw "Arm mapping mismatch: $($arm.name)."
        }
    }
    $rule = [ordered]@{
        id=$target.simulatorRuleId; name='Temporary .NET Bandit simulator'; dispatchKey=''; includedInExpt=$true
        conditions=@(@{ id='066ceabf-ce61-4812-b590-3f9f599c78e2'; property=$config.simulatorAttribute; op='IsOneOf'; value=(ConvertTo-Json -InputObject @($config.simulatorValue) -Compress) })
        variations=@(for ($i=0; $i -lt $config.arms.Count; $i++) {
            @{ id=$config.arms[$i].variationId; rollout=@(($i / $config.arms.Count), (($i + 1) / $config.arms.Count)); exptRollout=1 }
        })
    }
    $existingRule = @($flag.rules | Where-Object id -eq $target.simulatorRuleId)
    $targeting = [ordered]@{
        disabledVariationId=$flag.disabledVariationId; targetUsers=@($flag.targetUsers)
        rules=@($rule) + @($flag.rules | Where-Object id -ne $target.simulatorRuleId)
        fallthrough=$flag.fallthrough; exptIncludeAllTargets=$flag.exptIncludeAllTargets
    }
    $payload = @{ revision=$flag.revision; targeting=$targeting; comment='Local synthetic Bandit SDK traffic: only expt_simulator=bandit-sdk-v1 users; four equal arms.' }
    $payload | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath (Join-Path $resultDir 'targeting-plan.json') -Encoding utf8
    Write-Host "Local target: $($experiment.name) / $($config.flagKey)"
    Write-Host "Synthetic rule: $($config.simulatorAttribute)=$($config.simulatorValue), four equal arms."
    if ($PlanOnly) { Write-Host "Plan saved: $resultDir/targeting-plan.json. No flags changed or SDK events sent."; return }

    if ($PrepareTraffic) {
        $backup = Join-Path $resultDir ("targeting-before-{0}.json" -f [datetime]::UtcNow.ToString('yyyyMMddTHHmmssfff'))
        $flag | Select-Object key,revision,isEnabled,disabledVariationId,targetUsers,rules,fallthrough,exptIncludeAllTargets |
            ConvertTo-Json -Depth 40 | Set-Content -LiteralPath $backup -Encoding utf8
        [void](Invoke-Api 'Put' "$flagPath/targeting" $payload)
        $flag = Invoke-Api 'Get' $flagPath
        Write-Host "Simulator rule saved. Previous targeting: $backup"
    } elseif ($existingRule.Count -ne 1) {
        throw 'Simulator rule is missing. Review -PlanOnly, then use -PrepareTraffic once to add the synthetic-user rule.'
    }
    $actualRule = @($flag.rules | Where-Object id -eq $target.simulatorRuleId)
    if ($actualRule.Count -ne 1 -or $flag.rules[0].id -ne $target.simulatorRuleId -or !$actualRule[0].includedInExpt -or
        $actualRule[0].conditions.Count -ne 1 -or $actualRule[0].conditions[0].property -cne $config.simulatorAttribute -or
        $actualRule[0].conditions[0].op -ne 'IsOneOf' -or $actualRule[0].conditions[0].value -cne $rule.conditions[0].value -or
        $actualRule[0].variations.Count -ne $rule.variations.Count) { throw 'Simulator targeting rule does not match the reviewed plan.' }
    for ($i=0; $i -lt $rule.variations.Count; $i++) {
        $actual=$actualRule[0].variations[$i]; $expected=$rule.variations[$i]
        if ($actual.id -ne $expected.id -or $actual.rollout[0] -ne $expected.rollout[0] -or $actual.rollout[1] -ne $expected.rollout[1]) {
            throw 'Simulator rollout changed. Review the current rule before generating data.'
        }
    }

    function Read-Stats([string]$Metric, [string]$Type, [string]$Aggregation) {
        $end = [datetimeoffset]::UtcNow
        return Invoke-Api 'Post' "$envPath/experiment-stats/query" @{
            runId=$run.id; flagKey=$config.flagKey; metricEvent=$Metric
            startDate=([datetimeoffset]$run.observationStart).ToString('yyyy-MM-dd'); endDate=$end.ToString('yyyy-MM-dd')
            startTime=$run.observationStart; endTime=$end.ToString('o'); metricType=$Type; metricAgg=$Aggregation
            controlVariant=$run.controlVariant; treatmentVariants=$run.treatmentVariant; trafficPercent=100
        }
    }
    $beforePrimary = Read-Stats $config.primaryMetric 'binary' 'once'
    $beforeGuardrail = Read-Stats $config.guardrailMetric 'numeric' 'count'
    $environment = Invoke-Api 'Get' "/api/v1/projects/$($target.projectId)/envs/$($target.environmentId)"
    $secret = $environment.secrets | Where-Object type -eq 'server' | Select-Object -First 1
    if (!$secret.value) { throw 'No Server SDK key in the selected local environment.' }
    $config.eventUrl = $evalBase
    $config.streamingUrl = $evalBase -replace '^http', 'ws'
    $runtimeConfig = Join-Path $resultDir 'runtime-config.json'
    $config | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $runtimeConfig -Encoding utf8
    $previousSdkKey = $env:FEATBIT_SIM_SDK_KEY
    try {
        $env:FEATBIT_SIM_SDK_KEY = $secret.value
        dotnet run --project (Join-Path $PSScriptRoot 'BanditSimulator.csproj') -- --config $runtimeConfig --users $Users --seed $Seed --output-dir $resultDir
        if ($LASTEXITCODE -ne 0) { throw 'SDK simulator failed; inspect its report before retrying with fresh users.' }
    } finally { $env:FEATBIT_SIM_SDK_KEY = $previousSdkKey }
    $report = Get-Content -LiteralPath (Join-Path $resultDir 'latest.json') -Raw | ConvertFrom-Json
    if ($report.status -ne 'completed') { throw 'SDK report is incomplete.' }

    # Bounded checks for asynchronous event ingestion, after Aspire established service readiness.
    function Variant-Value($Stats, [string]$Id, [string]$Property) {
        $row = $Stats.variants | Where-Object variant -eq $Id
        if (!$row) { return 0 }
        return $row.$Property
    }
    $deadline = [datetimeoffset]::UtcNow.AddSeconds(60)
    do {
        $afterPrimary = Read-Stats $config.primaryMetric 'binary' 'once'
        $afterGuardrail = Read-Stats $config.guardrailMetric 'numeric' 'count'
        $checks = @(foreach ($arm in $report.arms) {
            $id=$arm.variationId
            $n=(Variant-Value $afterPrimary $id 'users') - (Variant-Value $beforePrimary $id 'users')
            $k=(Variant-Value $afterPrimary $id 'conversions') - (Variant-Value $beforePrimary $id 'conversions')
            $g=(Variant-Value $afterGuardrail $id 'sumValue') - (Variant-Value $beforeGuardrail $id 'sumValue')
            [pscustomobject]@{ arm=$arm.name; users=$n; conversions=$k; guardrailEvents=$g; expectedUsers=$arm.evaluations; expectedConversions=$arm.conversions; expectedGuardrailEvents=$arm.guardrailEvents; matches=($n -eq $arm.evaluations -and $k -eq $arm.conversions -and $g -eq $arm.guardrailEvents) }
        })
        $matched = @($checks | Where-Object { !$_.matches }).Count -eq 0
        if ($matched -or [datetimeoffset]::UtcNow -ge $deadline) { break }
        Start-Sleep -Seconds 2
    } while ($true)
    $checks | Format-Table arm,users,conversions,guardrailEvents,matches
    if (!$matched) {
        $checks | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $resultDir "$($report.batchId).verification-failed.json") -Encoding utf8
        throw 'SDK totals did not match newly attributed API stats within 60 seconds. No successful analysis claimed.'
    }
    $updated = Invoke-Api 'Post' "$experimentPath/runs/$($run.id)/analyze" @{ forceFresh=$true }
    $analyzedRun = $updated.experimentRuns | Where-Object id -eq $run.id
    $analysis = $analyzedRun.analysisResult | ConvertFrom-Json
    if ($analysis.type -ne 'bandit') { throw 'Expected a Bandit analysis result.' }
    $verification = @{ verifiedAtUtc=[datetimeoffset]::UtcNow.ToString('o'); batchId=$report.batchId; experimentId=$experiment.id; runId=$run.id; checks=$checks; analysis=$analysis }
    $verification | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath (Join-Path $resultDir "$($report.batchId).verified.json") -Encoding utf8
    $verification | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath (Join-Path $resultDir 'latest-verified.json') -Encoding utf8
    Write-Host "Verified SDK exposure + metrics through FeatBit stats and saved fresh Bandit analysis."
    $analysis.thompson_sampling.results | Format-Table arm,p_best,recommended_weight
    if ($uiResource) { Write-Host "Experiment: $(Get-LocalEndpoint $uiResource)/en/experiments/$($experiment.id)" }
} finally { Pop-Location }
