# Architecture & Infrastructure Reference

This document consolidates the architecture and infrastructure references for the FeatBit control-plane QA environment.

**Contents:**
- [MongoDB Replica Set Configuration](#mongodb-replica-set-configuration)
- [Registry Setup Guide](#registry-setup--plain-english-guide)
- [Multi-Cluster Testing Strategy](#featbit-control-plane-testing-plan)

---

# MongoDB Replica Set Configuration

This section describes the MongoDB replica set setup for FeatBit Pro across multiple Kubernetes clusters.

## Architecture

### Replica Set Topology

```
┌─────────────────────────────────────────────────────────┐
│                  MongoDB Replica Set                     │
│                     "rs-featbit"                         │
│                                                          │
│  ┌──────────────────┐         ┌──────────────────┐     │
│  │  WEST CLUSTER    │         │  EAST CLUSTER    │     │
│  │                  │         │                  │     │
│  │  ┌────────────┐  │         │  ┌────────────┐  │     │
│  │  │ mongodb-0  │  │         │  │ mongodb-2  │  │     │
│  │  │ (Primary)  │  │         │  │ (Secondary)│  │     │
│  │  │ Priority: 2│  │         │  │ Priority: 1│  │     │
│  │  └────────────┘  │         │  └────────────┘  │     │
│  │         │        │         │         │        │     │
│  │  ┌────────────┐  │         │         │        │     │
│  │  │ mongodb-1  │  │         │         │        │     │
│  │  │ (Secondary)│  │         │         │        │     │
│  │  │ Priority: 1│  │         │         │        │     │
│  │  └────────────┘  │         │         │        │     │
│  └──────────────────┘         └──────────────────┘     │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Configuration Details

- **Replica Set Name**: `rs-featbit`
- **Total Members**: 3
  - **West Cluster**: 2 replicas (mongodb-west-0, mongodb-west-1)
  - **East Cluster**: 1 replica (mongodb-east-0)
- **Priority Settings**:
  - mongodb-west-0: Priority 2 (preferred primary)
  - mongodb-west-1: Priority 1 (can become primary)
  - mongodb-east-0: Priority 1 (can become primary)

## Networking

### Cross-Cluster Connectivity

Since pods in separate Minikube clusters cannot directly communicate, we use a combination of:

1. **LoadBalancer Services**: Each MongoDB pod is exposed via a LoadBalancer service
2. **Port Forwarding**: kubectl port-forward maps LoadBalancer IPs to localhost
3. **DNS Resolution**: hosts file entries map DNS names to localhost
4. **Replica Set Configuration**: MongoDB configured with DNS names

### Port Mappings

| MongoDB Pod | DNS Name | localhost Port | Cluster | Service Name |
|------------|----------|----------------|---------|--------------|
| mongodb-west-0 | mongodb-0.west.local | 27017 | west | mongodb-0-lb |
| mongodb-west-1 | mongodb-1.west.local | 27018 | west | mongodb-1-lb |
| mongodb-east-0 | mongodb-2.east.local | 27019 | east | mongodb-2-lb |

### hosts File Entries

```
127.0.0.1 mongodb-0.west.local mongodb-1.west.local mongodb-2.east.local
```

## Connection String

### Replica Set URI

```
mongodb://admin:password@mongodb-0.west.local:27017,mongodb-1.west.local:27018,mongodb-2.east.local:27019/featbit?replicaSet=rs-featbit&authSource=admin
```

### Environment Variable Format

```yaml
env:
- name: MongoDb__ConnectionString
  value: "mongodb://admin:password@mongodb-0.west.local:27017,mongodb-1.west.local:27018,mongodb-2.east.local:27019/featbit?replicaSet=rs-featbit&authSource=admin"
- name: MongoDb__Database
  value: "featbit"
```

## Deployment Steps

### 1. Deploy Infrastructure

The deployment script automatically deploys MongoDB StatefulSets:

```powershell
.\Deploy-FeatBitClusters.ps1
```

This will:
- Deploy MongoDB StatefulSet to west cluster (2 replicas)
- Deploy MongoDB StatefulSet to east cluster (1 replica)
- Create LoadBalancer services for each pod
- Wait for pods to be ready

### 2. Start Port Forwards

Start the port forwarding script to enable cross-cluster communication:

```powershell
.\Start-PortForwards.ps1
```

This runs in the background and maintains port forwards for:
- Application services (UI, API, Evaluation)
- MongoDB replica set members

### 3. Initialize Replica Set

Once port forwards are running, initialize the replica set:

```powershell
.\Initialize-MongoDBReplicaSet.ps1
```

This script will:
1. Verify MongoDB pods are running
2. Check port forwards are active
3. Execute `rs.initiate()` with all members
4. Wait for replica set to stabilize
5. Verify replica set status
6. Run database initialization script (seed data)

### 4. Update Application ConfigMaps

Update FeatBit application ConfigMaps to use the replica set connection string:

**West Cluster:**
```powershell
kubectl --context west edit configmap api-server-config -n featbit
```

**East Cluster:**
```powershell
kubectl --context east edit configmap api-server-config -n featbit
```

Update the `MongoDb__ConnectionString` value to:
```
mongodb://admin:password@mongodb-0.west.local:27017,mongodb-1.west.local:27018,mongodb-2.east.local:27019/featbit?replicaSet=rs-featbit&authSource=admin
```

### 5. Restart Application Pods

Restart FeatBit pods to pick up the new connection string:

```powershell
# West cluster
kubectl --context west rollout restart deployment api-server -n featbit
kubectl --context west rollout restart deployment evaluation-server -n featbit

# East cluster
kubectl --context east rollout restart deployment api-server -n featbit
kubectl --context east rollout restart deployment evaluation-server -n featbit
```

## Management

### Check Replica Set Status

Connect to the primary and check status:

```bash
mongosh --host localhost:27017 -u admin -p password --authenticationDatabase admin
```

```javascript
rs.status()
```

### Check Replication Lag

```javascript
rs.printReplicationInfo()
```

### Check Member Health

```javascript
rs.conf()
```

### Force Re-election (if needed)

```javascript
rs.stepDown()
```

## Failover Behavior

### Automatic Failover

If the primary (mongodb-west-0) fails:
1. Replica set automatically elects a new primary
2. Election considers priority settings
3. mongodb-west-1 or mongodb-east-0 becomes primary
4. Applications automatically reconnect to new primary

### Priority-Based Election

- mongodb-west-0 (Priority: 2) - Preferred primary
- If mongodb-west-0 is unavailable, mongodb-west-1 or mongodb-east-0 can become primary
- When mongodb-west-0 recovers, it will become primary again

## Troubleshooting

### Pods Not Starting

Check pod status:
```powershell
kubectl --context west get pods -n featbit -l app=mongodb
kubectl --context east get pods -n featbit -l app=mongodb
```

View logs:
```powershell
kubectl --context west logs -n featbit mongodb-west-0
kubectl --context east logs -n featbit mongodb-east-0
```

### Port Forwards Not Working

Check if port forwards are running:
```powershell
Get-NetTCPConnection -LocalPort 27017,27018,27019
```

Restart port forwards:
```powershell
.\Stop-PortForwards.ps1
.\Start-PortForwards.ps1
```

### Replica Set Initialization Failed

Check DNS resolution:
```powershell
# Should resolve to 127.0.0.1
nslookup mongodb-0.west.local
nslookup mongodb-1.west.local
nslookup mongodb-2.east.local
```

Check connectivity:
```powershell
Test-NetConnection -ComputerName localhost -Port 27017
Test-NetConnection -ComputerName localhost -Port 27018
Test-NetConnection -ComputerName localhost -Port 27019
```

Manual initialization:
```bash
mongosh --host localhost:27017 -u admin -p password --authenticationDatabase admin
```

```javascript
rs.initiate({
  _id: 'rs-featbit',
  members: [
    { _id: 0, host: 'mongodb-0.west.local:27017', priority: 2 },
    { _id: 1, host: 'mongodb-1.west.local:27018', priority: 1 },
    { _id: 2, host: 'mongodb-2.east.local:27019', priority: 1 }
  ]
})
```

### Data Not Replicating

Check replica set status:
```javascript
rs.status()
```

Look for:
- All members should show `state: 2 (SECONDARY)` or `state: 1 (PRIMARY)`
- `health: 1` for all members
- No replication lag

Check oplog:
```javascript
use local
db.oplog.rs.find().limit(10).sort({$natural:-1})
```

## Production Considerations

For production deployments with real multi-zone clusters:

1. **Network Connectivity**: Use proper network connectivity between clusters
   - Service mesh (Istio, Linkerd)
   - VPN/Tunnel (Submariner, Cilium Cluster Mesh)
   - Direct network routing

2. **Persistent Storage**: Use proper storage classes with backups
   - Cloud provider persistent disks
   - Replicated storage (Longhorn, Rook/Ceph)

3. **Resource Limits**: Adjust based on workload
   - Memory: 2-4GB per pod minimum
   - CPU: 1-2 cores per pod minimum
   - Storage: Based on data size + growth

4. **Monitoring**: Add monitoring and alerting
   - MongoDB Atlas Cloud Manager
   - Prometheus + MongoDB Exporter
   - Grafana dashboards

5. **Backups**: Implement backup strategy
   - Regular snapshots
   - Point-in-time recovery
   - Cross-region backup replication

6. **Security**: Enhance security
   - TLS/SSL for connections
   - Strong passwords
   - Network policies
   - RBAC

## Related Files

- `kubernetes/pro/infrastructure/mongodb-west-statefulset.yaml` - West cluster MongoDB StatefulSet
- `kubernetes/pro/infrastructure/mongodb-east-statefulset.yaml` - East cluster MongoDB StatefulSet
- `01-Infrastructure/Initialize-MongoDBReplicaSet.ps1` - Replica set initialization script
- `01-Infrastructure/Start-PortForwards.ps1` - Port forwarding management
- `01-Infrastructure/Setup-FeatBitProxy.ps1` - nginx proxy and DNS configuration

---

# Analytics & Insights Pipeline

This explains how feature-flag **evaluation insights** (the per-flag evaluation
counts shown in the FeatBit UI "Insights" view) get from an SDK to the UI, and
why this deployment stores them in **ClickHouse**.

## Data flow

```
SDK (.variation())                       per evaluation, the SDK batches an
  → POST {event_url}/api/public/insight/track   insight event back to the eval server
  → evaluation-server                    produces to the message queue
  → Kafka topic: featbit-insights        (one row per evaluation)
  → analytics store                      ClickHouse (pro) OR Mongo/Postgres (standard)
  → da-server (data-analytics)           queries the analytics store
  → api-server  /feature-flags/insights  delegates to da-server when IS_PRO=true
  → UI "Insights"
```

The event carries the **environment secret**, so each evaluation is attributed
to the right project/environment. otel-demo's instrumented components
(`recommendation`, `product-catalog`, `cart`, `ad`, `payment`) each evaluate
against their own `otel-*` project and therefore appear under that project's env.

## Provider rule (important)

The **api-server** has `IS_PRO=true` in this deployment. In pro mode the
flag-insights query (`GET /api/v{n}/envs/{envId}/feature-flags/insights`) is
**delegated to da-server** (`http://da-server:8200/api/events/stat/featureflag`)
rather than read from the app database. Therefore:

> **da-server must point at the store that actually ingests `featbit-insights`.**
> With `IS_PRO=true` that store is **ClickHouse** — ClickHouse's Kafka-engine
> table drains `featbit-insights` into queryable tables. The app database
> (Mongo/Postgres) is **not** populated with insights in pro mode (the API's
> Mongo insight consumer is inactive), so pointing da-server at Mongo while the
> API is pro leaves the UI Insights empty.

`Deploy-FeatBitClusters.ps1` configures this automatically:

- App services (`api-server`, `control-plane`, `evaluation-server`) use the app
  DB (`MongoDb`/`Postgres`) for flags/segments/users.
- **da-server** is configured separately: `DB_PROVIDER=ClickHouse` when
  ClickHouse is in the deployed infra (the default `HostInfraComponents`),
  otherwise it falls back to the app DB.

### Single-node ClickHouse

The test topology runs a **single-node** ClickHouse (`featbit-infra-clickhouse-server`),
with no cluster or Keeper/ZooKeeper. The data-analytics migrations default to
`CLICKHOUSE_REPLICATION=true` (which emits `ON CLUSTER featbit_ch_cluster` +
`ReplicatedMergeTree` DDL and **fails** on a single node), so the deploy sets:

```
CLICKHOUSE_REPLICATION=false
```

On da-server startup, `flask migrate-database` (dispatched to the ClickHouse
migrations because `DB_PROVIDER=ClickHouse`) creates the `featbit` database, the
`kafka_events_queue` (Kafka engine), the `events` table, and the `events_mv`
materialized view that moves rows from the queue into `events`.

## Verifying / troubleshooting

**Symptom:** UI Insights shows 0 evaluations for every flag, even though flags
are clearly being evaluated.

Check, in order:

```bash
# 1. Are insight events being produced? (offset should grow)
docker exec featbit-infra-kafka-1 \
  kafka-run-class.sh kafka.tools.GetOffsetShell --broker-list localhost:9092 --topic featbit-insights

# 2. Is da-server pointed at the right store?
kubectl --context west -n featbit get deploy da-server \
  -o jsonpath='{range .spec.template.spec.containers[0].env[*]}{.name}={.value}{"\n"}{end}' | grep -E 'DB_PROVIDER|CLICKHOUSE'
#   IS_PRO=true  => DB_PROVIDER must be ClickHouse

# 3. Is ClickHouse ingesting? (row count should grow)
docker exec featbit-infra-clickhouse-server-1 clickhouse-client --query "SELECT count() FROM featbit.events"
```

**Fix (live):**

```bash
kubectl --context west -n featbit set env deployment/da-server \
  DB_PROVIDER=ClickHouse DbProvider=ClickHouse CLICKHOUSE_REPLICATION=false
kubectl --context east -n featbit set env deployment/da-server \
  DB_PROVIDER=ClickHouse DbProvider=ClickHouse CLICKHOUSE_REPLICATION=false
```

This is applied automatically by `Deploy-FeatBitClusters.ps1` (the "Configuring
Analytics Store (da-server)" step), so a fresh deploy does not need it.

> **Time range gotcha:** the UI Insights query uses a time window around the
> browser's clock. If the cluster/host clock differs from the browser, set the
> UI time range to include the cluster's "now" or the data will look empty.

## Related files

- `01-Infrastructure/Deploy-FeatBitClusters.ps1` - "Configuring Analytics Store (da-server)" step
- `modules/data-analytics/app/clickhouse/` - ClickHouse migrations + Kafka-engine ingestion
- `modules/back-end/src/Infrastructure/MQ/InsightMessageHandler.cs` - the Mongo/Postgres (non-pro) insight consumer

---

# Registry Setup — Plain English Guide

If you have never thought about container registries before, this guide is for you.
It answers one question in plain language: **Where do the Docker images come from?**

---

## The Short Version

This deployment uses **two completely separate sets of images** that come from different places and are configured independently.

| Image set | What it contains | Configured by |
|-----------|-----------------|---------------|
| **Infrastructure images** | MongoDB, Redis, Kafka, ClickHouse, Kafka UI | `CUSTOM_IMAGE_REGISTRY` |
| **FeatBit application images** | API Server, UI, Evaluation Server, Control Plane, Data Analytics | `FEATBIT_IMAGE_REGISTRY` |

You configure each set separately because they have different sources and different options.

---

## Part 1 — Infrastructure Images (MongoDB, Redis, Kafka, etc.)

These are standard open-source images from Docker Hub. You did not write them and you do not build them.

### Option A: Pull directly from Docker Hub (simplest, but risky)

**What to do:** Leave `CUSTOM_IMAGE_REGISTRY` blank (comment it out or delete it from `deployment.env`).

```
# CUSTOM_IMAGE_REGISTRY=
```

**What happens:** When the clusters start up, each Minikube node downloads the images directly from Docker Hub over the internet.

**The risk:** Docker Hub enforces pull rate limits — typically 100 pulls per 6 hours for unauthenticated users, 200 for free accounts. A full deployment pulls roughly 8–10 distinct images. If you recreate clusters frequently, or if several developers share the same IP address (common behind a corporate NAT), you will hit the limit and see errors like:

```
toomanyrequests: You have reached your pull rate limit.
```

If this happens, wait a few hours, or switch to Option B.

---

### Option B: Pull from a private/corporate registry (recommended for teams)

**What to do:** Set `CUSTOM_IMAGE_REGISTRY` to the hostname of your private registry.

```
CUSTOM_IMAGE_REGISTRY=harbor.example.com
```

**What happens:** The deploy script rewrites every infrastructure image reference in the Kubernetes YAML before applying it, replacing the Docker Hub image names with paths under your registry. No source files are modified — the rewritten YAML is written to `kubernetes/.generated/` (which is gitignored).

**What you need first:** The images must actually exist in your registry. Mirror them from Docker Hub using your registry's proxy/mirror feature, or pull and re-push manually. The full list of required images is in `kubernetes/infra-image-map.json`.

**Namespace layout:** If your registry uses a non-standard path structure (e.g., Harbor organises mirrored images under `/dockerhub/library/`), also set:

```
INFRA_IMAGE_REPOSITORY=harbor.example.com/dockerhub/library
```

If you leave `INFRA_IMAGE_REPOSITORY` blank and `CUSTOM_IMAGE_REGISTRY` is set, it defaults to `<registry>/dockerhub/library` automatically.

**Credentials:** If your registry requires authentication, the deploy script will prompt you. The credentials are stored as a Kubernetes secret named `registry-credentials` in the `featbit` namespace of each cluster (override the name with `CUSTOM_REGISTRY_SECRET_NAME` if needed).

> **Hosts file note:** If your registry hostname is not in public DNS (e.g., it is only resolvable on your internal network via a hosts file or internal DNS server), make sure that name resolves on your developer machine before running the deploy script. If it does not, add an entry to `C:\Windows\System32\drivers\etc\hosts`:
> ```
> 10.0.0.50  harbor.example.com
> ```
> The Minikube nodes are Linux VMs — they use the same DNS as the host machine via `host.minikube.internal`, but if you have name resolution issues inside the cluster you may also need to configure CoreDNS or use the IP directly.

---

## Part 2 — FeatBit Application Images

These are the five images built from the source code in this repository:

| Image | Source module | Needs local build? |
|-------|--------------|-------------------|
| `featbit-api-server` | `modules/back-end` | Only if modifying back-end code |
| `featbit-evaluation-server` | `modules/evaluation-server` | Only if modifying evaluation-server code |
| `featbit-control-plane` | `modules/control-plane` | Only if modifying control-plane code |
| `featbit-ui` | `modules/front-end` | Rarely — published to Docker Hub |
| `featbit-data-analytics-server` | `modules/data-analytics` | Rarely — published to Docker Hub |

The UI and Data Analytics images in particular do not need to be rebuilt for control-plane QA purposes. All five images are published to Docker Hub as `featbit/featbit-<name>:latest`.

You have three options for each image. Pick **one** option and set `FEATBIT_IMAGE_REGISTRY` accordingly.

---

### Option A: Build from source and push to the local registry (default)

**Best for:** Developers actively modifying the back-end, evaluation server, or control plane.

**What to do:** Leave `FEATBIT_IMAGE_REGISTRY` blank (or comment it out).

```
# FEATBIT_IMAGE_REGISTRY=
```

Then run `Initialize-LocalRegistry.ps1` before deploying. It starts a local `registry:2` container on `localhost:5000` and builds + pushes all five images from the source in this repo.

```powershell
.\Initialize-LocalRegistry.ps1

# To build only the images you changed:
.\Initialize-LocalRegistry.ps1 -Images api-server,evaluation-server
```

**What happens at deploy time:** Each Minikube node pulls images from `host.minikube.internal:5000` — which is your local machine's port 5000, reachable from inside the VM. No TLS is required; the clusters are configured with `--insecure-registry=host.minikube.internal:5000` at creation time.

**Hosts file requirement:** None. `host.minikube.internal` is a special hostname that Minikube resolves automatically to the host machine's bridge IP. No hosts file entry is needed.

**What the local registry looks like:**

```
localhost:5000/featbit/featbit-api-server:latest
localhost:5000/featbit/featbit-ui:latest
localhost:5000/featbit/featbit-evaluation-server:latest
localhost:5000/featbit/featbit-control-plane:latest
localhost:5000/featbit/featbit-data-analytics-server:latest
```

> **Rancher Desktop users:** Rancher Desktop uses the `docker-container` buildx driver by default, which does not load built images into the local image store unless you pass `--load`. `Initialize-LocalRegistry.ps1` handles this for you — it always passes `--load` during build.

---

### Option B: Pull from Docker Hub

**Best for:** Developers who do not need to change FeatBit source code and want the simplest possible setup, and are not worried about Docker Hub rate limits.

**What to do:** Set `FEATBIT_IMAGE_REGISTRY` to `docker.io`.

```
FEATBIT_IMAGE_REGISTRY=docker.io
```

**What happens:** Images are pulled directly from `docker.io/featbit/featbit-<name>:latest`. You do not need to run `Initialize-LocalRegistry.ps1` at all.

**The risk:** Same Docker Hub rate limit risk as infrastructure images (Option A in Part 1). If you are also pulling infrastructure images from Docker Hub at the same time, your rate limit budget is consumed by both sets.

---

### Option C: Pull from a private/corporate registry

**Best for:** Teams that mirror Docker Hub images into an internal registry, or teams that build and push their own FeatBit images to a shared registry as part of a CI pipeline.

**What to do:** Set `FEATBIT_IMAGE_REGISTRY` to the registry and path prefix where your FeatBit images live.

```
FEATBIT_IMAGE_REGISTRY=harbor.example.com/featbit
```

**What happens:** Images are pulled as `harbor.example.com/featbit/featbit-<name>:latest`. The deploy script appends `/<imagename>:latest` to whatever you specify here.

**What you need first:** The images must exist in your registry. Either push them from a local build, or have CI push them there. The image names must follow the pattern `featbit-<name>:latest` under the path you specified.

**Hosts file requirement:** Same rule as infrastructure images — if the registry hostname is not in public DNS, add it to your hosts file before running the deploy script. The Minikube VMs must also be able to resolve and reach it; if the registry is on an internal network, ensure the VMs have network access (they inherit the host's network via the bridge interface in most setups).

---

## Decision Checklist

Answer these questions in order to know exactly what to set.

**Q1: Do you want to modify FeatBit source code?**

- **Yes** → Use [Part 2 Option A](#option-a-build-from-source-and-push-to-the-local-registry-default). Leave `FEATBIT_IMAGE_REGISTRY` blank. Run `Initialize-LocalRegistry.ps1` before deploying. You only need to build the specific images you are changing.
- **No** → Continue to Q2.

**Q2: Does your team use a private/internal container registry?**

- **Yes** → Use [Part 2 Option C](#option-c-pull-from-a-privatecorporate-registry) for FeatBit images and [Part 1 Option B](#option-b-pull-from-a-privatecorporate-registry-recommended-for-teams) for infra images. Set both `FEATBIT_IMAGE_REGISTRY` and `CUSTOM_IMAGE_REGISTRY`.
- **No** → Use [Part 2 Option B](#option-b-pull-from-docker-hub) and [Part 1 Option A](#option-a-pull-directly-from-docker-hub-simplest-but-risky). Leave both blank, but be aware of rate limiting if recreating clusters frequently.

**Q3 (if you have a private registry): Is the registry hostname resolvable on your machine?**

- **Yes (it's in public DNS or your corporate DNS)** → Nothing extra needed.
- **No (only accessible via IP or internal hostname)** → Add an entry to `C:\Windows\System32\drivers\etc\hosts`. Example: `10.0.0.50  harbor.example.com`.

---

## Complete deployment.env Examples

### Scenario: Everything from local build + Docker Hub infra

```bash
# CUSTOM_IMAGE_REGISTRY=          # blank = Docker Hub for infra
# FEATBIT_IMAGE_REGISTRY=         # blank = local registry for FeatBit apps
```

Run `Initialize-LocalRegistry.ps1` first. Accept Docker Hub rate limit risk for infra images.

---

### Scenario: Local build for FeatBit apps + corporate registry for infra

```bash
CUSTOM_IMAGE_REGISTRY=harbor.example.com
INFRA_IMAGE_REPOSITORY=harbor.example.com/dockerhub/library
# FEATBIT_IMAGE_REGISTRY=         # blank = local registry for FeatBit apps
```

Run `Initialize-LocalRegistry.ps1` first. No Docker Hub calls.

---

### Scenario: Everything from the corporate registry (no local builds)

```bash
CUSTOM_IMAGE_REGISTRY=harbor.example.com
INFRA_IMAGE_REPOSITORY=harbor.example.com/dockerhub/library
FEATBIT_IMAGE_REGISTRY=harbor.example.com/featbit
```

Do not run `Initialize-LocalRegistry.ps1`. FeatBit images must already exist in your registry.

---

### Scenario: Everything from Docker Hub (simplest, rate-limit risk)

```bash
CUSTOM_IMAGE_REGISTRY=
FEATBIT_IMAGE_REGISTRY=docker.io
```

Do not run `Initialize-LocalRegistry.ps1`. Fastest to get started; will hit rate limits if used heavily.

---

# FeatBit Control Plane Testing Plan

## Current State
- ✅ Deployed to Rancher Desktop (single cluster)
- ✅ Configured ingress with *.east.local and *.west.local (internal DNS → 127.0.0.1)
- ✅ Enabled UseControlPlane=true
- ✅ Kafka UI deployed for monitoring

## Testing Strategy: Two-Phase Approach

### Phase 1: Single-Cluster Testing (Rancher Desktop)
Test all control plane features that work in single-cluster mode.

**Testable Features:**
- ✅ Client connection tracking across eval server pods
- ✅ Admin command distribution via Kafka topics
- ✅ Heartbeat mechanism for ghost connection cleanup
- ✅ Message routing through cp-* topics
- ✅ Control plane consuming and republishing messages
- ✅ Kafka topic flow visualization

**Current Setup:**
- System: 4 cores, 8GB RAM (79% utilization)
- Network: *.local → 127.0.0.1 (internal DNS)
- Adequate for single-cluster testing

### Phase 2: Multi-Cluster Testing (Multi-DC Simulation)
Test Redis synchronization and cross-DC features.

**Testable Features:**
- Redis synchronization across multiple DCs
- Cross-DC failover scenarios
- Race condition validation with replication lag
- Kafka MirrorMaker integration
- Control plane synchronizing multiple Redis instances

**Options:**

#### Option A: Local Multi-Cluster (Minikube)
**Requirements:**
- CPU: 10 cores minimum (12 recommended)
- RAM: 16GB minimum (20GB recommended)
- Disk: 50GB minimum

**Setup:**
```bash
# DC1 cluster
minikube start -p featbit-dc1 --cpus=5 --memory=7168 --disk-size=25g

# DC2 cluster
minikube start -p featbit-dc2 --cpus=5 --memory=7168 --disk-size=25g
```

**Pros:** 
- Full control, no cloud costs
- Faster iteration

**Cons:** 
- May exceed local hardware
- Doesn't simulate real network latency

#### Option B: Cloud Multi-Cluster (Azure AKS)
**Requirements:**
- Azure subscription (developer account)
- 2 AKS clusters in different regions

**Setup:**
```bash
# Create DC1 (East US)
az aks create --resource-group featbit-test \
  --name featbit-dc1 --location eastus \
  --node-count 2 --node-vm-size Standard_D2s_v3

# Create DC2 (West US)
az aks create --resource-group featbit-test \
  --name featbit-dc2 --location westus \
  --node-count 2 --node-vm-size Standard_D2s_v3
```

**Pros:**
- Realistic network latency
- Proper multi-region setup
- Can be shared with reviewers

**Cons:**
- Cloud costs (~$200-300/month if left running)
- Slower iteration

**Recommendation:** Check local hardware first. If < 10 cores or < 16GB RAM, use Azure.

## DNS/Networking Plan

### Problem
- Current: *.<internal-local-dns> → 127.0.0.1 (internal only, single host)
- GitHub reviewers don't have access to internal-local-dns infrastructure
- Need solution that works for:
  - Local testing (developer machine)
  - Multi-cluster testing (cross-cluster communication)
  - External reviewers (documentation/reproduction)

### Solution: Three-Tiered Approach

#### Tier 1: /etc/hosts for Local Testing
**For single-cluster local development:**

```bash
# /etc/hosts (Linux/Mac) or C:\Windows\System32\drivers\etc\hosts (Windows)
127.0.0.1 featbit.local
127.0.0.1 featbit-api.local
127.0.0.1 featbit-eval.local
127.0.0.1 featbit-control-plane.local
127.0.0.1 featbit-kafka-ui.local
```

**Update ingress manifests:**
```yaml
host: featbit-api.local  # instead of internal-local-dns
```

**Pros:** Simple, no infrastructure needed, works for reviewers
**Cons:** Only works for single host, not multi-cluster

#### Tier 2: NodePort Services for Multi-Cluster
**For multi-cluster local (minikube) testing:**

Instead of ingress, use NodePort services for cross-cluster communication:

```yaml
# DC1 - api-server NodePort
apiVersion: v1
kind: Service
metadata:
  name: api-server-external
spec:
  type: NodePort
  ports:
    - port: 5000
      nodePort: 30100
  selector:
    app: api-server
```

**Access via:**
```bash
# Get minikube IP
minikube ip -p featbit-dc1  # e.g., 192.168.49.2

# Access API
curl http://192.168.49.2:30100/health
```

**IP Address Map:**
```
DC1 (featbit-dc1):
  Minikube IP: 192.168.49.2
  API:         192.168.49.2:30100
  Eval:        192.168.49.2:30101
  Control:     192.168.49.2:30102
  UI:          192.168.49.2:30103

DC2 (featbit-dc2):
  Minikube IP: 192.168.49.3
  API:         192.168.49.3:30100
  Eval:        192.168.49.3:30101
  Control:     192.168.49.3:30102
```

**Pros:** Works cross-cluster, simple IP mapping
**Cons:** Requires IP documentation, not production-like

#### Tier 3: Cloud Load Balancers
**For cloud (Azure AKS) multi-cluster testing:**

Use cloud provider LoadBalancer services with public IPs:

```yaml
# API Server LoadBalancer
apiVersion: v1
kind: Service
metadata:
  name: api-server
spec:
  type: LoadBalancer
  ports:
    - port: 80
      targetPort: 5000
  selector:
    app: api-server
```

**Access via public IPs:**
```
DC1 (East US):
  API:     http://20.10.10.100
  Eval:    http://20.10.10.101
  Control: http://20.10.10.102

DC2 (West US):
  API:     http://40.20.20.100
  Eval:    http://40.20.20.101
  Control: http://40.20.20.102
```

**Documentation for reviewers:**
```markdown
## Testing the Deployment

### Access URLs (Cloud Test Environment)
- DC1 UI: http://20.10.10.103
- DC1 API: http://20.10.10.100
- DC2 UI: http://40.20.20.103
- DC2 API: http://40.20.20.100

### Local Testing (Minikube)
See TESTING-LOCAL.md for /etc/hosts configuration and NodePort mappings.
```

**Pros:** Production-like, shareable with reviewers
**Cons:** Cloud costs, public IPs (secure with auth)

## Recommended DNS Strategy

### For PR Documentation
Provide **three deployment methods** so reviewers can choose:

1. **Single-Cluster Local (Simplest)**
   - Use /etc/hosts with *.local domains
   - Rancher Desktop or minikube single profile
   - Document in: `TESTING-SINGLE-CLUSTER.md`

2. **Multi-Cluster Local (Advanced)**
   - Use minikube multi-profile with NodePort
   - Provide IP address map template
   - Document in: `TESTING-MULTI-CLUSTER-LOCAL.md`

3. **Multi-Cluster Cloud (Most Realistic)**
   - Azure AKS with LoadBalancers
   - Provide sample terraform/helm configs
   - Document in: `TESTING-MULTI-CLUSTER-CLOUD.md`

### Implementation Priority
1. ✅ Complete single-cluster testing (current Rancher setup)
2. ⬜ Create /etc/hosts based ingress manifests
3. ⬜ Test with *.local domains locally
4. ⬜ Check developer machine specs
5. ⬜ If specs sufficient: Create minikube multi-profile setup
6. ⬜ If specs insufficient: Create Azure AKS setup
7. ⬜ Document all three approaches for reviewers

## System Requirements

### Single-Cluster (Current)
- **Sufficient:** 4-6 cores, 8-10GB RAM, 30GB disk

### Multi-Cluster Local (Minikube)
- **Minimum:** 10 cores, 16GB RAM, 50GB disk
- **Recommended:** 12 cores, 20GB RAM, 60GB disk
- **Check with:**
  ```bash
  # Linux
  nproc && free -h && df -h
  
  # Windows PowerShell
  (Get-WmiObject Win32_Processor).NumberOfLogicalProcessors
  [Math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory/1GB)
  ```

### Multi-Cluster Cloud (Azure)
- Azure subscription required
- Estimated cost: ~$5-10/day if cleaned up nightly
- Monthly: ~$200-300 if left running

## Next Steps

### Immediate (This Session)
1. ⬜ Test control plane features on current Rancher setup
2. ⬜ Check developer machine hardware specs
3. ⬜ Decide: local multi-cluster or cloud

### Short Term
1. ⬜ Create *.local ingress manifests for reviewers
2. ⬜ Document /etc/hosts setup
3. ⬜ If local multi-cluster: Create minikube setup scripts
4. ⬜ If cloud: Create Azure AKS terraform/scripts

### Documentation
1. ⬜ Create three testing guides (single, multi-local, multi-cloud)
2. ⬜ Provide IP address map templates
3. ⬜ Include DNS setup instructions for each approach
4. ⬜ Add troubleshooting section for networking
