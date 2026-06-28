# FeatBit REST API E2E Test Script

This document is the human-readable fixed test script for testers and developers. It explains what is being tested, why each step exists, which API endpoints are used, and what assertions must pass.

The executable implementation is [featbit-rest-api-e2e.cs](./featbit-rest-api-e2e.cs). The recommended entry point is [run-featbit-rest-api-e2e.ps1](./run-featbit-rest-api-e2e.ps1).

The machine-readable checklist for this script is [test-manifest.json](./test-manifest.json).

## Test Objective

Verify that FeatBit REST APIs, feature flag mutation workflows, FeatBit .NET Server SDK evaluation/tracking, and the release-decision experiment analysis flow work together end to end in one environment.

After a successful live run, the test should produce:

- A created project `id` and `key`
- A created environment `id`, `key`, and Server SDK secret
- Creation, mutation, and verification records for 10 feature flags
- A release-decision experiment bound to a feature flag
- Primary metric and guardrail metric configuration records
- SDK evaluation, metric tracking, stats query, and analyze verification results
- A real Markdown report and JSON report generated from the live run

## Prerequisites

- Either a valid FeatBit OpenAPI access token, or local login credentials for `/api/v1/identity/login-by-email`
- The authenticated user/token has permission to create project/env/flag/segment/release-decision resources in the target workspace
- The target API, evaluation/event, and streaming services are reachable
- The local machine has .NET SDK installed and can restore `FeatBit.ServerSdk`
- For the Codex-agent topology cycle, the runner logs in as the seeded local
  test user and creates the project/environment through APIs. The tester only
  performs the final API/report review.

Default SaaS endpoints:

| Purpose | URL |
| --- | --- |
| API | `https://app-api.featbit.co` |
| SDK event/evaluation | `https://app-eval.featbit.co` |
| SDK streaming | `wss://app-eval.featbit.co` |

## Execution Command

Optional Swagger preflight:

```powershell
.\integration-tests\featbit-rest-api-e2e\run-featbit-rest-api-e2e.ps1 -OpenApiPreflight
```

The preflight fetches the target OpenAPI document and verifies that the project, environment, feature flag, and segment management endpoints used by this script are advertised. It is console-only and does not create a report. Release-decision and experiment-stats endpoints may be absent from the public SaaS Swagger; those endpoint contracts are verified through backend integration tests.

Live execution:

```powershell
.\integration-tests\featbit-rest-api-e2e\run-featbit-rest-api-e2e.ps1 `
  -AccessToken "<access-token>"
```

Local fixed-port service execution:

```powershell
.\integration-tests\featbit-rest-api-e2e\run-featbit-rest-api-e2e.ps1 `
  -LoginEmail test@featbit.com `
  -LoginPassword 123456 `
  -ApiUrl http://localhost:5000 `
  -EventUrl http://localhost:5100 `
  -StreamingUrl ws://localhost:5100 `
  -Users 1500 `
  -MinUsersPerVariant 500
```

Existing project/environment execution used by the Codex-agent skill:

```powershell
.\integration-tests\featbit-rest-api-e2e\run-featbit-rest-api-e2e.ps1 `
  -AccessToken "<access-token>" `
  -ProjectKey "<project-key>" `
  -EnvId "<environment-id>" `
  -ApiUrl http://localhost:5000 `
  -EventUrl http://localhost:5100 `
  -StreamingUrl ws://localhost:5100 `
  -Users 1500 `
  -MinUsersPerVariant 500
```

By default, the generated project is kept for inspection. Add `-Cleanup` only when the created project does not need to be retained:

```powershell
-Cleanup
```

## Test Data Naming

Live E2E runs use a fixed deterministic data set id, `fixed-v1`. The topology cycle clears the database before each run, so project, environment, segment, feature flag, user, and metric keys intentionally stay the same across every run.

Metric event keys use the fixed metric suffix `fixed_v1`.

Project:

| Field | Value |
| --- | --- |
| name | `E2E API Project fixed-v1` |
| key | `e2e-api-fixed-v1` |

Environment:

| Field | Value |
| --- | --- |
| name | `E2E Environment fixed-v1` |
| key | `e2e-env-fixed-v1` |

Segment:

| Field | Value |
| --- | --- |
| name | `E2E Segment fixed-v1` |
| key | `e2e-segment-fixed-v1` |
| type | `environment-specific` |
| scope | `organization/{organizationKey}:project/{projectKey}:env/{envKey}` |
| included users | `e2e-user-0000`, `e2e-user-0001`, and `e2e-user-0003` |

## Feature Flag Catalog

| No. | Key | Type | Purpose |
| --- | --- | --- | --- |
| 1 | `rd-checkout-treatment-fixed-v1` | `boolean` | Release-decision experiment flag with control/treatment variants |
| 2 | `rd-banner-copy-fixed-v1` | `string` | Banner copy experiment-style flag |
| 3 | `rd-price-multiplier-fixed-v1` | `number` | Numeric parameter flag |
| 4 | `rd-checkout-config-fixed-v1` | `json` | JSON configuration flag |
| 5 | `rd-onboarding-flow-fixed-v1` | `string` | Flow selection flag |
| 6 | `rd-risk-threshold-fixed-v1` | `number` | Risk threshold flag |
| 7 | `rd-ai-assistant-route-fixed-v1` | `string` | AI routing flag |
| 8 | `rd-notification-style-fixed-v1` | `string` | Notification style flag |
| 9 | `rd-search-ranking-fixed-v1` | `string` | Search ranking flag |
| 10 | `rd-kill-switch-fixed-v1` | `boolean` | Kill switch flag |

