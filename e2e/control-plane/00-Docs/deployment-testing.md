# FeatBit Kubernetes Deployment - Testing Documentation

## Pull Request Purpose

This pull request introduces the **Control Plane** component to FeatBit, solving two critical operational problems for production deployments.

### Problem 1: Client Connection Management in Kubernetes

**Challenge:**
- In K8s deployments with multiple eval server replicas (e.g., 6 pods round-robin), there's no way to:
  - Track which clients are connected to which eval server pod
  - Send administrative commands (like cache refresh) to specific eval servers
  - Monitor connection status for troubleshooting ("is the client actually connected?")

**Solution:**
The control plane tracks connected clients by consuming messages from the `featbit-connections` Kafka topic:
- Eval servers publish messages on client state changes (connected, disconnected)
- Messages include the environment secret to identify the project/environment
- Control plane maintains a registry of connected clients per eval server instance
- Provides an API endpoint to query currently connected clients
- Enables troubleshooting: verify if a client is actually connected before investigating flag issues

**Admin Control:**
- Control plane provides an endpoint to force client cache refresh
- Posts refresh commands to `featbit-controlplane-command` Kafka topic with environment secret
- Each eval server consumes these messages
- If the eval server has that client connected, it sends a data-sync message to the client
- Works across all pods without needing direct pod-to-pod communication

**Heartbeat Mechanism:**
To prevent stale/ghost connections when eval server pods crash or are killed without graceful shutdown:
- Each eval server sends periodic heartbeat messages to the control plane
- Each eval server registers with a unique identifier (UUID) on startup
- Control plane removes clients associated with eval servers that miss heartbeats
- Ensures accurate connection tracking even during pod failures

---

### Problem 2: Multi-DC Active/Active Support

**Challenge:**
Currently in a multi-DC active/active deployment:
1. User updates a flag in DC1
2. API updates Redis cache in DC1
3. API produces change message to `featbit-feature-flag-change` topic
4. Eval servers in DC1 consume message and update clients
5. **Problem:** In DC2, the flag isn't in Redis cache yet (replication lag)
6. Eval servers in DC2 consume the message but can't find the flag in Redis
7. No updates are sent to DC2 clients

Even with Redis Enterprise replication, there's no guarantee replication completes before eval servers consume the Kafka message.

**Solution - Control Plane as Cache Synchronization Layer:**

1. **Configurable Topic Routing:**
   - Topic names for flags, segments, and secrets become configuration values
   - When `useControlPlane` is enabled, API publishes to control-plane topics:
     - `cp-featbit-feature-flag-change` (instead of `featbit-feature-flag-change`)
     - `cp-featbit-segment-change` (instead of `featbit-segment-change`)
   - Default topic names unchanged for deployments without control plane

2. **Control Plane Message Flow:**
   ```
   User saves change → API updates local Redis → API publishes to cp-* topic
   ↓
   Control Plane consumes from cp-* topic
   ↓
   Control Plane syncs change to ALL Redis instances across DCs (with retry/failure handling)
   ↓
   Control Plane re-publishes to default topic (featbit-feature-flag-change)
   ↓
   Eval servers in ALL DCs consume message (cache already updated)
   ↓
   Clients receive updates
   ```

3. **Architectural Benefits:**
   - Separation of concerns: API doesn't manage multi-DC infrastructure
   - Eval servers remain stateless and simple
   - Control plane handles cross-DC complexity
   - Message sizes stay small (eval servers still use Redis lookups)
   - Race condition eliminated: Redis is always updated before eval servers process messages

**Why Not Full State in Messages?**
- Segments can contain hundreds/thousands of users
- Message size becomes unpredictable and potentially huge
- Network overhead increases significantly
- Harder to troubleshoot large binary messages

**Why Not Multi-Write from API?**
- Requires multiple Redis multiplexers in the API (generally problematic)
- API takes on infrastructure management duties (violates separation of concerns)
- Doesn't scale well for organizations with many DCs/AZs (dozens globally)
- Control plane is an explicit architectural choice that engineers understand

---

### Architecture Summary

**Control Plane Responsibilities:**
1. **Client Connection Registry** - Track all connected clients across all eval server pods
2. **Admin Command Distribution** - Send cache refresh commands to specific clients
3. **Multi-DC Cache Synchronization** - Ensure Redis is updated across all DCs before eval servers process changes
4. **Heartbeat Monitoring** - Detect and clean up stale connections from crashed pods

