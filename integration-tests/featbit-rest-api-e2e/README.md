# FeatBit REST API E2E Test

This folder contains an executable end-to-end test runner for FeatBit REST API
and FeatBit .NET Server SDK flows.

Read [TEST_SCRIPT.md](./TEST_SCRIPT.md) first for the human-readable test
script: scenario, test data, endpoints, assertions, and report requirements.
Use [test-manifest.json](./test-manifest.json) when a machine-readable inventory
of the same flags, metrics, steps, endpoints, and report expectations is useful.
Use [REQUIREMENTS_AUDIT.md](./REQUIREMENTS_AUDIT.md) to map the original
request to runner behavior, offline evidence, and the live-token evidence still
required.

The runner creates a project and environment, creates 10 feature flags, mutates
the flags, verifies every mutation through API reads, evaluates flags through
the .NET SDK, seeds release-decision metric evidence, calls analyze, and writes
a Markdown and JSON report.

For the Codex-agent topology cycle, use the repository skill at
[.agents/skills/featbit-e2e-test-cycle/SKILL.md](../../.agents/skills/featbit-e2e-test-cycle/SKILL.md).
That workflow starts each local topology, waits for a tester to create the
project/environment/global access token in the UI, runs this E2E script against
that existing environment, waits for manual report approval, then destroys the
topology before moving to the next one. It explicitly does not use `aspire run`.

## Run

From the repository root:

```powershell
.\integration-tests\featbit-rest-api-e2e\run-featbit-rest-api-e2e.ps1 `
  -AccessToken "<access-token>"
```

For local fixed-port services:

```powershell
.\integration-tests\featbit-rest-api-e2e\run-featbit-rest-api-e2e.ps1 `
  -AccessToken "<access-token>" `
  -ApiUrl http://localhost:5000 `
  -EventUrl http://localhost:5100 `
  -StreamingUrl ws://localhost:5100 `
  -Users 1500 `
  -MinUsersPerVariant 500
```

For the Codex-agent skill flow, where the tester creates project/environment in
the UI first:

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

To validate the runner without a token or live FeatBit instance:

```powershell
.\integration-tests\featbit-rest-api-e2e\run-featbit-rest-api-e2e.ps1 -SelfCheck
```

`--self-check` verifies the deterministic flag plan, payload builders, and
expected experiment direction. It does not call FeatBit APIs and does not write
report files.

To print the full fixed execution plan and the 10 generated feature flag
keys/types without a token:

```powershell
.\integration-tests\featbit-rest-api-e2e\run-featbit-rest-api-e2e.ps1 -PrintPlan -PlanSuffix preview
```

The plan is printed to the console only. It does not write report files and is
not evidence that FeatBit APIs passed.

To verify the target Swagger document advertises the project/env/flag/segment
management endpoints used by the live run:

```powershell
.\integration-tests\featbit-rest-api-e2e\run-featbit-rest-api-e2e.ps1 -OpenApiPreflight
```

This fetches `${ApiUrl}/swagger/OpenApi/swagger.json` by default. Pass
`-SwaggerUrl <url>` to check a different OpenAPI document. The public SaaS
Swagger currently advertises the management endpoints but may omit
release-decision and experiment-stats endpoints; those are reported as advisory
and are covered by backend integration tests.

By default the created project is kept so the project/environment ids, keys,
and server SDK secret can be reused. Add `-Cleanup` to delete the project at
the end.

## Reports

`reports/` is intentionally ignored by git except for `.gitignore`.

A report is meaningful only after live execution with a real access token. The
runner then writes:

| File | Meaning |
| --- | --- |
| `featbit-rest-api-e2e-<timestamp>.md` | Human-readable live test report. |
| `featbit-rest-api-e2e-<timestamp>.json` | Structured live test report. |

Each live report includes created resource ids/keys, metric event keys,
pre-experiment SDK targeting verification counts, expected final feature flag
state, observed final feature flag state, expected vs observed
primary/guardrail/analyze results, observed users and variant-row counts from
stats queries, pass/fail status for every API or SDK step, and masked secrets.

Offline `-SelfCheck` and `-PrintPlan` outputs are console-only helpers for
validating the runner and reviewing the plan. They do not write files under
`reports/` and should not be used as FeatBit E2E pass/fail evidence.
`-OpenApiPreflight` is also console-only.

## Manual Final Inspection

