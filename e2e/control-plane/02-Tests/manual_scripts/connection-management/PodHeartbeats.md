# CP-09 Pod Heartbeats Test

 

**Component:** Control-Plane, Api, Evaluation Server
**Status:** [Draft/Ready/Passed/Failed]

 

## Description
Validates the `cp09-pod-heartbeats` lifecycle: evaluation-server pod heartbeats
are recorded in Redis, real WebSocket clients stay connected through k6, and
client connections migrate after a west pod failover.

 

## Preconditions
- [ ] Start the Control-Plane QA deployment with one of the Quickstart powershell scripts
- [ ] If needed, run Start-PortForwards.ps1 from 01-Infrastructure/ (this depends on which quickstart script is used)
- [ ] East and West Clusters Running in Advanced mode with port forwards and host entries
- [ ] `playground` Organization Exists
- [ ] `control-plane-test` Project Exists
- [ ] Optional k6 is installed for full WebSocket coverage (`Quickstart-*.ps1 -InstallK6` or `benchmark/install-k6.md`)

 

## Test Steps
1. **Action:** Connect to redis instances using a gui (Redis Insights, Another Redis Desktop Manager Etc.)
2. **Action:** Start real WebSocket clients with `benchmark\k6-scripts\cp09\cp09-connections.js` (`WEST_CLIENTS=10`, `EAST_CLIENTS=20`, valid `SERVER_SECRET`). The script defaults to the nginx active/active load balancer at `featbit-eval.local:80` so clients distribute across both clusters and reconnects naturally fail over to the surviving cluster when one pod dies.
3. **Action:** Keep the k6 run active while the pod heartbeat and failover checks execute
4. **Action:** Verify that the clients created in steps 2 and 3 are showing up in both west and east Redis (`featbit:connection:*`); roughly half on each cluster under round-robin
5. **Action:** Verify that the pod heartbeat is being recorded in redis
6. **Action:** Take down the west pod
7. **Action:** Wait at least 91 seconds or the length of the pod timeout that has been set
8. **Action:** Verify that the west pod's heartbeat has been removed from redis
9. **Action:** Verify that the east pod's heartbeat and connections are still in redis
10. **Action:** Verify that the clients that were connected to the west pod are now connected to the east pod
11. **Note:** The connections to the east pod will have a different heartbeat and connection id
12. **Action** Bring the west pod back up
13. **Action** Confirm k6 can open 10 west clients against the new instance of the west pod (with the LB-mode default, push fresh clients through `featbit-eval.local:80` and observe west `featbit:connection:*` keys reappearing as nginx re-adds the recovered upstream to round-robin)

 

## Expected Results
- When the pods are up we see the heart beat for the pod updated. The timestamp should be changed each time a new heartbeat comes in
- When a pod is taken down all of the connections should be purged and move over to the other pod
- When a pod comes back up we should see the heartbeat restored with a new pod id
- k6 emits `CP09_EVENT` lines for WebSocket opens, closes, reconnects, messages, and errors during the run

 

## Post-conditions

 

---
**Notes/Comments:** WebSocket assertions are gated on k6 being installed; install via `Quickstart-*.ps1 -InstallK6` or `benchmark/install-k6.md`.