**Kafka Topics:**
- `featbit-connections` - Eval servers → Control plane (client state changes)
- `featbit-controlplane-command` - Control plane → Eval servers (admin commands)
- `cp-featbit-feature-flag-change` - API → Control plane (when control plane enabled)
- `cp-featbit-segment-change` - API → Control plane (when control plane enabled)
- `featbit-feature-flag-change` - Control plane → Eval servers (always)
- `featbit-segment-change` - Control plane → Eval servers (always)

**Benefits:**
- Solves thread exhaustion and scalability issues in K8s
- Enables multi-DC active/active deployments
- Provides operational visibility (connection tracking)
- Administrative control over client cache
- Clean separation of concerns

---

## Testing

This document describes the steps to deploy and test FeatBit Professional to a Kubernetes cluster using the manifests in the `kubernetes/pro` directory.

### Test Environment Setup

**Prerequisites:**
- Kubernetes cluster (tested on Rancher K8s)
- `kubectl` CLI configured to access the cluster
- Docker CLI for building and pushing images
- Access to a Docker registry (tested with private registry at `registry.local`)
- Traefik ingress controller installed in the cluster
- DNS or `/etc/hosts` entries configured for:
  - `featbit.east.local` → Ingress IP
  - `featbit-api.east.local` → Ingress IP
  - `featbit-eval.east.local` → Ingress IP
  - `featbit-control-plane.east.local` → Ingress IP

**Environment Variables:**
```bash
export DOCKER_REGISTRY="registry..local"
export K8S_NAMESPACE="featbit"
```

**Required Tools:**
- `kubectl` v1.20+
- `docker` v20.10+
- `curl` for API testing

---

### Test Scenarios

#### 1. Build and Push Docker Images

**Steps:**

1. Build API Server image:
   ```bash
   docker build -t ${DOCKER_REGISTRY}/featbit/featbit-api-server:latest \
     -f ./modules/back-end/src/Api/Dockerfile \
     ./modules/back-end
   docker push ${DOCKER_REGISTRY}/featbit/featbit-api-server:latest
   ```

2. Build Control Plane image:
   ```bash
   docker build -t ${DOCKER_REGISTRY}/featbit/featbit-control-plane:latest \
     -f ./modules/control-plane/Dockerfile \
     ./modules/control-plane
   docker push ${DOCKER_REGISTRY}/featbit/featbit-control-plane:latest
   ```

3. Build Evaluation Server image:
   ```bash
   docker build -t ${DOCKER_REGISTRY}/featbit/featbit-evaluation-server:latest \
     -f ./modules/evaluation-server/Dockerfile \
     ./modules/evaluation-server
   docker push ${DOCKER_REGISTRY}/featbit/featbit-evaluation-server:latest
   ```

4. Build Data Analytics Server image:
   ```bash
   docker build -t ${DOCKER_REGISTRY}/featbit/featbit-da-server:latest \
     -f ./modules/data-analytics/Dockerfile \
     ./modules/data-analytics
   docker push ${DOCKER_REGISTRY}/featbit/featbit-da-server:latest
   ```

5. Tag and push UI image (using official image due to build requirements):
   ```bash
   docker pull featbit/featbit-ui:latest
   docker tag featbit/featbit-ui:latest ${DOCKER_REGISTRY}/featbit/featbit-ui:latest
   docker push ${DOCKER_REGISTRY}/featbit/featbit-ui:latest
   ```

**Expected Results:**
- All 5 images successfully built and pushed to the Docker registry
- Images accessible from the Kubernetes cluster nodes

---

#### 2. Update Deployment Manifests

**Steps:**

1. Update all deployment YAML files in `kubernetes/pro/application/` to reference your Docker registry:
   ```yaml
   # Before:
   image: featbit/featbit-api-server:latest
   
   # After:
   image: registry..local/featbit/featbit-api-server:latest
   ```

2. Add required environment variables to `api-server-deployment.yaml`:
   ```yaml
   - name: DbProvider
     value: MongoDb
   - name: MqProvider
     value: Kafka
   - name: UseControlPlane
     value: "true"
   ```
   
   **Note:** The `UseControlPlane` environment variable enables control plane mode. When set to `"true"`:
   - API publishes flag/segment changes to `cp-*` topics instead of default topics
   - Control plane synchronizes Redis across all DCs before forwarding messages
   - Enables client connection tracking and admin command features
   
   If you want to test without control plane (traditional mode), omit this variable or set it to `"false"`.

