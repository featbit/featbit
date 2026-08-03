# FeatBit Control Plane End-to-End Testing Plan

## Overview
This document defines comprehensive end-to-end tests to verify control plane functionality. Each test validates the complete data flow from API through control plane to clients.

## Test Categories

### 1. Feature Flag Lifecycle Tests

#### Test 1.1: Create Flag
**Objective:** Verify new flag propagates through entire system

**Flow to Verify:**
```
User creates flag via API
  ↓
API saves to MongoDB
  ↓
API updates Redis
  ↓
API publishes to cp-featbit-feature-flag-change topic ✓
  ↓
Control Plane consumes from cp-* topic ✓
  ↓
Control Plane updates Redis (all DCs) ✓
  ↓
Control Plane republishes to featbit-feature-flag-change topic ✓
  ↓
Eval Server consumes from default topic ✓
  ↓
Eval Server reads flag from Redis ✓
  ↓
Eval Server sends update to connected clients ✓
  ↓
Client receives flag data ✓
```

**Verification Points:**
- [ ] MongoDB: Flag document exists with correct data
- [ ] Redis DC1: Flag key exists with correct value
- [ ] Redis DC2: Flag key exists with correct value (multi-DC only)
- [ ] Kafka cp-* topic: Message exists with flag data
- [ ] Kafka default topic: Message exists with flag data
- [ ] Control Plane logs: Show consuming from cp-* topic
- [ ] Control Plane logs: Show Redis update
- [ ] Control Plane logs: Show republishing to default topic
- [ ] Eval Server logs: Show consuming from default topic
- [ ] Eval Server logs: Show sending update to client
- [ ] Client: Receives flag in local cache

**Test Implementation:**
```bash
#!/bin/bash
# test-flag-create.sh

# Setup
FLAG_NAME="test-flag-$(date +%s)"
ENV_SECRET="your-env-secret"
CLIENT_ID="test-client-1"

# Start monitoring Kafka topics in background
kafka-console-consumer --topic cp-featbit-feature-flag-change > /tmp/cp-topic.log &
CP_PID=$!
kafka-console-consumer --topic featbit-feature-flag-change > /tmp/default-topic.log &
DEFAULT_PID=$!

# Connect test client
./test-client connect --env-secret $ENV_SECRET --client-id $CLIENT_ID &
CLIENT_PID=$!
sleep 2

# Create flag via API
TIMESTAMP_START=$(date +%s%3N)
curl -X POST https://featbit-api.local/api/v1/envs/{envId}/flags \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"$FLAG_NAME\",\"key\":\"$FLAG_NAME\",\"enabled\":false}"

# Wait for propagation
sleep 5
TIMESTAMP_END=$(date +%s%3N)

# Verify each step
echo "=== Verification Results ==="

# 1. Check MongoDB
echo -n "1. MongoDB: "
kubectl exec -it mongodb -- mongosh --eval "db.FeatureFlags.findOne({key:'$FLAG_NAME'})" | grep -q "$FLAG_NAME" && echo "✓ PASS" || echo "✗ FAIL"

# 2. Check Redis
echo -n "2. Redis: "
kubectl exec -it redis -- redis-cli GET "flag:$FLAG_NAME" | grep -q "$FLAG_NAME" && echo "✓ PASS" || echo "✗ FAIL"

# 3. Check cp-* topic
echo -n "3. CP Topic: "
grep -q "$FLAG_NAME" /tmp/cp-topic.log && echo "✓ PASS" || echo "✗ FAIL"

# 4. Check default topic
echo -n "4. Default Topic: "
grep -q "$FLAG_NAME" /tmp/default-topic.log && echo "✓ PASS" || echo "✗ FAIL"

# 5. Check Control Plane logs
echo -n "5. Control Plane Consume: "
kubectl logs control-plane --since-time=$(date -d @$((TIMESTAMP_START/1000)) -Iseconds) | grep -q "consuming.*$FLAG_NAME" && echo "✓ PASS" || echo "✗ FAIL"

echo -n "6. Control Plane Redis Update: "
kubectl logs control-plane --since-time=$(date -d @$((TIMESTAMP_START/1000)) -Iseconds) | grep -q "redis.*$FLAG_NAME" && echo "✓ PASS" || echo "✗ FAIL"

echo -n "7. Control Plane Republish: "
kubectl logs control-plane --since-time=$(date -d @$((TIMESTAMP_START/1000)) -Iseconds) | grep -q "republish.*$FLAG_NAME" && echo "✓ PASS" || echo "✗ FAIL"

# 6. Check Eval Server logs
echo -n "8. Eval Server Consume: "
kubectl logs evaluation-server --since-time=$(date -d @$((TIMESTAMP_START/1000)) -Iseconds) | grep -q "consuming.*$FLAG_NAME" && echo "✓ PASS" || echo "✗ FAIL"

# 7. Check client received update
echo -n "9. Client Received: "
./test-client check-flag --client-id $CLIENT_ID --flag-key $FLAG_NAME && echo "✓ PASS" || echo "✗ FAIL"

# Cleanup
kill $CP_PID $DEFAULT_PID $CLIENT_PID
rm /tmp/cp-topic.log /tmp/default-topic.log
```

