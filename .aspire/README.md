# FeatBit Aspire AppHost

This AppHost defaults to a self-contained stack that runs the current and
comparison React UIs side by side:

- `postgresql`: PostgreSQL 15.10 on `localhost:5432`, created and seeded by Aspire.
- `api-server`: `modules/back-end/src/Api/Api.csproj` on ports `5000` and `5001`.
- `ui`: the Vite app in `modules/front-end`; Aspire runs `npm ci` and `npm run dev`.
- `release-decision-web`: the comparison Vite app in `modules/front-end-rda-tempo`;
  it uses the same `api-server` and therefore the same PostgreSQL data.

The default `Standalone` topology uses PostgreSQL for storage and messaging and
disables the distributed cache. Redis and the Evaluation Server are not needed
for ordinary management-UI testing.

The PostgreSQL resource applies the released schema scripts, the backend's
development-only `vNext.sql` fixture, and the consolidated
[`v6.0.0-experimentation-schema.sql`](postgres-init/v6.0.0-experimentation-schema.sql)
for the experiment and MCP entity model. Its separate
`featbit-aspire-postgres-vnext` volume keeps this development schema isolated
from older Aspire data volumes.

The consolidated script contains the current table and index definitions.
The test fixture prepares the empty legacy tables created by the released
scripts before applying those definitions. Keep the table and index definitions
in `Fixtures/vNext.sql` in sync with the consolidated script. PostgreSQL runs
the initialization directory only on an empty data volume.

## Start or restart the UI comparison stack

Use the `StandardPostgres` topology for the current/new UI comparison workflow.
It runs PostgreSQL, Redis, the API, the Evaluation Server, and both React UIs.
Docker Desktop must be running first.

PowerShell environment variables only apply to the current terminal. Run this
complete sequence after opening a new PowerShell terminal or restarting the
machine:

```powershell
cd C:\Code\featbit\featbit

$env:FeatBit__Topology = 'StandardPostgres'
$env:FeatBit__UseExistingInfrastructure = 'false'
$env:FeatBit__IncludeUi = 'true'
$env:FeatBit__IncludeReleaseDecisionWeb = 'true'
$env:FeatBit__IncludeEvaluationServer = 'true'

aspire start
aspire wait postgresql
aspire wait redis
aspire wait api-server
aspire wait evaluation-server
aspire wait ui --timeout 600
aspire wait release-decision-web --timeout 600
```

Run the commands from the repository root. Its `aspire.config.json` already
points to `.aspire/FeatBit.AppHost.csproj`, so `--apphost` is unnecessary. The
configuration variable names contain two literal underscores (`__`); do not add
backslashes.

`aspire start` starts the AppHost in the background and returns control to the
terminal. Get the current Dashboard URL at any time with:

```powershell
aspire ps
```

For foreground operation, use `aspire run` instead. That terminal must remain
open: pressing `Ctrl+C`, closing the terminal, or stopping the terminal task
shuts down the entire AppHost and invalidates its Dashboard URL.

With `UseExistingInfrastructure=false`, Aspire starts PostgreSQL and Redis in
Docker automatically; do not also start `docker-compose-infra.yml`, because it
uses the same ports. PostgreSQL data is stored in the named Docker volume
`featbit-aspire-postgres-vnext`, and Redis data uses `featbit-aspire-redis`.
Normal `aspire stop`/`aspire start` cycles preserve both volumes.

Open the `ui` and `release-decision-web` endpoints reported by:

```powershell
aspire describe --format Json --non-interactive
```

Useful fixed endpoints:

- API Swagger: http://localhost:5000/swagger
- UI backend API: http://localhost:5000
- Seeded login: `test@featbit.com` / `123456`

## Alternative configurations

Use .NET configuration environment variables to opt into a larger topology.
Set them in the same PowerShell session before `aspire start`.

### UI-only stack without Evaluation Server

The comparison workflow above enables the Evaluation Server for SDK evaluation,
streaming/event URLs, and experiment E2E testing. Disable it for ordinary
management-UI testing:

```powershell
$env:FeatBit__IncludeEvaluationServer = 'false'
aspire start
```

### Existing local infrastructure

Existing-infrastructure mode currently supports `StandardPostgres` only and
expects PostgreSQL on `localhost:5432` and Redis on `localhost:6379`:

```powershell
$env:FeatBit__Topology = 'StandardPostgres'
$env:FeatBit__UseExistingInfrastructure = 'true'
aspire start --non-interactive
```

Store the connection strings in the AppHost user secrets under
`ConnectionStrings:postgresql` and `ConnectionStrings:redis`. Aspire does not
create, stop, or migrate those external services, so their schema must already
match the current backend model.

Both React UIs are enabled by default. To run only the current UI, disable the
comparison app before starting Aspire:

```powershell
$env:FeatBit__IncludeReleaseDecisionWeb = 'false'
aspire start --non-interactive
```

The old Angular `front-end-v1`, MongoDB, Kafka, ClickHouse, and control-plane
services are not part of the default UI test stack.

## OpenTelemetry

The AppHost only configures FeatBit's existing OpenTelemetry support; it does
not modify the API projects.

- Logs are exported by FeatBit's existing Serilog OpenTelemetry sink when
  `ENABLE_OPENTELEMETRY=true`.
- Traces and metrics require .NET Automatic Instrumentation for local source
  debugging, because Aspire starts projects with `dotnet run` instead of the
  FeatBit Docker image `start.sh`.

If .NET Automatic Instrumentation is installed in a standard Windows location,
or `OTEL_DOTNET_AUTO_HOME` points to it, AppHost passes the startup hook and
profiler environment variables to the API resources.

## Cleanup

Stop the AppHost through Aspire so project processes and port bindings are
released cleanly:

```powershell
aspire stop
```
