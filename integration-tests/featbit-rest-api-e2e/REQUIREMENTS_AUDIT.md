# FeatBit REST API E2E Requirements Audit

This audit maps the original E2E request to the concrete assets in this folder.
It separates what is implemented and locally verified from what still requires a
real FeatBit access token and live API execution.

## Status Legend

| Status | Meaning |
| --- | --- |
| Implemented | The executable runner contains the required behavior. |
| Offline verified | The no-token verifier proves the local asset, syntax, manifest, and backend contract coverage. |
| Live evidence required | The behavior can only be proven by running against FeatBit with a real access token. |

## Requirement Mapping

| Request | Runner coverage | Script/manifest coverage | Verification evidence | Status |
| --- | --- | --- | --- | --- |
| Use FeatBit REST API with a user-provided access token | `featbit-rest-api-e2e.cs` requires `--access-token` or `FEATBIT_ACCESS_TOKEN`, supports raw OpenAPI token and bearer modes, and sends optional organization/workspace headers. | `README.md` documents token usage and auth modes. | `verify-featbit-rest-api-e2e.ps1` validates runner help and refuses to treat offline output as a live report. | Implemented; live evidence required |
| 0. Create a project and env; record ids/keys | Step 0 creates project/env, reads project, records project/env ids and keys, extracts the Server SDK secret, and masks secrets in reports. | `TEST_SCRIPT.md` Step 0 and `test-manifest.json` Step 0. | Offline verifier checks manifest and runner self-check. Live report will contain the created resource ids/keys. | Implemented; live evidence required |
| 1. Create 10 feature flags and write key/type content | Step 1 creates exactly 10 flags covering `boolean`, `string`, `number`, and `json`, then reads each flag back. | `TEST_SCRIPT.md` and `test-manifest.json` list all 10 fixed keys and types for the `fixed-v1` data set. `--print-plan` prints the same concrete keys/types used by live E2E. | Offline verifier checks flag count, type coverage, unique keys, and printed plan output. | Implemented; offline verified |
| 2. Mutate the 10 flags: rules, segment, toggles, variants | Step 2 creates a segment, updates exact segment targeting, changes each flag description/tags/toggle/variants/targeting. Experiment flag keeps control/treatment; non-experiment flags receive meaningful variant changes. | `TEST_SCRIPT.md` Step 2 and expected final-state tables; `test-manifest.json` Step 2 and `expectedFinalState`. | Offline verifier checks mutation assertions exist. Live runner read-after-write assertions verify the persisted state. | Implemented; live evidence required |
| 3. Verify after each change or batch | Runner performs read-after-write checks after creation, segment update, description/tag/toggle batch, variation update, targeting update, segment references, metrics, run setup, stats queries, analyze, and final flags. | `TEST_SCRIPT.md` Step 3 and final verification section. | Offline verifier checks script/manifest consistency; live report records pass/fail for every API/SDK step. | Implemented; live evidence required |
| 4. Use FeatBit .NET SDK for evaluation and observe changes | Step 4 initializes `FeatBit.ServerSdk`, evaluates all 10 flags before experiment creation, verifies segment users get treatment, verifies enterprise rule targeting on non-experiment flags, and flushes SDK evaluation events. Step 7 reuses the SDK to seed exposure and metric evidence. | `TEST_SCRIPT.md` Step 4; `test-manifest.json` Step 4. | Offline verifier checks SDK assertion text; live report includes pre-experiment SDK validation counts and stats observations. | Implemented; live evidence required |
| 5. Use release-decision APIs to create experiment and fill intent/hypothesis/basic information; bind feature flag | Step 5 creates a release-decision experiment, binds it to the checkout treatment flag, fills goal/intent/hypothesis/change/constraints/env secret/flag server URL/entry mode, and reads it back. | `TEST_SCRIPT.md` Step 5 and manifest Step 5. | Backend release-decision contract tests run in offline verifier; live report records created experiment/run ids and final binding. | Implemented; live evidence required |
| 6. Fill primary and guardrail metrics with multiple types | Step 6 configures one primary binary/once metric, one binary/once guardrail, and one continuous/average guardrail with fixed metric keys. | `TEST_SCRIPT.md` Step 6; `test-manifest.json` metric definitions. | Offline verifier checks fixed metric keys and backend contract tests. Live stats queries prove metric data visibility. | Implemented; live evidence required |
| 7. Auto-fill flag evaluation data and metric data | Step 7 creates/configures a run, evaluates the fixed `e2e-user-0000` through `e2e-user-1499` users through the SDK, tracks primary/error/latency metrics from deterministic per-variant selections, flushes SDK events, waits for processing, and queries experiment stats. | `TEST_SCRIPT.md` Step 7 and expected insight/stats section. | Live runner asserts exact observed conversion/error counts from assigned variant sizes, treatment primary rate greater than control, guardrail thresholds, and latency direction. Live report includes users and variant row counts. | Implemented; live evidence required |
| 8. Call analyze | Step 8 calls `POST /api/v1/envs/{envId}/release-decision/experiments/{id}/runs/{runId}/analyze` with `forceFresh=true`. | `TEST_SCRIPT.md` Step 8 and expected analyze section. | Live runner asserts status `analyzing`, non-empty `inputData`, expected metric keys in `inputData`, and non-empty `analysisResult`. | Implemented; live evidence required |
| 9. Final verification against preset experiment values | Step 9 rereads the experiment and all flags, checks final experiment binding, analyzed run result, final enabled state, type, variants, rule condition, rule traffic, fallthrough traffic, and experimentation flags. | `TEST_SCRIPT.md` expected final-state tables; `test-manifest.json expectedFinalState`. | Offline verifier checks expected final-state completeness. Live report includes expected and observed final flag state. | Implemented; live evidence required |
| Analyze project, REST API, features, and tests | Runner uses current FeatBit API endpoints, backend release-decision/experiment-stats contract tests, public Swagger preflight for management endpoints, and project-local docs. | README explains Swagger limitations and backend contract-test coverage for advisory release-decision endpoints. | `verify-featbit-rest-api-e2e.ps1` runs OpenAPI preflight and backend contract tests. | Implemented; offline verified |
| Write fixed human-readable test script with steps, meaning, endpoints | `TEST_SCRIPT.md` is the fixed human-readable script. | `test-manifest.json` is the machine-readable inventory. | Verifier checks English-only docs and key manifest invariants. | Implemented; offline verified |
| Make an executable test program | `featbit-rest-api-e2e.cs` is the executable single-file C# runner; `run-featbit-rest-api-e2e.ps1` is the wrapper. | README documents live and offline commands. | Verifier runs help, self-check, plan print, OpenAPI preflight, and backend contract tests. | Implemented; offline verified |
| Produce a test report | Live mode writes Markdown and JSON reports under `reports/`; offline modes intentionally write no reports. | README and TEST_SCRIPT define report contents. | Verifier fails if offline modes create report files. A real access token is required for meaningful report generation. | Implemented; live evidence required |

## Live Completion Gate

Full completion requires a live run with a real FeatBit access token:

```powershell
.\integration-tests\featbit-rest-api-e2e\run-featbit-rest-api-e2e.ps1 `
  -AccessToken "<access-token>"
```

The run is complete only when:

- the command exits successfully,
- the generated Markdown and JSON reports exist under `reports/`,
- the report contains created project/env ids and keys,
- all API and SDK steps are `PASS`,
- expected vs observed final feature flag state matches,
- primary and guardrail metric observations match the preset directions,
- analyze status/inputData/analysisResult match the expected state,
- access token and Server SDK secret are masked.

Until that live run happens, the executable test package is ready, but the full
end-to-end FeatBit environment result remains unproven.
