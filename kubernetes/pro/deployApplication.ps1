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

# the api-server needs a secret JWT signing key: create a random one unless the secret already exists
if (-not (kubectl get secret featbit-api-jwt -o name --ignore-not-found)) {
    $jwtKeyBytes = New-Object byte[] 32
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($jwtKeyBytes)
    kubectl create secret generic featbit-api-jwt --from-literal=key=$([Convert]::ToBase64String($jwtKeyBytes))
}

kubectl apply -f .\application\api-server-service.yaml  

kubectl apply -f .\application\api-server-deployment.yaml

kubectl apply -f .\application\evaluation-server-service.yaml  

kubectl apply -f .\application\evaluation-server-deployment.yaml

kubectl apply -f .\application\da-server-deployment.yaml  

kubectl apply -f .\application\da-server-service.yaml

kubectl apply -f .\application\ui-service.yaml  

kubectl apply -f .\application\ui-deployment.yaml