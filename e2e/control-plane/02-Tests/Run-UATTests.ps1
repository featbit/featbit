<#
.SYNOPSIS
    Orchestrates UAT testing for FeatBit control-plane features.

.DESCRIPTION
    Main entry point for running UAT tests that validate FeatBit control-plane
    behaviour: Client Connections Made, Client Connections Closed, and Push Full
    Sync.

    The full pipeline comprises eight steps:

      1. Validate prerequisites (docker, kubectl, k6, python, minikube, registry)
      1b. Pre-flight image pull health check (no ImagePullBackOff pods)
      2. Provision FeatBit resources (projects, environments, flags)
      3. Build the test app Docker image and push to the local registry
      4. Deploy test app instances and scale the evaluation server
      5. Build test app URLs / set up port forwards for local k6 execution
      6. Run k6 UAT test suite
      7. Report results and archive artifacts
      8. Teardown (K8s resources + provisioned FeatBit resources)

    Steps can be run selectively via the -Mode parameter.

.PARAMETER Mode
    Controls which steps are executed.
      Full          — all steps 1-8 (default)
      ProvisionOnly — steps 1-2
      DeployOnly    — steps 3-4 (requires -ConfigPath)
      TestOnly      — steps 5-7 (requires deployed apps and -ConfigPath)
      TeardownOnly  — step 8   (requires -ConfigPath)

.PARAMETER InstanceCount
    Number of UAT test app instances to provision. Default: 3

.PARAMETER FlagCounts
    Comma-separated flag counts per instance (e.g. "1,3,6"). Default: "1,3,6"

.PARAMETER EvalServerReplicas
    Number of evaluation-server replicas. Default: 3

.PARAMETER ClusterContext
    Kubernetes context for the target Minikube cluster. Default: west

.PARAMETER Namespace
    Kubernetes namespace for UAT resources. Default: default

.PARAMETER ControlPlaneUrl
    FeatBit control-plane API base URL.
    Default: auto-detected via port-forward to control-plane:5200

.PARAMETER ControlPlaneApiKey
    API key for the FeatBit control-plane admin endpoints.

.PARAMETER ConfigPath
    Path to an existing uat-config.json. Required for TestOnly and TeardownOnly
    modes. When omitted in Full or ProvisionOnly mode a path under the run
    artifacts directory is generated automatically.

.PARAMETER ImageTag
    Docker image tag for the UAT test app. Default: latest

.PARAMETER SkipBuild
    Skip Docker image build and push (step 3).

.PARAMETER SkipTeardown
    Skip teardown (step 8) even in Full mode.

.PARAMETER SkipPullBackoffCheck
    Bypass the pre-flight ImagePullBackOff check (step 1b). Use when you know
    infrastructure is intentionally being torn down or replaced and pull failures
    are expected. Has no effect in DeployOnly, TestOnly, or TeardownOnly modes
    (those modes never run the check).

.PARAMETER Verbose
    Emit additional diagnostic output.

.EXAMPLE
    .\Run-UATTests.ps1
    Runs the full UAT pipeline with default settings.

.EXAMPLE
    .\Run-UATTests.ps1 -Mode ProvisionOnly -InstanceCount 5 -FlagCounts "2,4,6,8,10"
    Provisions five UAT instances without deploying or testing.

.EXAMPLE
    .\Run-UATTests.ps1 -Mode TestOnly -ConfigPath .\artifacts\uat\uat-config.json
    Runs k6 tests against already-deployed test apps.

.EXAMPLE
    .\Run-UATTests.ps1 -Mode Full -SkipBuild -SkipTeardown
    Full run reusing the existing Docker image and leaving resources in place.

.EXAMPLE
    .\Run-UATTests.ps1 -Mode TeardownOnly -ConfigPath .\artifacts\uat\uat-config.json
    Tears down K8s resources and provisioned FeatBit data.

.NOTES
    Requires PowerShell 5.1+ on Windows.
    Docker, kubectl, k6, and python must be in PATH.
    The local Docker registry at localhost:5000 must be accessible.
#>

