$namespace = "featbit"


# Check if namespace exists
if (-not (kubectl get namespaces $namespace -o name)) {
    Write-Host "Namespace '$namespace' does not exist. Creating..."

    # Create namespace
    kubectl create namespace $namespace

    Write-Host "Namespace '$namespace' created."
} else {
    Write-Host "Namespace '$namespace' already exists."
}

kubectl config set-context --current --namespace=$namespace

kubectl apply -f .\application\demo-dino-game-vue-service.yaml

kubectl apply -f .\application\demo-dino-game-vue-pod.yaml  