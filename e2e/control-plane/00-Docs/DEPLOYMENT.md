# FeatBit Multi-Cluster Deployment

This document covers deploying FeatBit Pro to two Minikube clusters (west and east). Infrastructure scripts live under `e2e/control-plane/01-Infrastructure/`.

> **Working directory:** All commands in this document assume you are in the `01-Infrastructure/` directory unless stated otherwise.

## Overview

The standard deployment workflow:

1. **`deployment.env`** — configure your environment once
2. **`Deploy-FeatBitClusters.ps1`** — create clusters and deploy FeatBit
3. **`Start-PortForwards.ps1`** — expose all services on localhost
4. **`Initialize-MongoDBReplicaSet.ps1`** — initialise the replica set (in-cluster MongoDB only)
5. **`Setup-FeatBitProxy.ps1`** — optional nginx reverse proxy for DNS-based access

> **Registry TLS trust:** As of the registry-trust permanent fix, `Deploy-FeatBitClusters.ps1` handles corporate registry TLS trust automatically when configured via `TRUST_CERTIFICATES` in `deployment.env`. No separate manual trust step is required during a normal deployment.

---

## Prerequisites

### Ubuntu / Debian Linux

#### 1. Install PowerShell 7.6+

```bash
source /etc/os-release
wget -q https://packages.microsoft.com/config/ubuntu/$VERSION_ID/packages-microsoft-prod.deb
sudo dpkg -i packages-microsoft-prod.deb
rm packages-microsoft-prod.deb

sudo apt-get update
sudo apt-get install -y powershell
```

For other Debian-based distros, see the [official install guide](https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell-on-linux).

#### 2. Install remaining prerequisites

Run `Install-Prerequisites.ps1` to automatically install Docker Engine, Minikube, and kubectl. Chocolatey is automatically skipped on Linux — no extra flags needed:

```powershell
pwsh -File ./Install-Prerequisites.ps1
```

Run as root, or as a user with sudo access. To preview what would be installed without making changes:

```powershell
pwsh -File ./Install-Prerequisites.ps1 -WhatIf
```

> **Note:** After installation, Docker Engine adds your user to the `docker` group. You must start a new shell session before running Docker without sudo.

Chocolatey is automatically skipped on Linux — it is not needed. `Setup-FeatBitProxy.ps1` supports Linux and will install and configure nginx via apt if needed.

---

### Windows

