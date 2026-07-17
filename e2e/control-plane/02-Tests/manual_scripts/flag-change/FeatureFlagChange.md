# CP-01 Feature Flag Change Test

**Component:** Control-Plane, Api, Evaluation Server
**Status:** [Draft/Ready/Passed/Failed]

## Description
A brief overview of the test case objective and what feature it validates.

## Preconditions
- [ ] Start the Control-Plane QA deployment with one of the Quickstart powershell scripts
- [ ] If needed, run Start-PortForwards.ps1 from 01-Infrastructure/ (this depends on which quickstart script is used)
- [ ] East and West Clusters Running in Advanced mode with port forwards and host entries
- [ ] `playground` Organization Exists
- [ ] `contorl-plane-test` Project Exists
- [ ] `test-west-1` Feature Flag Exists and is toggled off
- [ ] `test-east-1` Feature Flag Does Not Exist

## Test Steps
1. **Action:** Connect to redis instances using a gui (Redis Insights, Another Redis Desktop Manager Etc.)
2. **Action:** Navigate to featbit-kafka.west.local and featbit-kafka.east.local in two seperate browsers and a standard and incognito instance.
3. **Action:** Navigate to the featbit.west.local
4. **Action:** Login
5. **Action:** Naviagte to the control-plane-project
6. **Action:** Observe that the flag `test-west-1` is `false` in redis.west.local
7. **Action:** Observe that the flag `test-west-1` is `false` in redis.east.local
8. **Action:** In the featbit ui, toggle the test-west-1 flag to on
9. **Action:** Navigate to featbit-kafka.west.local
10. **Action:** Navigate to featbit-main in kafka-ui
11. **Action:** Navigate to topics in kafka-ui under featbit-main
12. **Action:** Click `featbit-control-plane-feature-flag-change`
13. **Action:** Click Messages
14. **Action:** Observe a Change message with isEnabled enabled set to true
15. **Action:** Observe that the flag is updated in redis.west.local
16. **Action:** Observe that the flag is updated in redis.east.local
17. **Action:** Return featbit-kafka.west.local
18. **Action:** Navigate to topics in kafka-ui under featbit-main
19. **Action:** Click `featbit-feature-flag-change`
20. **Action:** Click Messages
21. **Action:** Observe a Change message with isEnabled enabled set to true
22. **Action:** Navigate to featbit-kafka.west.local
23. **Action:** Navigate to featbit-aggregate in kafka-ui
24. **Action:** Navigate to topics in kafka-ui under featbit-aggregate
25. **Action:** Click `featbit-feature-flag-change`
26. **Action:** Click Messages
27. **Action:** Observe a Change message with isEnabled enabled set to true
28. **Action:** Navigate to featbit-kafka.east.local
29. **Action:** Navigate to featbit-aggregate in kafka-ui
30. **Action:** Navigate to topics in kafka-ui under featbit-aggregate
31. **Action:** Click `featbit-feature-flag-change`
32. **Action:** Click Messages
33. **Action:** Observe a Change message with isEnabled enabled set to true

## Expected Results
- Redis in both east and west are updated before the change message appears in the `featbit-feature-flag-change` topic
- After Redis is updated in both east and west, change messages should appear in the 
'featbit-feature-flag-change` topics in both east and west featbit-aggregate clusters.

## Post-conditions

---
**Notes/Comments:**
