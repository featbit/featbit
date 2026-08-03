<#
.SYNOPSIS
    Configures ingress for FeatBit Pro on west and east Minikube clusters.

.DESCRIPTION
    This script performs the following operations:
    1. Creates nginx ingress resources for UI, API, and Evaluation servers
    2. Updates UI deployments with correct API/Eval URLs
    3. Provides access instructions via port-forwarding or minikube tunnel
    
    The script supports two access methods:
    - Port forwarding (recommended for Windows/Docker): Uses kubectl port-forward
    - Minikube tunnel (alternative): Creates a network tunnel for direct access
    
.PARAMETER WestDomain
    Domain name for west cluster. Default: west.featbit.local

.PARAMETER EastDomain
    Domain name for east cluster. Default: east.featbit.local

.PARAMETER UsePortForward
    If specified, sets up port forwarding instead of using ingress NodePorts.

.EXAMPLE
    .\Configure-FeatBitIngress.ps1
    Configures ingress with default settings.

.EXAMPLE
    .\Configure-FeatBitIngress.ps1 -UsePortForward
    Configures and starts port forwarding for direct access.

.NOTES
    Author: GitHub Copilot
    Date: 2026-03-04
    
    Due to networking limitations with Minikube on Windows Docker driver,
    port-forwarding is the recommended access method.
#>