## Expected Final State

This section defines the expected state after all mutations, SDK seeding, stats queries, and analysis complete.

### Segment Final State

| Field | Expected value |
| --- | --- |
| key | `e2e-segment-fixed-v1` |
| scope | `organization/{organizationKey}:project/{projectKey}:env/{envKey}` |
| included users | `e2e-user-0000`, `e2e-user-0001`, and `e2e-user-0003` |
| excluded users | empty |
| rules | empty |
| references | All 9 non-experiment flags reference this segment; the release-decision experiment flag does not reference this segment |

### Feature Flag Final State

Dynamic variation IDs are generated at runtime. The table below names variations by final name and value.

| No. | Key | Type | Final enabled | Final variants | Final rule | Final traffic / fallthrough | Experimentation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `rd-checkout-treatment-fixed-v1` | `boolean` | `true` | `control=false`; `treatment=true` | No targeting rule | fallthrough `control` 50%, `treatment` 50%; `includedInExpt=true`; `exptIncludeAllTargets=true` | Bound to the release-decision experiment |
| 2 | `rd-banner-copy-fixed-v1` | `string` | `false` | `control-updated=control`; `candidate-1-updated=short`; `candidate-2-updated=direct`; `candidate-updated=candidate` | `User is in segment IsOneOf [segmentId]` serves first variation at 100% | fallthrough first variation 100%; `includedInExpt=true`; `exptIncludeAllTargets=true` | Not bound to release-decision |
| 3 | `rd-price-multiplier-fixed-v1` | `number` | `true` | `control-updated=1.0`; `candidate-1-updated=1.1`; `candidate-2-updated=1.2`; `candidate-updated=2.5` | `User is in segment IsOneOf [segmentId]` serves first variation at 100% | fallthrough first variation 100%; `includedInExpt=true`; `exptIncludeAllTargets=true` | Not bound to release-decision |
| 4 | `rd-checkout-config-fixed-v1` | `json` | `false` | `control-updated={"mode":"control","limit":5}`; `candidate-1-updated={"mode":"treatment","limit":10}`; `candidate-updated={"mode":"candidate","limit":15}` | `User is in segment IsOneOf [segmentId]` serves first variation at 100% | fallthrough first variation 100%; `includedInExpt=true`; `exptIncludeAllTargets=true` | Not bound to release-decision |
| 5 | `rd-onboarding-flow-fixed-v1` | `string` | `true` | `control-updated=classic`; `candidate-1-updated=guided`; `candidate-2-updated=compact`; `candidate-updated=candidate` | `User is in segment IsOneOf [segmentId]` serves first variation at 100% | fallthrough first variation 100%; `includedInExpt=true`; `exptIncludeAllTargets=true` | Not bound to release-decision |
| 6 | `rd-risk-threshold-fixed-v1` | `number` | `false` | `control-updated=10`; `candidate-1-updated=25`; `candidate-2-updated=50`; `candidate-updated=2.5` | `User is in segment IsOneOf [segmentId]` serves first variation at 100% | fallthrough first variation 100%; `includedInExpt=true`; `exptIncludeAllTargets=true` | Not bound to release-decision |
| 7 | `rd-ai-assistant-route-fixed-v1` | `string` | `true` | `control-updated=off`; `candidate-1-updated=gpt-4.1-mini`; `candidate-2-updated=gpt-4.1`; `candidate-updated=candidate` | `User is in segment IsOneOf [segmentId]` serves first variation at 100% | fallthrough first variation 100%; `includedInExpt=true`; `exptIncludeAllTargets=true` | Not bound to release-decision |
| 8 | `rd-notification-style-fixed-v1` | `string` | `false` | `control-updated=quiet`; `candidate-1-updated=badge`; `candidate-2-updated=toast`; `candidate-updated=candidate` | `User is in segment IsOneOf [segmentId]` serves first variation at 100% | fallthrough first variation 100%; `includedInExpt=true`; `exptIncludeAllTargets=true` | Not bound to release-decision |
| 9 | `rd-search-ranking-fixed-v1` | `string` | `true` | `control-updated=baseline`; `candidate-1-updated=semantic`; `candidate-2-updated=hybrid`; `candidate-updated=candidate` | `User is in segment IsOneOf [segmentId]` serves first variation at 100% | fallthrough first variation 100%; `includedInExpt=true`; `exptIncludeAllTargets=true` | Not bound to release-decision |
| 10 | `rd-kill-switch-fixed-v1` | `boolean` | `false` | `control-updated=false`; `treatment-updated=true` | `User is in segment IsOneOf [segmentId]` serves first variation at 100% | fallthrough first variation 100%; `includedInExpt=true`; `exptIncludeAllTargets=true` | Not bound to release-decision |

### Detailed Rule And Traffic Contracts

Dynamic variation IDs are discovered during the live run. The contract below defines which generated ID must be used in each rule and rollout.

