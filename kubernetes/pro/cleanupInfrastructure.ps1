kubectl delete -f .\infrastructure\mongodb-pod.yaml  

kubectl delete -f .\infrastructure\redis-pod.yaml

kubectl delete -f .\infrastructure\clickhouse-server-pod.yaml

kubectl delete -f .\infrastructure\kafka-pod.yaml

kubectl delete -f .\infrastructure\clickhouse-configmap-etc.yaml

kubectl delete -f .\infrastructure\mongodb-init-configMap.yaml

kubectl delete -f .\infrastructure\redis-service.yaml

kubectl delete -f .\infrastructure\mongodb-service.yaml

kubectl delete -f .\infrastructure\clickhouse-server-service.yaml

kubectl delete -f .\infrastructure\kafka-service.yaml

kubectl delete -f .\infrastructure\mongodb-persistentvolumeclaim.yaml 

kubectl delete -f .\infrastructure\kafka-persistentvolumeclaim.yaml

kubectl delete -f .\infrastructure\clickhouse-server-persistentvolumeclaim.yaml

kubectl delete -f .\infrastructure\redis-persistentvolumeclaim.yaml