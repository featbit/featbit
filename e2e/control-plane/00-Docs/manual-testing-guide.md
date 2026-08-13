# FeatBit Control Plane Manual Testing Guide

## Overview
This guide walks through manual testing of the FeatBit control plane functionality using the browser-based UI and Kafka UI.

## Prerequisites
- ✅ FeatBit deployed to Kubernetes
- ✅ UseControlPlane=true enabled on API server
- ✅ All pods running
- ✅ Kafka UI accessible

## Access URLs

### Port-forward mode (default)
- **FeatBit UI (west):** http://localhost:8081
- **FeatBit UI (east):** http://localhost:8082
- **FeatBit API (west):** http://localhost:15000
- **FeatBit API (east):** http://localhost:15001
- **Kafka UI (west):** http://localhost:18080
- **Kafka UI (east):** http://localhost:18081

### Nginx proxy mode (optional, requires Setup-FeatBitProxy.ps1)
- **FeatBit UI:** http://featbit.east.local
- **FeatBit API:** http://featbit-api.east.local
- **Kafka UI:** http://featbit-kafka-ui.east.local
- **Control Plane:** http://featbit-control-plane.east.local

## Test Credentials
- **Email:** test@featbit.com
- **Password:** 123456

---

## Test 1: Verify Kafka Topics Setup

### Step 1.1: Access Kafka UI
1. Open browser to: https://featbit-kafka-ui.east.local
2. You should see the Kafka cluster named "featbit"
3. Click on **Topics** in the left navigation

### Step 1.2: Identify Control Plane Topics
Look for these topics (some may not exist yet until first use):

**Control Plane Topics (cp-*):**
- `featbit-control-plane-feature-flag-change` - API publishes flag changes here
- `featbit-control-plane-segment-change` - API publishes segment changes here
- `featbit-control-plane-secret-change` - API publishes secret changes here
- `featbit-control-plane-license-change` - License updates
- `featbit-control-plane-web-hooks` - Web hooks
- `featbit-control-plane-command` - Control plane publishes admin commands here

**Default Topics (eval servers consume from these):**
- `featbit-feature-flag-change` - Control plane republishes here
- `featbit-segment-change` - Control plane republishes here
- `featbit-endusers` - End user events

**Connection Tracking Topics:**
- `featbit-connection-made` - Eval server publishes when client connects
- `featbit-connection-closed` - Eval server publishes when client disconnects

**Command Topics:**
- `featbit-controlplane-command` - Control plane publishes admin commands here

### Step 1.3: Check Control Plane Logs
Open a terminal and run:
```bash
kubectl logs -n featbit $(kubectl get pods -n featbit | grep control-plane | awk '{print $1}') --tail=50
```

**Expected Output:**
```
Start consuming messages for Topics...
Topics: featbit-control-plane-feature-flag-change, 
        featbit-control-plane-segment-change,
        featbit-connection-made,
        featbit-connection-closed
```

✅ **Result:** Control plane is listening to the correct topics

---

## Test 2: Login to FeatBit

### Step 2.1: Access FeatBit UI
1. Open browser to: https://featbit.east.local
2. You should see the FeatBit login page

### Step 2.2: Login
1. Enter **Email:** test@featbit.com
2. Click **Continue**
3. Enter **Password:** 123456
4. Click **Sign In**

### Step 2.3: Verify Login Success
- You should be redirected to the FeatBit dashboard
- You should see the default workspace/project

✅ **Result:** Successfully logged in to FeatBit

**Note:** If login fails, check the API server logs:
```bash
kubectl logs -n featbit $(kubectl get pods -n featbit | grep api-server | awk '{print $1}') --tail=30
```

---

## Test 3: Create a Feature Flag and Observe Message Flow

### Step 3.1: Navigate to Feature Flags
1. In FeatBit UI, click on **Feature Flags** in the left sidebar
2. Click **+ Create Feature Flag** button (top right)