#### Test 1.2: Enable Flag
**Flow:** Same as 1.1 but for flag state change (disabled → enabled)

**Verification Points:**
- [ ] MongoDB: Flag.enabled = true
- [ ] Redis: Flag value updated
- [ ] Topics: Change message present
- [ ] Client: Receives updated flag state

#### Test 1.3: Disable Flag
**Flow:** Same as 1.2 but for enabled → disabled transition

#### Test 1.4: Archive Flag
**Flow:** Same as 1.2 but for archive operation

**Verification Points:**
- [ ] MongoDB: Flag.archived = true
- [ ] Redis: Flag marked as archived
- [ ] Topics: Archive message present
- [ ] Client: Flag removed from active flags

---

### 2. Segment Lifecycle Tests

#### Test 2.1: Create Segment
**Flow:** Same pattern as flag create, but through segment topics

**Topics:**
- cp-featbit-segment-change
- featbit-segment-change

**Verification Points:**
- [ ] MongoDB: Segment document exists
- [ ] Redis: Segment key exists
- [ ] Kafka: Messages in both topics
- [ ] Control Plane: Logs show processing
- [ ] Eval Server: Logs show consumption
- [ ] Client: Receives segment data

#### Test 2.2: Update Segment (Add User)
#### Test 2.3: Update Segment (Remove User)
#### Test 2.4: Archive Segment

---

### 3. Secret Lifecycle Tests

#### Test 3.1: Create Secret
**Flow:** Similar to flag/segment tests

**Verification Points:**
- [ ] MongoDB: Secret stored (encrypted)
- [ ] Redis: Secret cached
- [ ] Topics: Secret change messages
- [ ] Control Plane: Processing confirmed
- [ ] Eval Server: Secret available

#### Test 3.2: Rotate Secret
#### Test 3.3: Revoke Secret

---

### 4. Client Connection Tracking Tests

#### Test 4.1: Client Connect
**Objective:** Verify control plane tracks new client connections

**Flow:**
```
Client connects to Eval Server
  ↓
Eval Server publishes to featbit-connections topic ✓
  ↓
Control Plane consumes connection message ✓
  ↓
Control Plane adds client to registry ✓
  ↓
API queries control plane for connected clients ✓
  ↓
Client appears in list ✓
```

**Verification Points:**
- [ ] Kafka: Connection message in featbit-connections topic
- [ ] Control Plane logs: "Client connected" message
- [ ] Control Plane registry: Client exists
- [ ] API endpoint: Client listed in response

