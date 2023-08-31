# Kubernetes Manifests

**Overview**

A collection of Kubernetes Manifests used to deploy the Professional version of Featbit.

**Prerequisites**

A working Kubernetes Cluster such as 

* [k3s](https://k3s.io/)
* [k8s](https://kubernetes.io/)
* [Minikube](https://minikube.sigs.k8s.io/docs/start/)

**Important Notes**

- These files use known usernames and passwords as well as very basic configurations to facilitate an easy way to evaluate Featbit Professional on kubernetes, they should be changed for any other uses. DO NOT deploy to a production or otherwise public cluster without customizing them.

- The infrastructure folder contains manifests needed to setup single instances of mongodb, clickhouse, kafka, and redis, with the exception of the *-configMap files which are derived from the configuration files found in featbit/infra/ directory of the repo. These manifests are provided as a convenience, if you have support, installation, maintanance, configuration, clustering, or any other questions regarding infrastructure components, please check with those projects respectively.

- The manifests in the ingress folder are provided as a convenience and assume that traefik is installed and properly configured.  As such configurations are highly custom, we cannot support your specific configuration.  If you need help with traefik, please seek support from that community and their documentation.


**Instructions**

*For Powershell*:

There are two powershell scripts deployInfrastructure.ps1 and deployApplication.ps1

If you already have mongodb or redis available and want to use your existing deployments of those, you do not need to run deployInfrastructure.ps1

These scripts MUST be run from the `featbit\kubernetes\pro` folder.

```
ex.
PS C:\Users\<your account>\source\public-forks\featbit\kubernetes\pro>.\deployInfrastructure.ps1

PS C:\Users\<your account>\source\public-forks\featbit\kubernetes\pro>.\deployApplication.ps1

```


*For all others*

Apply each manifest individually. The commands in powershell scripts can be used as a guide for a shell script, or pasted into a terminal but it was not developed or tested that way.


**Port Forwarding**

*Port forwarding is not needed when using an ingress*

With kubectl you can forward to a pod, deployment, replicaset, or service. These examples use services 

```
kubectl port-forward services/api-server 5000:5000 -n featbit
kubectl port-forward services/evaluation-server 5100:5100 -n featbit
kubectl port-forward services/ui 8081:8081 -n featbit
```

**Ingress**

If using the ingress supplied files or your own, there are a few settings that require attention in the manifests.

In `ui-deployment.yaml`the API_URL & EVALUATION_URL environment variables will need to be set to reflect your desired FQDN.

for example if the domain was `testnetwork.local` the values would look something like:

```
- name: API_URL
value: http://featbit-api.testnetwork.local
- name: DEMO_URL
value: https://featbit-samples.vercel.app
- name: EVALUATION_URL
value: http://featbit-eval.testnetwork.local
```

These values also need to be set in each of the ingress files respectively.

For example the `host` line in `traefik-ingress-ui.yaml` would look something like

```
- host: featbit-ui.testnetwork.local
```