param(
    [ValidateSet("Full", "ProvisionOnly", "DeployOnly", "TestOnly", "TeardownOnly")]
    [string]$Mode = "Full",

    [int]$InstanceCount = 3,
    [string]$FlagCounts = "1,3,6",
    [int]$EvalServerReplicas = 3,

    [string]$ClusterContext = "west",
    [string]$Namespace = "featbit",

    [string]$ControlPlaneUrl = "",
    [string]$ControlPlaneApiKey = "",

    [string]$ConfigPath = "",

    [string]$ImageTag = "latest",
    [switch]$SkipBuild,
    [switch]$SkipTeardown,
    [switch]$SkipPullBackoffCheck,
    [switch]$Verbose
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Paths ────────────────────────────────────────────────────────────────────────

$scriptRoot    = $PSScriptRoot
$repoRoot      = (Split-Path -Parent $scriptRoot) | Split-Path -Parent | Split-Path -Parent
$automationDir = Join-Path $scriptRoot "automation-py"
$testAppDir    = Join-Path $scriptRoot "test-app"
$k8sUatDir     = Join-Path $scriptRoot "uat-k8s"
$k6ScriptPath  = Join-Path $repoRoot  "benchmark\k6-scripts\uat\uat-connections.js"

# Prefer the automation-py venv Python (has all deps); fall back to system python
$automationPython = Join-Path $automationDir ".venv\Scripts\python.exe"
if (-not (Test-Path $automationPython)) {
    $automationPython = "python"
}

$timestamp     = Get-Date -Format "yyyyMMdd-HHmmss"
$artifactsDir  = Join-Path $scriptRoot "artifacts\uat\$timestamp"

# ── Console helpers ──────────────────────────────────────────────────────────────

function Write-Step {
    param([string]$step, [string]$message)
    Write-Host "`n=== [$step] $message ===" -ForegroundColor Cyan
}

function Write-Pass {
    param([string]$message)
    Write-Host "[PASS] $message" -ForegroundColor Green
}

function Write-Fail {
    param([string]$message)
    Write-Host "[FAIL] $message" -ForegroundColor Red
}

function Write-Skip {
    param([string]$message)
    Write-Host "[SKIP] $message" -ForegroundColor Yellow
}

function Write-Info {
    param([string]$message)
    Write-Host "[INFO] $message" -ForegroundColor Gray
}

# ── Prerequisite check ───────────────────────────────────────────────────────────

function Test-Prerequisite {
    param(
        [string]$Name,
        [string]$Command,
        [string]$VersionArg = "--version"
    )

    try {
        $null = & $Command $VersionArg 2>&1
        if ($LASTEXITCODE -ne 0) { throw "non-zero exit" }
        Write-Pass "$Name is available"
        return $true
    } catch {
        Write-Fail "$Name is NOT available ('$Command $VersionArg' failed)"
        return $false
    }
}

function Test-MinikubeCluster {
    param([string]$Context)

    try {
        $status = kubectl --context $Context cluster-info 2>&1
        if ($LASTEXITCODE -ne 0) { throw "cluster not reachable" }
        Write-Pass "Cluster '$Context' is running"
        return $true
    } catch {
        Write-Fail "Cluster '$Context' is not reachable"
        return $false
    }
}

function Test-LocalRegistry {
    try {
        $null = docker ps --filter "name=^registry$" --filter "status=running" --format "{{.Names}}" 2>$null |
                Where-Object { $_ -eq "registry" }
        if (-not $_) {
            # Fallback: try curling the registry API
            $response = curl -s -o NUL -w "%{http_code}" http://localhost:5000/v2/ 2>$null
            if ($response -ne "200") { throw "registry not accessible" }
        }
        Write-Pass "Local registry (localhost:5000) is accessible"
        return $true
    } catch {
        Write-Fail "Local registry (localhost:5000) is NOT accessible"
        return $false
    }
}

# ── Step implementations ─────────────────────────────────────────────────────────

function Invoke-ValidatePrerequisites {
    Write-Step "1" "Validate Prerequisites"

    $allOk = $true
    foreach ($tool in @(
        @{ Name = "docker";  Command = "docker";  VersionArg = "--version" },
        @{ Name = "kubectl"; Command = "kubectl"; VersionArg = "version"   },
        @{ Name = "k6";      Command = "k6";      VersionArg = "version"   },
        @{ Name = "python";  Command = "python";  VersionArg = "--version" }
    )) {
        if (-not (Test-Prerequisite -Name $tool.Name -Command $tool.Command -VersionArg $tool.VersionArg)) {
            $allOk = $false
        }
    }

    if (-not (Test-MinikubeCluster -Context $ClusterContext)) { $allOk = $false }
    if (-not (Test-LocalRegistry))                            { $allOk = $false }

    if (-not $allOk) {
        throw "One or more prerequisites are missing. Resolve the issues above and retry."
    }

    Write-Pass "All prerequisites satisfied"
}

function Invoke-AssertNoImagePullBackoff {
    Write-Step "1b" "Pre-flight Image Pull Health Check"

    if ($SkipPullBackoffCheck) {
        Write-Skip "Pre-flight ImagePullBackOff check skipped (-SkipPullBackoffCheck)"
        return
    }

    $assertScript = Join-Path (Split-Path -Parent $scriptRoot) "01-Infrastructure\Assert-NoImagePullBackoff.ps1"

    if (-not (Test-Path $assertScript)) {
        throw "Assert-NoImagePullBackoff.ps1 not found at expected path: $assertScript"
    }

    & $assertScript -Contexts @($ClusterContext) -Namespaces @($Namespace) -TimeoutSeconds 60 -IntervalSeconds 5

    if ($LASTEXITCODE -ne 0) {
        throw "Pre-flight check failed: ImagePullBackOff pods detected in '$ClusterContext/$Namespace'. Resolve the pull issues (see Assert-NoImagePullBackoff output above) then re-run the UAT."
    }

    Write-Pass "Pre-flight: zero ImagePullBackOff pods in '$ClusterContext/$Namespace'"
}

function Invoke-Provision {
    Write-Step "2" "Provision FeatBit Resources"

    $provisionScript = Join-Path $automationDir "scripts\provision_uat.py"
    if (-not (Test-Path $provisionScript)) {
        throw "Provisioning script not found: $provisionScript"
    }

    # Ensure artifacts directory exists
    if (-not (Test-Path $artifactsDir)) {
        New-Item -ItemType Directory -Path $artifactsDir -Force | Out-Null
    }

    # Resolve config output path
    if (-not $script:effectiveConfigPath) {
        $script:effectiveConfigPath = Join-Path $artifactsDir "uat-config.json"
    }

    Write-Info "Provisioning $InstanceCount instance(s) with flag counts: $FlagCounts"
    Write-Info "Config output: $($script:effectiveConfigPath)"

    Push-Location $automationDir
    try {
        & $automationPython scripts/provision_uat.py provision `
            --output $script:effectiveConfigPath `
            --instances $InstanceCount `
            --flag-counts "$FlagCounts"

        if ($LASTEXITCODE -ne 0) {
            throw "provision_uat.py exited with code $LASTEXITCODE"
        }
    } finally {
        Pop-Location
    }

    if (-not (Test-Path $script:effectiveConfigPath)) {
        throw "Config file was not created: $($script:effectiveConfigPath)"
    }

    Write-Pass "Provisioning complete — config written to $($script:effectiveConfigPath)"
}

function Invoke-BuildImage {
    Write-Step "3" "Build Test App Docker Image"

    if ($SkipBuild) {
        Write-Skip "Docker build skipped (-SkipBuild)"
        return
    }

    $imageName = "localhost:5000/featbit/uat-test-app:$ImageTag"

    if (-not (Test-Path $testAppDir)) {
        throw "Test app directory not found: $testAppDir"
    }

    Write-Info "Building image: $imageName"
    docker build -t $imageName $testAppDir
    if ($LASTEXITCODE -ne 0) {
        throw "Docker build failed"
    }

    Write-Info "Pushing image to local registry..."
    docker push $imageName
    if ($LASTEXITCODE -ne 0) {
        throw "Docker push failed"
    }

    Write-Pass "Image built and pushed: $imageName"
}

function Invoke-Deploy {
    Write-Step "4" "Deploy to Kubernetes"

    if (-not $script:effectiveConfigPath -or -not (Test-Path $script:effectiveConfigPath)) {
        throw "Config file not found: $($script:effectiveConfigPath). Run provisioning first or supply -ConfigPath."
    }

    $deployScript = Join-Path $k8sUatDir "deploy-test-apps.ps1"
    if (-not (Test-Path $deployScript)) {
        throw "Deploy script not found: $deployScript"
    }

    Write-Info "Deploying to context '$ClusterContext', namespace '$Namespace'"
    Write-Info "Eval-server replicas: $EvalServerReplicas, image tag: $ImageTag"

    & $deployScript `
        -ConfigPath $script:effectiveConfigPath `
        -Context $ClusterContext `
        -Namespace $Namespace `
        -EvalServerReplicas $EvalServerReplicas `
        -ImageTag $ImageTag

    if ($LASTEXITCODE -ne 0) {
        throw "Deployment failed (exit code $LASTEXITCODE)"
    }

    # Configure control-plane API key for admin endpoints if needed
    $script:uatApiKey = $ControlPlaneApiKey
    if (-not $script:uatApiKey) {
        $script:uatApiKey = "uat-test-$(Get-Date -Format 'yyyyMMddHHmmss')"
        Write-Info "Setting control-plane API key for UAT admin endpoints..."
        kubectl --context $ClusterContext -n $Namespace set env deployment/control-plane "Api__ApiKey=$($script:uatApiKey)" 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Info "Waiting for control-plane rollout..."
            kubectl --context $ClusterContext -n $Namespace rollout status deployment/control-plane --timeout=120s 2>&1 | Out-Null
            Write-Pass "Control-plane API key configured"
        } else {
            Write-Fail "Failed to set control-plane API key"
        }
    }

    Write-Pass "All UAT test app instances deployed and ready"
}

function Invoke-RunTests {
    Write-Step "5" "Build Test App URLs"

    if (-not $script:effectiveConfigPath -or -not (Test-Path $script:effectiveConfigPath)) {
        throw "Config file not found: $($script:effectiveConfigPath). Required for test execution."
    }

    $config = Get-Content $script:effectiveConfigPath -Raw | ConvertFrom-Json
    $instances = $config.instances

    # Build in-cluster service URLs (k6 running locally uses port-forwards)
    $script:portForwardProcesses = @()
    $testAppUrls = @()
    $basePort = 9100

    # Kill any leftover kubectl port-forward processes on our ports
    $portsToCheck = @(9200)
    for ($i = 0; $i -lt $instances.Count; $i++) { $portsToCheck += (9100 + $i) }
    $existingPFs = Get-CimInstance Win32_Process -Filter "Name='kubectl.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -and $_.CommandLine -match "port-forward" }
    foreach ($pf in $existingPFs) {
        foreach ($port in $portsToCheck) {
            if ($pf.CommandLine -match "\b$port\b") {
                Write-Info "Killing leftover port-forward (PID $($pf.ProcessId)) on port $port"
                Stop-Process -Id $pf.ProcessId -Force -ErrorAction SilentlyContinue
                break
            }
        }
    }
    Start-Sleep -Seconds 1

    # Wait for pods to be ready before port-forwarding
    Write-Info "Waiting for UAT pods to be ready..."
    foreach ($instance in $instances) {
        $instanceId = $instance.instance_id
        $waitArgs = @("wait", "--for=condition=ready", "pod", "-l", "app=uat-test-app,instance=$instanceId", "-n", $Namespace, "--context", $ClusterContext, "--timeout=120s")
        kubectl @waitArgs 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Fail "Pod for $instanceId did not become ready"
        } else {
            Write-Pass "Pod $instanceId is ready"
        }
    }

    foreach ($instance in $instances) {
        $instanceId = $instance.instance_id
        $localPort = $basePort
        $basePort++

        Write-Info "Setting up port-forward for $instanceId -> localhost:$localPort"

        $proc = Start-Process -FilePath "kubectl" `
            -ArgumentList "port-forward svc/uat-test-app-$instanceId ${localPort}:8080 -n $Namespace --context $ClusterContext" `
            -NoNewWindow -PassThru

        $script:portForwardProcesses += $proc
        $testAppUrls += "http://localhost:$localPort"
    }

    # Set up control-plane port-forward for push-full-sync endpoint
    $cpLocalPort = 9200
    Write-Info "Setting up port-forward for control-plane -> localhost:$cpLocalPort"
    $cpProc = Start-Process -FilePath "kubectl" `
        -ArgumentList "port-forward svc/control-plane ${cpLocalPort}:5200 -n $Namespace --context $ClusterContext" `
        -NoNewWindow -PassThru
    $script:portForwardProcesses += $cpProc

    # Auto-set ControlPlaneUrl if not explicitly provided
    if (-not $ControlPlaneUrl) {
        $ControlPlaneUrl = "http://localhost:$cpLocalPort"
        Write-Info "Control plane URL auto-set to: $ControlPlaneUrl"
    }

    # Give port-forwards a moment to establish
    Start-Sleep -Seconds 5

    # Verify control-plane is responding via its port-forward
    $cpHealthUrl = "http://localhost:${cpLocalPort}/health/liveness"
    $cpReady = $false
    for ($attempt = 1; $attempt -le 10; $attempt++) {
        try {
            $resp = Invoke-WebRequest -Uri $cpHealthUrl -UseBasicParsing -TimeoutSec 3 -ErrorAction SilentlyContinue
            if ($resp.StatusCode -eq 200) {
                $cpReady = $true
                break
            }
        } catch { }
        Write-Info "Waiting for control-plane health (attempt $attempt/10)..."
        Start-Sleep -Seconds 3
    }
    if ($cpReady) {
        Write-Pass "Control-plane is healthy and accepting requests"
    } else {
        Write-Fail "Control-plane did not become healthy within 30s"
    }

    $urlsString = $testAppUrls -join ","
    Write-Info "Test app URLs: $urlsString"

    # ── Step 6: Run k6 ─────────────────────────────────────────────────────────
    Write-Step "6" "Run k6 UAT Tests"

    if (-not (Test-Path $k6ScriptPath)) {
        throw "k6 test script not found: $k6ScriptPath"
    }

    # Ensure artifacts directory exists for output
    if (-not (Test-Path $artifactsDir)) {
        New-Item -ItemType Directory -Path $artifactsDir -Force | Out-Null
    }

    $k6SummaryPath = Join-Path $artifactsDir "k6-summary.json"

    $k6Env = @(
        "--env", "UAT_CONFIG_PATH=$($script:effectiveConfigPath)",
        "--env", "CONTROL_PLANE_URL=$ControlPlaneUrl",
        "--env", "TEST_APP_URLS=$urlsString"
    )
    # Use the auto-configured API key if user didn't provide one
    $effectiveApiKey = if ($ControlPlaneApiKey) { $ControlPlaneApiKey } else { $script:uatApiKey }
    if ($effectiveApiKey) {
        $k6Env += @("--env", "CONTROL_PLANE_API_KEY=$effectiveApiKey")
    }

    Write-Info "Running: k6 run $k6ScriptPath"

    # Ensure UTF-8 output for k6 unicode characters
    $prevOutputEncoding = [Console]::OutputEncoding
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8

    # k6 writes all output (progress, console.log) to stderr. With
    # $ErrorActionPreference='Stop', the 2>&1 redirect turns stderr lines
    # into ErrorRecords that immediately throw. Temporarily switch to
    # Continue so we capture the full output and rely on $LASTEXITCODE.
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = "Continue"

    try {
        $k6Output = k6 run $k6ScriptPath @k6Env --summary-export $k6SummaryPath 2>&1
        $k6ExitCode = $LASTEXITCODE
    } catch {
        $k6ExitCode = 1
        $k6Output = $_.Exception.Message
    } finally {
        $ErrorActionPreference = $prevEAP
        [Console]::OutputEncoding = $prevOutputEncoding
    }

    # ── Step 7: Report Results ─────────────────────────────────────────────────
    Write-Step "7" "Report Results"

    # Save raw k6 console output
    $k6LogPath = Join-Path $artifactsDir "k6-output.log"
    $k6Output | Out-File -FilePath $k6LogPath -Encoding UTF8

    # Copy config alongside artifacts
    $configCopy = Join-Path $artifactsDir "uat-config.json"
    if ($script:effectiveConfigPath -ne $configCopy) {
        Copy-Item -Path $script:effectiveConfigPath -Destination $configCopy -Force
    }

    Write-Info "Artifacts saved to: $artifactsDir"
    Write-Info "  k6 output log : $k6LogPath"
    Write-Info "  k6 summary    : $k6SummaryPath"
    Write-Info "  UAT config    : $configCopy"

    # Display k6 summary
    Write-Host "`n--- k6 output (last 40 lines) ---" -ForegroundColor Cyan
    $k6Output | Select-Object -Last 40 | ForEach-Object { Write-Host $_ }
    Write-Host "--- end k6 output ---`n" -ForegroundColor Cyan

    # Clean up port-forward processes
    foreach ($proc in $script:portForwardProcesses) {
        if (-not $proc.HasExited) {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        }
    }

    if ($k6ExitCode -ne 0) {
        # Collect pod logs before teardown for debugging
        Invoke-CollectPodLogs
        throw "k6 UAT tests failed (exit code $k6ExitCode)"
    }

    Write-Pass "k6 UAT tests passed"
}