**Test Implementation:**
```bash
#!/bin/bash
# test-client-connect.sh

CLIENT_ID="test-client-$(date +%s)"
ENV_SECRET="your-env-secret"

# Monitor connections topic
kafka-console-consumer --topic featbit-connections > /tmp/connections.log &
KAFKA_PID=$!

# Connect client
./test-client connect --env-secret $ENV_SECRET --client-id $CLIENT_ID &
CLIENT_PID=$!
sleep 3

# Verify
echo "=== Connection Tracking Verification ==="

echo -n "1. Kafka Topic: "
grep -q "$CLIENT_ID.*connected" /tmp/connections.log && echo "✓ PASS" || echo "✗ FAIL"

echo -n "2. Control Plane Registry: "
kubectl logs control-plane | grep -q "client.*$CLIENT_ID.*registered" && echo "✓ PASS" || echo "✗ FAIL"

echo -n "3. API Lists Client: "
curl https://featbit-control-plane.local/api/connected-clients | grep -q "$CLIENT_ID" && echo "✓ PASS" || echo "✗ FAIL"

# Cleanup
kill $KAFKA_PID $CLIENT_PID
```

#### Test 4.2: Client Disconnect
**Flow:** Similar to connect, but verify removal from registry

**Verification Points:**
- [ ] Kafka: Disconnect message in topic
- [ ] Control Plane logs: "Client disconnected"
- [ ] Control Plane registry: Client removed
- [ ] API endpoint: Client not in list

#### Test 4.3: Heartbeat Mechanism
**Objective:** Verify ghost connection cleanup

**Flow:**
```
Client connects to Eval Server
  ↓
Eval Server sends periodic heartbeats
  ↓
Control Plane receives heartbeats
  ↓
Kill Eval Server pod (no graceful shutdown)
  ↓
Wait for heartbeat timeout
  ↓
Control Plane detects missing heartbeat ✓
  ↓
Control Plane removes clients of that eval server ✓
```

**Verification Points:**
- [ ] Control Plane logs: Heartbeat received
- [ ] Kill eval server pod
- [ ] Control Plane logs: Heartbeat timeout detected
- [ ] Control Plane logs: Clients removed
- [ ] API endpoint: Clients no longer listed

---

### 5. Admin Command Tests

#### Test 5.1: Force Client Cache Refresh
**Objective:** Verify admin command propagates to specific client

**Flow:**
```
Admin calls API endpoint
  ↓
API posts to featbit-controlplane-command topic ✓
  ↓
Eval Servers consume command message ✓
  ↓
Eval Server checks if it has the target client ✓
  ↓
If yes: Eval Server sends data-sync to client ✓
  ↓
Client refreshes cache ✓
```

**Verification Points:**
- [ ] Kafka: Command message in cp-command topic
- [ ] Control Plane logs: Command received
- [ ] Eval Server logs: Command processed
- [ ] Eval Server logs: data-sync sent to client
- [ ] Client logs: Cache refreshed

**Test Implementation:**
```bash
#!/bin/bash
# test-admin-refresh.sh

CLIENT_ID="test-client-123"
ENV_SECRET="your-env-secret"

# Connect client
./test-client connect --env-secret $ENV_SECRET --client-id $CLIENT_ID &
CLIENT_PID=$!
sleep 2

# Monitor command topic
kafka-console-consumer --topic featbit-controlplane-command > /tmp/commands.log &
KAFKA_PID=$!

# Send refresh command
TIMESTAMP=$(date +%s%3N)
curl -X POST https://featbit-control-plane.local/api/refresh-client \
  -H "Content-Type: application/json" \
  -d "{\"envSecret\":\"$ENV_SECRET\",\"clientId\":\"$CLIENT_ID\"}"

sleep 3

# Verify
echo "=== Admin Command Verification ==="

echo -n "1. Command Topic: "
grep -q "$CLIENT_ID.*refresh" /tmp/commands.log && echo "✓ PASS" || echo "✗ FAIL"

echo -n "2. Eval Server Processed: "
kubectl logs evaluation-server --since=$(($TIMESTAMP/1000)) | grep -q "refresh.*$CLIENT_ID" && echo "✓ PASS" || echo "✗ FAIL"

echo -n "3. Client Refreshed: "
./test-client get-refresh-count --client-id $CLIENT_ID | grep -q "1" && echo "✓ PASS" || echo "✗ FAIL"

# Cleanup
kill $KAFKA_PID $CLIENT_PID
```