### Step 3.2: Create Test Flag
1. **Name:** Control Plane Test Flag
2. **Key:** cp-test-flag-1 (or use timestamp for uniqueness)
3. **Description:** Testing control plane message routing
4. **Variation Type:** Boolean
5. **Variations:**
   - Name: On, Value: true
   - Name: Off, Value: false
6. **Default Rule:** Return "Off"
7. Click **Create**

### Step 3.3: Monitor Kafka UI (Separate Browser Tab/Window)
**Before creating the flag:**
1. Open Kafka UI in a separate tab: https://featbit-kafka-ui.east.local
2. Navigate to **Topics**
3. Click on `featbit-control-plane-feature-flag-change` topic
4. Click **Messages** tab
5. Keep this tab visible

**After creating the flag:**
1. Refresh the messages view
2. You should see a new message with your flag data

### Step 3.4: Verify Control Plane Topic Message
In the Kafka UI messages view:

**Expected Message Structure:**
```json
{
  "messageId": "...",
  "messageType": "ff-updated",
  "data": {
    "key": "cp-test-flag-1",
    "name": "Control Plane Test Flag",
    "enabled": false,
    "variations": [...],
    ...
  }
}
```

✅ **Result:** Message appears in `featbit-control-plane-feature-flag-change` topic

### Step 3.5: Verify Default Topic Message
1. In Kafka UI, navigate to `featbit-feature-flag-change` topic
2. Click **Messages** tab
3. Look for a message with your flag key

**Expected:** The same flag data should appear in this topic (republished by control plane)

✅ **Result:** Message appears in `featbit-feature-flag-change` topic

### Step 3.6: Check Message Timestamps
Compare the timestamps of messages in both topics:
- `featbit-control-plane-feature-flag-change`: Earlier timestamp
- `featbit-feature-flag-change`: Later timestamp (after control plane processing)

**Typical delay:** 100ms - 2 seconds

✅ **Result:** Control plane processed and forwarded the message

### Step 3.7: Verify Control Plane Logs
In terminal:
```bash
# Get control plane logs from last 2 minutes
kubectl logs -n featbit $(kubectl get pods -n featbit | grep control-plane | awk '{print $1}') --since=2m
```

**Look for:**
- "Consuming message from featbit-control-plane-feature-flag-change"
- "Updating Redis cache for flag: cp-test-flag-1"
- "Publishing to featbit-feature-flag-change"

✅ **Result:** Control plane logs show flag processing

### Step 3.8: Verify Redis Cache
```bash
# Check if flag exists in Redis
kubectl exec -it -n featbit $(kubectl get pods -n featbit | grep redis | awk '{print $1}') -- redis-cli KEYS "*cp-test-flag-1*"
```

**Expected:** One or more keys related to your flag

✅ **Result:** Flag cached in Redis

---

## Test 4: Enable the Feature Flag

### Step 4.1: Enable Flag in UI
1. In FeatBit UI, find your flag "Control Plane Test Flag"
2. Click on the flag to open details
3. Toggle the **Status** switch to **ON** (enabled)
4. Click **Save** or confirm the change

### Step 4.2: Monitor Kafka Topics
Switch to Kafka UI tab:

1. Refresh `featbit-control-plane-feature-flag-change` messages
2. Refresh `featbit-feature-flag-change` messages

**Expected:** New messages in both topics with `"enabled": true`

✅ **Result:** Flag enable event propagated through both topics

### Step 4.3: Check Control Plane Logs
```bash
kubectl logs -n featbit $(kubectl get pods -n featbit | grep control-plane | awk '{print $1}') --since=1m | grep "cp-test-flag-1"
```

✅ **Result:** Control plane processed the enable event

---

## Test 5: Disable the Feature Flag

### Step 5.1: Disable Flag in UI
1. In FeatBit UI, toggle the flag **Status** to **OFF**
2. Save the change

### Step 5.2: Monitor Kafka Topics
1. Check both topics in Kafka UI
2. New messages should show `"enabled": false`

