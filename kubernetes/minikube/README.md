# Minikube Custom Base Image

The Dockerfile in this folder is only needed if you are using a private image registry on an internal network with self-signed certificates. Because of the number of images needed to run the PRO stack with control planes, a private registry can avoid Docker Hub rate limiting.

## What it does

Builds a custom Minikube `kicbase` image with your corporate CA certificates pre-installed and Docker daemon trust pre-configured, so clusters created from this image can pull from your private registry without any post-creation certificate setup.

## Before building

Edit the `Dockerfile` and replace the placeholder values:

| Placeholder | Replace with |
|---|---|
| `<MY_CA_CERT>` | The filename (without extension) of your root CA certificate PEM file, e.g. `my-root-ca` |
| `<MY_INT_CERT>` | The filename (without extension) of your intermediate CA certificate PEM file, e.g. `my-intermediate-ca` |

Place the corresponding `.pem` files in this directory alongside the Dockerfile before building.

## Building

```powershell
docker build `
  --build-arg REGISTRY_HOST=myregistry.example.com `
  -t kicbase:v0.0.50-corpca `
  kubernetes/minikube
```

Replace `myregistry.example.com` with your registry hostname (and port if needed, e.g. `myregistry.example.com:5000`).

## Using the image

Set `MINIKUBE_BASE_IMAGE` in your `deployment.env`:

```
MINIKUBE_BASE_IMAGE=kicbase:v0.0.50-corpca
```

`Deploy-FeatBitClusters.ps1` will pass this as `--base-image` when creating the west and east clusters.