function Invoke-CollectPodLogs {
    Write-Info "Collecting pod logs for debugging..."

    if (-not (Test-Path $artifactsDir)) {
        New-Item -ItemType Directory -Path $artifactsDir -Force | Out-Null
    }

    $logsDir = Join-Path $artifactsDir "pod-logs"
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null

    # Collect UAT test app pod logs
    $uatPods = kubectl get pods -l app=uat-test-app -n $Namespace --context $ClusterContext -o jsonpath="{.items[*].metadata.name}" 2>$null
    if ($uatPods) {
        foreach ($pod in ($uatPods -split '\s+')) {
            if ($pod) {
                $logFile = Join-Path $logsDir "$pod.log"
                kubectl logs $pod -n $Namespace --context $ClusterContext --tail=200 2>&1 | Out-File -FilePath $logFile -Encoding UTF8
                Write-Info "  Saved logs: $pod -> $logFile"
            }
        }
    } else {
        Write-Info "  No UAT test app pods found"
    }

    # Collect evaluation-server pod logs (last 100 lines, look for connection validation)
    $evalPods = kubectl get pods -l app=evaluation-server -n $Namespace --context $ClusterContext -o jsonpath="{.items[*].metadata.name}" 2>$null
    if ($evalPods) {
        foreach ($pod in ($evalPods -split '\s+')) {
            if ($pod) {
                $logFile = Join-Path $logsDir "eval-$pod.log"
                kubectl logs $pod -n $Namespace --context $ClusterContext --tail=200 2>&1 | Out-File -FilePath $logFile -Encoding UTF8
                Write-Info "  Saved logs: $pod -> $logFile"
            }
        }
    } else {
        Write-Info "  No evaluation-server pods found"
    }

    Write-Info "Pod logs saved to: $logsDir"
}