✅ **Result:** Flag disable event propagated correctly

---

## Test 6: Client Connection Tracking (Simulated)

**Note:** This requires a connected SDK client. For manual testing without a client:

### Step 6.1: Check Connection Topics in Kafka UI
1. Navigate to Topics in Kafka UI
2. Look for:
   - `featbit-connection-made`
   - `featbit-connection-closed`

**Expected:** These topics may not exist yet (will be created on first client connection)

### Step 6.2: Monitor Control Plane for Connection Messages
```bash
kubectl logs -n featbit $(kubectl get pods -n featbit | grep control-plane | awk '{print $1}') -f
```

Leave this running. When a client connects (via SDK), you should see:
- "Client connected: [client-id]"
- "Registering client in connection registry"

**Note:** Without a real SDK client, we cannot fully test this feature manually. See Test 7 for alternative verification.

---

## Test 7: Verify Evaluation Server Communication

### Step 7.1: Check Evaluation Server Logs
```bash
kubectl logs -n featbit $(kubectl get pods -n featbit | grep evaluation-server | awk '{print $1}') --tail=50
```

**Look for:**
- "Consuming from featbit-feature-flag-change"
- Flag key "cp-test-flag-1" in messages

✅ **Result:** Evaluation server is consuming from the default topic

### Step 7.2: Test Evaluation Server API
```bash
# Health check
curl -k https://featbit-eval.east.local/health

# Expected: HTTP 200 OK
```

✅ **Result:** Evaluation server is healthy and responding

---

## Test 8: Test with Segment Changes

### Step 8.1: Create a Segment
1. In FeatBit UI, navigate to **Segments**
2. Click **+ Create Segment**
3. **Name:** Control Plane Test Segment
4. **Key:** cp-test-segment-1
5. **Description:** Testing segment propagation
6. Click **Create**

### Step 8.2: Verify Segment Topics
In Kafka UI:

1. Check `featbit-control-plane-segment-change` topic
2. Check `featbit-segment-change` topic

**Expected:** Segment data in both topics

✅ **Result:** Segment changes propagate through control plane

### Step 8.3: Add User to Segment
1. In FeatBit UI, open the segment
2. Add a test user (e.g., user-id: "test-user-123")
3. Save

**Expected:** New messages in both segment topics

✅ **Result:** Segment updates propagate correctly

---

## Test 9: Multi-DC Simulation (Single Cluster Limitation)

**Note:** In a single-cluster setup, we cannot fully test multi-DC Redis synchronization. However, we can verify the control plane architecture is ready:

### Step 9.1: Check Control Plane Configuration
```bash
kubectl get deployment control-plane -n featbit -o yaml | grep -A 10 "env:"
```

**Look for:**
- Redis connection string configuration
- Capability to connect to multiple Redis instances (future enhancement)

### Step 9.2: Verify Redis Updates
```bash
# Monitor Redis in real-time while creating a flag
kubectl exec -it -n featbit $(kubectl get pods -n featbit | grep redis | awk '{print $1}') -- redis-cli MONITOR
```

Keep this running, then create a flag in the UI. You should see Redis SET commands for the flag data.

✅ **Result:** Control plane updates Redis as expected

---

## Test 10: Admin Command API (Future)

**Note:** Admin endpoints may not be fully implemented yet. To test when available:

### Step 10.1: Check Control Plane API
```bash
curl -k https://featbit-control-plane.east.local/health
```

**Expected:** HTTP 200 OK

### Step 10.2: Test Connected Clients Endpoint (if available)
```bash
curl -k https://featbit-control-plane.east.local/api/connected-clients
```

**Expected:** JSON response with connected clients (empty if no SDK clients)

### Step 10.3: Test Refresh Client Command (if available)
```bash
curl -k -X POST https://featbit-control-plane.east.local/api/refresh-client \
  -H "Content-Type: application/json" \
  -d '{"envSecret":"your-env-secret","clientId":"test-client-id"}'
```

