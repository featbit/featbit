# CP-12 GatedCommit Recovery Backfill (Returning DC)

**Component:** Control-Plane, Api, Evaluation Server, Redis
**Status:** [Draft/Ready/Passed/Failed]

## Description
Validate that under `ConsistencyMode=GatedCommit` a data center that dropped out (lease expired) and then returns is **backfilled** by the recovery worker with the current committed flag **and** segment state before it rejoins, so it serves correct, committed values without divergence. This exercises the recovery worker and post-recovery version-gated reads.

## Preconditions
- [ ] Start the Control-Plane QA deployment with one of the Quickstart PowerShell scripts.
- [ ] If needed, run Start-PortForwards.ps1 from 01-Infrastructure/.
- [ ] East and West clusters are running in Advanced mode with required host entries.
- [ ] `ConsistencyMode=GatedCommit` is set on the control plane and every evaluation server; all services restarted.
- [ ] `Recovery:IntervalSeconds` is known (default 10) and `LeaseTtlSeconds` is known (default 15).
- [ ] DcId mapping is correct; both DCs heartbeating; `unmatched_dc_count` is 0.
- [ ] playground organization and control-plane-test project exist.
- [ ] Test flag ff-cp12-recovery exists (committed false in both DCs).
- [ ] Test segment seg-cp12-recovery exists, plus a segment-dependent flag ff-cp12-segdep that targets it.
- [ ] Operators have a known method to take east out (stop east eval-server heartbeats and/or partition east) and bring it back.
- [ ] Access is available to featbit.west.local, redis.west.local, and redis.east.local.

## Test Steps

### Phase 1: Baseline and Drop East Out
1. **Action:** Open Redis clients for redis.west.local and redis.east.local; record committed pointers for ff-cp12-recovery, ff-cp12-segdep, and seg-cp12-recovery.
2. **Action:** Take east out: stop east heartbeats and wait beyond `LeaseTtlSeconds` so east's lease expires and it leaves the live set.
3. **Action:** Confirm only west remains live.

### Phase 2: Make Committed Changes While East Is Absent
1. **Action:** From featbit.west.local, toggle ff-cp12-recovery from false to true; confirm it commits on west (east evicted) — committed pointer advances in redis.west.local.
2. **Action:** Edit seg-cp12-recovery (e.g. add/remove a targeted user) so the segment has a new committed version on west.
3. **Action:** Toggle/save ff-cp12-segdep so it commits on west referencing the updated segment.
4. **Action:** Confirm redis.east.local is now **stale**: its committed pointers/values for these keys still reflect the pre-outage state.

### Phase 3: Bring East Back and Observe Backfill
1. **Action:** Restore east (heartbeats resume); confirm east's lease reappears and it rejoins as live.
2. **Action:** Observe the recovery worker (interval ~10s) detect the returning DC and backfill redis.east.local with the current committed state.
3. **Action:** In redis.east.local, confirm:
   - `featbit:flag-committed:{ff-cp12-recovery-id}` advances to the committed `{ts}` and resolves to true.
   - `featbit:segment-committed:{seg-cp12-recovery-id}` advances to the committed segment version with the updated membership.
   - `featbit:flag-committed:{ff-cp12-segdep-id}` reflects the committed segment-dependent flag.
4. **Action:** Confirm the corresponding versioned snapshot keys (`featbit:flag:{id}:v{ts}`, `featbit:segment:{id}:v{ts}`) exist in east for the committed versions.

### Phase 4: Verify East Serves Correct Values
1. **Action:** Via an SDK client (or the eval-server evaluation endpoint) in east, evaluate ff-cp12-recovery and confirm true.
2. **Action:** Evaluate ff-cp12-segdep for a user inside and outside seg-cp12-recovery and confirm results match west (segment membership honored).
3. **Action:** Confirm west and east now serve identical committed values for all three entities.

## Expected Results
- While east is out, changes commit on west (east evicted) and east's Redis goes stale.
- On east's return, the recovery worker backfills its Redis with the current committed **flag and segment** state before/just-as it rejoins.
- East's committed pointers advance to the current committed versions, and version-gated reads serve those committed values.
- A segment change and a segment-dependent flag both recover correctly.
- West and east converge to identical committed values with no permanent divergence.

## Post-conditions
- Ensure east heartbeats and connectivity are fully restored and east is live.
- Return ff-cp12-recovery and ff-cp12-segdep to false (committed) and revert seg-cp12-recovery membership in both DCs.
- Clear temporary log/metric filters.

---
**Notes/Comments:**
- Known limitation (#54): SDK clients that stayed **connected** to east through the outage may keep stale values until they reconnect / next full-sync; verify recovery using a fresh client or after a reconnect. Newly connecting clients should immediately see committed values.
- The applied watermark in heartbeats is per-pod/in-memory and is **not** used for gating (Model A); do not treat it as a recovery-completion signal — use the committed pointers and served values.