3. Add required environment variables to `control-plane-deployment.yaml`:
   ```yaml
   - name: DbProvider
     value: MongoDb
   - name: MqProvider
     value: Kafka
   ```

4. Update `da-server-deployment.yaml` to use MongoDB:
   ```yaml
   - name: MongoDb__ConnectionString
     value: mongodb://admin:password@mongodb:27017
   - name: MongoDb__Database
     value: featbit
   ```

5. Update ingress files in `kubernetes/pro/ingress/` with your domain names:
   - `traefik-ingress-ui.yaml`: host: `featbit.east.local`
   - `traefik-ingress-api.yaml`: host: `featbit-api.east.local`
   - `traefik-ingress-evaluation-server.yaml`: host: `featbit-eval.east.local`
   - `traefik-ingress-control-plane.yaml`: host: `featbit-control-plane.east.local`

6. Update `ui-deployment.yaml` with ingress URLs:
   ```yaml
   - name: API_URL
     value: https://featbit-api.east.local
   - name: EVALUATION_URL
     value: https://featbit-eval.east.local
   ```

**Expected Results:**
- All manifests updated with correct registry URLs
- Configuration values set for MongoDB and Kafka
- Ingress configured with your domain names

---

#### 3. Create Namespace and Deploy Infrastructure

**Steps:**

1. Create the namespace:
   ```bash
   kubectl create namespace ${K8S_NAMESPACE}
   ```

2. Deploy infrastructure components:
   ```bash
   kubectl apply -f kubernetes/pro/infrastructure/mongodb-init-configMap.yaml
   kubectl apply -f kubernetes/pro/infrastructure/mongodb-deployment.yaml
   kubectl apply -f kubernetes/pro/infrastructure/redis-deployment.yaml
   kubectl apply -f kubernetes/pro/infrastructure/clickhouse-configMap.yaml
   kubectl apply -f kubernetes/pro/infrastructure/clickhouse-deployment.yaml
   kubectl apply -f kubernetes/pro/infrastructure/kafka-deployment.yaml
   ```

3. Wait for infrastructure pods to be ready (2-3 minutes):
   ```bash
   kubectl get pods -n ${K8S_NAMESPACE} -w
   ```

**Expected Results:**
- Namespace `featbit` created
- All infrastructure pods in `Running` state:
  - `mongodb` (1/1 Ready)
  - `redis` (1/1 Ready)
  - `clickhouse-server` (2/2 Ready)
  - `kafka` (1/1 Ready)
- Services created for each infrastructure component

---

#### 4. Deploy Application Components

**Steps:**

1. Deploy all application services:
   ```bash
   kubectl apply -f kubernetes/pro/application/api-server-deployment.yaml
   kubectl apply -f kubernetes/pro/application/control-plane-deployment.yaml
   kubectl apply -f kubernetes/pro/application/evaluation-server-deployment.yaml
   kubectl apply -f kubernetes/pro/application/da-server-deployment.yaml
   kubectl apply -f kubernetes/pro/application/ui-deployment.yaml
   ```

2. Verify all application pods are running:
   ```bash
   kubectl get pods -n ${K8S_NAMESPACE} | grep -E "(api-server|control-plane|evaluation|da-server|ui)"
   ```

**Expected Results:**
- All application pods in `Running` state:
  - `api-server` (1/1 Ready)
  - `control-plane` (1/1 Ready)
  - `evaluation-server` (1/1 Ready)
  - `da-server` (1/1 Ready)
  - `ui` (1/1 Ready)
- No CrashLoopBackOff or Error states

---

#### 5. Deploy Ingress Resources

**Steps:**

1. Apply all ingress manifests:
   ```bash
   kubectl apply -f kubernetes/pro/ingress/traefik-ingress-ui.yaml
   kubectl apply -f kubernetes/pro/ingress/traefik-ingress-api.yaml
   kubectl apply -f kubernetes/pro/ingress/traefik-ingress-evaluation-server.yaml
   kubectl apply -f kubernetes/pro/ingress/traefik-ingress-control-plane.yaml
   ```

2. Verify ingress resources:
   ```bash
   kubectl get ingress -n ${K8S_NAMESPACE}
   ```

