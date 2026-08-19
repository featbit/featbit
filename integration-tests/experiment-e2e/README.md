# FeatBit REST API E2E Test

This folder contains an executable end-to-end test runner for FeatBit REST API,
public evaluation, experimentation insight ingest, and analysis flows.

Read [TEST_SCRIPT.md](./TEST_SCRIPT.md) first for the human-readable test
script: scenario, test data, endpoints, assertions, and report requirements.
Use [test-manifest.json](./test-manifest.json) when a machine-readable inventory
of the same flags, metrics, steps, endpoints, and report expectations is useful.
Use [REQUIREMENTS_AUDIT.md](./REQUIREMENTS_AUDIT.md) to map the original
request to runner behavior, offline evidence, and the live-token evidence still
required.

The runner creates a project and environment, creates 10 feature flags, mutates
the flags, verifies every mutation through API reads, checks public evaluation
without writing insight events, seeds preset-timestamp experimentation raw
exposure and metric evidence, calls analyze, and writes a Markdown and JSON
report.

## Run

From the repository root:

```powershell
.\integration-tests\experiment-e2e\run-featbit-rest-api-e2e.ps1 `
  -AccessToken "<access-token>"
```

For local fixed-port services:

```powershell
.\integration-tests\experiment-e2e\run-featbit-rest-api-e2e.ps1 `
  -LoginEmail test@featbit.com `
  -LoginPassword 123456 `
  -ApiUrl http://localhost:5000 `
  -EventUrl http://localhost:5100 `
  -StreamingUrl ws://localhost:5100 `
  -Users 1500 `
  -MinUsersPerVariant 500
```

To run against an existing project/environment instead of letting the runner
create them:

```powershell
.\integration-tests\experiment-e2e\run-featbit-rest-api-e2e.ps1 `
  -AccessToken "<access-token>" `
  -ProjectKey "<project-key>" `
  -EnvId "<environment-id>" `
  -ApiUrl http://localhost:5000 `
  -EventUrl http://localhost:5100 `
  -StreamingUrl ws://localhost:5100 `
  -Users 1500 `
  -MinUsersPerVariant 500
```

To validate the runner without a token or live FeatBit instance:

```powershell
.\integration-tests\experiment-e2e\run-featbit-rest-api-e2e.ps1 -SelfCheck
```

`--self-check` verifies the deterministic flag plan, payload builders, and
expected experiment direction. It does not call FeatBit APIs and does not write
report files.

To print the full fixed execution plan and the 10 generated feature flag
keys/types without a token:

```powershell
.\integration-tests\experiment-e2e\run-featbit-rest-api-e2e.ps1 -PrintPlan -PlanSuffix fixed-v1
```

The plan is printed to the console only. It does not write report files and is
not evidence that FeatBit APIs passed.

To verify the target Swagger document advertises the project/env/flag/segment
management endpoints used by the live run:

```powershell
.\integration-tests\experiment-e2e\run-featbit-rest-api-e2e.ps1 -OpenApiPreflight
```

This fetches `${ApiUrl}/swagger/OpenApi/swagger.json` by default. Pass
`-SwaggerUrl <url>` to check a different OpenAPI document. The public SaaS
Swagger currently advertises the management endpoints but may omit
experimentation, experiment-stats, and MCP OAuth endpoints; those are reported as advisory
and are covered by backend integration tests.

By default the created project is kept so the project/environment ids, keys,
and server SDK secret can be reused. Add `-Cleanup` to delete the project at
the end. The live data set defaults to `fixed-v1`; pass
`-DataSetId <unique-lowercase-id>` when an isolated rerun is needed after a
previous generated project could not be removed.

## Reports

`reports/` is intentionally ignored by git except for `.gitignore`.

A report is meaningful only after live execution with an access token or local
login credentials. The runner then writes:

| File | Meaning |
| --- | --- |
| `featbit-rest-api-e2e-<timestamp>.md` | Human-readable live test report. |
| `featbit-rest-api-e2e-<timestamp>.json` | Structured live test report. |

Each live report includes created resource ids/keys, metric event keys,
pre-seed public-evaluation targeting verification counts, expected final feature flag
state, observed final feature flag state, expected vs observed
primary/guardrail/analyze results, observed users and variant-row counts from
stats queries, pass/fail status for every API step, and masked secrets.