| Scope | Expected rule contract | Expected rule traffic | Expected fallthrough traffic | Experiment targeting flags |
| --- | --- | --- | --- | --- |
| Experiment flag `rd-checkout-treatment-fixed-v1` | `rules = []` | No targeting-rule traffic; experiment assignment comes only from fallthrough | `fallthrough.includedInExpt = true`; `fallthrough.variations[0].id = controlVariationId`; `rollout = [0, 0.5]`; `exptRollout = 0.5`; `fallthrough.variations[1].id = treatmentVariationId`; `rollout = [0.5, 1]`; `exptRollout = 0.5` | `exptIncludeAllTargets = true`; release-decision experiment `flagKey` equals this flag |
| Every non-experiment flag | `rules[0].conditions[0].property = "User is in segment"`; `op = "IsOneOf"`; `value` contains the real generated `[segmentId]` | `rules[0].includedInExpt = true`; `rules[0].variations[0].id = firstVariationId`; `rollout = [0, 1]`; `exptRollout = 1` | `fallthrough.includedInExpt = true`; one fallthrough variation using `firstVariationId`; `rollout = [0, 1]`; `exptRollout = 1` | `exptIncludeAllTargets = true`; not bound to the release-decision experiment |

### Detailed Evaluation, Insight, And Metric Data Contract

Live runs use the configured `--users` synthetic-user seed budget and the configured `--min-users-per-variant` sample floor. The wrapper defaults are documented in README options, but this test script does not treat either value as an expected exact variant size. User keys are fixed as `e2e-user-0000` through `e2e-user-1499` for the default 1500-user run. Synthetic user attributes are deterministic: `plan = "enterprise"` when `index % 3 == 0`, otherwise `plan = "free"`; `country = "US"` for even indexes and `"FR"` for odd indexes. Segment rule coverage uses the real generated segment, not the `plan` attribute.

| Phase | Expected data |
| --- | --- |
| Pre-seed public evaluation verification | Evaluate all 10 flags for users `e2e-user-0000` and `e2e-user-0001`, then evaluate all 9 non-experiment flags for `e2e-user-0003` through `POST /api/public/featureflag/evaluate`. Expected evaluation count is at least `29`. User 3 is included in the generated segment and must evaluate every non-experiment flag to the current first variation through the segment rule. These calls must not create release-decision insight events. |
| Experiment traffic assignment | The main run uses the current v6.0.0 run traffic payload: `controlVariant`, `treatmentVariant`, `assignmentUnitSelector = user.keyId`, `layerTrafficPercent = 100`, and an `analysisSamplingPlan` that includes both actual served variations at `100%`. Additional traffic-assignment scenarios each create their own feature flag, release-decision experiment, run, metric event, and observation window. Every run window defaults to `2026-06-15T00:00:00Z` through `2026-06-28T23:59:59Z`. |
| Preset insight seeding | The runner computes deterministic served assignments from the fixed flag key plus fixed user keys. It writes every raw exposure assignment through `POST /api/public/insight/track` with explicit timestamps inside the default run window. Metric events are generated only for the deterministic users that the configured run layer and sampling plan will include in analysis. Events are spread across five days starting `2026-06-16T00:00:00Z`, with metric events offset from their exposure event. |
| Exposure data | Experiment stats for `rd-checkout-treatment-fixed-v1` must include rows for both `controlVariationId` and `treatmentVariationId`. FeatBit rollout hashing decides the exact split from the fixed flag key plus fixed user keys, and both variants must meet the configured `--min-users-per-variant` floor. |
| Primary metric data | Binary `once` metric. Based on the exact users assigned by FeatBit, the runner seeds `Round(controlUsers * 0.30)` control conversions and `Round(treatmentUsers * 0.45)` treatment conversions. Manual acceptance: both variant user counts meet the configured sample floor, observed conversion counts equal those deterministic targets, and treatment conversion rate is greater than control. |
| Error guardrail data | Binary `once` metric. Based on the exact users assigned by FeatBit, the runner seeds `Round(controlUsers * 0.018)` control errors and `Round(treatmentUsers * 0.020)` treatment errors. Manual acceptance: both variant user counts meet the configured sample floor, observed error counts equal those deterministic targets, and both error rates are below `5.00%`. |
| Latency guardrail data | Continuous `average` metric. The runner seeds one deterministic latency value per assigned user: control `340ms`, treatment `320ms`. Manual acceptance: both variant user counts meet the configured sample floor, observed averages equal those deterministic values, and treatment average latency is no higher than control. |

### Traffic-Assignment Scenario Contract

After the main experiment run is analyzed, the runner creates independent release-decision experiments for the scenarios below. Each scenario gets its own feature flag, experiment id, run id, primary metric event, synthetic user key prefix, and the default preset observation window. No-layer scenarios intentionally omit `layerKey` and `layerTrafficPercent` from the run payload.

Scenario seed data is ingested through `POST /api/public/insight/track` with explicit timestamps inside the preset window. Dedicated scenario flags determine actual served variations through the same fixed rollout hashing used by FeatBit fallthrough rollout, and persisted release-decision exposure and metric timestamps are fixed so manual UI analysis uses the same window every run.

For the default `--users 1500` run, exact raw assignment counts are determined by FeatBit rollout hashing. Sampled-control scenarios still seed the full raw exposure population; the runner precomputes the deterministic subset that is eligible under the run's layer and sampling hash so repeated E2E runs produce the same analyzed metric counts.