function Invoke-Teardown {
    Write-Step "8" "Teardown"

    # Clean up any lingering port-forward processes
    if ($script:portForwardProcesses) {
        foreach ($proc in $script:portForwardProcesses) {
            if (-not $proc.HasExited) {
                Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            }
        }
        $script:portForwardProcesses = @()
    }

    # Clean up K8s resources
    $cleanupScript = Join-Path $k8sUatDir "cleanup-test-apps.ps1"
    if (Test-Path $cleanupScript) {
        Write-Info "Cleaning up K8s resources..."
        & $cleanupScript -Namespace $Namespace -Context $ClusterContext
        if ($LASTEXITCODE -ne 0) {
            Write-Fail "K8s cleanup returned exit code $LASTEXITCODE"
        } else {
            Write-Pass "K8s resources cleaned up"
        }
    } else {
        Write-Fail "Cleanup script not found: $cleanupScript"
    }

    # Teardown provisioned FeatBit resources
    if ($script:effectiveConfigPath -and (Test-Path $script:effectiveConfigPath)) {
        Write-Info "Tearing down provisioned FeatBit resources..."
        Push-Location $automationDir
        try {
            & $automationPython scripts/provision_uat.py teardown --config $script:effectiveConfigPath
            if ($LASTEXITCODE -ne 0) {
                Write-Fail "provision_uat.py teardown exited with code $LASTEXITCODE"
            } else {
                Write-Pass "FeatBit resources torn down"
            }
        } finally {
            Pop-Location
        }
    } else {
        Write-Skip "No config file available — skipping FeatBit resource teardown"
    }

    # Remove API key from control-plane if we set it
    if ($script:uatApiKey -and -not $ControlPlaneApiKey) {
        Write-Info "Removing UAT API key from control-plane..."
        kubectl --context $ClusterContext -n $Namespace set env deployment/control-plane "Api__ApiKey-" 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Pass "Control-plane API key removed"
        }
    }
}

