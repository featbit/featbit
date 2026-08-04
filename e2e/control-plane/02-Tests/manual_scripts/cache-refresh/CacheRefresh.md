# CP-08 Control Plane API Full Sync

**Component:** Control-Plane, Api, Evaluation Server
**Status:** [Draft/Ready/Passed/Failed]

## Description
Validates that the Control-Plane API can push a full sync to the Evaluation Server and then down to each test application.

## Preconditions
- [ ] Start the Control-Plane QA deployment with one of the Quickstart powershell scripts
- [ ] If needed, run Start-PortForwards.ps1 from 01-Infrastructure/ (this depends on which quickstart script is used)
- [ ] East and West Clusters Running in Advanced mode with port forwards and host entries
- [ ] `playground` Organization Exists
- [ ] `control-plane-test` Project Exists
- [ ] `test-flag` Feature Flag Exists and is toggled on
- [ ] A test application is connected to the evaluation server using the `control-plane-test` project with the default logging level set to `Debug`.

## Test Steps
1. **Action:** Connect to redis instances using a gui (Redis Insights, Another Redis Desktop Manager Etc.)
2. **Action:** Send a POST request to the `api/admin/push-eval-full-sync` endpoint on the control plane.
3. **Action:** Navigate to featbit-main in kafka-ui
4. **Action:** Navigate to topics in kafka-ui under featbit-main
5. **Action:** Click `featbit-control-plane-command`
6. **Action:** Click Messages
7. **Action:** Observe a message is in the topic with an action of `PushFullSync`
8. **Action:** Observe through the test application logs that a `data-sync` message is received.

## Expected Results
- The test application receives a `data-sync` message when a request is made to the `api/admin/push-eval-full-sync` endpoint.

## Post-conditions

---
**Notes/Comments:**
