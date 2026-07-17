# CP-10 GatedCommit Happy Path (Stage → Commit Gating)

**Component:** Control-Plane, Api, Evaluation Server, Redis, Kafka
**Status:** [Draft/Ready/Passed/Failed]

## Description
Validate that under `ConsistencyMode=GatedCommit` a flag change is **staged** to every live data center's Redis before it is **committed**, and that evaluation servers serve the new value only **after** the committed pointer is advanced — never the staged-but-uncommitted value. This exercises the stage→commit lifecycle, the commit coordinator, and version-gated reads.

## Preconditions
- [ ] Start the Control-Plane QA deployment with one of the Quickstart PowerShell scripts.
- [ ] If needed, run Start-PortForwards.ps1 from 01-Infrastructure/.
- [ ] East and West clusters are running in Advanced mode with required host entries.
- [ ] `ConsistencyMode=GatedCommit` is set on the control plane **and** every evaluation server in both DCs; all services restarted.
- [ ] Each control-plane `Redis:Instances[].DcId` matches the `ControlPlane:DcId` reported by that DC's evaluation servers (e.g. `west` / `east`).
- [ ] Both DCs are heartbeating (a lease per DC is present); no `DcIdConsistencyChecker` warnings and `unmatched_dc_count` is 0.
- [ ] playground organization exists.
- [ ] control-plane-test project exists.
- [ ] Test flag ff-cp10-gatedcommit exists and is toggled off (committed value false in both DCs).
- [ ] Access is available to featbit.west.local, featbit-kafka.west.local, featbit-kafka.east.local, redis.west.local, and redis.east.local.

## Test Steps

### Phase 1: Baseline and Observability Setup
1. **Action:** Open Redis clients for redis.west.local and redis.east.local.
2. **Action:** In both Redis instances, record the committed pointer `featbit:flag-committed:{ff-cp10-gatedcommit-id}` (its value is the committed timestamp) and confirm the served value resolves to false.
3. **Action:** Open Kafka UI at featbit-kafka.west.local and featbit-kafka.east.local and prepare to observe:
   - featbit-control-plane-feature-flag-change (under featbit-main)
   - featbit-feature-flag-change (under featbit-aggregate in both west and east)
4. **Action:** Open Control-Plane logs and the consistency metrics (`FeatBit.ControlPlane.Consistency`): note the current `commits` count and `pending_backlog`.
5. **Action:** Record observations from UI screens (FeatBit UI, Kafka UI, Redis GUI, metrics, log viewer); avoid mutating Redis by hand.

### Phase 2: Toggle and Observe Staging (Pre-Commit)
1. **Action:** From featbit.west.local, toggle ff-cp10-gatedcommit from false to true.
2. **Action:** In the brief window before commit, observe a new versioned staged key `featbit:flag:{id}:v{ts}` appear in **both** redis.west.local and redis.east.local.
3. **Action:** Confirm the committed pointer `featbit:flag-committed:{id}` has **not** yet advanced to the new `{ts}` while staging is in progress.
4. **Action:** Confirm `pending_backlog` momentarily increments for the flag.
5. **Action:** Confirm the evaluation-server downstream publish (featbit-feature-flag-change in the aggregate topics) is **withheld** until commit.

### Phase 3: Observe Commit and Convergence
1. **Action:** Observe the commit coordinator (interval ~5s) promote the staged version once both live DCs have `v{ts}`.
2. **Action:** Confirm `featbit:flag-committed:{id}` advances to the new `{ts}` in **both** Redis instances.
3. **Action:** Confirm `commits` increments by one and `time_to_commit_ms` records a sample; `pending_backlog` returns to 0.
4. **Action:** Observe the withheld downstream featbit-feature-flag-change records now published in the aggregate topics for both west and east.
5. **Action:** Via an SDK client (or the eval-server evaluation endpoint) in each DC, confirm the flag now evaluates to true in both west and east.

### Phase 4: Reverse Toggle
1. **Action:** Toggle ff-cp10-gatedcommit from true back to false.
2. **Action:** Verify the same stage→commit sequence: new staged version in both DCs, pointer advances only after both stage, `commits` increments again.
3. **Action:** Confirm both DCs converge to false and evaluate consistently.

## Expected Results
- A new staged version key `featbit:flag:{id}:v{ts}` is written to every live DC's Redis before commit.
- The committed pointer `featbit:flag-committed:{id}` advances **only after** all live DCs hold the staged version.
- Evaluation servers never serve the staged-but-uncommitted value; the new value becomes visible to SDK clients only after the pointer advances.
- The downstream evaluation-server publish is withheld until commit.
- `control_plane.consistency.commits` increments per commit, `time_to_commit_ms` records latency, and `pending_backlog` returns to 0 after each commit.
- Both DCs converge to the same committed value with no divergence.

## Post-conditions
- Return ff-cp10-gatedcommit to false (committed) in both DCs.
- Clear temporary topic/log/metric filters used for observation.
- Leave `ConsistencyMode=GatedCommit` in place for subsequent CP-1x scripts (CP-14 covers rollback).

---
**Notes/Comments:**
- The stage→commit window can be short at the default 5s coordinator interval. To observe staging reliably, either raise `CommitCoordinator:IntervalSeconds` temporarily or use CP-11 (one DC blocked) to hold the pending state open.
- If `pending_backlog` stays > 0 and never commits, suspect a DcId mismatch or a non-staging live DC (see CP-13 / the operator guide §2.3).
