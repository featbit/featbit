# cleanup-test-apps.ps1
#
# Removes all UAT test app deployments and services from the cluster,
# and scales the evaluation-server back to its default replica count.
#
# Examples:
#   .\cleanup-test-apps.ps1
#   .\cleanup-test-apps.ps1 -Namespace uat -Context minikube-west
#   .\cleanup-test-apps.ps1 -EvalServerReplicas 1

param(
    [string]$Namespace = "featbit",
    [string]$Context = "",
    [int]$EvalServerReplicas = 1
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# Build the base kubectl args for namespace and context
$kubectlArgs = @("-n", $Namespace)
if ($Context) {
    $kubectlArgs += @("--context", $Context)
}

# --- Delete all UAT test app resources ---
Write-Host "Deleting UAT test app deployments..."
kubectl delete deployment -l app=uat-test-app @kubectlArgs --ignore-not-found

Write-Host "Deleting UAT test app services..."
kubectl delete service -l app=uat-test-app @kubectlArgs --ignore-not-found

# --- Scale eval server back to default ---
Write-Host "Scaling evaluation-server back to $EvalServerReplicas replica(s)..."
kubectl scale deployment evaluation-server --replicas=$EvalServerReplicas @kubectlArgs

Write-Host "UAT cleanup complete."
