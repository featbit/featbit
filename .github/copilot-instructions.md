# FeatBit — Copilot Instructions

FeatBit is an open-source feature flag management platform. It is a polyglot monorepo with .NET APIs, an Angular UI, and Kubernetes-based multi-cluster deployment tooling.

## Workflow

Before you start any work, state how you would verify it. After you finish, run the verification and report the results.

**Before writing or modifying any test, read [`CONTRIBUTING-tests.md`](../CONTRIBUTING-tests.md) and follow it.**
It is the authoritative standard for the three .NET modules and governs test project layout, folder
mirroring, class and method naming, setup patterns, allowed libraries, unit-vs-integration
boundaries, and `Category` traits. Inferring conventions from neighboring files is not sufficient —
the repo contains pre-existing inconsistencies, so matching a nearby file can reproduce a violation
rather than avoid one. If a change genuinely cannot follow the standard, record the deviation in
that file rather than leaving it undocumented.

**Before adding or changing any metric, span, or log statement, read
[`docs/observability/index.md`](../docs/observability/index.md) and follow it.** The same warning
applies: do not infer the conventions from surrounding code.

## Observability

Observability is a first-class requirement in `back-end`, `evaluation-server`, and `control-plane`,
not an optional extra. When you add a code path that can fail, retry, queue, drop work, take an
unbounded amount of time, or silently do nothing, instrument it in the same change. The bar is: **if
this breaks in production, is there enough signal to find out why without attaching a debugger?**

The four documents under `docs/observability/` are the standard:

| Document | Use it for |
|---|---|
| [`index.md`](../docs/observability/index.md) | The rules: naming, the attribute allowlist, the cardinality budget, log levels, redaction, trace gating, health-check tags |
| [`instruments.md`](../docs/observability/instruments.md) | The registry of every instrument, and the "known gaps" list of what is deliberately not measured |
| [`exporting.md`](../docs/observability/exporting.md) | Getting signals to a collector, and the traps that drop them silently |
| [`investigating.md`](../docs/observability/investigating.md) | The operator runbook — how the signals are meant to be used during an incident |

Rules that are easy to get wrong and expensive to fix later:

- **Names are a contract.** `featbit.<service>.<area>.<name>`, units in the `unit` field and never in
  the name. Instruments are exported now, so renaming one breaks live dashboards.
- **Attributes come from a fixed allowlist**, and an attribute is safe *only if its value set is
  defined by FeatBit's own code*. Never tag with anything sourced from a request body, a socket
  frame, a customer-authored rule or flag name, a URL, a user identifier, or an environment id.
  Map untrusted input onto a closed set first, or leave it out.
- **Register every new instrument in `instruments.md`** with a description matching the
  `description:` string in code. An undocumented instrument and a missing one cost the same during
  an incident.
- **Add a test.** `MetricCollector` (in `shared/Observability.TestKit`) asserts name, unit, and
  attributes; the cardinality sweeps in `CardinalityBudgetTests` must cover new instruments.
- **Telemetry must never change behavior.** No I/O on a request, streaming, or evaluation path; no
  blocking; gauge callbacks read cached or atomic state only. If measuring something would require
  new runtime behavior, say so and record it rather than doing it quietly.
- **All logging is source-generated `[LoggerMessage]`.** There are zero raw `logger.LogInformation` /
  `LogWarning` / `LogError` / `LogDebug` / `LogTrace` / `LogCritical` calls in the three `src/`
  trees, and none may be added. Declare the event in a sibling `<ClassName>.Log.cs` holding a nested
  `public static partial class Log`, use positional attribute arguments
  (`[LoggerMessage(1, LogLevel.Error, "…", EventName = "…")]`), number event ids from 1 within each
  owning class, and **never add `.ToString()` to make a call compile** — widen the parameter to the
  argument's real type instead, or the structured payload is silently degraded. Preserve existing
  `EventId` / `EventName` values; alerting keys on them. Full rules in
  [`index.md` §6.1](../docs/observability/index.md).
- **Both halves of this rule are enforced, not just documented.** The analyzer rule `CA1848` is
  turned on as an **error** for the `src/` trees (via `.editorconfig` in each module's `src/` and in
  `modules/shared/`), so a raw `ILogger.Log*` call fails the build — a violation is a compile
  error, not merely frowned upon. The `.ToString()` prohibition is enforced separately, by a test
  (`LoggerMessagePayloadTests` in each of the three modules, backed by
  `LoggerMessagePayloadGuard` in `modules/shared/Observability.TestKit`), because no compiler can
  see it — a coercion compiles cleanly. Genuine exceptions are declared as an explicit allowance
  list with a reason; the guard also fails on an allowance that has stopped being used, so stale
  exemptions cannot accumulate.
- **Credentials are hashed, never logged raw** — SDK secrets, streaming and relay-proxy tokens, and
  JWTs. Everything else (payloads, IPs, webhook URLs) is logged raw on purpose, because that is what
  makes an incident diagnosable. New credential-bearing field names must be added to
  `Redaction.CredentialNames`. A credential-bearing event is declared as a private `…Core` method
  behind a public wrapper that redacts first, so logging the raw value is impossible rather than
  discouraged.
- **Shared primitives live in `modules/shared/Observability`** and are deliberately BCL-only. Do not
  add a package dependency to that project; put transport- or framework-specific glue in the module
  that needs it.
