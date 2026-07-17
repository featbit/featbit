# CP-11 GatedCommit Slow/Down DC and Eviction

**Component:** Control-Plane, Api, Evaluation Server, Redis, Kafka
**Status:** [Draft/Ready/Passed/Failed]

## Description
Validate that under `ConsistencyMode=GatedCommit` a flag change does **not** go live anywhere while a **live** DC has not staged it (the commit is gated), and that once a non-staging DC stops heartbeating and its lease expires, it is **evicted** from the live set so the change commits on the remaining DCs. This exercises commit gating, lease-based liveness, and eviction accounting.

## Preconditions
- [ ] Start the Control-Plane QA deployment with one of the Quickstart PowerShell scripts.
- [ ] If needed, run Start-PortForwards.ps1 from 01-Infrastructure/.
- [ ] East and West clusters are running in Advanced mode with required host entries.
- [ ] `ConsistencyMode=GatedCommit` is set on the control plane and every evaluation server; all services restarted.
- [ ] `LeaseTtlSeconds` is known (default 15) and `CommitCoordinator:IntervalSeconds` is known (default 5).
- [ ] DcId mapping is correct and both DCs are heartbeating; `unmatched_dc_count` is 0.
- [ ] playground organization and control-plane-test project exist.
- [ ] Test flag ff-cp11-eviction exists and is toggled off (committed false in both DCs).
- [ ] Operators have a known method to (a) block staging to east Redis (e.g. pause/partition redis.east.local) and (b) stop east's evaluation-server heartbeats (e.g. stop east eval pods or partition them from the control plane).
- [ ] Access is available to featbit.west.local, redis.west.local, redis.east.local, and Kafka UIs.

## Test Steps

### Phase 1: Baseline
1. **Action:** Open Redis clients for redis.west.local and redis.east.local; confirm ff-cp11-eviction committed pointer resolves to false in both.
2. **Action:** Open Control-Plane logs and the `FeatBit.ControlPlane.Consistency` metrics; record `commits`, `pending_backlog`, and `evicted_commits{dc_id=east}`.
3. **Action:** Confirm both `west` and `east` leases are present (both DCs live).

### Phase 2: Block East Staging While It Is Still Live
1. **Action:** Apply the disruption that prevents the control plane from staging into redis.east.local, **but keep east's eval-server heartbeats flowing** (east remains "live").
2. **Action:** From featbit.west.local, toggle ff-cp11-eviction from false to true.
3. **Action:** Observe the staged version `featbit:flag:{id}:v{ts}` appear in redis.west.local but **not** in redis.east.local.
4. **Action:** Confirm the committed pointer does **not** advance in **either** DC (commit is gated on the still-live east).
5. **Action:** Confirm the change does **not** go live in west — SDK clients in west still evaluate false.
6. **Action:** Confirm `pending_backlog` stays > 0 for the flag while east is live-but-missing.
7. **Action:** Observe the downstream featbit-feature-flag-change publish remains withheld.

### Phase 3: Stop East Heartbeats and Observe Eviction
1. **Action:** Stop east's evaluation-server heartbeats (east can no longer renew its lease) while staging to east remains blocked.
2. **Action:** Wait beyond `LeaseTtlSeconds` for east's lease to expire.
3. **Action:** Observe the commit coordinator drop east from the live set and commit the change on the remaining live DC (west).
4. **Action:** Confirm `featbit:flag-committed:{id}` advances to `{ts}` in redis.west.local and the flag now evaluates to true in west.
5. **Action:** Confirm `evicted_commits{dc_id=east}` increments and the control-plane log records a commit that proceeded without the evicted DC; `pending_backlog` returns to 0.

### Phase 4: Restore East and Confirm No Permanent Divergence
1. **Action:** Remove both disruptions (restore east Redis staging and east heartbeats).
2. **Action:** Confirm east rejoins the live set (lease reappears) and is reconciled to the committed value (recovery backfill is validated in detail by CP-12).
3. **Action:** Confirm both DCs ultimately serve true for ff-cp11-eviction with no permanent divergence.

## Expected Results
- While east is **live but missing** the staged version, the commit is gated: the pointer does not advance in any DC, the change is not served in west, and `pending_backlog` stays > 0.
- The downstream evaluation-server publish is withheld during the gated window.
- After east's lease expires (no heartbeats > `LeaseTtlSeconds`), east is evicted from the live set and the change commits on west.
- `control_plane.consistency.evicted_commits{dc_id=east}` increments and a log entry records the commit proceeding without the evicted DC.
- After east returns it is reconciled to the committed value; no permanent west/east divergence remains.

## Post-conditions
- Ensure east Redis staging and east heartbeats are fully restored.
- Return ff-cp11-eviction to false (committed) in both DCs.
- Clear temporary topic/log/metric filters.

---
**Notes/Comments:**
- Distinguish the two failure shapes: a **live-but-not-staging** DC blocks commits indefinitely (Phase 2); only an **evicted** DC (lease expired) is dropped so commits can proceed (Phase 3). The eviction is what unblocks west.
- If the change commits in Phase 2 while east is still heartbeating, that is a defect — gating must hold until eviction.
- Document the exact disruption mechanism used (network policy, paused container, scaled-to-zero pods) for reproducibility.
