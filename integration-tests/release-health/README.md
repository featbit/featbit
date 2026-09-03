# Release Health integration fixture

A local, independently runnable source of **real metrics**, not a simulated FeatBit API. It exercises a .NET checkout service, OpenTelemetry, Prometheus and the three authentication methods supported by FeatBit's Prometheus-compatible provider.

```text
Load generator → Checkout API → OTLP/gRPC → OTel Collector
                                              ↑ scrape
FeatBit API → query-only authentication gateway → Prometheus
```

## Start and verify

Requires Docker Compose and PowerShell 7. Run from the repository root:

```powershell
pwsh -File integration-tests/release-health/scripts/start.ps1
pwsh -File integration-tests/release-health/scripts/verify-demo.ps1
```

The first command builds and starts the Docker Compose containers. It generates random local test credentials in `.local/provider-token` and `.local/provider-password` (gitignored) **only when the corresponding file is missing**. Existing credentials are reused across restarts, stop/start cycles and container rebuilds, so saved FeatBit connections using those credentials do not need to be reconfigured.

If you delete these files or start from a fresh checkout on another machine without them, new credentials are generated. Update the corresponding Token / Password in FeatBit if you want existing connections to use that new fixture.

The verifier runs healthy, regression and recovery phases, checks authentication, queries actual Prometheus samples and writes `reports/demo-latest.json`, `reports/demo-latest.md` and `reports/demo-latest.html` (actual curves). Allow about three minutes after image downloads/builds.

## Connect FeatBit

Choose **Prometheus-compatible**, schema version 1. These URLs are base endpoints; FeatBit appends `/api/v1/query` or `/api/v1/query_range`.

| Authentication | Endpoint from a host-run FeatBit API | Fields |
| --- | --- | --- |
| None | `http://127.0.0.1:19181/none` | No credential |
| Bearer token | `http://127.0.0.1:19181/bearer` | Token from `.local/provider-token` |
| Basic | `http://127.0.0.1:19181/basic` | Username `metrics-reader`, password from `.local/provider-password` |

Read the files locally and paste their contents into the authorized FeatBit connection form. Do not commit them, attach them to reports or use production credentials. FeatBit's application encryption root key is separate from these provider credentials and from JWT signing keys.

These loopback HTTP endpoints are **test fixtures only**. Production connections require TLS and outbound-network restrictions. A containerized FeatBit API needs explicit network access to the gateway; its own `localhost` does not refer to the host. Do not expose the fixture to a shared network. Both authenticated routes in this fixture are handled by the query-only gateway. Native Prometheus has Basic/TLS support, but these tests do not exercise its native Basic configuration or imply native Bearer token management.

Prometheus's local browser is at <http://127.0.0.1:19090>. The checkout API is at <http://127.0.0.1:19180>.

## Metrics and scenarios

Copy the exact expressions from [queries/queries.json](queries/queries.json):

- `errorRate`: percentage of failed checkout requests, 30-second rate window.
- `p95Latency`: histogram p95 converted from seconds to milliseconds.
- `throughput`: checkout requests per second.