| Scenario | Flag serving split | Run sampling | Layer eligibility | Default expected analyzed users | Conversion expectation |
| --- | --- | --- | --- | --- | --- |
| No layer `50/50 -> use all` | control 50%, treatment 50% | control 100%, treatment 100% | none | roughly 750 control and 750 treatment; each must meet `--min-users-per-variant` | control conversions = `Round(controlUsers * 0.30)`; treatment conversions = `Round(treatmentUsers * 0.45)` |
| No layer `90/10 -> 10/10` | control 90%, treatment 10% | control 11.111111%, treatment 100% | none | roughly 150 sampled control users and roughly 150 treatment users; control/treatment ratio must be between 0.5 and 2.0 | control conversions = `Round(controlUsers * 0.30)`; treatment conversions = `Round(treatmentUsers * 0.45)` |
| Layer `30% + 34/33/33` | control 34%, treatment1 33%, treatment2 33% | all variants 100% | 30% | roughly 150 users per arm from the eligible layer slice | control conversions = `Round(controlUsers * 0.30)`; treatment conversions = `Round(treatmentUsers * 0.45)` for each treatment arm |
| Layer `30% + 80/20 -> 20/20` | control 80%, treatment 20% | control 22.222222%, treatment 100% | 30% | roughly 90 sampled control users and roughly 90 treatment users; ratio must be between 0.5 and 2.0 | control conversions = `Round(controlUsers * 0.30)`; treatment conversions = `Round(treatmentUsers * 0.45)` |

Manual acceptance for every scenario:

- The runner creates a non-empty `experimentId` and `runId` dedicated to that scenario.
- The scenario experiment is bound to a feature flag key that is unique to that scenario.
- The scenario primary metric key is unique and starts with `e2e_{scenario_id}_activated_`, where the scenario id is normalized to underscores.
- `POST /api/v1/envs/{envId}/experiment-stats/query` returns the configured control and treatment variation ids for that scenario.
- Observed conversion counts exactly match the deterministic formulas in the table above.
- The analyze API writes non-empty `inputData` containing the scenario metric event and non-empty `analysisResult`.

### Expected Insight And Stats Data

| Data | Expected result |
| --- | --- |
| Public evaluation | Pre-experiment verification evaluates all 10 flags for representative users without writing insight events. |
| Insight ingest | The runner posts preset-timestamp raw exposure events for every synthetic assignment and metric events for the deterministic analysis-included users to `POST /api/public/insight/track`. |
| Experiment exposure stats | `POST /api/v1/envs/{envId}/experiment-stats/query` returns users for both `control` and `treatment` variation IDs of `rd-checkout-treatment-fixed-v1`. Each variant must meet the configured sample floor shown in the report. |
| Primary metric | `e2e_checkout_activated_fixed_v1` is binary/once. Expected result: use the exact control/treatment users and conversions from the report; control conversions equal `Round(controlUsers * 0.30)`, treatment conversions equal `Round(treatmentUsers * 0.45)`, and treatment rate must be greater than control. |
| Error guardrail | `e2e_checkout_error_fixed_v1` is binary/once. Expected result: use the exact control/treatment users and error counts from the report; control errors equal `Round(controlUsers * 0.018)`, treatment errors equal `Round(treatmentUsers * 0.020)`, and both rates must stay below the `5.00%` threshold. |
| Latency guardrail | `e2e_checkout_latency_ms_fixed_v1` is continuous/average. Expected result: use the exact control/treatment users, sums, and averages from the report; control average equals `340ms`, treatment average equals `320ms`, and treatment must be faster. |
| Traffic-assignment scenario metrics | Scenario flag keys, metric keys, and preset observation windows are unique per scenario, for example `rd-e2e-scenario-skewed-90-10-to-10-10-fixed-v1` and `e2e_skewed_90_10_to_10_10_activated_fixed_v1`. Expected result: each scenario report row shows its dedicated flag key, experiment id, run id, sampled control/treatment users, and conversions equal to `Round(users * configuredScenarioRate)`. |

### Expected Analyze Result

| Field | Expected result |
| --- | --- |
| run status | `analyzing` after `POST /api/v1/envs/{envId}/release-decision/experiments/{id}/runs/{runId}/analyze` when samples are present |
| `inputData` | non-empty JSON. It must contain a top-level `metrics` object with entries for `e2e_checkout_activated_fixed_v1`, `e2e_checkout_error_fixed_v1`, and `e2e_checkout_latency_ms_fixed_v1`. Each metric entry must contain non-empty variant data keyed by the generated control/treatment variation ids or equivalent variant keys produced by the stats service. |
| `analysisResult` | non-empty JSON generated by the release-decision analyzer. The script does not hardcode a specific statistical posterior value, but it requires the analyzer to return structured output rather than an empty string/null. |
| final experiment binding | experiment `flagKey` remains `rd-checkout-treatment-fixed-v1` |
| final flag verification | all 10 generated flags still exist and match the expected final enabled state, variants, rule state, rule traffic, fallthrough traffic, `includedInExpt`, `exptIncludeAllTargets`, and variation type from the Feature Flag Final State table |

## Test Steps

### 0. Create Project And Environment

Purpose: create an isolated test area and record the project/environment identifiers used by all later steps.

API:

| Action | Endpoint |
| --- | --- |
| Create project | `POST /api/v1/projects` |
| Create environment | `POST /api/v1/projects/{projectId}/envs` |
| Read project | `GET /api/v1/projects/{projectId}` |

Assertions:

- Project creation succeeds and returns a non-empty `projectId`
- Environment creation succeeds and returns a non-empty `envId`
- The environment has a Server SDK secret
- Reading the project shows the newly created environment

Records:

- `projectId`
- `projectKey`
- `envId`
- `envKey`
- Masked Server SDK secret

### 1. Create 10 Feature Flags

