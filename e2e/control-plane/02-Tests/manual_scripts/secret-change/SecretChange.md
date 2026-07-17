# CP-05 Secret Change Test

**Component:** Control-Plane, Api, Evaluation Server
**Status:** [Draft/Ready/Passed/Failed]

## Description
Validates that a secret change message is sent through the control plane to update Redis.

## Preconditions
- [ ] Start the Control-Plane QA deployment with one of the Quickstart powershell scripts
- [ ] If needed, run Start-PortForwards.ps1 from 01-Infrastructure/ (this depends on which quickstart script is used)
- [ ] East and West Clusters Running in Advanced mode with port forwards and host entries
- [ ] `playground` Organization Exists
- [ ] `control-plane-test` Project Exists

## Test Steps
1. **Action:** Connect to redis instances using a gui (Redis Insights, Another Redis Desktop Manager Etc.)
2. **Action:** Navigate to the featbit.west.local
3. **Action:** Login
4. **Action:** In the featbit ui, add a secret under an environment in the `control-plane-test` project.
5. **Action:** Navigate to featbit-main in kafka-ui
6. **Action:** Navigate to topics in kafka-ui under featbit-main
7. **Action:** Click `featbit-control-plane-secret-change`
8. **Action:** Click Messages
9. **Action:** Observe a secret change message with an operation of `add`
10. **Action:** Observe that the secret exists in redis.west.local
11. **Action:** Observe that the secret exists in redis.east.local

## Expected Results
- Redis in both east and west are updated.

## Post-conditions

---
**Notes/Comments:**
