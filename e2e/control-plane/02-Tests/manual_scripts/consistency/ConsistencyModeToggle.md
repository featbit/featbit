# CP-14 ConsistencyMode Toggle and Rollback (GatedCommit ↔ BestEffort)

**Component:** Control-Plane, Api, Evaluation Server, Redis, Kafka
**Status:** [Draft/Ready/Passed/Failed]

## Description
Validate that `ConsistencyMode` is a safe, reversible switch: with the default `BestEffort`, behavior is the original immediate best-effort broadcast (no staging/gating); enabling `GatedCommit` activates the stage→commit lifecycle; and rolling back to `BestEffort` restores immediate propagation with no data migration and harmless leftover staged keys. Also covers the DcId-mismatch advisory check surfaced right after enabling.

## Preconditions
- [ ] Start the Control-Plane QA deployment with one of the Quickstart PowerShell scripts.
- [ ] If needed, run Start-PortForwards.ps1 from 01-Infrastructure/.
- [ ] East and West clusters are running in Advanced mode with required host entries.
- [ ] You can change `ConsistencyMode` (and restart) on the control plane and both DCs' evaluation servers.
- [ ] playground organization and control-plane-test project exist.
- [ ] Test flag ff-cp14-mode exists and is toggled off in both DCs.
- [ ] Access is available to featbit.west.local, redis.west.local, redis.east.local, and the control-plane logs/metrics.

## Test Steps

### Phase 1: Default BestEffort Regression
1. **Action:** Confirm `ConsistencyMode` is `BestEffort` (default) on the control plane and both eval servers.
2. **Action:** Open Redis clients for redis.west.local and redis.east.local.
3. **Action:** From featbit.west.local, toggle ff-cp14-mode from false to true.
4. **Action:** Confirm the value propagates **immediately** via the legacy single-value key `featbit:flag:{id}` in both DCs (no commit gating, no withheld publish).
5. **Action:** Confirm **no** committed-pointer key `featbit:flag-committed:{id}` is created and the consistency `commits` metric does **not** increment.
6. **Action:** Confirm both DCs serve true.

### Phase 2: Enable GatedCommit
1. **Action:** Set `ConsistencyMode=GatedCommit` on the control plane and both eval servers; restart.
2. **Action:** Watch control-plane logs for `DcIdConsistencyChecker` warnings and the `unmatched_dc_count` gauge; confirm both are clean (0). If a DcId is mismatched, observe the warning and a non-zero `unmatched_dc_count`, then fix the mapping before proceeding.
3. **Action:** Toggle ff-cp14-mode from true to false.
4. **Action:** Confirm the stage→commit lifecycle now applies: a versioned staged key `featbit:flag:{id}:v{ts}` in both DCs, the committed pointer `featbit:flag-committed:{id}` advances after both stage, and `commits` increments (this mirrors CP-10).
5. **Action:** Confirm both DCs converge to false.

### Phase 3: Rollback to BestEffort
1. **Action:** Set `ConsistencyMode=BestEffort` on the control plane and both eval servers; restart. (No data migration is expected.)
2. **Action:** Toggle ff-cp14-mode from false to true.
3. **Action:** Confirm immediate best-effort propagation resumes (legacy `featbit:flag:{id}` key updates directly in both DCs; no new commits).
4. **Action:** Confirm any leftover staged `featbit:flag:{id}:v{ts}` keys from Phase 2 are harmless — they are not served and are GC'd by the staged-flag GC worker (`StagedFlagGc:IntervalSeconds`, default 300).
5. **Action:** Confirm both DCs serve true and evaluation is correct.

### Phase 4: Negative — DcId Mismatch Advisory (Optional)
1. **Action:** Re-enable `GatedCommit`, but deliberately mis-set one DC's eval-server `ControlPlane:DcId` (e.g. `west-1` instead of `west`); restart that DC.
2. **Action:** Confirm `DcIdConsistencyChecker` logs a warning (configured Redis DcId with no reporting lease, and/or a lease with an unknown DcId) and `unmatched_dc_count` is non-zero.
3. **Action:** Toggle ff-cp14-mode and confirm commits for the mismatched DC stall (`pending_backlog` stays > 0) — the advisory check does not fail the service, only warns.
4. **Action:** Restore the correct DcId; confirm `unmatched_dc_count` returns to 0 and commits proceed.

## Expected Results
- Under BestEffort (default), flag changes propagate immediately via the legacy `featbit:flag:{id}` key; no committed pointer is created and `commits` does not increment.
- Enabling GatedCommit activates the stage→commit lifecycle (staged versioned key → pointer advance → commit) exactly as in CP-10.
- Rolling back to BestEffort restores immediate propagation with no data migration; leftover staged `v{ts}` keys are unserved and GC'd.
- The DcIdConsistencyChecker warns (does not fail) on a DcId mismatch and `unmatched_dc_count` is non-zero; a mismatched DC's commits stall until the mapping is corrected.

## Post-conditions
- Leave `ConsistencyMode` in the intended state for the environment (note which) and ensure DcId mappings are correct (`unmatched_dc_count` = 0).
- Return ff-cp14-mode to false in both DCs.
- Clear temporary log/metric filters.

---
**Notes/Comments:**
- Rollback is intended to be instant and migration-free: flip to `BestEffort` and restart. Capture the time from restart to first immediate propagation as the rollback signal.
- Phase 4 is the documented "most common misconfiguration" (operator guide §2.3); run it at least once to confirm the advisory wiring works in this environment.