[CmdletBinding()]
param(
    [string]$WestDomain = "west.featbit.local",
    [string]$EastDomain = "east.featbit.local",
    [switch]$UsePortForward
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "`n=== $Message ===" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host "  $Message" -ForegroundColor Gray
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

Write-Step "Configuring Ingress for FeatBit Clusters"

Write-Info "Creating ingress resources for west cluster..."

$westIngressUI = @"
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ui-route
  namespace: featbit
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  rules:
    - host: $WestDomain
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: ui
                port:
                  number: 8081
"@

$westIngressAPI = @"
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-server-route
  namespace: featbit
spec:
  ingressClassName: nginx
  rules:
    - host: west-api.featbit.local
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api-server
                port:
                  number: 5000
"@

$westIngressEval = @"
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: evaluation-server-route
  namespace: featbit
spec:
  ingressClassName: nginx
  rules:
    - host: west-eval.featbit.local
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: evaluation-server
                port:
                  number: 5100
"@

$westIngressUI | kubectl --context west apply -f - | Out-Null
$westIngressAPI | kubectl --context west apply -f - | Out-Null
$westIngressEval | kubectl --context west apply -f - | Out-Null
Write-Success "West ingress resources created"

Write-Info "Creating ingress resources for east cluster..."

$eastIngressUI = @"
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ui-route
  namespace: featbit
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  rules:
    - host: $EastDomain
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: ui
                port:
                  number: 8081
"@

$eastIngressAPI = @"
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-server-route
  namespace: featbit
spec:
  ingressClassName: nginx
  rules:
    - host: east-api.featbit.local
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api-server
                port:
                  number: 5000
"@

$eastIngressEval = @"
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: evaluation-server-route
  namespace: featbit
spec:
  ingressClassName: nginx
  rules:
    - host: east-eval.featbit.local
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: evaluation-server
                port:
                  number: 5100
"@

$eastIngressUI | kubectl --context east apply -f - | Out-Null
$eastIngressAPI | kubectl --context east apply -f - | Out-Null
$eastIngressEval | kubectl --context east apply -f - | Out-Null
Write-Success "East ingress resources created"

Write-Step "Updating UI Deployments"

Write-Info "Updating west UI with API/Eval URLs..."
$westUIUpdate = @"
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ui
  namespace: featbit
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ui
  template:
    metadata:
      labels:
        app: ui
    spec:
      containers:
        - env:
            - name: API_URL
              value: http://localhost:5000
            - name: DEMO_URL
              value: https://featbit-samples.vercel.app
            - name: EVALUATION_URL
              value: http://localhost:5100
          image: host.minikube.internal:5000/featbit/featbit-ui:latest
          name: ui
          ports:
            - containerPort: 80
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
"@

$westUIUpdate | kubectl --context west apply -f - | Out-Null
Write-Success "West UI updated"

Write-Info "Updating east UI with API/Eval URLs..."
$eastUIUpdate = @"
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ui
  namespace: featbit
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ui
  template:
    metadata:
      labels:
        app: ui
    spec:
      containers:
        - env:
            - name: API_URL
              value: http://localhost:5000
            - name: DEMO_URL
              value: https://featbit-samples.vercel.app
            - name: EVALUATION_URL
              value: http://localhost:5100
          image: host.minikube.internal:5000/featbit/featbit-ui:latest
          name: ui
          ports:
            - containerPort: 80
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
"@

$eastUIUpdate | kubectl --context east apply -f - | Out-Null
Write-Success "East UI updated"

Write-Info "Waiting for UI pods to restart..."
Start-Sleep -Seconds 20

Write-Step "Ingress Configuration Complete"

Write-Host "`nIngress Status:" -ForegroundColor Yellow
Write-Host "West Cluster:" -ForegroundColor Cyan
kubectl --context west get ingress -n featbit

Write-Host "`nEast Cluster:" -ForegroundColor Cyan
kubectl --context east get ingress -n featbit

Write-Step "Access Instructions"

Write-Host "`nDue to Docker driver networking limitations on Windows," -ForegroundColor Yellow
Write-Host "use Port Forwarding to access FeatBit:" -ForegroundColor Yellow

Write-Host "`nWest Cluster Access:" -ForegroundColor Cyan
Write-Host "  UI:          kubectl --context west port-forward -n featbit svc/ui 8081:8081" -ForegroundColor Gray
Write-Host "  API:         kubectl --context west port-forward -n featbit svc/api-server 5000:5000" -ForegroundColor Gray
Write-Host "  Evaluation:  kubectl --context west port-forward -n featbit svc/evaluation-server 5100:5100" -ForegroundColor Gray
Write-Host "  Then access: http://localhost:8081" -ForegroundColor Green

Write-Host "`nEast Cluster Access:" -ForegroundColor Cyan
Write-Host "  UI:          kubectl --context east port-forward -n featbit svc/ui 8082:8081" -ForegroundColor Gray
Write-Host "  API:         kubectl --context east port-forward -n featbit svc/api-server 5001:5000" -ForegroundColor Gray
Write-Host "  Evaluation:  kubectl --context east port-forward -n featbit svc/evaluation-server 5101:5100" -ForegroundColor Gray
Write-Host "  Then access: http://localhost:8082" -ForegroundColor Green

if ($UsePortForward) {
    Write-Step "Starting Port Forwarding"
    Write-Warning "Port forwarding will run in the foreground. Press Ctrl+C to stop."
    Write-Info "Starting west UI port-forward on port 8081..."
    Write-Info "Starting east UI port-forward on port 8082..."
    
    Start-Process pwsh -ArgumentList "-NoExit", "-Command", "kubectl --context west port-forward -n featbit svc/ui 8081:8081"
    Start-Sleep -Seconds 2
    Start-Process pwsh -ArgumentList "-NoExit", "-Command", "kubectl --context east port-forward -n featbit svc/ui 8082:8081"
    Start-Sleep -Seconds 2
    Start-Process pwsh -ArgumentList "-NoExit", "-Command", "kubectl --context west port-forward -n featbit svc/api-server 5000:5000"
    Start-Sleep -Seconds 2
    Start-Process pwsh -ArgumentList "-NoExit", "-Command", "kubectl --context east port-forward -n featbit svc/api-server 5001:5000"
    Start-Sleep -Seconds 2
    Start-Process pwsh -ArgumentList "-NoExit", "-Command", "kubectl --context west port-forward -n featbit svc/evaluation-server 5100:5100"
    Start-Sleep -Seconds 2
    Start-Process pwsh -ArgumentList "-NoExit", "-Command", "kubectl --context east port-forward -n featbit svc/evaluation-server 5101:5100"
    
    Write-Success "Port forwarding started in separate windows"
    Write-Host "`nAccess URLs:" -ForegroundColor Green
    Write-Host "  West: http://localhost:8081" -ForegroundColor Cyan
    Write-Host "  East: http://localhost:8082" -ForegroundColor Cyan
}

Write-Host "`nAlternative: Use minikube service command:" -ForegroundColor Yellow
Write-Host "  minikube -p west service ui -n featbit" -ForegroundColor Gray
Write-Host "  minikube -p east service ui -n featbit" -ForegroundColor Gray

Write-Host ""
