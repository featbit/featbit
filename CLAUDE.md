# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

FeatBit is a self-hosted feature flag management platform with a microservices architecture. Its services communicate via pluggable message queues:

```
UI (Angular 19) → API Server (.NET 10) → Message Queue → Evaluation Server (.NET 10)

Control Plane (.NET 10) — optional broker between API and Evaluation Servers
```

### Service Locations
| Service | Path | Port |
|---|---|---|
| Frontend UI | `modules/front-end/` | 4200 (dev) |
| API Server | `modules/back-end/` | 5000 |
| Evaluation Server | `modules/evaluation-server/` | 5100 |
| Control Plane | `modules/control-plane/` | — |

### Pluggable Providers
All backend services select infrastructure via environment variables:
- `DbProvider` — `Postgres` or `MongoDB`
- `MqProvider` — `Postgres`, `Redis`, or `Kafka`
- `CacheProvider` — `Redis` or `None`

Standard edition uses Postgres for everything. Professional edition adds Kafka and ClickHouse for high-throughput analytics.

### Message Queue Topics
Flag/segment changes flow from API → MQ → Evaluation Server via these topics:
- `featbit-feature-flag-change`, `featbit-segment-change`
- `featbit-endusers`, `featbit-insights`
- `featbit-control-plane-*` (when Control Plane is enabled)

### .NET Service Architecture
API Server, Evaluation Server, and Control Plane all use Clean Architecture:
`Api → Application → Domain → Infrastructure`

Health endpoints on all .NET services: `/health/liveness`, `/health/readiness`

---

## Commands

### Frontend (modules/front-end/)
```bash
npm install
npm run start          # Dev server (English) at localhost:4200
npm run start:zh       # Dev server (Chinese) at localhost:4201
npm run build:prod     # Production build
npm run test           # Unit tests (Jasmine/Karma)
npm run test-coverage  # Coverage report
npm run i18n           # Extract i18n strings and validate translations
```

### .NET Services (back-end / evaluation-server / control-plane)
```bash
dotnet restore
dotnet build -c Release --no-restore
dotnet test -c Release --no-build --verbosity normal

# Run a single test
dotnet test --filter "FullyQualifiedName~TestClassName"

# Build Docker image (from module root)
docker build --progress plain -f ./deploy/Dockerfile -t featbit/api:local .
```

### Local Development (Docker Compose)
```bash
# Infrastructure only (MongoDB + Redis) — then run services locally
docker compose --project-directory . -f ./docker/composes/docker-compose-infra.yml up -d

# Full dev stack (MongoDB)
docker compose --project-directory . -f ./docker/composes/docker-compose-dev.yml up -d

# Full dev stack (Postgres)
docker compose --project-directory . -f ./docker/composes/docker-compose-dev-postgres.yml up -d

# Standard edition (all services, Postgres + Redis)
docker compose -f docker-compose-standard.yml up -d

# Professional edition (Kafka + ClickHouse)
docker compose -f docker-compose-pro.yml up -d
```

Default dev credentials: `test@featbit.com` / `123456`

---

## Key Configuration

### Backend Environment Variables (appsettings.json / env)
- `ConnectionStrings__Mongo` / `ConnectionStrings__Postgres`
- `Redis__ConnectionString`
- `JWT__Issuer`, `JWT__Audience`, `JWT__Key`
- `Kafka__BootstrapServers` (pro edition)
- `SSOEnabled`, `WorkspaceId`, `OAuthConfig__*`

### Frontend Environment
Config at `modules/front-end/src/environments/`. API base URL is set via `environment.ts` (dev) or injected at container startup via `config.js`.

### Evaluation Server Rate Limiting
Configurable per-endpoint rate limiting via `RateLimit__*` env vars.

---

## CI/CD (ONLY APPLIES to the github.com/featbit/featbit repo)