Purpose: cover boolean, string, number, and json variation types, and create the objects used by later mutation and experiment-analysis steps.

API:

| Action | Endpoint |
| --- | --- |
| Create flag | `POST /api/v1/envs/{envId}/feature-flags` |
| Read flag | `GET /api/v1/envs/{envId}/feature-flags/{key}` |

Assertions:

- All 10 flags are created successfully
- Every flag `key` matches the catalog in this script
- Every flag `variationType` matches the catalog in this script
- Every flag has at least two variations: control and treatment/candidate

### 2. Create Segment And Mutate Flags

Purpose: verify common management operations, including real segment creation, segment references from feature flag rules, enable/disable toggles, description updates, tags, and variant changes.

API:

| Action | Endpoint |
| --- | --- |
| Create segment | `POST /api/v1/envs/{envId}/segments` |
| Update segment targeting | `PUT /api/v1/envs/{envId}/segments/{segmentId}/targeting` |
| Read segment | `GET /api/v1/envs/{envId}/segments/{segmentId}` |
| Update flag description | `PUT /api/v1/envs/{envId}/feature-flags/{key}/description` |
| Update flag tags | `PUT /api/v1/envs/{envId}/feature-flags/{key}/tags` |
| Toggle flag | `PUT /api/v1/envs/{envId}/feature-flags/{key}/toggle/{status}` |
| Update variations | `PUT /api/v1/envs/{envId}/feature-flags/{key}/variations` |
| Update targeting/rules | `PUT /api/v1/envs/{envId}/feature-flags/{key}/targeting` |
| Read flag | `GET /api/v1/envs/{envId}/feature-flags/{key}` |
| Query segment references | `GET /api/v1/envs/{envId}/segments/{segmentId}/flag-references` |
| Query segment list | `GET /api/v1/envs/{envId}/segments?name=&isArchived=false&pageIndex=0&pageSize=100` |

Assertions:

- Segment creation succeeds and returns a non-empty `segmentId`
- Segment included users match the three deterministic users exactly, excluded users are empty, and segment rules are empty
- Segment scope matches the product resource scope and the segment list endpoint returns the generated segment
- Every flag description is changed and verified by a read-after-write API call
- Every flag contains the tags `e2e`, `release-decision`, and its own variation type
- Every flag enabled/disabled state matches the test runner expectation
- Non-experiment flag variation updates are meaningfully changed and remain valid for their variation type
- The experiment flag keeps its `control` and `treatment` variation names/values so release-decision analysis can bind the expected variants
- The experiment flag has no targeting rules and uses 50/50 fallthrough traffic
- Every non-experiment flag targeting contains a `User is in segment IsOneOf [segmentId]` rule whose `segmentId` is the real generated segment
- Segment flag references include all 9 non-experiment flags and do not include the release-decision experiment flag

### 3. Batch Verification

Purpose: after each mutation batch, read the server-side model through API calls to verify the persisted state, instead of only trusting write API responses.

API:

| Action | Endpoint |
| --- | --- |
| Read flag | `GET /api/v1/envs/{envId}/feature-flags/{key}` |
| Query segment references | `GET /api/v1/envs/{envId}/segments/{segmentId}/flag-references` |

Assertions:

- Flag key/type/status/tags/variations/targeting match the expected state
- Experiment flag fallthrough traffic is 50/50 and has no targeting rules
- Non-experiment targeting rules reference the real segment
- Segment references match the non-experiment targeting changes

### 4. Evaluate And Track Through FeatBit .NET SDK

Purpose: verify that flag configuration written by management APIs can be fetched and evaluated by the SDK, and that exposure/metric events can be sent through the SDK.

SDK:

| Type | SDK Call |
| --- | --- |
| boolean | `BoolVariationDetail` |
| string/json | `StringVariationDetail` |
| number | `DoubleVariationDetail` |
| binary metric | `Track(user, eventName)` |
| continuous metric | `Track(user, eventName, numericValue)` |
| flush | `FlushAndWait` |

Event ingest endpoint used by the SDK:

| Action | Endpoint |
| --- | --- |
| Flush SDK insights | `POST /api/public/insight/track` |

Assertions:

- SDK client initializes successfully
- SDK evaluation completes for all 10 flags
- Evaluation detail contains variation information
- A synthetic user included in the generated segment evaluates each non-experiment flag to the expected first variation
- SDK evaluation events are flushed
- Metric tracking happens later in Step 7 after the experiment run and metrics are configured

### 5. Create Release-Decision Experiment

Purpose: verify that release-decision APIs can create an experiment and bind it to the boolean treatment flag created earlier.

API:

| Action | Endpoint |
| --- | --- |
| Create experiment | `POST /api/v1/envs/{envId}/release-decision/experiments` |
| Update experiment details | `PUT /api/v1/envs/{envId}/release-decision/experiments/{id}` |
| Read experiment | `GET /api/v1/envs/{envId}/release-decision/experiments/{id}` |

Fields:

- intent
- hypothesis
- change
- constraints
- environment secret
- flag server URL
- bound feature flag key
- control/treatment variation

Assertions:

- Experiment creation succeeds and returns a non-empty `experimentId`
- intent/hypothesis/change/constraints can be read back
- The experiment is bound to `rd-checkout-treatment-fixed-v1`
- Control/treatment variations are preserved

### 6. Configure Primary And Guardrail Metrics

Purpose: verify release-decision metric configuration and cover multiple metric types.

