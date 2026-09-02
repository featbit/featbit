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

The first command builds the containers and creates random local test credentials under `.local/` (gitignored). The verifier runs healthy, regression and recovery phases, checks authentication, queries actual Prometheus samples and writes `reports/demo-latest.json`, `reports/demo-latest.md` and `reports/demo-latest.html` (actual curves). Allow about three minutes after image downloads/builds.

## Connect FeatBit

Choose **Prometheus-compatible**, schema version 1. These URLs are base endpoints; FeatBit appends `/api/v1/query` or `/api/v1/query_range`.

| Authentication | Endpoint from a host-run FeatBit API | Fields |
| --- | --- | --- |
| None | `http://127.0.0.1:19181/none` | No credential |
| Bearer token | `http://127.0.0.1:19181/bearer` | Token from `.local/provider-token` |
| Basic | `http://127.0.0.1:19181/basic` | Username `metrics-reader`, password from `.local/provider-password` |

Read the files locally and paste their contents into the authorized FeatBit connection form. Do not commit them, attach them to reports or use production credentials. FeatBit's application encryption root key is separate from these provider credentials and from JWT signing keys.

These loopback HTTP endpoints are **test fixtures only**. Production connections require TLS and outbound-network restrictions. A containerized FeatBit API needs explicit network access to the gateway; its own `localhost` does not refer to the host. Do not expose the fixture to a shared network. Native Prometheus has Basic/TLS support; the Bearer route here is provided by a small query-only gateway, not a claim of native Prometheus Bearer authentication.

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

Keep each phase running at least 45 seconds. Regression introduces approximately 25% errors and 400–520 ms request latency. Recovery removes the fault; rate windows mean the graph settles gradually rather than instantly. The verifier restores recovery even if a check fails.

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

In the running FeatBit UI, select the report's project and **Prod** environment, then open **Release Health → Connections / Metrics**. Authorized users can Test/Save connections and enter credentials there. Metrics support real PromQL preview, binding save and a 15-minute trend refreshed every 10 seconds. The other providers remain clickable configuration previews; their Test/Save is disabled.

Implementation boundaries:

- Queries run on demand; no background synchronization, persisted metric points, Monitor evaluation or Session evidence is implemented by this slice.
- The UI uses simplified connection cards, metric selection and an inline binding editor. Full catalog/detail/version-management and other Release Health pages remain design previews.
- Credentials use AES-256-GCM, context-bound metadata and a separate versioned key ring. Connection `version` is a compare-and-swap token; semantic `revision` does not increase for secret-only rotation.
- A missing encryption key fails closed at use time. Production startup validation, durable audit, bulk re-encryption, production private-network allowlists and the full role matrix remain follow-up work. Structured sanitized logs are not a compliance certification.
- PostgreSQL is integration-tested. The MongoDB store is implemented but not exercised against a live MongoDB instance here.

Run the focused automated tests from the repo root:

```powershell
dotnet test modules/back-end/tests/Infrastructure.UnitTests/Infrastructure.UnitTests.csproj --filter FullyQualifiedName~ReleaseHealth
npm --prefix modules/front-end run test -- src/features/release-health src/lib/i18n/i18n.test.ts
```

## Stop

```powershell
pwsh -File integration-tests/release-health/scripts/stop.ps1
```

This stops only this Compose project. Metrics volumes and local credential files are retained for repeatable tests. It does not stop the existing FeatBit/Aspire environment.
