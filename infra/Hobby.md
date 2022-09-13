# Hobby Deployment

We provide a **hobby deployment** option just for those that want to try out self-hosted Featbit without having to spend a lot on infrastructure costs.

This type of deployment is aimed at users who want to test out the platform or do some minimal use with Featbit ecosystem

It should **not** be used as a production instance for tracking a product with any reasonable amount of scale.

## Pre-requisites

We recommend you to deploy a Linux Ubuntu Virtual Machine

* minimal 4G RAM, 8-16G RAM is recommended
* 64G in disk, SATA is recommended
* Docker should be installed in your VM

## Manuel install on an Ubuntu VM

```
git clone https://github.com/featbit/featbit.git

cd featbit/

docker compose up -d
```