API:

| Action | Endpoint |
| --- | --- |
| Update metrics | `PUT /api/v1/envs/{envId}/release-decision/experiments/{id}/metrics` |
| Read experiment | `GET /api/v1/envs/{envId}/release-decision/experiments/{id}` |

Metrics:

| Role | Key | Type | Aggregation |
| --- | --- | --- | --- |
| Primary | `e2e_checkout_activated_fixed_v1` | binary | conversion / once |
| Guardrail | `e2e_checkout_error_fixed_v1` | binary | conversion / once |
| Guardrail | `e2e_checkout_latency_ms_fixed_v1` | continuous | average |

Assertions:

- Primary metric exists and has the expected key/type
- At least two guardrail metrics exist
- Guardrails cover both binary and continuous metrics

### 7. Create Run And Seed Evaluation/Metric Data

Purpose: create an experiment run and automatically generate exposure and metric evidence through the SDK.

API:

| Action | Endpoint |
| --- | --- |
| Create run | `POST /api/v1/envs/{envId}/release-decision/experiments/{id}/runs` |
| Update run | `PUT /api/v1/envs/{envId}/release-decision/experiments/{id}/runs/{runId}` |
| Update experiment traffic assignment | `PUT /api/v1/envs/{envId}/release-decision/experiments/{id}/runs/{runId}/audience` |
| Update observation window | `PUT /api/v1/envs/{envId}/release-decision/experiments/{id}/runs/{runId}/observation-window` |
| Query stats | `POST /api/v1/envs/{envId}/experiment-stats/query` |

Data setup:

- Generate the configured number of synthetic users
- Configure run traffic with actual served control/treatment variation ids and `100%` per-variation include rates
- Require each control/treatment variant to meet the configured sample floor
- Treatment primary metric success rate is intentionally higher than control
- Binary guardrail failure rate remains controlled
- Continuous guardrail latency should not show severe regression

Assertions:

- Run creation succeeds and returns a non-empty `runId`
- Run traffic assignment accepts the v6.0.0 payload shape
- Primary stats query returns samples after SDK evaluation/tracking
- Treatment primary conversion rate is higher than control
- Binary guardrail stats query returns samples
- Continuous guardrail stats query returns samples and numeric values

### 8. Call Analyze

Purpose: verify that the release-decision analysis endpoint can generate an analysis result from collected data.

API:

| Action | Endpoint |
| --- | --- |
| Analyze run | `POST /api/v1/envs/{envId}/release-decision/experiments/{id}/runs/{runId}/analyze` |
| Read experiment | `GET /api/v1/envs/{envId}/release-decision/experiments/{id}` |

Assertions:

- Analyze API returns success
- The run has generated or updated `inputData`
- The run has generated or updated `analysisResult`

### 9. Traffic-Assignment Scenario Runs

Purpose: verify the v6.0.0 run traffic model against independent experiments, rather than relying only on the main balanced experiment.

For each scenario listed in the Traffic-Assignment Scenario Contract:

- Create a feature flag dedicated to that scenario.
- Update that scenario flag fallthrough split for the scenario.
- Create a new release-decision experiment bound to that scenario flag.
- Configure a scenario-specific primary metric event.
- Create a new run and set its observation window to the scenario's preset seed window.
- Configure `controlVariant`, `treatmentVariant`, optional layer fields, and `analysisSamplingPlan`.
- Evaluate scenario-specific synthetic users through the SDK, then ingest scenario-specific exposure and metric events with timestamps inside the preset window.
- Query experiment stats, retrying briefly for asynchronous insight persistence, then assert the expected sampled users and deterministic conversions.
- Analyze the run and assert non-empty `inputData` and `analysisResult`.

Assertions:

- No-layer `50/50 -> use all` returns both variants with enough users and deterministic conversions.
- No-layer `90/10 -> 10/10` does not analyze the full raw 90% control population; sampled control and treatment counts must be in the same order of magnitude.
- Layer `30% + 34/33/33` analyzes only the eligible layer slice and keeps both treatment arms as separate observed variants.
- Layer `30% + 80/20 -> 20/20` samples 22.222222% of control and 100% of treatment inside the eligible layer slice, producing roughly balanced analysis evidence.

Remaining future scenarios not covered by this script:

- Duplicate exposure/metric events.
- Custom assignment unit selector with missing-property exclusion.

### 10. Final Verification

Purpose: confirm that the final state matches the expected test design.

API:

| Action | Endpoint |
| --- | --- |
| Read experiment | `GET /api/v1/envs/{envId}/release-decision/experiments/{id}` |
| Query stats | `POST /api/v1/envs/{envId}/experiment-stats/query` |
| Read flag | `GET /api/v1/envs/{envId}/feature-flags/{key}` |

Assertions:

- Project/environment ids and keys are written to the report
- All 10 flags still exist
- All 10 flags have the expected final enabled state
- All 10 flags have the expected final variants
- The experiment flag has no targeting rules
- The 9 non-experiment flags have the expected final rule condition
- All 10 flags have the expected rule traffic, fallthrough traffic, `includedInExpt`, and `exptIncludeAllTargets`
- The release-decision experiment is bound to the expected flag
- Primary metric direction matches the preset: treatment performs better than control
- Binary and continuous guardrail metrics contain data
- Analyze run status is `analyzing`
- Analyze `inputData` contains the primary metric, binary guardrail, and continuous guardrail event keys
- Analyze result exists
- The report does not print the access token or Server SDK secret in plain text