---

## Test Automation

### Test Runner Script
```bash
#!/bin/bash
# run-all-tests.sh

RESULTS_DIR="./test-results/$(date +%Y%m%d-%H%M%S)"
mkdir -p $RESULTS_DIR

echo "=== FeatBit Control Plane E2E Tests ==="
echo "Results will be saved to: $RESULTS_DIR"

# Flag tests
echo "Running Flag Tests..."
./test-flag-create.sh > $RESULTS_DIR/flag-create.log 2>&1
./test-flag-enable.sh > $RESULTS_DIR/flag-enable.log 2>&1
./test-flag-disable.sh > $RESULTS_DIR/flag-disable.log 2>&1
./test-flag-archive.sh > $RESULTS_DIR/flag-archive.log 2>&1

# Segment tests
echo "Running Segment Tests..."
./test-segment-create.sh > $RESULTS_DIR/segment-create.log 2>&1
./test-segment-add-user.sh > $RESULTS_DIR/segment-add-user.log 2>&1
./test-segment-remove-user.sh > $RESULTS_DIR/segment-remove-user.log 2>&1

# Connection tests
echo "Running Connection Tests..."
./test-client-connect.sh > $RESULTS_DIR/client-connect.log 2>&1
./test-client-disconnect.sh > $RESULTS_DIR/client-disconnect.log 2>&1
./test-heartbeat.sh > $RESULTS_DIR/heartbeat.log 2>&1

# Admin command tests
echo "Running Admin Command Tests..."
./test-admin-refresh.sh > $RESULTS_DIR/admin-refresh.log 2>&1

# Generate summary
echo "=== Test Summary ===" | tee $RESULTS_DIR/summary.txt
grep "PASS\|FAIL" $RESULTS_DIR/*.log | tee -a $RESULTS_DIR/summary.txt

TOTAL=$(grep -o "PASS\|FAIL" $RESULTS_DIR/*.log | wc -l)
PASSED=$(grep -o "PASS" $RESULTS_DIR/*.log | wc -l)
FAILED=$(grep -o "FAIL" $RESULTS_DIR/*.log | wc -l)

echo "" | tee -a $RESULTS_DIR/summary.txt
echo "Total: $TOTAL, Passed: $PASSED, Failed: $FAILED" | tee -a $RESULTS_DIR/summary.txt
```

### Test Client Tool
Need to create a test client that can:
1. Connect to eval server WebSocket
2. Track received messages
3. Report flag/segment state
4. Log data-sync events

**Implementation Options:**
- Go CLI tool using FeatBit Go SDK
- Node.js script using FeatBit Node SDK
- Python script using FeatBit Python SDK

---

## Manual Testing Checklist

### Pre-Test Setup
- [ ] Deploy FeatBit to single cluster
- [ ] Deploy Kafka UI for monitoring
- [ ] Enable UseControlPlane=true
- [ ] Create test project and environment
- [ ] Note environment secret

### Flag Tests
- [ ] Create flag → Verify in Kafka UI (cp-* then default topic)
- [ ] Enable flag → Verify topic messages
- [ ] Disable flag → Verify topic messages
- [ ] Archive flag → Verify removal

### Segment Tests
- [ ] Create segment → Verify propagation
- [ ] Add user to segment → Verify update
- [ ] Remove user → Verify update

### Connection Tests
- [ ] Connect client → Check control plane logs
- [ ] Query connected clients API
- [ ] Disconnect client → Verify removal
- [ ] Kill eval pod → Verify heartbeat cleanup

### Admin Commands
- [ ] Send refresh command → Verify client receives data-sync

### Multi-DC Tests (Cloud Only)
- [ ] Create flag in DC1 → Verify Redis in DC2 updated
- [ ] Verify timing: Redis update before default topic message
- [ ] Test with high latency simulation

---

## Verification Tools