GitHub Actions workflows run on push/PR to `main` for path-filtered changes:
- `build-and-test-api.yml` — dotnet restore → build → test
- `build-and-test-els.yml` — same for Evaluation Server
- `build-and-test-control-plane.yml` — same for Control Plane
- `ui-change-validations.yml` — npm ci → i18n → build
- `publish-docker-images.yml` — manual trigger; builds multi-platform (amd64/arm64) images to Docker Hub

Kubernetes manifests are in `kubernetes/` (standard, pro, demo, minikube variants).

---

## Control Plane QA

The `e2e/control-plane/` directory manages multi-cluster (west/east) Minikube deployments for
testing cross-datacenter feature flag propagation. It is organized into three numbered
subdirectories:

- **`00-Docs/`** — architecture reference, deployment guide, testing plans.
- **`01-Infrastructure/`** — deployment scripts, platform quickstarts (`ubuntu/`,
  `windows-wsl/`, `windows-hyperv/`), config files, and `extras/` for infrequently-used
  utilities.
- **`02-Tests/`** — automated scenarios (`automation-py/scenarios/cp01–cp15.py`), manual
  procedures (`manual_scripts/`), test applications (`test-app/`, `quick-test/`), curated run
  reports (`simulations/`, see below), and UAT orchestration (`Run-UATTests.ps1`).

Artifacts are gitignored — test output goes to `artifacts/`, excluded from version control.
Configuration lives in `01-Infrastructure/deployment.env` (copied from
`deployment.env.example`); never commit credentials.

**`artifacts/` vs `02-Tests/simulations/`:** these look similar (both hold test-run output) but
follow opposite conventions. `artifacts/` is machine-generated, disposable automation output —
gitignored, never committed. `02-Tests/simulations/*.md` are CURATED, git-tracked run reports —
a human-authored (or human-reviewed) writeup of a specific test/simulation session, kept in
version control as a durable record. When adding a new simulation writeup, put it under
`02-Tests/simulations/` and commit it; when a script/tool needs a scratch output location, use
`artifacts/`.

PowerShell scripts in `e2e/control-plane/` use approved PowerShell verbs in their names (e.g.
`Deploy-`, `Initialize-`, `Start-`) and target multi-cluster Minikube deployments.

---

## Commit & PR Conventions

- PR title: < 70 characters, sentence case.
- Use emoji prefixes: ✨ feature, 🐛 bugfix, 🔥 P0 fix, ✅ tests, 🚀 perf, 📖 docs, 🏗 infra,
  🧹 refactor.
- Labels: UI, API, Evaluation Server, OLAP.
- Always include a `Co-Authored-By` trailer when AI-assisted.

---

## Working agreement

- **Verification-first.** Before starting any task, state up front how you will
  verify it — the concrete check: the exact command to run, the test to add/run,
  the endpoint to hit, the output or metric to inspect. After finishing, actually
  run that verification and report the results, including failures, skipped steps,
  and partial outcomes. "Done" means *verified*, not "should work" — if you can't
  verify, say so explicitly and explain why.
- **Tests follow `CONTRIBUTING-tests.md`.** Read it before writing or modifying any
  test in `modules/back-end`, `modules/evaluation-server`, or `modules/control-plane`.
  It governs test project layout, folder mirroring, class and method naming, setup
  patterns, allowed libraries, unit-vs-integration boundaries, and `Category` traits.
  Do not infer conventions from neighboring test files — the repo has pre-existing
  inconsistencies, so copying a nearby file can reproduce a violation rather than
  avoid one. If a change genuinely cannot follow the standard, record the deviation
  in that file rather than leaving it undocumented.
- **Instrumentation follows `docs/observability/index.md`.** Read it before adding or
  changing any metric, span, or log statement. Same warning: do not infer the
  conventions from surrounding code.

---

## Observability

Observability is a first-class requirement in the three .NET modules, not an optional
extra. When you add a code path that can fail, retry, queue, drop work, take an
unbounded amount of time, or silently do nothing, instrument it **in the same change**.
The bar is: *if this breaks in production, is there enough signal to find out why
without attaching a debugger?*