**Expected Results:**
- Four ingress resources created:
  - `ui-route` → `featbit.east.local`
  - `api-server-route` → `featbit-api.east.local`
  - `evaluation-server-route` → `featbit-eval.east.local`
  - `control-plane-route` → `featbit-control-plane.east.local`
- All ingress resources show an ADDRESS (e.g., `192.168.127.2`)

---

#### 6. Test API Server Functionality

**Steps:**

1. Test the health/status of the API server:
   ```bash
   curl -k https://featbit-api.east.local/health
   ```

2. Test the has-multiple-workspaces endpoint:
   ```bash
   curl -k -X POST https://featbit-api.east.local/api/v1/user/has-multiple-workspaces \
     -H "Content-Type: application/json" \
     -d '{"email":"test@featbit.com"}' \
     -w "\nHTTP Status: %{http_code}\n"
   ```

3. Check API server logs for errors:
   ```bash
   kubectl logs -n ${K8S_NAMESPACE} $(kubectl get pods -n ${K8S_NAMESPACE} | grep api-server | awk '{print $1}') --tail=50
   ```

**Expected Results:**
- Health endpoint returns HTTP 200
- has-multiple-workspaces endpoint returns:
  ```json
  {"success":true,"errors":[],"data":false}
  ```
  with HTTP Status: 200
- No errors in API server logs related to database connectivity

---

#### 7. Test UI Accessibility

**Steps:**

1. Open a web browser and navigate to `https://featbit.east.local`

2. Verify the login page loads without errors

3. Open browser developer tools (F12) and check the Console tab for errors

4. Attempt to enter email `test@featbit.com` and click "Continue"

5. Enter password `123456` and click "Login"

**Expected Results:**
- UI loads successfully via HTTPS
- No mixed content errors in browser console
- No CORS errors in browser console
- Login page is functional (full login testing will be done after control-plane verification)

---

#### 8. Verify MongoDB Data

**Steps:**

1. Connect to MongoDB pod:
   ```bash
   kubectl exec -it -n ${K8S_NAMESPACE} $(kubectl get pods -n ${K8S_NAMESPACE} | grep mongodb | awk '{print $1}') -- mongosh
   ```

2. Switch to featbit database and verify test user exists:
   ```javascript
   use featbit
   db.Users.findOne({email: "test@featbit.com"})
   ```

3. Exit MongoDB shell:
   ```javascript
   exit
   ```

**Expected Results:**
- MongoDB connection succeeds
- Test user document found with email `test@featbit.com`
- User document contains `_id`, `email`, `password` (hashed), and other fields

---

#### 9. Verify Service Connectivity

**Steps:**

1. List all services:
   ```bash
   kubectl get svc -n ${K8S_NAMESPACE}
   ```

2. Test internal service DNS resolution from a pod:
   ```bash
   kubectl run -it --rm debug --image=busybox --restart=Never -n ${K8S_NAMESPACE} -- nslookup api-server
   kubectl run -it --rm debug --image=busybox --restart=Never -n ${K8S_NAMESPACE} -- nslookup mongodb
   kubectl run -it --rm debug --image=busybox --restart=Never -n ${K8S_NAMESPACE} -- nslookup kafka
   ```

**Expected Results:**
- All services listed with ClusterIP addresses
- DNS resolution succeeds for all service names
- Services are reachable within the cluster

---

#### 10. Test Evaluation Server (Next: Control Plane Testing)

**Steps:**

1. Test evaluation server health:
   ```bash
   curl -k https://featbit-eval.east.local/health
   ```

2. Check evaluation server logs:
   ```bash
   kubectl logs -n ${K8S_NAMESPACE} $(kubectl get pods -n ${K8S_NAMESPACE} | grep evaluation-server | awk '{print $1}') --tail=20
   ```

**Expected Results:**
- Evaluation server responds with HTTP 200
- No errors in logs

---

#### 11. Deploy Kafka UI for Monitoring

**Steps:**

1. Deploy Kafka UI to observe message flow:
   ```bash
   kubectl apply -f kubernetes/pro/infrastructure/kafka-ui-deployment.yaml
   kubectl apply -f kubernetes/pro/ingress/traefik-ingress-kafka-ui.yaml
   ```