- Windows 10/11 or Windows Server
- Docker Desktop, or Rancher Desktop installed and running
- Minikube installed (https://minikube.sigs.k8s.io/docs/)
- kubectl installed (https://kubernetes.io/docs/reference/kubectl/)
- Chocolatey package manager installed (for `Setup-FeatBitProxy.ps1` only) (https://chocolatey.org/)
- PWSH flavored PowerShell 7.6.0 or later (https://github.com/powershell/powershell)
- Administrator privileges (for `Setup-FeatBitProxy.ps1` only)

Run `Install-Prerequisites.ps1` to automatically check for and install any missing prerequisites:

```powershell
# Core prerequisites only (Docker Desktop, Minikube, kubectl)
.\Install-Prerequisites.ps1 -SkipChocolatey

# All prerequisites including Chocolatey (required for Setup-FeatBitProxy.ps1)
# Must be run from an elevated (Administrator) PowerShell session
.\Install-Prerequisites.ps1
```

#### Optional: k6 for CP-09 WebSocket coverage

Grafana k6 is optional. It is required only for full coverage of the
`cp09-pod-heartbeats` scenario, where automation opens real evaluation-server
WebSocket clients and asserts connection migration after pod failover.

Auto-install k6 with `pwsh -File ...\Quickstart-*.ps1 -InstallK6`; choose
the matching Quickstart wizard:

- `pwsh -File .\01-Infrastructure\Quickstart-WSL.ps1 -InstallK6` — Windows WSL2 wizard
- `pwsh -File .\01-Infrastructure\windows-wsl\Quickstart-WSL.ps1 -InstallK6` — in-WSL2 Linux wizard
- `pwsh -File .\01-Infrastructure\windows-hyperv\Quickstart-HyperV.ps1 -InstallK6` — Windows Hyper-V wizard
- `pwsh -File .\01-Infrastructure\ubuntu\Quickstart-Ubuntu.ps1 -InstallK6` — native Ubuntu wizard

For manual installation, see [`benchmark\install-k6.md`](../../../benchmark/install-k6.md).
A sudo-less alternative that the harness picks up equally well: drop the
[static k6 release binary](https://github.com/grafana/k6/releases) into `~/.local/bin`.
Any k6 from v0.50 up works — the cp09 script feature-detects the timer API
(global timers on v0.56+/v1.x, legacy socket timers on older releases).

Without k6, run the suite with `--ws-disabled`: the heartbeat purge/recovery
assertions still execute; only the WebSocket client phases are skipped.

#### CP-09 failover: the load balancer is a prerequisite for the migration assertion

CP-09's `west-clients-migrated-to-east` assertion is only meaningful when the
WebSocket clients connect **through the active/active nginx LB**: west's eval
pods are deleted, and the LB is what routes the reconnecting clients to east.
Two things must line up:

1. **The proxy must be running with the eval upstream.** Both proxy flavors
   provide it, but under different hostnames — pass the one matching your proxy:
   - host nginx (`Setup-FeatBitProxy.ps1`, needs sudo): the default
     `--ws-lb-host featbit-eval.local` works as-is.
   - rootless container (`Start-FeatBitProxyContainer.ps1`): pass
     `--ws-lb-host featbit-eval.127.0.0.1.sslip.io` — the `.local` names are
     not wired into the container's nginx.
2. **Do not use `--ws-no-load-balancer` for failover coverage.** Pinned mode
   connects each VU directly to a per-cluster port-forward slot; after the pod
   delete, pinned clients reconnect to west's replacement pods and *cannot*
   migrate — the migration assertion then fails by design, not because the
   product misbehaved. Pinned mode is for per-cluster connection accounting,
   not failover.

---

## Architecture

```
Browser
    ↓
Port Forwards (kubectl)          ← primary access method
    ↓
Kubernetes Services (Minikube)
    ↓
FeatBit Pods

          ─ or ─

Browser (DNS names)
    ↓
Nginx Reverse Proxy (host)  ← optional, via Setup-FeatBitProxy.ps1
    ↓                          requires port forwards to be running simultaneously
Port Forwards (kubectl)
    ↓
Kubernetes Services (Minikube)
```

### Clusters

- **West Cluster** (`west` profile) — default 4 CPUs / 8 GB
- **East Cluster** (`east` profile) — default 4 CPUs / 8 GB

Both clusters share a Docker bridge network (`featbit-cluster-network`) for cross-cluster infrastructure communication.

### Port Mappings (port-forward mode)

| Service    | West                   | East                   |
| ---------- | ---------------------- | ---------------------- |
| UI         | http://localhost:8081  | http://localhost:8082  |
| API        | http://localhost:15000 | http://localhost:15001 |
| Evaluation | http://localhost:5100  | http://localhost:5101  |
| Kafka UI   | http://localhost:18080 | http://localhost:18081 |

### DNS Names (nginx proxy mode)

| Service    | West                           | East                           |
| ---------- | ------------------------------ | ------------------------------ |
| UI         | http://featbit.west.local      | http://featbit.east.local      |
| API        | http://featbit-api.west.local  | http://featbit-api.east.local  |
| Evaluation | http://featbit-eval.west.local | http://featbit-eval.east.local |

---

## Quick Start

All commands below assume your working directory is the `e2e/control-plane` folder:

```powershell
# Windows
cd <repo-root>\e2e\control-plane

# Linux
cd <repo-root>/e2e/control-plane
```

### Step 0: Configure deployment.env

Copy the example file and fill in values for your environment:

```powershell
# Windows
Copy-Item deployment.env.example deployment.env
notepad deployment.env

# Linux
cp deployment.env.example deployment.env
nano deployment.env   # or: $EDITOR deployment.env
```

Key settings (all optional — see comments in the file for defaults):

| Variable                                                | Purpose                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CUSTOM_IMAGE_REGISTRY`                                 | Registry prefix for infrastructure images rewritten from the image map (e.g. `nexus.tekgeek.io/repository/docker-proxy`). Leave blank to pull from Docker Hub directly.                                                                                                                    |
| `INFRA_IMAGE_REPOSITORY`                                | Full registry path used to compute `MongoImage` and `PostgresImage` for `kubectl set image` calls. Defaults to `CUSTOM_IMAGE_REGISTRY/dockerhub/library` — override this whenever your proxy path does not end in `/dockerhub/library` (e.g. a Nexus proxy at `/repository/docker-proxy`). |
| `FEATBIT_IMAGE_REGISTRY`                                | Registry hosting the FeatBit application images. Defaults to `host.minikube.internal:5000`. Set this only if your FeatBit images live on a different registry than your infra images.                                                                                                      |
| `CUSTOM_REGISTRY_USERNAME` / `CUSTOM_REGISTRY_PASSWORD` | Credentials for `CUSTOM_IMAGE_REGISTRY`. When set, the script automatically creates image pull secrets in both clusters.                                                                                                                                                                   |
| `MINIKUBE_BASE_IMAGE`                                   | Full custom kicbase image reference, including registry/path/tag (e.g. `harbor.example.com/ci/minikube:v0.0.50-corpca`)                                                                                                                                                                    |
| `TRUST_CERTIFICATES`                                    | Corporate CA certs to install at runtime (if not using a custom base image)                                                                                                                                                                                                                |
| `DEPLOYMENT_MODE`                                       | `Basic` (default) or `Advanced`                                                                                                                                                                                                                                                            |
| `DATABASE_PROVIDER`                                     | `MongoDb` (default) or `Postgres`                                                                                                                                                                                                                                                          |
| `CONSISTENCY_MODE`                                      | `BestEffort` (default) or `GatedCommit`. GatedCommit enables cross-DC staged commits and labels each Redis instance with its `DcId` — required for the CP-10 – CP-14 consistency tests. See [GATED-COMMIT-CONSISTENCY.md](./GATED-COMMIT-CONSISTENCY.md).                                    |
| `WEST_CPUS` / `WEST_MEMORY`                             | Cluster resource overrides                                                                                                                                                                                                                                                                 |

### Step 1: Build and Push FeatBit Images

Build all four FeatBit service images from source, start the local Docker registry (if not
running), and push the images to it:

```powershell
.\extras\Build-FeatBitImages.ps1
```

To build only specific images:

```powershell
.\extras\Build-FeatBitImages.ps1 -Images control-plane, evaluation-server
```

To preview what would happen without making any changes:

```powershell
.\extras\Build-FeatBitImages.ps1 -WhatIf
```

**Estimated time:** 5–15 minutes (first build; subsequent builds are faster due to Docker layer caching)

### Step 2: Deploy Clusters and FeatBit

```powershell
.\Deploy-FeatBitClusters.ps1
```

This script will:

- ✓ Start the local Docker registry on localhost:5000 (creates it automatically if needed)
- ✓ Verify FeatBit images are available
- ✓ Create west and east Minikube clusters
- ✓ Connect both nodes to a shared Docker network
- ✓ Deploy infrastructure (MongoDB, Redis, ClickHouse, Kafka — per your configuration)
- ✓ Deploy FeatBit applications (UI, API, Evaluation, Control Plane)
- ✓ Configure database connection strings

To recreate clusters from scratch: add `-RecreateClusters`.
To redeploy FeatBit without touching clusters: add `-SkipClusterCreation`.

**Estimated time:** 5–10 minutes

### Step 3: Start Port Forwards

```powershell
.\Start-PortForwards.ps1
```

Keep this window open. It manages all `kubectl port-forward` processes with automatic restart. Access FeatBit at http://localhost:8081 (west) and http://localhost:8082 (east).

To stop all port forwards:

```powershell
.\Stop-PortForwards.ps1
```

### Step 4: Initialize MongoDB Replica Set (in-cluster MongoDB only)

Skip this step if MongoDB is running on the host (`HostInfraComponents` includes `mongodb`) — it is already initialised by Docker Compose.

Run **after** port forwards are active:

```powershell
.\Initialize-MongoDBReplicaSet.ps1
```

**Estimated time:** 1–2 minutes

### Step 5: Access FeatBit

Open your browser to:

- West Cluster: http://localhost:8081
- East Cluster: http://localhost:8082

**Default credentials:**

- Username: `test@featbit.com`
- Password: `123456`

### Step 6 (Optional): Setup Nginx Reverse Proxy

For DNS name access instead of localhost ports.

- **Windows:** requires an Administrator PowerShell session
- **Linux:** requires root or a user with sudo access

```powershell
# Windows (Administrator session)
.\Setup-FeatBitProxy.ps1

# Linux
sudo pwsh ./Setup-FeatBitProxy.ps1
```

After this, FeatBit is accessible at http://featbit.west.local and http://featbit.east.local.

> **Linux note:** `Setup-FeatBitProxy.ps1` attempts to start port forwards automatically, but the background process it spawns may not survive in all terminal environments. If the proxy returns 502 Bad Gateway, restart port forwards manually:
>
> ```powershell
> pwsh ./Start-PortForwards.ps1
> ```
>
> Nginx proxies to the kubectl port-forward ports (8081, 8082, etc.), so both nginx **and** port forwards must be running simultaneously.

### Step 7 (Optional): GatedCommit Consistency Testing

Required only to run the cross-DC consistency scenarios (CP-10 – CP-14). See
[GATED-COMMIT-CONSISTENCY.md](./GATED-COMMIT-CONSISTENCY.md) for the full operator guide.

1. **Deploy in GatedCommit mode.** Set `CONSISTENCY_MODE=GatedCommit` in `deployment.env`
   **before** Step 2. The deploy script then enables `ControlPlane:ConsistencyMode=GatedCommit`
   on both control planes + eval servers and labels each Redis instance with its `DcId`.
   (Default `BestEffort` leaves behavior unchanged.) To flip an already-deployed environment,
   set it and re-run `.\Deploy-FeatBitClusters.ps1 -SkipClusterCreation`.

2. **Install Chaos Mesh** (CP-11/CP-12/CP-13 disruptions only):

   ```powershell
   .\extras\Deploy-ChaosMesh.ps1
   ```

3. **Run the scenarios** from `02-Tests/automation-py`, e.g. `automation suite cp11 --env-id <env> --no-dashboard`.
   The suite auto-applies the chaos-mesh partitions from `01-Infrastructure/chaos-mesh/`.

---

## Script Reference

### extras\Build-FeatBitImages.ps1

**Purpose:** Builds FeatBit application images from source and pushes them to the local registry. Starts the local registry automatically if needed.

**Parameters:**

- `-Images` — Image(s) to build. Valid values: `api-server`, `ui`, `evaluation-server`, `control-plane`. Defaults to all four.
- `-Registry` — Registry to push to (default: `localhost:5000`)
- `-Tag` — Image tag (default: `latest`)
- `-NoPush` — Build locally without pushing
- `-Force` — Rebuild even if the image already exists locally
- `-WhatIf` — Dry-run mode

**Examples:**

```powershell
# Build and push all images
.\extras\Build-FeatBitImages.ps1

# Build specific images only
.\extras\Build-FeatBitImages.ps1 -Images api-server, control-plane

# Build without pushing
.\extras\Build-FeatBitImages.ps1 -NoPush

# Push to a custom registry with a version tag
.\extras\Build-FeatBitImages.ps1 -Registry myregistry.example.com:5000 -Tag 1.2.3
```

### Deploy-FeatBitClusters.ps1

**Purpose:** Creates Minikube clusters and deploys FeatBit Pro. The primary entry point for standing up the environment.

**Parameters:**

- `-SkipClusterCreation` — Only deploy FeatBit (clusters must already exist)
- `-RecreateClusters` — Delete and recreate clusters before deploying
- `-SkipImageCheck` — Skip verification of FeatBit images in the local registry
- `-DeploymentMode` — `Basic` (default) or `Advanced`
- `-DatabaseProvider` — `MongoDb` (default) or `Postgres`
- `-HostInfraComponents` — Host Docker infra components in Basic mode (`redis`, `kafka`, `clickhouse`, and one of `mongodb` or `postgresql`)
- `-WestCpus` / `-WestMemory` / `-EastCpus` / `-EastMemory` — Cluster resource overrides
- `-CustomImageRegistry` — Private registry hostname for infrastructure images
- `-FeatBitImageRegistry` — Registry hosting FeatBit application images (defaults to `host.minikube.internal:5000`)
- `-MinikubeBaseImage` — Full custom kicbase image reference, including registry/path/tag
- `-InsecureCustomRegistry` — Bypass TLS verification for the `CUSTOM_IMAGE_REGISTRY` by passing `--insecure-registry` to `minikube start`. Default: `false`.

All parameters can also be set in `deployment.env` (see `deployment.env.example`).

**Examples:**

```powershell
# Standard deployment (uses deployment.env defaults)
.\Deploy-FeatBitClusters.ps1

# Recreate clusters from scratch
.\Deploy-FeatBitClusters.ps1 -RecreateClusters

# Redeploy FeatBit only (skip cluster creation)
.\Deploy-FeatBitClusters.ps1 -SkipClusterCreation

# Advanced mode — all infra runs inside both clusters
.\Deploy-FeatBitClusters.ps1 -DeploymentMode Advanced

# PostgreSQL instead of MongoDB
.\Deploy-FeatBitClusters.ps1 -DatabaseProvider Postgres -DeploymentMode Advanced

# Custom resources
.\Deploy-FeatBitClusters.ps1 -WestCpus 6 -WestMemory 16384
```

### extras\Deploy-ChaosMesh.ps1

**Purpose:** Installs Chaos Mesh (via Helm) on both Minikube clusters. Required only for the
network-partition disruptions used by the CP-11/CP-12/CP-13 consistency tests (and CP-03).

**Parameters:**

- `-Clusters` — `east`, `west`, or both (default)
- `-ChartVersion` — Chaos Mesh chart version (default: latest)
- `-Namespace` — Namespace for Chaos Mesh (default: `chaos-mesh`)
- `-SkipInotifyTuning` — Skip the node inotify sysctl tuning
- `-TimeoutSeconds` — Seconds to wait for pods ready (default: 120)

**Examples:**

```powershell
# Install on both clusters
.\extras\Deploy-ChaosMesh.ps1

# East only, pinned version
.\extras\Deploy-ChaosMesh.ps1 -Clusters east -ChartVersion 2.8.2
```

### Start-PortForwards.ps1

**Purpose:** Starts and manages all `kubectl port-forward` processes in a single window with automatic restart on failure.

```powershell
.\Start-PortForwards.ps1
```

Keep the window open while using FeatBit. Port mappings are printed on startup.

### Stop-PortForwards.ps1

**Purpose:** Kills all active port-forward processes.

```powershell
.\Stop-PortForwards.ps1
```

### Initialize-MongoDBReplicaSet.ps1

**Purpose:** Initialises the MongoDB replica set across west and east clusters. Required when `mongodb` is deployed in-cluster (not in host Docker). Run after port forwards are active.

```powershell
.\Initialize-MongoDBReplicaSet.ps1
```

### extras\Set-InfraImages.ps1

**Purpose:** Rewrites infrastructure YAML image references for a custom container registry. Generates files under `kubernetes/.generated/` without modifying source-controlled files.

```powershell
# Rewrite for custom registry
.\extras\Set-InfraImages.ps1 -CustomImageRegistry myregistry.example.com

# Preview changes without writing
.\extras\Set-InfraImages.ps1 -CustomImageRegistry myregistry.example.com -WhatIf

# Generate and apply to both clusters
.\extras\Set-InfraImages.ps1 -CustomImageRegistry myregistry.example.com -Apply west,east

# Reset to Docker Hub defaults
.\extras\Set-InfraImages.ps1 -Reset
```

### extras\Repair-KafkaConfig.ps1

**Purpose:** Restores the correct Kafka cross-cluster advertised listener and MirrorMaker configuration after a YAML re-apply resets the env vars to placeholder values.

```powershell
# Restore defaults
.\extras\Repair-KafkaConfig.ps1

# Preview commands without executing
.\extras\Repair-KafkaConfig.ps1 -WhatIf
```

### Trust-MinikubeCertificates.ps1

As of the registry-trust permanent fix, `Deploy-FeatBitClusters.ps1` automatically invokes this script when both `CUSTOM_IMAGE_REGISTRY` and `TRUST_CERTIFICATES` are set in `deployment.env`. Manual invocation is supported for ad-hoc cert refreshes or for environments that haven't run the deploy script yet.

**What the script does:** Downloads each PEM certificate listed in `TRUST_CERTIFICATES`, copies it into every target cluster's OS CA store (`/usr/local/share/ca-certificates/<name>.crt`), runs `update-ca-certificates`, then writes Docker daemon trust under `/etc/docker/certs.d/<registry-host>/ca.crt` and restarts the Docker daemon. After restarting, the script polls (up to 60 s) until the daemon is responsive to avoid race conditions with downstream `kubectl apply` operations.

**Parameters:**

| Parameter | Default | Description |
| --------- | ------- | ----------- |
| `-Clusters` | `west,east` | Minikube profile names to update |
| `-RegistryHosts` | from `CUSTOM_IMAGE_REGISTRY` | Registry hostnames for which Docker daemon trust is written. Pass an explicit list to override; pass an empty array to suppress Docker trust entirely. |
| `-DeploymentEnvFile` | auto-resolved | Full path to `deployment.env`. When omitted, the script searches the script directory then the repository root. |
| `-DryRun` | `false` | Print all actions that would be taken without executing any remote commands. |

**Examples:**

```powershell
# Default: reads TRUST_CERTIFICATES and CUSTOM_IMAGE_REGISTRY from deployment.env
.\Trust-MinikubeCertificates.ps1

# Override the registry host explicitly (ignores CUSTOM_IMAGE_REGISTRY in deployment.env)
.\Trust-MinikubeCertificates.ps1 -RegistryHosts "myregistry.example.com"

# Preview all actions without making any changes
.\Trust-MinikubeCertificates.ps1 -DryRun
```

### Assert-NoImagePullBackoff.ps1

**Purpose:** Polls `kubectl` across the specified contexts and namespaces until all pods are free of image-pull failure states — or until the timeout is exceeded. Fails fast on any of the following waiting reasons: `ImagePullBackOff`, `ErrImagePull`, `Init:ImagePullBackOff`, `Init:ErrImagePull`, `RegistryUnavailable`, `ImageInspectError`. Pods in `Succeeded` / `Completed` phase are skipped.

**When it runs automatically:**

- At the end of `Deploy-FeatBitClusters.ps1`, after a 45-second stabilisation wait following the final FeatBit application rollout.
- At the start of the UAT pipeline (`Run-UATTests.ps1`) before any scenario executes, to catch pull failures from a previous partial deploy.
- After the deploy-clusters phase in the platform Quickstart wizards (Ubuntu and Windows).

**Parameters:**

| Parameter | Default | Description |
| --------- | ------- | ----------- |
| `-Contexts` | `west,east` | kubectl context names to check |
| `-Namespaces` | `featbit` | Kubernetes namespaces to inspect within each context |
| `-TimeoutSeconds` | `90` | Total seconds to keep polling before declaring failure |
| `-IntervalSeconds` | `5` | Seconds to sleep between successive poll iterations |
| `-Quiet` | `false` | Suppress per-poll progress lines; print only the final pass/fail summary |

**Exit codes:** `0` — all pods healthy. `1` — pull-backoff detected OR cluster unreachable.

> **Important:** This script uses `exit 0` / `exit 1` and is intended to be invoked as a top-level orchestration step. Do **not** dot-source it — the `exit` calls will terminate your calling session.

**Examples:**

```powershell
# Default: poll west and east, featbit namespace, 90-second timeout
.\Assert-NoImagePullBackoff.ps1

# Check only the west cluster with a custom timeout (e.g. after a targeted redeploy)
.\Assert-NoImagePullBackoff.ps1 -Contexts @("west") -TimeoutSeconds 120
```

### extras\Test-EvalWebSocket.ps1

**Purpose:** Validates WebSocket connectivity to the evaluation servers on both west and east clusters (via port forwards).

```powershell
# Test with default server key
.\extras\Test-EvalWebSocket.ps1

# Test with a specific environment server SDK key
.\extras\Test-EvalWebSocket.ps1 -ServerKey <your-sdk-key>
```

### extras\Configure-FeatBitIngress.ps1

> **Deprecated.** This script is no longer part of the standard workflow. Use `Start-PortForwards.ps1` for service access. It is retained for reference only.

### Setup-FeatBitProxy.ps1

**Purpose:** Sets up nginx reverse proxy with DNS names. **Requires Administrator.**

**Parameters:**
- `-NginxPath` - Path to nginx installation (default: C:\nginx)
- `-SkipNginxInstall` - Skip nginx installation if already present

**Examples:**
```powershell
# Full setup (requires admin)
.\Setup-FeatBitProxy.ps1

# Use existing nginx installation
.\Setup-FeatBitProxy.ps1 -SkipNginxInstall -NginxPath "C:\custom\nginx"
```

## Image Management

### Required Images

The following FeatBit images must be available in the local Docker registry at `localhost:5000/featbit/*`:

- featbit-api-server:latest
- featbit-ui:latest
- featbit-evaluation-server:latest
- featbit-control-plane:latest

### Pushing Images to Local Registry

If images are not in the local registry, tag and push them:

```powershell
# Tag images
docker tag <source-image> localhost:5000/featbit/featbit-api-server:latest
docker tag <source-image> localhost:5000/featbit/featbit-ui:latest
docker tag <source-image> localhost:5000/featbit/featbit-evaluation-server:latest
docker tag <source-image> localhost:5000/featbit/featbit-control-plane:latest

# Push to local registry
docker push localhost:5000/featbit/featbit-api-server:latest
docker push localhost:5000/featbit/featbit-ui:latest
docker push localhost:5000/featbit/featbit-evaluation-server:latest
docker push localhost:5000/featbit/featbit-control-plane:latest
```

## Troubleshooting

### can't connect to cluster with kubectl

If you get an error similar to the following

```
E0305 13:08:56.969153   36228 memcache.go:265] "Unhandled Error" err="couldn't get current server API group list: Get \"https://127.0.0.1:32771/api?timeout=32s\": read tcp 127.0.0.1:55946->127.0.0.1:32771: wsarecv: An existing connection was forcibly closed by the remote host."
```

or

```
E0305 13:17:37.244838   35172 memcache.go:265] "Unhandled Error" err="couldn't get current server API group list: Get \"https://127.0.0.1:32771/api?timeout=32s\": net/http: TLS handshake timeout"
```

Check the port numbers that have been assigned to your "cluster" pods using `docker ps` against the ports set in your %userprofile$/.kube/config file for the east and west cluster. If needed set the correct port in your .kube/config file.

### Pods Not Starting

Check pod status:

```powershell
kubectl --context west get pods -n featbit
kubectl --context east get pods -n featbit
```

View pod logs:

```powershell
kubectl --context west logs <pod-name> -n featbit
kubectl --context east logs <pod-name> -n featbit
```

### Image Pull Errors

For pods stuck in `ImagePullBackOff` due to a TLS certificate problem (kubelet reports `x509: certificate signed by unknown authority`), see [**Image Pull Errors — TLS Certificate Issues**](#image-pull-errors--tls-certificate-issues) below.

For all other pull failures (image not found, wrong tag, authentication), verify images in the local registry:

```powershell
Invoke-RestMethod http://localhost:5000/v2/_catalog
```

Test registry accessibility from Minikube:

```powershell
minikube -p west ssh -- "curl -I http://host.minikube.internal:5000/v2/"
minikube -p east ssh -- "curl -I http://host.minikube.internal:5000/v2/"
```

### Image Pull Errors — TLS Certificate Issues

**Symptom:** Pods stuck in `ImagePullBackOff` and `kubectl describe pod <name> -n featbit` shows a kubelet event such as:

```
Failed to pull image "myregistry.example.com/...": ... tls: failed to verify certificate: x509: certificate signed by unknown authority
```

**Root cause:** Minikube's Docker daemon does not consult the host OS CA trust store. Trust must be written explicitly to `/etc/docker/certs.d/<registry-host>/ca.crt` inside each Minikube node. Registries signed by a well-known public CA work out of the box; registries signed by a private or corporate CA require explicit trust installation via `Trust-MinikubeCertificates.ps1`.

**Fix 1 — Recommended:** Populate `TRUST_CERTIFICATES` in `deployment.env` and re-run `Deploy-FeatBitClusters.ps1`. The trust is installed automatically during cluster bring-up when both `CUSTOM_IMAGE_REGISTRY` and `TRUST_CERTIFICATES` are set. Each entry in `TRUST_CERTIFICATES` uses the format:

```
name|https://certs.example.com/ca.pem|/usr/local/share/ca-certificates/my-corp-ca.crt
```

Multiple entries are separated by semicolons. Example:

```
TRUST_CERTIFICATES=my-corp-ca|https://certs.example.com/root-ca.pem|/usr/local/share/ca-certificates/my-corp-ca.crt
```

To refresh trust in already-running clusters without a full redeploy:

```powershell
.\Trust-MinikubeCertificates.ps1
```

**Fix 2 — Fallback:** If installing a CA certificate is not feasible, set `INSECURE_CUSTOM_REGISTRY=true` in `deployment.env` (or pass `-InsecureCustomRegistry $true` on the command line). This passes `--insecure-registry` to `minikube start`, which disables TLS verification for the custom registry entirely.

> ⚠ **Security implication:** Disabling TLS verification means the Minikube nodes will pull images from `CUSTOM_IMAGE_REGISTRY` without verifying the server certificate. Use this only as a temporary workaround on isolated dev/test infrastructure, not on production-adjacent environments.

**How to verify the fix:** Run the image-pull assertion script. It exits `0` when all pods are healthy and `1` when pull-backoff is still detected:

```powershell
.\Assert-NoImagePullBackoff.ps1
```

### Port Forward Issues

List active port forwards:

```powershell
Get-Process | Where-Object {$_.ProcessName -eq "kubectl"}
```

Stop all port forwards:

```powershell
Get-Process kubectl | Stop-Process
```

Restart port forwarding:

```powershell
.\Start-PortForwards.ps1
```

### Nginx Issues

Check nginx status:

```powershell
Get-Process nginx -ErrorAction SilentlyContinue
```

Test nginx configuration:

```powershell
cd C:\nginx
.\nginx.exe -t
```

View nginx logs:

```powershell
Get-Content C:\nginx\logs\error.log -Tail 50
```

Restart nginx:

```powershell
Stop-Process -Name nginx
cd C:\nginx
.\nginx.exe
```

### CORS Errors

Ensure nginx is running and configured correctly:

```powershell
Get-Process nginx
```

Verify hosts file entries:

```powershell
Get-Content C:\Windows\System32\drivers\etc\hosts | Select-String "featbit"
```

Check UI environment variables:

```powershell
kubectl --context west get deployment ui -n featbit -o yaml | Select-String "API_URL" -Context 2
```

### DNS Resolution Issues

Verify hosts file entries:

```powershell
Get-Content C:\Windows\System32\drivers\etc\hosts | Select-String "127.0.0.1"
```

Test DNS resolution:

```powershell
ping featbit.west.local
ping featbit.east.local
```

Clear browser cache and restart browser if DNS changes don't take effect.

## Management Commands

### Cluster Management

```powershell
# List Minikube profiles
minikube profile list

# Get cluster IPs
minikube -p west ip
minikube -p east ip

# Stop clusters
minikube -p west stop
minikube -p east stop

# Start clusters
minikube -p west start
minikube -p east start

# Delete clusters
minikube -p west delete
minikube -p east delete
```

### Kubernetes Commands

```powershell
# View all resources
kubectl --context west get all -n featbit
kubectl --context east get all -n featbit

# View pods
kubectl --context west get pods -n featbit
kubectl --context east get pods -n featbit

# View services
kubectl --context west get svc -n featbit
kubectl --context east get svc -n featbit

# View ingress
kubectl --context west get ingress -n featbit
kubectl --context east get ingress -n featbit

# Describe pod
kubectl --context west describe pod <pod-name> -n featbit

# View logs
kubectl --context west logs <pod-name> -n featbit -f

# Restart deployment
kubectl --context west rollout restart deployment <deployment-name> -n featbit
```

### Service Management

```powershell
# Stop nginx
Stop-Process -Name nginx

# Start nginx
cd C:\nginx
.\nginx.exe

# Reload nginx configuration
cd C:\nginx
.\nginx.exe -s reload

# Stop port forwards
Get-Process kubectl | Stop-Process

# Check Docker registry
docker ps --filter "name=registry"
```

## Complete Cleanup

To completely remove everything:

```powershell
# Stop nginx
Stop-Process -Name nginx -ErrorAction SilentlyContinue

# Stop port forwards
Get-Process kubectl | Stop-Process -ErrorAction SilentlyContinue

# Delete Minikube clusters
minikube delete -p west
minikube delete -p east

# Stop Docker registry (optional)
docker stop registry
docker rm registry

# Remove nginx (optional)
choco uninstall nginx -y
```

Then manually remove the FeatBit entries from `C:\Windows\System32\drivers\etc\hosts` (requires admin).

## Architecture Details

### Infrastructure Components

Each cluster runs:

- **MongoDB** - Primary data store
- **Redis** - Caching and session management
- **ClickHouse** - Analytics data warehouse
- **Kafka** - Message broker for event streaming
- **Kafka UI** - Web interface for Kafka management

### FeatBit Components

Each cluster runs:

- **UI** - Angular-based web interface (port 8081/8082)
- **API Server** - REST API backend (port 5000/5001)
- **Evaluation Server** - Feature flag evaluation engine (port 5100/5101)
- **Control Plane** - Administrative control services (port 5200)

### Network Flow

1. Browser requests `http://featbit.west.local`
2. DNS resolves to `127.0.0.1` (via hosts file)
3. Nginx receives request on port 80
4. Nginx proxies to `localhost:8081` (kubectl port-forward)
5. Port forward tunnels to Kubernetes service
6. Service routes to pod
7. Pod serves response

The nginx proxy adds CORS headers automatically, eliminating cross-origin issues.

## License

See repository LICENSE file.

## Support

For issues with:

- **FeatBit functionality**: https://github.com/featbit/featbit
- **Deployment scripts**: Create issue in this repository
- **Minikube**: https://github.com/kubernetes/minikube
- **Nginx**: https://nginx.org/en/docs/

## Contributing

See CONTRIBUTING.md for guidelines.
