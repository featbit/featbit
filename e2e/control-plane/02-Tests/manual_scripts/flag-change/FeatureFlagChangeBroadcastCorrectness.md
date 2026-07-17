# CP-02 Feature Flag Change Broadcast Correctness (Cross-DC)

**Component:** Control-Plane, Api, Evaluation Server, Redis, Kafka
**Status:** [Draft/Ready/Passed/Failed]

## Description
Validate that Control-Plane correctly enforces cross-datacenter change propagation guarantees for feature flag updates. This test verifies ordering, traceability, bidirectional handling, and rapid sequential consistency.

## Preconditions
- [ ] Start the Control-Plane QA deployment with one of the Quickstart PowerShell scripts.
- [ ] If needed, run Start-PortForwards.ps1 from 01-Infrastructure/.
- [ ] East and West clusters are running in Advanced mode with required host entries.
- [ ] playground organization exists.
- [ ] control-plane-test project exists.
- [ ] Two test flags exist and are toggled off:
  - ff-cp02-west
  - ff-cp02-east
- [ ] Access is available to:
  - featbit.west.local
  - featbit.east.local
  - featbit-kafka.west.local
  - featbit-kafka.east.local
  - redis.west.local and redis.east.local

## Test Steps

### Phase 1: Baseline and Instrumentation
1. **Action:** Open Redis clients for redis.west.local and redis.east.local.
2. **Action:** Open Kafka UI at featbit-kafka.west.local and featbit-kafka.east.local.
3. **Action:** In Kafka UI, prepare to observe these topics:
   - featbit-control-plane-feature-flag-change (under featbit-main)
   - featbit-feature-flag-change (under featbit-main)
   - featbit-feature-flag-change (under featbit-aggregate in both west and east)
4. **Action:** Confirm ff-cp02-west and ff-cp02-east are false in both Redis instances.

Optional command snippets:
- Redis (example): GET <flag-cache-key>
- Kafka (example): consume topic records and capture message fields: messageId, flagId, isEnabled, version, timestamp

### Phase 2: West to East Correctness Flow
1. **Action:** Sign in to featbit.west.local and open control-plane-test project.
2. **Action:** Toggle ff-cp02-west from false to true.
3. **Action:** In featbit-control-plane-feature-flag-change, capture the source record fields:
   - messageId or equivalent correlation field
   - flagId
   - isEnabled
   - version
   - timestamp
4. **Action:** Verify Redis update in west for ff-cp02-west equals true.
5. **Action:** Verify Redis update in east for ff-cp02-west equals true.
6. **Action:** Observe downstream records in featbit-feature-flag-change topics (main and aggregate).
7. **Action:** Confirm downstream records carry matching correlation fields and represent the same flag state.

### Phase 3: East to West Correctness Flow
1. **Action:** Sign in to featbit.east.local and open control-plane-test project.
2. **Action:** Toggle ff-cp02-east from false to true.
3. **Action:** In featbit-control-plane-feature-flag-change, capture source record fields:
   - messageId or equivalent correlation field
   - flagId
   - isEnabled
   - version
   - timestamp
4. **Action:** Verify Redis update in east for ff-cp02-east equals true.
5. **Action:** Verify Redis update in west for ff-cp02-east equals true.
6. **Action:** Observe downstream records in featbit-feature-flag-change topics (main and aggregate).
7. **Action:** Confirm downstream records carry matching correlation fields and represent the same flag state.

### Phase 4: Rapid Sequential Consistency
1. **Action:** From featbit.west.local, toggle ff-cp02-west true to false, then false to true in quick succession.
2. **Action:** Capture the sequence of source records in featbit-control-plane-feature-flag-change.
3. **Action:** Verify both Redis instances reflect the final expected state for ff-cp02-west.
4. **Action:** Verify downstream featbit-feature-flag-change records converge to the same final state.
5. **Action:** Confirm version and timestamp progression is monotonic for the observed sequence.

## Expected Results
- Redis in both west and east is updated before downstream featbit-feature-flag-change records are considered valid for each change.
- West-originated and east-originated changes both propagate correctly across datacenters.
- Source and downstream records preserve a traceable correlation field (messageId or equivalent) for each tested change.
- For rapid sequential updates, both datacenters converge to the same deterministic final state.
- No final-state mismatch exists between redis.west.local and redis.east.local for tested flags.

## Post-conditions
- Return ff-cp02-west and ff-cp02-east to false.
- Clear temporary observation filters in Kafka UI and Redis tools.

---
**Notes/Comments:**
- If strict timestamp ordering cannot be guaranteed due to clock skew, rely on record order plus correlation and version fields for correctness determination.
- This CP-02 test excludes failure injection and retry behavior. Capture those in a separate resilience-focused case.