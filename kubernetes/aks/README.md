# Study resources


[Deploying ASP.NET Core applications to Kubernetes](https://andrewlock.net/deploying-asp-net-core-applications-to-kubernetes-part-3-deploying-applications-with-helm/)

[FeatBit's helm chart repository](https://github.com/featbit/featbit-charts)

[Create an ingress controller in Azure Kubernetes Service (AKS)](https://learn.microsoft.com/en-us/azure/aks/ingress-basic?tabs=azure-cli)

- Our helm chart create service in default namespace, this should be able to be initialized with parameters when installing the chart.

[Use a public standard load balancer in Azure Kubernetes Service (AKS)](https://learn.microsoft.com/en-us/azure/aks/load-balancer-standard)


Book: `Helm Chart in action`


# Steps

1. Goto folder where values.yaml is located, modify file `examples/expose-services-via-lb.yaml` to fill loadbalancer and static ip values.

2. Install
```
helm install featbit-v2.4.1 . -f examples/expose-services-via-lb.yaml
```

Remote mongo & Remote redis weren't tested yet.

3. Get helm chart in AKS
```
helm list
```

4. Uninstall

Uninistall
```
helm uninstall featbit
```