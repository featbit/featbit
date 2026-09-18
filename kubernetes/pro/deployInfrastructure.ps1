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

kubectl apply -f .\infrastructure\mongodb-init-configMap.yaml

kubectl apply -f .\infrastructure\mongodb-persistentvolumeclaim.yaml 

kubectl apply -f .\infrastructure\mongodb-service.yaml

kubectl apply -f .\infrastructure\mongodb-pod.yaml  

kubectl apply -f .\infrastructure\redis-persistentvolumeclaim.yaml

kubectl apply -f .\infrastructure\redis-service.yaml

kubectl apply -f .\infrastructure\redis-pod.yaml

kubectl apply -f .\infrastructure\clickhouse-configmap-etc.yaml

kubectl apply -f .\infrastructure\clickhouse-server-persistentvolumeclaim.yaml

kubectl apply -f .\infrastructure\clickhouse-server-service.yaml

kubectl apply -f .\infrastructure\clickhouse-server-pod.yaml

kubectl apply -f .\infrastructure\kafka-persistentvolumeclaim.yaml

kubectl apply -f .\infrastructure\kafka-service.yaml

kubectl apply -f .\infrastructure\kafka-pod.yaml