# ── Main orchestration ───────────────────────────────────────────────────────────

# Resolve effective config path
$script:effectiveConfigPath = $ConfigPath
$script:uatApiKey = ""
$script:portForwardProcesses = @()
if (-not $script:effectiveConfigPath -and $Mode -in @("TestOnly", "TeardownOnly", "DeployOnly")) {
    Write-Fail "-ConfigPath is required for $Mode mode"
    exit 1
}

$overallSuccess = $false

Write-Host "`n╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║          FeatBit UAT Test Orchestrator               ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Info "Mode             : $Mode"
Write-Info "Cluster context  : $ClusterContext"
Write-Info "Namespace        : $Namespace"
Write-Info "Instance count   : $InstanceCount"
Write-Info "Flag counts      : $FlagCounts"
Write-Info "Eval replicas    : $EvalServerReplicas"
Write-Info "Image tag        : $ImageTag"
Write-Info "Artifacts dir    : $artifactsDir"
if ($script:effectiveConfigPath) {
    Write-Info "Config path      : $script:effectiveConfigPath"
}
Write-Host ""

try {
    switch ($Mode) {
        "Full" {
            Invoke-ValidatePrerequisites
            Invoke-AssertNoImagePullBackoff
            Invoke-Provision
            Invoke-BuildImage
            Invoke-Deploy
            Invoke-RunTests
            if (-not $SkipTeardown) {
                Invoke-Teardown
            } else {
                Write-Skip "Teardown skipped (-SkipTeardown)"
            }
            $overallSuccess = $true
        }

        "ProvisionOnly" {
            Invoke-ValidatePrerequisites
            Invoke-AssertNoImagePullBackoff
            Invoke-Provision
            $overallSuccess = $true
        }

        "DeployOnly" {
            Invoke-ValidatePrerequisites
            Invoke-BuildImage
            Invoke-Deploy
            $overallSuccess = $true
        }

        "TestOnly" {
            Invoke-RunTests
            $overallSuccess = $true
        }

        "TeardownOnly" {
            Invoke-Teardown
            $overallSuccess = $true
        }
    }
} catch {
    Write-Fail "Pipeline failed: $_"

    # On failure in Full mode, attempt cleanup unless skipped
    if ($Mode -eq "Full" -and -not $SkipTeardown) {
        Write-Info "Attempting cleanup after failure..."
        try {
            Invoke-Teardown
        } catch {
            Write-Fail "Cleanup also failed: $_"
        }
    }
}

# ── Exit ─────────────────────────────────────────────────────────────────────────

Write-Host ""
if ($overallSuccess) {
    Write-Pass "UAT pipeline completed successfully ($Mode mode)"
    exit 0
} else {
    Write-Fail "UAT pipeline failed ($Mode mode)"
    exit 1
}
