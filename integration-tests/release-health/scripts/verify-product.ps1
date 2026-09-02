[CmdletBinding()]
param([string]$ApiUrl = 'http://localhost:5000', [string]$Email = 'test@featbit.com', [string]$Password = '123456', [string]$OrganizationKey = 'featbit', [string]$PostgresContainer = 'featbit-infra-postgresql-1')
$ErrorActionPreference = 'Stop'
if (([Uri]$ApiUrl).Host -notin @('localhost','127.0.0.1')) { throw 'This fixture creates test resources and is restricted to a local FeatBit API.' }
$demoRoot = Split-Path $PSScriptRoot -Parent
$providerToken = (Get-Content -LiteralPath (Join-Path $demoRoot '.local/provider-token') -Raw).Trim()
$providerPassword = (Get-Content -LiteralPath (Join-Path $demoRoot '.local/provider-password') -Raw).Trim()
$queries = Get-Content -LiteralPath (Join-Path $demoRoot 'queries/queries.json') -Raw | ConvertFrom-Json
$headers = @{}
$checks = [Collections.Generic.List[string]]::new()
function Call([string]$method, [string]$path, $body = $null, [int[]]$expected = @(200)) {
    $options = @{ Method=$method; Uri=$ApiUrl+$path; Headers=$headers; ContentType='application/json'; SkipHttpErrorCheck=$true; TimeoutSec=20 }
    if ($null -ne $body) { $options.Body = $body | ConvertTo-Json -Depth 20 -Compress }
    $response = Invoke-WebRequest @options
    if ($response.StatusCode -notin $expected) {
        # Only server-owned error codes, never request bodies or credentials.
        $safeCode = try { ($response.Content | ConvertFrom-Json).errors -join ', ' } catch { 'non-json response' }
        throw "Unexpected HTTP $($response.StatusCode) on $method $path. $safeCode"
    }
    if ($response.Content.Contains($providerToken) -or $response.Content.Contains($providerPassword)) { throw 'Credential appeared in a response.' }
    if ($response.StatusCode -eq 200) {
        $result = $response.Content | ConvertFrom-Json
        if (-not $result.success) { throw "API operation failed: $path" }
        return $result.data
    }
}
$login = Call POST '/api/v1/identity/login-by-email' @{ email=$Email; password=$Password }
$headers.Authorization = 'Bearer '+$login.token
$workspaces = @(Call GET '/api/v1/user/workspaces')
if ($workspaces.Count -ne 1) { throw 'Select a workspace explicitly before adapting this fixture to a multi-workspace local instance.' }
$workspace = $workspaces[0]
$headers.Workspace = $workspace.id
$organizations = @(Call GET '/api/v1/organizations')
$organization = $organizations | Where-Object key -eq $OrganizationKey | Select-Object -First 1
if (-not $organization) { throw 'Requested local organization not found; no project created.' }
$headers.Organization = $organization.id
$previousReportPath = Join-Path $demoRoot 'reports/product-latest.json'
$project = $null
if (Test-Path -LiteralPath $previousReportPath) {
    $previousReport = Get-Content -LiteralPath $previousReportPath -Raw | ConvertFrom-Json
    if ($previousReport.organizationId -eq $organization.id) {
        $candidate = Call GET "/api/v1/projects/$($previousReport.projectId)"
        if ($candidate.key -eq $previousReport.projectKey -and $candidate.key.StartsWith('release-health-')) { $project=$candidate }
    }
}
if (-not $project) {
    $suffix = [DateTime]::UtcNow.ToString('yyyyMMddHHmmss')
    $project = Call POST '/api/v1/projects' @{ name="Release Health integration $suffix"; key="release-health-$suffix" }
}
$environment = $project.environments | Where-Object key -eq 'prod' | Select-Object -First 1
$otherEnvironment = $project.environments | Where-Object key -eq 'dev' | Select-Object -First 1
if (-not $environment -or -not $otherEnvironment) { throw 'Expected new project Prod and Dev environments.' }
$root = "/api/v1/projects/$($project.id)/envs/$($environment.id)/release-health"
$otherRoot = "/api/v1/projects/$($project.id)/envs/$($otherEnvironment.id)/release-health"
$connections = @{}
$existingConnections = @(Call GET "$root/connections")
foreach ($type in @('none','bearer_token','basic')) {
    $mode = if ($type -eq 'bearer_token') { 'bearer' } else { $type }
    $authentication = @{type=$type}
    $secret = @{operation='remove'}
    if ($type -eq 'bearer_token') { $secret=@{operation='replace';token=$providerToken} }
    if ($type -eq 'basic') { $authentication.username='metrics-reader'; $secret=@{operation='replace';password=$providerPassword} }
    $write=@{name="Local Prometheus $mode";providerType='prometheus-compatible';providerSchemaVersion=1;providerConfig=@{endpoint="http://127.0.0.1:19181/$mode"};authentication=$authentication;secretUpdate=$secret;expectedVersion=$null}
    $existing = $existingConnections | Where-Object { $_.providerConfig.endpoint -eq $write.providerConfig.endpoint } | Select-Object -First 1
    if ($existing) {
        $write.expectedVersion=$existing.version
        Call POST "$root/connections/$($existing.id)/test-draft" $write | Out-Null
        $connection=Call PUT "$root/connections/$($existing.id)" $write
    } else {
        Call POST "$root/connections/test" $write | Out-Null
        $connection = Call POST "$root/connections" $write
    }
    $connections[$type]=$connection
    $checks.Add("${type}: real test and encrypted-or-no-secret save")
}
$listed = @(Call GET "$root/connections")
if ($listed.Count -ne 3) { throw 'Persisted connection list mismatch.' }
if (@(Call GET "$otherRoot/connections").Count -ne 0) { throw 'Connection leaked across environments.' }
$bad=@{name='rejected';providerType='prometheus-compatible';providerSchemaVersion=1;providerConfig=@{endpoint='http://127.0.0.1:19181/bearer'};authentication=@{type='bearer_token'};secretUpdate=@{operation='replace';token='wrong-fixture-token'};expectedVersion=$null}
Call POST "$root/connections" $bad @(422) | Out-Null
$bad.providerType='datadog'
Call POST "$root/connections/test" $bad @(422) | Out-Null
$bad.providerType='prometheus-compatible'; $bad.providerConfig.endpoint='http://169.254.169.254'
Call POST "$root/connections/test" $bad @(422) | Out-Null
$checks.Add('Invalid credential, unsupported provider and metadata HTTP endpoint rejected')
$saved = $connections['bearer_token']
$update=@{name='Local Prometheus bearer rotated';providerType='prometheus-compatible';providerSchemaVersion=1;providerConfig=$saved.providerConfig;authentication=@{type='bearer_token'};secretUpdate=@{operation='replace';token=$providerToken};expectedVersion=$saved.version}
$rotated=Call PUT "$root/connections/$($saved.id)" $update
if ($rotated.revision -ne $saved.revision -or $rotated.version -le $saved.version) { throw 'Rotation changed semantic revision or failed optimistic version increment.' }
Call PUT "$root/connections/$($saved.id)" $update @(409) | Out-Null
$checks.Add('Credential rotation keeps semantic revision; stale writes rejected')
$metrics = [Collections.Generic.List[object]]::new()
$existingMetrics = @(Call GET "/api/v1/projects/$($project.id)/release-health/metrics")
foreach ($definition in @(
    @{key='checkout_error_rate';name='Checkout error rate';query=$queries.errorRate;measurement='ratio';unit=@{kind='percent';scale='zero_to_one_hundred'}},
    @{key='checkout_p95_latency';name='Checkout P95 latency';query=$queries.p95Latency;measurement='gauge';unit=@{kind='duration';base='millisecond'}},
    @{key='checkout_throughput';name='Checkout throughput';query=$queries.throughput;measurement='rate';unit=@{kind='rate';numerator='requests';per='second'}}
)) {
    $metric = $existingMetrics | Where-Object key -eq $definition.key | Select-Object -First 1
    if (-not $metric) { $metric = Call POST "/api/v1/projects/$($project.id)/release-health/metrics" @{key=$definition.key;name=$definition.name;resultSemantics='Whole demo checkout service, rolling 30-second PromQL window, canonical unit.';resultContract=@{schemaVersion=1;resultKind='numeric_time_series';cardinality='single';measurementKind=$definition.measurement;unit=$definition.unit;constraints=@{minimum=0;allowNaN=$false;allowInfinity=$false}}} }
    $existingBinding = Call GET "$root/metrics/$($metric.id)/binding"
    $binding=@{connectionId=$rotated.id;connectionRevision=$rotated.revision;providerType='prometheus-compatible';providerSchemaVersion=1;providerConfig=@{promql=$definition.query;queryMode='range';step='5s'};expectedVersion=$(if($existingBinding){$existingBinding.revision}else{$null})}
    $preview=Call POST "$root/metrics/$($metric.id)/binding/preview" $binding
    if ($preview.points.Count -lt 2) { throw 'Preview did not return real samples.' }
    Call PUT "$root/metrics/$($metric.id)/binding" $binding | Out-Null
    $trend=Call GET "$root/metrics/$($metric.id)/trend?minutes=15"
    if ($trend.points.Count -lt 2) { throw 'Persisted binding did not return a real trend.' }
    $crossEnvironment = $binding.Clone(); $crossEnvironment.expectedVersion=$null
    Call PUT "$otherRoot/metrics/$($metric.id)/binding" $crossEnvironment @(404) | Out-Null
    $metrics.Add(@{id=$metric.id;key=$metric.key;points=$trend.points.Count;latest=$trend.points[-1];status=$trend.status})
}
$checks.Add('Three project metrics and environment bindings produce real finite trends; cross-environment connection reference rejected')
$metricId=$metrics[0].id
$currentBinding=Call GET "$root/metrics/$metricId/binding"
$invalidBinding=@{connectionId=$rotated.id;connectionRevision=$rotated.revision;providerType='prometheus-compatible';providerSchemaVersion=1;providerConfig=@{promql='vector(101)';queryMode='range';step='5s'};expectedVersion=$currentBinding.revision}
Call POST "$root/metrics/$metricId/binding/preview" $invalidBinding @(422) | Out-Null
$invalidBinding.providerConfig.promql='{__name__=~"up|scrape_duration_seconds"}'
Call POST "$root/metrics/$metricId/binding/preview" $invalidBinding @(422) | Out-Null
$invalidBinding.providerConfig.promql='release_health_nonexistent_metric'
$empty=Call POST "$root/metrics/$metricId/binding/preview" $invalidBinding
if ($empty.status -ne 'no_data' -or $empty.points.Count -ne 0) { throw 'Empty data was converted to zero or readiness.' }
$checks.Add('Contract bounds and multiple series rejected; empty query returns no_data, not zero')
$projectGuid=[guid]$project.id
$rows = docker exec $PostgresContainer psql -U postgres -d featbit -At -c "SELECT row_to_json(d) FROM release_health_documents d WHERE project_id='$projectGuid' AND kind='connection'"
if ($LASTEXITCODE -ne 0) { throw 'Database ciphertext inspection failed.' }
foreach ($row in $rows) {
    if ($row.Contains($providerToken) -or $row.Contains($providerPassword)) { throw 'Plaintext provider credential found in database.' }
    $record=$row|ConvertFrom-Json
    $stored=$record.payload|ConvertFrom-Json
    if ($stored.authentication.type -ne 'none') {
        $envelope=$record.protected_secrets|ConvertFrom-Json
        if ($envelope.Version -ne 1 -or $envelope.KeyId -ne 'local-v1' -or -not $envelope.Tag) { throw 'Missing authenticated ciphertext envelope.' }
    }
}
$checks.Add('Database inspected: no plaintext provider token/password; authenticated ciphertext with key version')
$report=@{checkedAt=[DateTimeOffset]::UtcNow;workspaceId=$workspace.id;organizationId=$organization.id;projectId=$project.id;projectName=$project.name;projectKey=$project.key;environmentId=$environment.id;environmentName=$environment.name;environmentKey=$environment.key;otherEnvironmentId=$otherEnvironment.id;checks=$checks;metrics=$metrics}
$report|ConvertTo-Json -Depth 12|Set-Content -LiteralPath (Join-Path $demoRoot 'reports/product-latest.json')
Write-Host "PASS: $($checks.Count) live product checks. Project: $($project.name). Reports contain no credentials."