Offline `-SelfCheck` and `-PrintPlan` outputs are console-only helpers for
validating the runner and reviewing the plan. They do not write files under
`reports/` and should not be used as FeatBit E2E pass/fail evidence.
`-OpenApiPreflight` is also console-only.

## Manual Final Inspection

After a live run, open the generated Markdown report and compare it against
[TEST_SCRIPT.md](./TEST_SCRIPT.md#91-manual-final-inspection-checklist).
That checklist is the human-readable acceptance script for the final state.

## Verification

Without live API credentials, use these checks to validate the local runner and
the backend API contract it targets:

```powershell
.\integration-tests\experiment-e2e\verify-featbit-rest-api-e2e.ps1
```

The verification script validates the manifest, runner syntax/help,
`-SelfCheck`, `-PrintPlan`, `-OpenApiPreflight`, and the backend experiment,
experiment-stats, and environment-scoped MCP OAuth contract tests. It also fails if any offline
check creates report files.

Use `-SkipOpenApiPreflight` when the public Swagger URL is unavailable, or
`-SkipBackendContractTests` when only the runner assets should be checked.

## Authentication

The OpenAPI access token is sent as a raw `Authorization` header by default,
matching the backend integration tests.

Use `-AuthMode bearer` if the target API expects a JWT-style bearer token:

```powershell
.\integration-tests\experiment-e2e\run-featbit-rest-api-e2e.ps1 `
  -AccessToken "<access-token>" `
  -AuthMode bearer
```

If the target deployment requires explicit workspace context, pass
`-Organization <organization-id>` and `-Workspace <workspace-id>`. Access-token
authentication usually derives these values automatically, but the runner can
send them as headers when needed. Segment creation also needs the organization
resource key for product-compatible scopes; pass `-OrganizationKey <organization-key>`
when it is not the local default `playground`.

Explicit `-AccessToken` and `-LoginEmail`/`-LoginPassword` arguments are mutually
exclusive and override ambient authentication environment variables. This keeps
local login deterministic even when `FEATBIT_ACCESS_TOKEN` is already set.

The wrapper passes arguments to the single-file C# runner without printing the
access token. For CI or lower-level debugging, the runner can still be invoked
directly:

```powershell
dotnet run integration-tests\experiment-e2e\featbit-rest-api-e2e.cs -- --help
```

## Options

| Option | Environment variable | Default | Meaning |
| --- | --- | --- | --- |
| `--access-token` | `FEATBIT_ACCESS_TOKEN` | empty | FeatBit OpenAPI access token or JWT. Required unless login credentials are provided. |
| `--login-email` | `FEATBIT_LOGIN_EMAIL` | empty | Login email used to call `/api/v1/identity/login-by-email` and obtain a JWT automatically. |
| `--login-password` | `FEATBIT_LOGIN_PASSWORD` | empty | Login password used with `--login-email`. |
| `--api-url` | `FEATBIT_API_URL` | `https://app-api.featbit.co` | FeatBit API base URL. |
| `--event-url` | `FEATBIT_EVENT_URL` | `https://app-eval.featbit.co` | FeatBit public evaluation and insight base URL. |
| `--streaming-url` | `FEATBIT_STREAMING_URL` | derived from `--event-url` | Legacy-compatible streaming URL option. |
| `--auth-mode` | `FEATBIT_AUTH_MODE` | `raw` | Use `raw` for OpenAPI token header or `bearer` for JWT bearer auth. |
| `--organization` | `FEATBIT_ORGANIZATION` | empty | Optional `Organization` header. |
| `--organization-key` | `FEATBIT_ORGANIZATION_KEY` | `playground` | Organization resource key used in generated segment scopes. |
| `--workspace` | `FEATBIT_WORKSPACE` | empty | Optional `Workspace` header. |
| `--project-key` | `FEATBIT_PROJECT_KEY` | empty | Use an existing tester-created project instead of creating one. Must be passed with `--env-id`. |
| `--env-id` | `FEATBIT_ENV_ID` | empty | Use an existing tester-created environment. Must be passed with `--project-key`. |
| `--data-set-id` | `FEATBIT_DATA_SET_ID` | `fixed-v1` | Deterministic suffix for generated project, environment, flag, layer, and metric keys; override it to isolate reruns. |
| `--users` | | `1500` | Synthetic users seeded into experimentation evidence. |
| `--min-users-per-variant` | | `500` | Minimum observed users required for each experiment variant in primary and guardrail stats. |
| `--batch-size` | | `10` | Preset insight ingest batch size. |
| `--seed-batch-delay-ms` | | `100` | Delay between experimentation seed batches. |
| `--post-sdk-wait-seconds` | | `8` | Legacy option name; wait after insight ingest before querying stats. |
| `--cleanup` | | `false` | Delete the generated project at the end. Default keeps ids/keys for reuse. |
| `--report-dir` | `FEATBIT_REPORT_DIR` | `integration-tests/experiment-e2e/reports` | Markdown/JSON report output directory. |
| `--self-check` | | off | Offline script self-check, no API calls and no report files. |
| `--print-plan` | | off | Print the fixed execution plan, no API calls and no report files. |
| `--openapi-preflight` | | off | Fetch Swagger and verify advertised management endpoints, no API mutations and no report files. |
| `--swagger-url` | | derived from `--api-url` | Optional OpenAPI JSON URL for preflight mode. |
| `--plan-suffix` | | `fixed-v1` | Suffix used by `--print-plan`; use the same value as `--data-set-id` when reviewing an isolated live plan. |

## Endpoints Covered

| Step | Meaning | Endpoint |
| --- | --- | --- |
| 0 | Create project and env, record ids/keys/secrets | `POST /api/v1/projects`, `POST /api/v1/projects/{projectId}/envs`, `GET /api/v1/projects/{projectId}` |
| 1 | Create 10 feature flags | `POST /api/v1/envs/{envId}/feature-flags`, `GET /api/v1/envs/{envId}/feature-flags/{key}` |
| 2 | Create segment and mutate flags | `POST /api/v1/envs/{envId}/segments`, `PUT /api/v1/envs/{envId}/segments/{segmentId}/targeting`, `GET /api/v1/envs/{envId}/segments/{segmentId}`, `PUT /api/v1/envs/{envId}/feature-flags/{key}/toggle/{status}`, `/description`, `/tags`, `/variations`, `/targeting` |
| 3 | Verify mutations and segment references | `GET /api/v1/envs/{envId}/feature-flags/{key}`, `GET /api/v1/envs/{envId}/segments/{segmentId}/flag-references` |
| 4 | Public evaluation verification | `POST /api/public/featureflag/evaluate`; verifies configured flags without writing insight events |
| 5 | Create experiment | `POST /api/v1/envs/{envId}/experiments`, `PUT /api/v1/envs/{envId}/experiments/{id}` |
| 6 | Register and select primary/guardrail metrics | `GET/POST/PUT /api/v1/envs/{envId}/experiment-metrics`, `PUT /api/v1/envs/{envId}/experiments/{id}/metrics` |
| 7 | Start run and seed evidence | `POST /api/v1/envs/{envId}/experiments/{id}/runs`, `PUT /runs/{runId}/audience` with v6.0.0 experiment traffic assignment fields, preset-timestamp `POST /api/public/insight/track`, `POST /api/v1/envs/{envId}/experiment-stats/query`; verifies primary and guardrail evidence |
| 8 | Analyze | `POST /api/v1/envs/{envId}/experiments/{id}/runs/{runId}/analyze` |
| 9 | Traffic-assignment scenarios | Create one dedicated feature flag plus one independent experiment/run/registered metric/default window per scenario; verifies no-layer `50/50 -> use all`, no-layer `90/10 -> 10/10`, layer `0-30 + 34/33/33`, layer `0-30 + 80/20 -> 20/20`, and same-layer `[30,60)` companion mutual-exclusion traffic assignment |
| 10 | Final verification | `GET /api/v1/envs/{envId}/experiments/{id}`, `GET /api/v1/envs/{envId}/feature-flags/{key}`, `POST /api/v1/envs/{envId}/experiment-stats/query`; verifies the seeded treatment conversion rate is higher than control and all 10 flags retain their expected final enabled state, variants, rule state, traffic/fallthrough split, experimentation targeting flags, and type |

The live runner does not execute an MCP OAuth grant flow. Offline verification
checks `POST /api/v1/envs/{envId}/mcp/oauth/token` through the backend
`McpOAuthControllerTests` and treats its OpenAPI operation as advisory.

The public SaaS OpenAPI schema currently lists project/env/flag/segment
management endpoints. The experimentation endpoints are taken from this
repository's backend controllers and integration tests.
