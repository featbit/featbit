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
development-only `vNext.sql` fixture, and an AppHost-only overlay for the
current experiment and MCP entity model. Its separate
`featbit-aspire-postgres-vnext` volume keeps this development schema isolated
from older Aspire data volumes. The overlay replaces legacy experiment tables
only when they are empty and otherwise stops initialization rather than
discarding data.

## Run the UI stack

From the repository root (`aspire.config.json` points to this AppHost):

```powershell
aspire start --non-interactive
aspire wait postgresql --non-interactive
aspire wait api-server --non-interactive
aspire wait ui --non-interactive
aspire wait release-decision-web --non-interactive
```

Open the `ui` and `release-decision-web` endpoints reported by:

```powershell
aspire describe --format Json --non-interactive
```

Useful fixed endpoints:

- API Swagger: http://localhost:5000/swagger
- UI backend API: http://localhost:5000
- Seeded login: `test@featbit.com` / `123456`

## Optional services

Use .NET configuration environment variables to opt into a larger topology.
Set them in the same PowerShell session before `aspire start`.

### Evaluation and SDK streaming

Enable the Evaluation Server only when testing SDK evaluation, streaming/event
URLs, or the quick demo:

```powershell
$env:FeatBit__IncludeEvaluationServer = 'true'
aspire start --non-interactive
aspire wait evaluation-server --non-interactive
```

It uses `http://localhost:5100` and `https://localhost:5101`.

### Redis-backed standard topology

Enable Redis as both message queue and cache:

```powershell
$env:FeatBit__Topology = 'StandardPostgres'
aspire start --non-interactive
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
aspire stop --non-interactive
```
