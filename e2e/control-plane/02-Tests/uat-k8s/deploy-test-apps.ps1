# deploy-test-apps.ps1
#
# Deploys UAT test app instances to a Kubernetes cluster.
#
# Reads the uat-config.json produced by provision_uat.py, generates K8s
# manifests from the templates in this directory, and applies them.
# Also scales the evaluation-server deployment to the desired replica count.
#
# Examples:
#   .\deploy-test-apps.ps1 -ConfigPath ..\..\uat-config.json
#   .\deploy-test-apps.ps1 -ConfigPath .\config.json -Namespace uat -Context minikube-west
#   .\deploy-test-apps.ps1 -ConfigPath .\config.json -EvalServerReplicas 6 -ImageTag v1.2.3

param(
    [Parameter(Mandatory=$true)]
    [string]$ConfigPath,

    [string]$Namespace = "featbit",
    [string]$Context = "",
    [string]$ImageTag = "latest",
    [int]$EvalServerReplicas = 3
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Build the base kubectl args for namespace and context
$kubectlArgs = @("-n", $Namespace)
if ($Context) {
    $kubectlArgs += @("--context", $Context)
}

# --- Read config ---
if (-not (Test-Path $ConfigPath)) {
    Write-Error "Config file not found: $ConfigPath"
    exit 1
}
$config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
Write-Host "Loaded config with $($config.instances.Count) instance(s)"

# --- Scale evaluation server ---
Write-Host "Scaling evaluation-server to $EvalServerReplicas replica(s)..."
kubectl scale deployment evaluation-server --replicas=$EvalServerReplicas @kubectlArgs
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to scale evaluation-server"
    exit 1
}

# --- Deploy each test app instance ---
$templateDir = $PSScriptRoot
$deploymentTemplate = Get-Content "$templateDir\test-app-deployment.yaml" -Raw
$serviceTemplate = Get-Content "$templateDir\test-app-service.yaml" -Raw

foreach ($instance in $config.instances) {
    $instanceId = $instance.instance_id
    $envSecret  = $instance.env_secret
    $flagKeys   = ($instance.flag_keys -join ",")

    Write-Host "Deploying instance: $instanceId"

    # Generate deployment manifest from template
    $deploymentYaml = $deploymentTemplate `
        -replace '__INSTANCE_ID__', $instanceId `
        -replace '__ENV_SECRET__', $envSecret `
        -replace '__FLAG_KEYS__', $flagKeys `
        -replace '__IMAGE_TAG__', $ImageTag

    # Generate service manifest from template
    $serviceYaml = $serviceTemplate `
        -replace '__INSTANCE_ID__', $instanceId

    # Apply deployment
    $deploymentYaml | kubectl apply -f - @kubectlArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to apply deployment for instance $instanceId"
        exit 1
    }

    # Apply service
    $serviceYaml | kubectl apply -f - @kubectlArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to apply service for instance $instanceId"
        exit 1
    }
}

# --- Wait for all test app pods to be ready ---
Write-Host "Waiting for all UAT test app pods to become ready (timeout: 120s)..."
kubectl wait --for=condition=ready pod -l app=uat-test-app --timeout=120s @kubectlArgs
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Some pods did not become ready within 120s — check pod status"
    kubectl get pods -l app=uat-test-app @kubectlArgs
    exit 1
}

Write-Host "All UAT test app instances deployed and ready."