- **Scope gaps honestly.** If something is specified but not built, record it in the "known gaps"
  section of `instruments.md` with a reason. Documentation that overclaims coverage is worse than
  documentation that admits a hole.

## Architecture

```
modules/
  back-end/           # API server (.NET 10, C#, Clean Architecture)
  evaluation-server/  # Flag evaluation + streaming (.NET 10, C#)
  control-plane/      # Cross-DC control plane API (.NET 10, C#)
  front-end/          # Web UI (Angular 19, TypeScript)
e2e/
  control-plane/  # Control-Plane infrastructure for multi-cluster testing
```

**Data flow:** The API publishes changes to `cp-*` Kafka topics → the Control Plane consumes and updates Redis in all DCs, then republishes to default topics → Evaluation Servers push flag updates to SDK clients via WebSocket.

**Deployment tiers:**
- **Standard** (`docker-compose.yml`): PostgreSQL only
- **Professional** (`docker-compose-pro.yml`): PostgreSQL + Redis + Kafka + ClickHouse
- **MongoDB variant** (`docker-compose-mongodb.yml`): MongoDB instead of PostgreSQL

**Back-end layers** (Clean Architecture): `Api → Application → Domain → Infrastructure`

## Build, Test, and Lint Commands

### Back-end API (`modules/back-end/`)

```sh
dotnet restore
dotnet build -c Release --no-restore
dotnet test -c Release --no-build --verbosity normal

# Run a single test project
dotnet test tests/Domain.UnitTests -c Release --verbosity normal

# Run a single test by name
dotnet test --filter "FullyQualifiedName~MyTestClass.MyTestMethod"
```

### Evaluation Server (`modules/evaluation-server/`)

```sh
dotnet restore
dotnet build -c Release --no-restore
dotnet test -c Release --no-build --verbosity normal
dotnet test tests/Domain.UnitTests -c Release --verbosity normal
```

### Control Plane (`modules/control-plane/`)

```sh
dotnet restore
dotnet build -c Release --no-restore
dotnet test -c Release --no-build --verbosity normal
dotnet test tests/Api.UnitTests -c Release --verbosity normal
```

### Front-end (`modules/front-end/`)

```sh
npm ci
npm run build:prod     # production build with localization
npm test               # run all tests (Karma/Jasmine)
npm run i18n           # extract + validate i18n strings

# After adding UI text, run `npm run i18n` and add translations to src/locale/messages.xx.xlf
```

### Control-Plane QA Automation (`e2e/control-plane/02-Tests/automation-py/`)

Python 3.9–3.11, managed with Poetry. Uses pytest + Click CLI.

```sh
poetry install
poetry run pytest                              # all tests
poetry run pytest -m cp02                       # single scenario marker
poetry run pytest -k "test_my_specific_test"   # single test by name
```

Style: black (line-length 100), isort (profile black), flake8, mypy.

## Coding Conventions

### C# (.NET 10)

- `<Nullable>enable</Nullable>` and `<ImplicitUsings>enable</ImplicitUsings>` in all projects
- xUnit with `[Fact]` and `[Theory]`; mocking with Moq
- Global usings in `Usings.cs` (`global using Xunit;`, `global using Moq;`)
- Test class naming: `[Feature]Tests`, method naming: `MethodName_Condition_ExpectedBehavior`
- Private `CreateSut()` factory method for system-under-test instantiation
- Arrange-Act-Assert (AAA) structure in tests
- Allman braces, PascalCase methods, `_camelCase` private fields, `var` for obvious types

### TypeScript / Angular

- 2-space indentation, single quotes
- NG-ZORRO (Ant Design) component library
- i18n via `@angular/localize`: English on port 4200, Chinese on port 4201
- Test files: `[component-name].component.spec.ts` using Jasmine + Karma with Angular TestBed

### Python (QA scenarios)

- All scenarios inherit from `core.scenario_base.BaseScenario`
- Scenario files: `scenarios/cpXX.py` with `CPxxScenario` class
- Use existing helpers: `toggle_flag()`, `get_flag_state()`, `poll_convergence()`, `run_optional_check()`
- Assertions via `self.assertions.add_pass()` / `add_fail()` / `add_skip()`
- Lifecycle: `setup_artifacts()` → test logic → `write_artifacts()` → return `self.assertions.all_passed()`
- Register new scenarios as Click commands in `cli/main.py`

## PR Conventions

- Title: < 70 characters, sentence case
- Prefix with emoji: ✨ feature, 🐛 bugfix, 🔥 P0 fix, ✅ tests, 🚀 perf, 📖 docs, 🏗 infra, 🧹 refactor
- Labels: `UI`, `API`, `Evaluation Server`, `OLAP`
- Always include `Co-authored-by` trailer for AI-assisted commits

## Local Development

```sh
# Start infrastructure (PostgreSQL, Redis)
docker compose --project-directory . -f docker/composes/docker-compose-infra.yml up -d redis postgresql

# Run API server
cd modules/back-end/src/Api && dotnet run
# Swagger at http://localhost:5000/swagger

# Run UI
cd modules/front-end && npm install && npm start
# Available at http://localhost:4200
```

Default credentials: `test@featbit.com` / `123456`