### 10.1 Manual Final Inspection Checklist

Use this checklist after a live run. The Markdown report is the primary artifact to inspect first; API reads can be used to cross-check any row that looks wrong.

#### Resource Identity

| Check | Where to look | Expected value |
| --- | --- | --- |
| Project identity | Live report `Resources` section, or `GET /api/v1/projects/{projectId}` | `projectId` is non-empty; `projectKey = e2e-api-fixed-v1` unless using tester-provided project key |
| Environment identity | Live report `Resources` section, or project detail API response | `envId` is non-empty; `envKey = e2e-env-fixed-v1` unless using tester-provided environment |
| Segment identity | Live report `Resources` section, or `GET /api/v1/envs/{envId}/segments/{segmentId}` | `segmentId` is non-empty; `segmentKey = e2e-segment-fixed-v1` |
| Segment list visibility | `GET /api/v1/envs/{envId}/segments?name=&isArchived=false&pageIndex=0&pageSize=100` | List contains `segmentKey = e2e-segment-fixed-v1` |
| Experiment identity | Live report `Resources` section, or `GET /api/v1/envs/{envId}/release-decision/experiments/{id}` | `experimentId` is non-empty; experiment is bound to `rd-checkout-treatment-fixed-v1` |
| Run identity | Live report `Resources` section, or experiment detail API response | `runId` is non-empty and belongs to the created experiment |
| Secret handling | Live report body | Access token and Server SDK secret are masked; full raw secrets are not printed |

#### Segment Targeting

| Check | Where to look | Expected value |
| --- | --- | --- |
| Included users | Live report `Resources` / step details, or segment API response | Exactly `e2e-user-0000`, `e2e-user-0001`, and `e2e-user-0003` |
| Scope | Live report `Resources` / step details, or segment API response | `organization/{organizationKey}:project/{projectKey}:env/{envKey}` |
| Excluded users | Segment API response | Empty |
| Segment rules | Segment API response | Empty |
| Segment references | `GET /api/v1/envs/{envId}/segments/{segmentId}/flag-references` | Includes all 9 non-experiment flags; does not include `rd-checkout-treatment-fixed-v1` |

#### Feature Flag Terminal State

| No. | Key | Human check |
| --- | --- | --- |
| 1 | `rd-checkout-treatment-fixed-v1` | Enabled is `true`; variants are exactly `control=false` and `treatment=true`; there are no targeting rules; fallthrough splits `control` 50% and `treatment` 50%; `includedInExpt=true`; `exptIncludeAllTargets=true`; this is the only flag bound to release-decision. |
| 2 | `rd-banner-copy-fixed-v1` | Enabled is `false`; variants are `control-updated=control`, `candidate-1-updated=short`, `candidate-2-updated=direct`, `candidate-updated=candidate`; rule is `User is in segment IsOneOf [segmentId]`; rule and fallthrough serve the first variation 100%; experiment targeting flags are true; not bound to release-decision. |
| 3 | `rd-price-multiplier-fixed-v1` | Enabled is `true`; variants are `control-updated=1.0`, `candidate-1-updated=1.1`, `candidate-2-updated=1.2`, `candidate-updated=2.5`; rule is `User is in segment IsOneOf [segmentId]`; rule and fallthrough serve the first variation 100%; experiment targeting flags are true; not bound to release-decision. |
| 4 | `rd-checkout-config-fixed-v1` | Enabled is `false`; variants are `control-updated={"mode":"control","limit":5}`, `candidate-1-updated={"mode":"treatment","limit":10}`, `candidate-updated={"mode":"candidate","limit":15}`; rule is `User is in segment IsOneOf [segmentId]`; rule and fallthrough serve the first variation 100%; experiment targeting flags are true; not bound to release-decision. |
| 5 | `rd-onboarding-flow-fixed-v1` | Enabled is `true`; variants are `control-updated=classic`, `candidate-1-updated=guided`, `candidate-2-updated=compact`, `candidate-updated=candidate`; rule is `User is in segment IsOneOf [segmentId]`; rule and fallthrough serve the first variation 100%; experiment targeting flags are true; not bound to release-decision. |
| 6 | `rd-risk-threshold-fixed-v1` | Enabled is `false`; variants are `control-updated=10`, `candidate-1-updated=25`, `candidate-2-updated=50`, `candidate-updated=2.5`; rule is `User is in segment IsOneOf [segmentId]`; rule and fallthrough serve the first variation 100%; experiment targeting flags are true; not bound to release-decision. |
| 7 | `rd-ai-assistant-route-fixed-v1` | Enabled is `true`; variants are `control-updated=off`, `candidate-1-updated=gpt-4.1-mini`, `candidate-2-updated=gpt-4.1`, `candidate-updated=candidate`; rule is `User is in segment IsOneOf [segmentId]`; rule and fallthrough serve the first variation 100%; experiment targeting flags are true; not bound to release-decision. |
| 8 | `rd-notification-style-fixed-v1` | Enabled is `false`; variants are `control-updated=quiet`, `candidate-1-updated=badge`, `candidate-2-updated=toast`, `candidate-updated=candidate`; rule is `User is in segment IsOneOf [segmentId]`; rule and fallthrough serve the first variation 100%; experiment targeting flags are true; not bound to release-decision. |
| 9 | `rd-search-ranking-fixed-v1` | Enabled is `true`; variants are `control-updated=baseline`, `candidate-1-updated=semantic`, `candidate-2-updated=hybrid`, `candidate-updated=candidate`; rule is `User is in segment IsOneOf [segmentId]`; rule and fallthrough serve the first variation 100%; experiment targeting flags are true; not bound to release-decision. |
| 10 | `rd-kill-switch-fixed-v1` | Enabled is `false`; variants are `control-updated=false` and `treatment-updated=true`; rule is `User is in segment IsOneOf [segmentId]`; rule and fallthrough serve the first variation 100%; experiment targeting flags are true; not bound to release-decision. |