**Expected:** Command published to `featbit-controlplane-command` topic

---

## Verification Checklist

### Control Plane Setup
- [ ] UseControlPlane=true environment variable set on API server
- [ ] Control plane pod running and healthy
- [ ] Control plane consuming from cp-* topics
- [ ] Kafka UI accessible and showing topics

### Flag Lifecycle
- [ ] Create flag → Message in cp-* topic
- [ ] Create flag → Message in default topic (forwarded)
- [ ] Enable flag → Messages in both topics
- [ ] Disable flag → Messages in both topics
- [ ] Control plane logs show processing

### Segment Lifecycle
- [ ] Create segment → Messages in both segment topics
- [ ] Update segment → Messages propagate
- [ ] Control plane processes segment changes

### Redis Caching
- [ ] Flags stored in Redis
- [ ] Redis updated before message forwarded to default topic
- [ ] Redis MONITOR shows SET commands during flag creation

### Message Flow Timing
- [ ] cp-* topic message timestamp < default topic message timestamp
- [ ] Typical delay: 100ms - 2 seconds
- [ ] No race conditions observed

### Evaluation Server
- [ ] Eval server consuming from default topics (not cp-* topics)
- [ ] Eval server health check passes
- [ ] Eval server logs show flag/segment processing

---

## Troubleshooting

### Issue: No Messages in cp-* Topics
**Possible Causes:**
1. UseControlPlane=true not set on API server
2. API server using old image without control plane support
3. Kafka connection issues

**Solution:**
```bash
# Check API server environment
kubectl get deployment api-server -n featbit -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="UseControlPlane")]}' | jq .

# Check API server logs
kubectl logs -n featbit $(kubectl get pods -n featbit | grep api-server | awk '{print $1}') --tail=50
```

### Issue: Control Plane Not Forwarding Messages
**Possible Causes:**
1. Control plane not consuming from cp-* topics
2. Control plane cannot connect to Kafka
3. Control plane Redis connection issues

**Solution:**
```bash
# Check control plane logs
kubectl logs -n featbit $(kubectl get pods -n featbit | grep control-plane | awk '{print $1}') --tail=100

# Look for errors like:
# - "Failed to consume message"
# - "Redis connection failed"
# - "Kafka connection error"
```

### Issue: Messages Not Appearing in Kafka UI
**Possible Causes:**
1. Kafka UI not connected to correct cluster
2. Topics haven't been created yet (need first message)
3. Browser cache issues

**Solution:**
1. Refresh Kafka UI
2. Check Kafka UI connection in Settings
3. Clear browser cache and reload

---

## Expected Results Summary

After completing all tests, you should have confirmed:

1. ✅ **Message Routing:** API publishes to cp-* topics, control plane forwards to default topics
2. ✅ **Redis Caching:** Control plane updates Redis before forwarding messages
3. ✅ **Flag Lifecycle:** Create, enable, disable all propagate correctly
4. ✅ **Segment Lifecycle:** Create and update propagate correctly
5. ✅ **No Race Conditions:** Redis always updated before eval servers process messages
6. ✅ **Proper Topic Isolation:** Eval servers never consume from cp-* topics directly

---

## Next Steps

After completing manual testing:

1. **Document Findings:** Record any issues or unexpected behavior
2. **Create Test Scripts:** Automate the verification steps
3. **Test Client Integration:** Use SDK to test client connection tracking
4. **Multi-DC Testing:** Deploy to Azure AKS for full multi-DC validation
5. **Performance Testing:** Measure message latency and throughput

---

## Notes

- **Topic Creation:** Kafka topics are auto-created on first message (may see errors in logs before first use)
- **Message Retention:** Default 7 days (configurable in Kafka)
- **Control Plane Performance:** Typical message processing: < 100ms
- **Redis Consistency:** Single cluster uses single Redis (no synchronization needed)
- **Multi-DC Ready:** Architecture supports multiple Redis instances (requires configuration)
