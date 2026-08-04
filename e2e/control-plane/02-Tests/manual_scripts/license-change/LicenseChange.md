# CP-07 License Change Test

**Component:** Control-Plane, Api, Evaluation Server
**Status:** [Draft/Ready/Passed/Failed]

## Description
Validates that a license change message is sent through the control plane to update Redis.

## Preconditions
- [ ] Start the Control-Plane QA deployment with one of the Quickstart powershell scripts
- [ ] If needed, run Start-PortForwards.ps1 from 01-Infrastructure/ (this depends on which quickstart script is used)
- [ ] East and West Clusters Running in Advanced mode with port forwards and host entries
- [ ] `playground` Organization Exists
- [ ] `control-plane-test` Project Exists
- [ ] A valid Featbit license

## Test Steps
1. **Action:** Connect to redis instances using a gui (Redis Insights, Another Redis Desktop Manager Etc.)
2. **Action:** Navigate to the featbit.west.local
3. **Action:** Login
4. **Action:** In the featbit ui, update the license.
5. **Action:** Navigate to featbit-main in kafka-ui
6. **Action:** Navigate to topics in kafka-ui under featbit-main
7. **Action:** Click `featbit-control-plane-license-change`
8. **Action:** Click Messages
9. **Action:** Observe a license update message with the new license value
10. **Action:** Observe that the license update exists in redis.west.local
11. **Action:** Observe that the license update exists in redis.east.local

## Expected Results
- Redis in both east and west are updated

## Post-conditions

---
**Notes/Comments:**
