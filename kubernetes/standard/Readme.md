# Kubernetes Manifests

**Overview**

A collection of Kubernetes Manifests used to deploy the Standard version of Featbit.

**Prerequisites**

A working Kubernetes Cluster such as 

* [k3s](https://k3s.io/)
* [k8s](https://kubernetes.io/)
* [Minikube](https://minikube.sigs.k8s.io/docs/start/)

**Important Notes**

- These files use known usernames and passwords as well as very basic configurations to facilitate an easy way to evaluate Featbit Standard on kubernetes, they should be changed for any other uses.

- The infrastruture folder contains the manifests needed to setup mongodb and redis.  With the exception of the mongodb-init-configMap.yaml file which is derived from the init.js file from featbit/infra/mongodb/docker-entrypoint-initdb.d/init.js file, these are provided as a convenience, if you have support, installation, maintanance, configuration, or any other questions regarding mongodb, or redis check with those projects.

- The manifests in the ingress folder are provided as a convenience and assume that traefik is installed and properly configured.  As such configurations are highly custom, we can not support your specific configuration.  If you need help with traefik, please seek support from that community.