The expressions deliberately aggregate to **one series**, matching the initial FeatBit result contract. Labels are bounded (`service`, `environment`, `status`); users and request IDs are not metric labels. An empty result is missing data, not a successful release.

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:19180/scenario/healthy
Invoke-RestMethod -Method Post http://127.0.0.1:19180/scenario/regression
Invoke-RestMethod -Method Post http://127.0.0.1:19180/scenario/recovery
```

Keep each phase running at least 45 seconds. Regression introduces approximately 25% errors and 400–520 ms request latency. The histogram p95 is a bucket-based estimate, not the exact request latency. Recovery removes the fault; rate windows mean the graph settles gradually rather than instantly. The verifier restores recovery even if a check fails.

## Optional real feature flag

The fixture works without a FeatBit instance. To drive the same fault with a real server SDK, supply `FEATBIT_DEMO_ENV_SECRET` to Compose, point `FEATBIT_DEMO_EVENT_URL` and `FEATBIT_DEMO_STREAMING_URL` at the local evaluation service if necessary, and create boolean flag `release-health-regression` in that environment. Use `POST /scenario/flag` after the SDK is initialized. The route refuses activation when the SDK is unavailable. Never commit the environment secret.

The fixture does not implement Release Health storage, authorization, encryption or query adapters. Those belong in the main FeatBit API and UI; a successful fixture report alone does not prove product integration.

## Verify the main FeatBit integration

The main API and UI now have a minimal live slice for Connections and Metrics. With an existing local PostgreSQL-based FeatBit environment and .NET 10 SDK:

```powershell
pwsh -File integration-tests/release-health/scripts/configure-local-api.ps1 -PostgresContainer featbit-infra-postgresql-1
aspire resource api-server rebuild --non-interactive
pwsh -File integration-tests/release-health/scripts/verify-product.ps1
```

Use the actual PostgreSQL container name if yours differs. The configuration script applies the additive [PostgreSQL migration](../../modules/back-end/scripts/release-health/postgres.sql), creates a separate random AES root key and sets API Development user-secrets. It does not print the key or reuse JWT signing keys. The gitignored `.local/api-root-key` and user-secrets are **development conveniences, not encrypted enterprise vaults**. Production must inject a protected key ring independently from database backups. Never publish this fixture or its HTTP endpoints.

The verifier uses the existing local fixture login (`test@featbit.com` by default) and creates or reuses a dedicated `Release Health integration ...` project. It saves three connections, three metrics and their environment bindings, tests real queries and security failures, and checks PostgreSQL storage for the absence of the test plaintext credentials. It leaves these fixtures available for UI testing and writes non-secret identifiers/results to `reports/product-latest.json`. It does not change existing flags or other projects.

In the running FeatBit UI, select the report's project and **Prod** environment, then open **Release Health → Connections / Metrics**. Authorized users can Test/Save connections and enter credentials there. Metrics use the catalog and Add Metric drawer: create a project definition, open its detail page, then Connect / Manage an environment through the separate Source Binding page. PromQL preview and binding save use the real API; the detail trend queries the last hour and refreshes every 30 seconds. The other providers remain clickable configuration previews; their Test/Save is disabled.

The API checks `CanAccessProject` / `CanAccessEnv` and Organization → Project → Environment ownership. Connection list/Test/Save and binding management use `UpdateEnvSettings`; metric creation uses `UpdateProjectSettings`. Trend reads use saved bindings, not caller-supplied queries. This implementation mapping does not replace full fine-grained role acceptance testing.

Outbound requests use HTTPS by default, AntiSSRF checks, no redirects or cookies, and bounded concurrency, timeout, response size and point count. PromQL is sent in a POST body; request bodies and authorization headers are not logged. Errors expose sanitized categories, not raw provider responses or credentials. The exact gateway origin `http://127.0.0.1:19181` is a Development-only exception.

Implementation boundaries:

- Bindings use `promql`, `queryMode: range` and `step` (5s / 15s / 1m / 5m), without `syncInterval`. Queries run on demand; no background synchronization, persisted metric points, complete Stream lifecycle, Monitor/Gate/Response evaluation or Session evidence is implemented by this slice.
- The metric catalog, Add Metric drawer, detail and separate Source Binding page use persisted data. Description, optional Category, fraction digits and the complete Result Contract are saved with v1. Definition editing, additional versions, Monitor/Session references and trends longer than one hour are not implemented; their UI does not substitute mock results. Connection summary/search/Used by/name uniqueness, disable/delete and full pagination are not implemented; lists are limited to 500 entries and error categories are not fully refined.
- PostgreSQL stores Connection metadata and a separate `protected_secrets` field atomically in `release_health_documents`, alongside scoped Metric and Binding records. Existing business tables are not rewritten. Credentials use AES-256-GCM, context-bound metadata and a separate versioned key ring. Connection `version` is a compare-and-swap token; semantic `revision` does not increase for secret-only rotation.
- A missing encryption key fails closed at use time. Production startup validation, durable audit/outbox, bulk re-encryption, old-key retirement, KMS/Vault integration and production private-network allowlists remain follow-up work. Structured sanitized logs are not a compliance certification; production also requires independently managed keys, TLS, backups, access control and network policies.
- PostgreSQL is integration-tested. Live MongoDB, multi-instance contention, all fine-grained role combinations and production private-network deployments have not been validated here.

Run the focused automated tests from the repo root:

```powershell
dotnet test modules/back-end/tests/Infrastructure.UnitTests/Infrastructure.UnitTests.csproj --filter FullyQualifiedName~ReleaseHealth
npm --prefix modules/front-end run test -- src/features/release-health src/lib/i18n/i18n.test.ts
```

Recorded results and UI screenshots from the 2026-09-02 run are kept in [verification.md](verification.md). They document that run, not a guarantee that later revisions pass.

## Stop

```powershell
pwsh -File integration-tests/release-health/scripts/stop.ps1
```

This stops only this Compose project. Metrics volumes and local credential files are retained for repeatable tests. It does not stop the existing FeatBit/Aspire environment.
