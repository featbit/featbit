# CP-13 GatedCommit Degraded Health (Stale-Heartbeat Readiness Fence)

**Component:** Evaluation Server, Control-Plane, Redis
**Status:** [Draft/Ready/Passed/Failed]

## Description
Validate the evaluation-server self-fence (#22): under `ConsistencyMode=GatedCommit`, when a pod has been unable to publish a heartbeat to the control plane for longer than `HeartbeatStalenessThresholdSeconds`, its `/health/readiness` check returns **Unhealthy (HTTP 503)** — a hard readiness fence that pulls the pod from load-balancer rotation. It must recover (return to Healthy / rotation) once heartbeats resume, and the fence must be a **no-op under BestEffort**.

## Preconditions
- [ ] Start the Control-Plane QA deployment with one of the Quickstart PowerShell scripts.
- [ ] If needed, run Start-PortForwards.ps1 from 01-Infrastructure/.
- [ ] East and West clusters are running in Advanced mode with required host entries.
- [ ] `ConsistencyMode=GatedCommit` is set on the control plane and every evaluation server; all services restarted.
- [ ] `HeartbeatStalenessThresholdSeconds` is known (default 180; consider lowering it temporarily for a faster test and noting the value used).
- [ ] At least one east evaluation-server pod is reachable on its `/health/readiness` and `/health/liveness` endpoints.
- [ ] Operators have a known method to stop a single eval-server pod from publishing heartbeats to the control plane (e.g. partition that pod from the control-plane Redis used for heartbeats, without killing the process).
- [ ] Access is available to the east eval-server health endpoints and its logs/metrics (`FeatBit.EvaluationServer.Consistency`).

## Test Steps

### Phase 1: Baseline (Healthy)
1. **Action:** Hit `/health/readiness` on the target east eval-server pod; confirm 200 Healthy with a "Heartbeat fresh" message naming the DcId.
2. **Action:** Confirm `/health/liveness` is 200 (liveness must NOT be affected by this fence).
3. **Action:** Record the `evaluation_server.consistency.heartbeat_staleness_seconds` gauge — it should be 0.

### Phase 2: Stop Heartbeats and Observe the Fence
1. **Action:** Apply the disruption so the target pod can no longer publish heartbeats (but the process stays up).
2. **Action:** Observe `heartbeat_staleness_seconds` climb on each health evaluation.
3. **Action:** Before the threshold elapses, confirm `/health/readiness` is still Healthy (within staleness threshold) and the pod stays in rotation.
4. **Action:** After staleness exceeds `HeartbeatStalenessThresholdSeconds`, confirm `/health/readiness` flips to **503 Unhealthy** with a "Heartbeat stale … Failing readiness (pulled from rotation)" message naming the DcId and staleness seconds.
5. **Action:** Confirm a single WARNING is logged on the transition into the fenced state (not repeated every poll).
6. **Action:** Confirm `/health/liveness` remains 200 — the pod is pulled from rotation, **not** restarted.

### Phase 3: Restore Heartbeats and Observe Recovery
1. **Action:** Remove the disruption so heartbeats resume.
2. **Action:** Confirm `heartbeat_staleness_seconds` returns toward 0 and `/health/readiness` returns to 200 Healthy.
3. **Action:** Confirm the pod returns to load-balancer rotation and resumes serving evaluations.

### Phase 4: BestEffort No-Op Check
1. **Action:** Set `ConsistencyMode=BestEffort` on the target eval server and restart it.
2. **Action:** Repeat the heartbeat disruption from Phase 2.
3. **Action:** Confirm `/health/readiness` stays **Healthy** ("Heartbeat freshness not gating (BestEffort)") and `heartbeat_staleness_seconds` stays 0 — the fence is a no-op under BestEffort.
4. **Action:** Restore `ConsistencyMode=GatedCommit` and restart.

## Expected Results
- Under GatedCommit, `/health/readiness` is Healthy while heartbeat staleness is within `HeartbeatStalenessThresholdSeconds`.
- Once staleness exceeds the threshold, `/health/readiness` returns 503 Unhealthy and the pod is removed from LB rotation; `/health/liveness` stays 200 (no restart).
- A single warning is logged on the transition into the fenced state.
- `evaluation_server.consistency.heartbeat_staleness_seconds` tracks seconds since last successful publish (0 when healthy).
- When heartbeats resume, readiness returns to Healthy and the pod rejoins rotation.
- Under BestEffort, the check is always Healthy and the gauge stays 0 regardless of heartbeat state.

## Post-conditions
- Ensure the target pod's heartbeats are restored and it is back in rotation as Healthy.
- Restore `HeartbeatStalenessThresholdSeconds` if it was lowered for the test.
- Ensure `ConsistencyMode=GatedCommit` is restored on the pod.
- Clear temporary log/metric filters.

---
**Notes/Comments:**
- A just-started pod gets a startup grace equal to the threshold before it can be considered stale (it measures from process start until its first successful publish) — account for this when timing Phase 2 right after a restart.
- This is the strict consistency-over-availability choice: a partitioned/evicted DC's eval servers stop serving rather than serving stale-but-consistent values. Confirm the LB actually drains the pod on 503.