The standard lives in four documents under `docs/observability/`:

| Document | Use it for |
|---|---|
| `index.md` | The rules: naming, attribute allowlist, cardinality budget, log levels, redaction, trace gating, health-check tags |
| `instruments.md` | The registry of every instrument, plus the "known gaps" list of what is deliberately not measured |
| `exporting.md` | Getting signals to a collector, and the traps that drop them silently |
| `investigating.md` | The operator runbook — how these signals are meant to be used during an incident |

Rules that are easy to get wrong and expensive to fix later:

- **Names are a contract.** `featbit.<service>.<area>.<name>`; the unit belongs in the
  instrument's `unit` field, never in its name. These instruments export today, so
  renaming one breaks live dashboards.
- **Attributes come from a fixed allowlist**, and an attribute is safe *only if its
  value set is defined by FeatBit's own code*. Never tag with a value taken from a
  request body, a socket frame, a customer-authored rule or flag name, a URL, a user
  identifier, or an environment id. Map untrusted input onto a closed set first, or
  leave it out. Unbounded cardinality is the most expensive mistake available here.
- **Register every new instrument in `instruments.md`**, with a description matching the
  `description:` string in code. An undocumented instrument and a missing one cost the
  same during an incident.
- **Add a test.** `MetricCollector` (in `modules/shared/Observability.TestKit`) asserts
  name, unit, and attributes; extend the `CardinalityBudgetTests` sweeps so new
  instruments are checked against the allowlist mechanically.
- **Telemetry must never change behavior.** No I/O on a request, streaming, or
  evaluation path; nothing that blocks; gauge callbacks read cached or atomic state
  only. If measuring something would require new runtime behavior, say so and record it
  rather than doing it quietly.
- **All logging is source-generated `[LoggerMessage]`.** There are zero raw
  `logger.LogInformation` / `LogWarning` / `LogError` / `LogDebug` / `LogTrace` /
  `LogCritical` calls left in the three `src/` trees, and none may be added. Declare the
  event in a **sibling `<ClassName>.Log.cs`** file holding a nested
  `public static partial class Log`; use **positional** attribute arguments
  (`[LoggerMessage(1, LogLevel.Error, "…", EventName = "…")]`, not `EventId =`/`Level =`);
  number event ids from **1 within each owning class**, appending from the highest if the
  file already exists. **Never add `.ToString()` to make a call compile** — widen the
  parameter to the argument's real type (`Guid`, `long`, `double`, `DateTimeOffset`,
  `object?`) instead. A coercion compiles, renders identically, and silently degrades the
  structured payload, and no test catches it. Preserve existing `EventId` / `EventName`
  values — log-based alerting keys on them. Full rules in `docs/observability/index.md`
  §6.1.
- **This rule is build-enforced, not just documented.** The analyzer rule `CA1848` is
  enabled as an **error** for the `src/` trees (via `.editorconfig` in each module's `src/`
  and in `modules/shared/`), so a raw `ILogger.Log*` call fails the build rather than merely
  being discouraged.
- **Credentials are hashed, never logged raw** — SDK secrets, streaming and relay-proxy
  tokens, JWTs. Everything else (message payloads, client IPs, webhook URLs) is logged
  raw on purpose, because that is what makes an incident diagnosable. New
  credential-bearing field names must be added to `Redaction.CredentialNames`. A
  credential-bearing event is declared as a private `…Core` method behind a public
  wrapper that redacts first, so logging the raw value is impossible rather than merely
  discouraged.
- **Shared primitives live in `modules/shared/Observability` and are deliberately
  BCL-only.** Do not add a package dependency to that project; keep transport- or
  framework-specific glue in the module that needs it.
- **Scope gaps honestly.** If something is specified but not built, record it in the
  "known gaps" section of `instruments.md` with a reason. Documentation that overclaims
  coverage is worse than documentation that admits a hole — an overclaim is how the
  original M7–M10 gap stayed hidden.