After a live run with a real access token, open the generated Markdown report
and compare it against [TEST_SCRIPT.md](./TEST_SCRIPT.md#91-manual-final-inspection-checklist).
That checklist is the human-readable acceptance script for the final state.

## Verification

Without a live access token, use these checks to validate the local runner and
the backend API contract it targets:

```powershell
.\integration-tests\featbit-rest-api-e2e\verify-featbit-rest-api-e2e.ps1
```

The verification script validates the manifest, runner syntax/help,
`-SelfCheck`, `-PrintPlan`, `-OpenApiPreflight`, and the backend
release-decision/experiment-stats contract tests. It also fails if any offline
check creates report files.

Use `-SkipOpenApiPreflight` when the public Swagger URL is unavailable, or
`-SkipBackendContractTests` when only the runner assets should be checked.

## Authentication

The OpenAPI access token is sent as a raw `Authorization` header by default,
matching the backend integration tests.

Use `-AuthMode bearer` if the target API expects a JWT-style bearer token:

```powershell
.\integration-tests\featbit-rest-api-e2e\run-featbit-rest-api-e2e.ps1 `
  -AccessToken "<access-token>" `
  -AuthMode bearer
```

If the target deployment requires explicit workspace context, pass
`-Organization <organization-id>` and `-Workspace <workspace-id>`. Access-token
authentication usually derives these values automatically, but the runner can
send them as headers when needed. Segment creation also needs the organization
resource key for UI-compatible scopes; pass `-OrganizationKey <organization-key>`
when it is not the local default `playground`.

The wrapper passes arguments to the single-file C# runner without printing the
access token. For CI or lower-level debugging, the runner can still be invoked
directly:

```powershell
dotnet run integration-tests\featbit-rest-api-e2e\featbit-rest-api-e2e.cs -- --help
```

## Options

| Option | Environment variable | Default | Meaning |
| --- | --- | --- | --- |
| `--access-token` | `FEATBIT_ACCESS_TOKEN` | required | FeatBit OpenAPI access token or JWT. |
| `--api-url` | `FEATBIT_API_URL` | `https://app-api.featbit.co` | FeatBit API base URL. |
| `--event-url` | `FEATBIT_EVENT_URL` | `https://app-eval.featbit.co` | FeatBit SDK event/evaluation base URL. |
| `--streaming-url` | `FEATBIT_STREAMING_URL` | derived from `--event-url` | FeatBit SDK streaming URL. |
| `--auth-mode` | `FEATBIT_AUTH_MODE` | `raw` | Use `raw` for OpenAPI token header or `bearer` for JWT bearer auth. |
| `--organization` | `FEATBIT_ORGANIZATION` | empty | Optional `Organization` header. |
| `--organization-key` | `FEATBIT_ORGANIZATION_KEY` | `playground` | Organization resource key used in generated segment scopes. |
| `--workspace` | `FEATBIT_WORKSPACE` | empty | Optional `Workspace` header. |
| `--project-key` | `FEATBIT_PROJECT_KEY` | empty | Use an existing tester-created project instead of creating one. Must be passed with `--env-id`. |
| `--env-id` | `FEATBIT_ENV_ID` | empty | Use an existing tester-created environment. Must be passed with `--project-key`. |
| `--users` | | `1500` | Synthetic users evaluated through the SDK. |
| `--min-users-per-variant` | | `500` | Minimum observed users required for each experiment variant in primary and guardrail stats. |
| `--batch-size` | | `10` | SDK event flush batch size. |
| `--seed-batch-delay-ms` | | `100` | Delay between release-decision seed batches after each SDK flush. |
| `--post-sdk-wait-seconds` | | `8` | Wait after SDK flush before querying stats. |
| `--cleanup` | | `false` | Delete the generated project at the end. Default keeps ids/keys for reuse. |
| `--report-dir` | `FEATBIT_REPORT_DIR` | `integration-tests/featbit-rest-api-e2e/reports` | Markdown/JSON report output directory. |
| `--self-check` | | off | Offline script self-check, no API calls and no report files. |
| `--print-plan` | | off | Print the fixed execution plan, no API calls and no report files. |
| `--openapi-preflight` | | off | Fetch Swagger and verify advertised management endpoints, no API mutations and no report files. |
| `--swagger-url` | | derived from `--api-url` | Optional OpenAPI JSON URL for preflight mode. |
| `--plan-suffix` | | `plan` | Suffix used by `--print-plan` for deterministic preview keys. |

## Endpoints Covered

| Step | Meaning | Endpoint |
| --- | --- | --- |
| 0 | Create project and env, record ids/keys/secrets | `POST /api/v1/projects`, `POST /api/v1/projects/{projectId}/envs`, `GET /api/v1/projects/{projectId}` |
| 1 | Create 10 feature flags | `POST /api/v1/envs/{envId}/feature-flags`, `GET /api/v1/envs/{envId}/feature-flags/{key}` |
| 2 | Create segment and mutate flags | `POST /api/v1/envs/{envId}/segments`, `PUT /api/v1/envs/{envId}/segments/{segmentId}/targeting`, `GET /api/v1/envs/{envId}/segments/{segmentId}`, `PUT /api/v1/envs/{envId}/feature-flags/{key}/toggle/{status}`, `/description`, `/tags`, `/variations`, `/targeting` |
| 3 | Verify mutations and segment references | `GET /api/v1/envs/{envId}/feature-flags/{key}`, `GET /api/v1/envs/{envId}/segments/{segmentId}/flag-references` |
| 4 | SDK evaluation and metric tracking | FeatBit.ServerSdk `BoolVariationDetail`, `StringVariationDetail`, `DoubleVariationDetail`, `Track`, `FlushAndWait`; SDK flushes events to `POST /api/public/insight/track` |
| 5 | Create release-decision experiment | `POST /api/v1/envs/{envId}/release-decision/experiments`, `PUT /api/v1/envs/{envId}/release-decision/experiments/{id}` |
| 6 | Configure primary/guardrail metrics | `PUT /api/v1/envs/{envId}/release-decision/experiments/{id}/metrics` |
| 7 | Start run and seed evidence | `POST /api/v1/envs/{envId}/release-decision/experiments/{id}/runs`, SDK evaluation/Track, `POST /api/v1/envs/{envId}/experiment-stats/query`; verifies primary and guardrail evidence |
| 8 | Analyze | `POST /api/v1/envs/{envId}/release-decision/experiments/{id}/runs/{runId}/analyze` |
| 9 | Final verification | `GET /api/v1/envs/{envId}/release-decision/experiments/{id}`, `GET /api/v1/envs/{envId}/feature-flags/{key}`, `POST /api/v1/envs/{envId}/experiment-stats/query`; verifies the seeded treatment conversion rate is higher than control and all 10 flags retain their expected final enabled state, variants, rule state, traffic/fallthrough split, experimentation targeting flags, and type |

The public SaaS OpenAPI schema currently lists project/env/flag/segment
management endpoints. The release-decision endpoints are taken from this
repository's backend controllers and integration tests.
