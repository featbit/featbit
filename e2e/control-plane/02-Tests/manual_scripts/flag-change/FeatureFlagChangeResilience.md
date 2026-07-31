# CP-03 Feature Flag Change Resilience (Cross-DC Failure and Recovery)

**Component:** Control-Plane, Api, Evaluation Server, Redis, Kafka
**Status:** [Draft/Ready/Passed/Failed]

## Description
Validate that Control-Plane safely handles cross-datacenter failure scenarios during feature flag changes. This test verifies retry behavior, delayed downstream publish until cache sync completes, and eventual recovery without final-state divergence.

## Preconditions
- [ ] Start the Control-Plane QA deployment with one of the Quickstart PowerShell scripts.
- [ ] If needed, run Start-PortForwards.ps1 from 01-Infrastructure/.
- [ ] East and West clusters are running in Advanced mode with required host entries.
- [ ] playground organization exists.
- [ ] control-plane-test project exists.
- [ ] Test flag ff-cp03-resilience exists and is toggled off.
- [ ] Access is available to featbit.west.local, featbit-kafka.west.local, featbit-kafka.east.local, redis.west.local, and redis.east.local.
- [ ] Operators have a known method to temporarily disrupt east Redis access from Control-Plane.

## Test Steps

### Phase 1: Baseline and Observability Setup
1. **Action:** Open Redis clients for redis.west.local and redis.east.local.
2. **Action:** Open Kafka UI at featbit-kafka.west.local and featbit-kafka.east.local.
3. **Action:** Prepare to observe these topics:
   - featbit-control-plane-feature-flag-change (under featbit-main)
   - featbit-feature-flag-change (under featbit-main)
   - featbit-feature-flag-change (under featbit-aggregate in both west and east)
4. **Action:** Confirm ff-cp03-resilience is false in both Redis instances.
5. **Action:** Open Control-Plane logs and confirm trace fields are visible (messageId or equivalent).
6. **Action:** Do not use terminal commands for this test. Record observations only from UI screens (FeatBit UI, Kafka UI, Redis GUI, and log viewer).

### Phase 2: Simulate East Redis Unavailable During Change
1. **Action:** Apply the temporary disruption so Control-Plane cannot update redis.east.local.
2. **Action:** From featbit.west.local, toggle ff-cp03-resilience from false to true.
3. **Action:** Capture the source message in featbit-control-plane-feature-flag-change with messageId and timestamp.
4. **Action:** Verify redis.west.local may update to true.
5. **Action:** Verify redis.east.local remains unchanged while disruption is active.
6. **Action:** Observe Control-Plane logs for retry attempts related to the same messageId.
7. **Action:** Verify downstream featbit-feature-flag-change records are not published as completed cross-DC change while east remains unavailable.

### Phase 3: Recover East Redis and Verify Completion
1. **Action:** Remove the disruption and restore east Redis connectivity.
2. **Action:** Observe retry completion in Control-Plane logs for the same messageId.
3. **Action:** Verify redis.east.local updates to true.
4. **Action:** Verify both Redis instances now show true for ff-cp03-resilience.
5. **Action:** Observe downstream featbit-feature-flag-change records in main and aggregate topics.
6. **Action:** Confirm downstream records match the recovered change and remain traceable to the original messageId.

### Phase 4: Repeat Recovery with Reverse Final State
1. **Action:** Reapply east Redis disruption.
2. **Action:** Toggle ff-cp03-resilience from true to false.
3. **Action:** Verify retry behavior appears again for the new messageId.
4. **Action:** Remove disruption and wait for recovery.
5. **Action:** Verify both Redis instances converge to false.
6. **Action:** Verify downstream records reflect false and correlate to the second messageId.

## Expected Results
- Control-Plane attempts retries while east Redis is unavailable and retains traceability by messageId.
- Cross-DC completion is not considered successful until both Redis west and Redis east are updated.
- After recovery, the pending change completes and downstream records reflect the recovered final state.
- No permanent divergence remains between redis.west.local and redis.east.local for ff-cp03-resilience.
- Repeating disruption and recovery with opposite state produces the same safe behavior.

## Post-conditions
- Ensure east Redis connectivity is fully restored.
- Ensure ff-cp03-resilience is returned to false.
- Clear temporary topic/log filters used for observation.

---
**Notes/Comments:**
- If your environment publishes interim or diagnostic events during retry windows, mark them separately from completed cross-DC change events.
- If strict timestamp comparisons are unreliable due to clock skew, use correlation fields and observed state transitions as the primary correctness signal.
- If disruption is only possible at network level, document the exact mechanism used for reproducibility.