2. Wait for Kafka UI pod to be ready:
   ```bash
   kubectl get pods -n ${K8S_NAMESPACE} | grep kafka-ui
   ```

3. Access Kafka UI in browser:
   ```
   https://featbit-kafka-ui.east.local
   ```

**Expected Results:**
- Kafka UI pod running (1/1 Ready)
- UI accessible via HTTPS
- Connected to Kafka cluster "featbit"
- Topics visible: `featbit-endusers`, `featbit-feature-flag-change`, `featbit-segment-change`, etc.

**What to Observe:**
- Real-time message flow through topics
- Consumer group lag
- Message payload inspection
- Topic throughput and metrics

---

#### 12. Enable Control Plane Mode

**Steps:**

1. Update `api-server-deployment.yaml` to enable control plane:
   ```yaml
   - name: UseControlPlane
     value: "true"
   ```

2. Apply the updated configuration:
   ```bash
   kubectl apply -f kubernetes/pro/application/api-server-deployment.yaml
   ```

3. Wait for API server to restart:
   ```bash
   kubectl get pods -n ${K8S_NAMESPACE} | grep api-server
   ```

4. Verify API server started successfully:
   ```bash
   kubectl logs -n ${K8S_NAMESPACE} $(kubectl get pods -n ${K8S_NAMESPACE} | grep api-server | awk '{print $1}') --tail=20
   ```

**Expected Results:**
- API server pod restarts (new pod name)
- Pod reaches Running status (1/1 Ready)
- Logs show "Starting Api service" with no errors
- **Behavior Change:** API will now publish to `cp-*` topics instead of default topics

**What Changes:**
- Flag changes: API → `cp-featbit-feature-flag-change` → Control Plane → `featbit-feature-flag-change` → Eval Servers
- Segment changes: API → `cp-featbit-segment-change` → Control Plane → `featbit-segment-change` → Eval Servers
- Control plane synchronizes Redis before forwarding to eval servers

**Verification in Kafka UI:**
- After updating a flag, check Kafka UI
- Should see messages in `cp-featbit-feature-flag-change` topic first
- Then see forwarded messages in `featbit-feature-flag-change` topic
- Timestamps show control plane processes and forwards messages

---

### Configuration Details

**Key Environment Variables Configured:**

For API Server and Control Plane:
- `IS_PRO=true` - Enables Professional features
- `DbProvider=MongoDb` - Uses MongoDB for data persistence (not PostgreSQL)
- `MqProvider=Kafka` - Uses Kafka for message queue (not Redis or PostgreSQL)
- `UseControlPlane=true` - **Enables control plane mode for multi-DC and K8s scalability** (API Server only)
- `MongoDb__ConnectionString=mongodb://admin:password@mongodb:27017`
- `Kafka__BootstrapServers=kafka:9092`
- `Redis__ConnectionString=redis:6379`

For UI:
- `API_URL=https://featbit-api.east.local` - External HTTPS URL (not internal service)
- `EVALUATION_URL=https://featbit-eval.east.local` - External HTTPS URL

**Important Notes:**
- The UI is a client-side Angular application that runs in the browser, so it requires external HTTPS URLs, not internal Kubernetes service names
- FeatBit Pro can use either MongoDB OR PostgreSQL for the database backend, not both simultaneously
- For this deployment, we use MongoDB exclusively via the `DbProvider=MongoDb` setting
- The message queue uses Kafka via the `MqProvider=Kafka` setting
- **Control Plane Mode:** When `UseControlPlane=true` is set:
  - API publishes flag/segment changes to `cp-*` topics (e.g., `cp-featbit-feature-flag-change`)
  - Control plane consumes from `cp-*` topics, syncs Redis across DCs, then republishes to default topics
  - Eval servers consume from default topics (e.g., `featbit-feature-flag-change`)
  - This eliminates race conditions in multi-DC deployments and enables K8s client tracking

---

### Common Issues and Solutions

**Issue: Mixed Content Errors**
- **Cause:** UI configured with HTTP URLs (`http://api-server:5000`)
- **Solution:** Update UI environment variables to use HTTPS ingress URLs

**Issue: PostgreSQL Connection Errors**
- **Cause:** `DbProvider` not set, defaults to PostgreSQL
- **Solution:** Add `DbProvider=MongoDb` environment variable

**Issue: Redis Message Queue Errors**
- **Cause:** `MqProvider` not set, defaults to Redis or PostgreSQL
- **Solution:** Add `MqProvider=Kafka` environment variable