#### SDK Evaluation And Insight Evidence

| Check | Where to look | Expected value |
| --- | --- | --- |
| Pre-experiment evaluation count | Live report SDK section | At least `29` detail evaluations: 10 flags for user 0, 10 flags for user 1, and 9 non-experiment flags for user 3 |
| Segment rule hits | Live report SDK section | User `e2e-user-0003` evaluates every non-experiment flag to the first variation because that user is included in the generated segment |
| Seeded SDK evaluations | Live report insight/stats section | Logical evaluations are `configured --users` for the experiment flag |
| Insight ingest | Live report step results, SDK event service logs, or network traces | SDK events are flushed to `POST /api/public/insight/track` without an error |
| Exposure stats | Live report stats section, or `POST /api/v1/envs/{envId}/experiment-stats/query` | Both generated control and treatment variation IDs have observed users. Compare the exact control/treatment counts shown in the report against the configured sample floor. |

#### Metric Evidence

| Metric | Where to look | Expected data and manual interpretation |
| --- | --- | --- |
| Primary: `e2e_checkout_activated_fixed_v1` | Live report stats/analyze section, or experiment stats query | Binary `once` metric. Expected data: exact users and conversions come from the report; each variant meets the configured sample floor; control conversions equal `Round(controlUsers * 0.30)`; treatment conversions equal `Round(treatmentUsers * 0.45)`; treatment conversion rate must be greater than control. |
| Guardrail: `e2e_checkout_error_fixed_v1` | Live report stats/analyze section, or experiment stats query | Binary `once` metric. Expected data: exact users and error counts come from the report; each variant meets the configured sample floor; control errors equal `Round(controlUsers * 0.018)`; treatment errors equal `Round(treatmentUsers * 0.020)`; both rates must be below the `5.00%` threshold. |
| Guardrail: `e2e_checkout_latency_ms_fixed_v1` | Live report stats/analyze section, or experiment stats query | Continuous `average` metric. Expected data: exact users, sums, and averages come from the report; each variant meets the configured sample floor; control average equals `340ms`; treatment average equals `320ms`; treatment average must be no higher than control. |

#### Experiment And Analyze Result

| Check | Where to look | Expected value |
| --- | --- | --- |
| Experiment mode | Experiment detail in report or API response | `entryMode = expert` |
| Intent | Experiment detail | States that the test validates checkout activation and release-decision analysis through FeatBit APIs and SDK evidence |
| Hypothesis | Experiment detail | States that treatment should improve checkout activation without unacceptable error or latency regression |
| Bound flag | Experiment detail | `flagKey = rd-checkout-treatment-fixed-v1` |
| Control/treatment variants | Experiment detail and flag detail | Control maps to the generated `control` variation ID/value `false`; treatment maps to the generated `treatment` variation ID/value `true` |
| Primary metric config | Experiment detail | Event key is `e2e_checkout_activated_fixed_v1`; metric type is binary; aggregation is once/conversion; direction is treatment higher than control |
| Guardrail metric config | Experiment detail | Contains `e2e_checkout_error_fixed_v1` as binary/once and `e2e_checkout_latency_ms_fixed_v1` as continuous/average |
| Analyze status | Experiment run detail after analyze | Run status is `analyzing` after the analyze call |
| Analyze `inputData` | Experiment run detail after analyze | Non-empty JSON with top-level `metrics`; contains entries for the primary metric and both guardrails; each metric has non-empty control/treatment variant data |
| Analyze `analysisResult` | Experiment run detail after analyze | Non-empty structured JSON. Do not manually expect one exact posterior value; this test checks that analysis runs and returns structured output from the seeded data. |
| Final decision shape | Human interpretation of metric direction | Expected synthetic result is favorable or directionally favorable to treatment: primary improves, error guardrail remains under threshold, latency does not regress. If the analyzer returns an inconclusive probability because of sample size, that is acceptable only if the raw seeded metric directions above are still correct. |

## Report Requirements

After a live run, the runner writes the following files under `reports/`:

| File | Purpose |
| --- | --- |
| `featbit-rest-api-e2e-<timestamp>.md` | Human-readable live test report |
| `featbit-rest-api-e2e-<timestamp>.json` | Machine-readable structured live test report |

The report must include:

- Execution time
- API URL, event URL, and streaming URL
- Fixed data set id and metric suffix
- Project/env/segment/experiment/run ids and keys
- 10 flag keys and types
- Primary and guardrail metric event keys
- Pre-experiment SDK evaluation counts and targeting verification counts
- Expected final feature flag state
- Observed final feature flag state
- Expected vs observed primary metric, guardrail, and analyze results
- Observed users and variant row counts for primary and guardrail stats queries
- Pass/fail result for every step
- Error details for failures
- Masked secrets

Important: without an access token, only offline self-check or plan output can be printed to the console. Offline modes do not write files under `reports/` and must not be treated as a real E2E test report.