### Kafka UI Checks
1. Navigate to Topics
2. Select cp-featbit-feature-flag-change
3. View messages in real-time
4. Verify message order and timing
5. Check consumer lag

### Redis Verification
```bash
# Check flag exists
kubectl exec -it redis -- redis-cli GET "flag:flag-key"

# Check all flags
kubectl exec -it redis -- redis-cli KEYS "flag:*"

# Monitor real-time
kubectl exec -it redis -- redis-cli MONITOR
```

### MongoDB Verification
```bash
# Check flag document
kubectl exec -it mongodb -- mongosh --eval '
  use featbit
  db.FeatureFlags.findOne({key: "flag-key"})
'

# Check timestamps
kubectl exec -it mongodb -- mongosh --eval '
  use featbit
  db.FeatureFlags.findOne({key: "flag-key"}, {updatedAt: 1})
'
```

### Log Analysis
```bash
# Control Plane: Check message processing
kubectl logs control-plane | grep -A5 "consuming from cp-"

# Eval Server: Check forwarding to clients
kubectl logs evaluation-server | grep "data-sync sent"

# API Server: Check topic routing
kubectl logs api-server | grep "publishing to"
```

---

## Success Criteria

### Single-Cluster Testing
- ✅ All flag lifecycle tests pass
- ✅ All segment lifecycle tests pass
- ✅ Client connection tracking works
- ✅ Admin commands execute successfully
- ✅ Message routing through cp-* topics confirmed
- ✅ Kafka UI shows expected topic flow

### Multi-Cluster Testing
- ✅ Redis synchronization across DCs confirmed
- ✅ No race conditions observed
- ✅ Control plane updates all Redis before republishing
- ✅ Failover scenarios work correctly

---

## Next Steps

1. **Implement Test Client** - Create tool that can connect and verify updates
2. **Write Test Scripts** - Implement bash scripts for each test case
3. **Run Single-Cluster Tests** - Validate on current Rancher setup
4. **Document Results** - Record findings and any issues
5. **Create *.local Ingress** - For reviewer testing
6. **Setup Multi-Cluster** - Either local minikube or Azure AKS
7. **Run Multi-DC Tests** - Validate Redis synchronization
8. **Create PR Documentation** - Include all test results and reproduction steps

---

## Scenario Cross-Reference: Manual Procedures ↔ Automated Tests

The table below maps human-readable manual test procedures (in `02-Tests/manual_scripts/`) to their automated counterparts (in `02-Tests/automation-py/scenarios/`).

| Manual Procedure (`manual_scripts/`) | Automated Scenario (`automation-py/scenarios/`) | Description |
|--------------------------------------|------------------------------------------------|-------------|
| `flag-change/FeatureFlagChange.md` | `cp01.py` — CP-01 | Basic feature flag toggle propagation (west↔east) |
| `flag-change/FeatureFlagChangeBroadcastCorrectness.md` | `cp02.py` — CP-02 | Cross-DC flag propagation correctness validation |
| `flag-change/FeatureFlagChangeResilience.md` | `cp03.py` — CP-03 | Resilience under failure (Redis outage during flag change) |
| `segment-change/SegmentChange.md` | `cp04.py` — CP-04 | Segment change propagation across datacenters |
| `secret-change/SecretChange.md` | `cp05.py` — CP-05 | Secret change propagation across datacenters |
| `secret-change/EnvironmentAdded.md` | `cp06.py` — CP-06 | Environment added triggers secret propagation |
| `license-change/LicenseChange.md` | `cp07.py` — CP-07 | License change propagation across datacenters |
| `cache-refresh/CacheRefresh.md` | `cp08.py` — CP-08 | Control Plane API full sync push to Evaluation Server |

**Key differences:**
- **Manual procedures** include browser-based steps (Kafka UI, Redis GUI) and are designed for human testers verifying system behavior visually.
- **Automated scenarios** use the `BaseScenario` framework with programmatic API calls, Redis assertions, and Kafka message verification — suitable for CI/CD pipelines.
