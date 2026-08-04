# FeatBit — Copilot Instructions

FeatBit is an open-source feature flag management platform. It is a polyglot monorepo with .NET APIs, an Angular UI, Python analytics, and Kubernetes-based multi-cluster deployment tooling.

## Workflow

Before you start any work, state how you would verify it. After you finish, run the verification and report the results.

## Architecture

```
modules/
  back-end/           # API server (.NET 10, C#, Clean Architecture)
  evaluation-server/  # Flag evaluation + streaming (.NET 10, C#)
  control-plane/      # Cross-DC control plane API (.NET 10, C#)
  front-end/          # Web UI (Angular 19, TypeScript)
  data-analytics/     # Analytics server (Python 3.9+, Flask)
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

### Data Analytics (`modules/data-analytics/`)

Python 3.9+ with Flask. Dependencies in `requirements.txt`.

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
