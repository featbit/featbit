# CP-04 Segment Change Test

**Component:** Control-Plane, Api, Evaluation Server
**Status:** [Draft/Ready/Passed/Failed]

## Description
Validates that a segment change message is sent through the control plane to update Redis.

## Preconditions
- [ ] Start the Control-Plane QA deployment with one of the Quickstart powershell scripts
- [ ] If needed, run Start-PortForwards.ps1 from 01-Infrastructure/ (this depends on which quickstart script is used)
- [ ] East and West Clusters Running in Advanced mode with port forwards and host entries
- [ ] `playground` Organization Exists
- [ ] `control-plane-test` Project Exists

## Test Steps
1. **Action:** Connect to redis instances using a gui (Redis Insights, Another Redis Desktop Manager Etc.)
2. **Action:** Navigate to featbit-kafka.west.local and featbit-kafka.east.local in two seperate browsers and a standard and incognito instance.
3. **Action:** Navigate to the featbit.west.local
4. **Action:** Login
5. **Action:** In the featbit ui, create a segment
6. **Action:** Navigate to featbit-main in kafka-ui
7. **Action:** Navigate to topics in kafka-ui under featbit-main
8. **Action:** Click `featbit-control-plane-segment-change`
9. **Action:** Click Messages
10. **Action:** Observe a segment change message with an operation of `create`
11. **Action:** Observe that the segment exists in redis.west.local
12. **Action:** Observe that the segment exists in redis.east.local

## Expected Results
- Redis in both east and west are updated before the change message appears in the `featbit-segment-change` topic
- After Redis is updated in both east and west, change messages should appear in the 
'featbit-segment-change` topics in both east and west featbit-aggregate clusters.

## Post-conditions

---
**Notes/Comments:**