**Issue: Image Pull Errors**
- **Cause:** DockerHub rate limits
- **Solution:** Push images to private registry and update manifests

---

### OS/Browser Used

**Testing Environment:**
- **Operating System:** Linux (WSL2/Ubuntu)
- **Kubernetes:** Rancher K8s (v1.20+)
- **Ingress Controller:** Traefik
- **Browser:** Chrome/Firefox (for UI testing)
- **Docker Registry:** Private registry at `registry..local`

---

### Next Steps

The following tests are pending and will be performed next to verify the control plane implementation:

**Control Plane Testing:**

1. **Verify Control Plane Health**
   ```bash
   curl -k https://featbit-control-plane.east.local/health
   ```
   - Expected: HTTP 200 response
   - Verifies control plane pod is running and responding

2. **Test Client Connection Tracking**
   - Connect a test client to an evaluation server
   - Check control plane logs for connection messages:
     ```bash
     kubectl logs -n featbit $(kubectl get pods -n featbit | grep control-plane | awk '{print $1}') --tail=50
     ```
   - Expected: Log entries showing client connected with environment secret
   - Query control plane API for connected clients (if endpoint implemented)
   - Disconnect client and verify disconnection is tracked

3. **Test Heartbeat Mechanism**
   - Verify eval servers send periodic heartbeat messages
   - Kill an eval server pod without graceful shutdown:
     ```bash
     kubectl delete pod -n featbit <eval-server-pod-name> --force --grace-period=0
     ```
   - Wait for heartbeat timeout period
   - Expected: Control plane removes clients associated with killed pod

4. **Test Cache Refresh Command (Single Client)**
   - Identify a connected client (via connection tracking)
   - Send refresh command via control plane admin endpoint:
     ```bash
     curl -k -X POST https://featbit-control-plane.east.local/admin/refresh-client \
       -H "Content-Type: application/json" \
       -d '{"envSecret":"<env-secret>"}'
     ```
   - Check eval server logs for data-sync message sent to client
   - Verify client receives and processes the refresh
   - Expected: Client cache is refreshed without manual reconnection

5. **Test Feature Flag Change Propagation (Single DC)**
   - Update a feature flag via the API (POST to `/api/v1/envs/{envId}/flags`)
   - Check API logs: Should publish to `cp-featbit-feature-flag-change` topic (if control plane enabled)
   - Check control plane logs:
     - Should consume from `cp-*` topic
     - Should update Redis cache
     - Should re-publish to `featbit-feature-flag-change` topic
   - Check eval server logs: Should consume and process change
   - Verify connected clients receive the update
   - Expected: End-to-end propagation completes within 1-2 seconds

6. **Test Segment Change Propagation**
   - Update a segment via the API
   - Verify same flow as flag changes but through `cp-featbit-segment-change` → `featbit-segment-change`
   - Expected: Segment updates propagate to all connected clients

7. **Test Multi-DC Cache Synchronization** (if applicable)
   - Configure control plane with multiple Redis instances (DC1, DC2)
   - Update a flag in DC1
   - Verify control plane updates Redis in both DC1 and DC2 before republishing
   - Verify eval servers in DC2 can find the flag in their local Redis
   - Expected: No race condition, both DCs receive updates simultaneously

8. **Test Failure Handling**
   - Simulate Redis unavailable in one DC
   - Update a flag
   - Expected: Control plane logs retry attempts, still republishes message to eval servers
   - Verify flag is eventually synced when Redis recovers

9. **Test Configuration Toggle**
   - Deploy without `useControlPlane` flag
   - Verify API publishes directly to `featbit-feature-flag-change` (not `cp-*` topics)
   - Expected: System works in traditional mode without control plane

10. **Stress Test - Mass Reconnection**
    - Simulate rolling update scenario with many clients
    - Roll out new eval server deployment
    - Monitor control plane performance during mass reconnections
    - Expected: No thread exhaustion, clean connection tracking

These tests validate:
- ✅ Client connection tracking and heartbeat mechanism
- ✅ Admin command distribution to specific eval servers
- ✅ Multi-DC cache synchronization before eval server processing
- ✅ Proper message routing through configurable Kafka topics
- ✅ Failure handling and retry logic
- ✅ Scalability improvements for K8s deployments

---
