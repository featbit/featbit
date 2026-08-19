# FeatBit Aspire AppHost

This .NET Aspire AppHost runs the current FeatBit backend core loop with the
`StandardPostgres` topology:

- `postgresql`: the existing local PostgreSQL service on `localhost:5432`.
- `redis`: the existing local Redis service on `localhost:6379`.
- `api-server`: `modules/back-end/src/Api/Api.csproj` on ports `5000` and `5001`.
- `evaluation-server`: `modules/evaluation-server/src/Api/Api.csproj` on ports `5100` and `5101`.
- `ui`: the Vite app in `modules/front-end`; Aspire runs `npm ci` and then
  `npm run dev` before exposing its managed HTTP endpoint.

The topology uses PostgreSQL for storage and Redis for messaging and caching.
The main UI is enabled by default through `FeatBit:IncludeUi`. The separate
`release-decision-web` resource remains disabled through
`FeatBit:IncludeReleaseDecisionWeb`.

## Run

```powershell
cd .aspire
aspire start --non-interactive
aspire wait api-server
aspire wait evaluation-server
aspire wait ui
```

Open the Aspire Dashboard URL printed by `aspire start`, or use:

- API Swagger: http://localhost:5000/swagger
- Evaluation server: http://localhost:5100 and https://localhost:5101
- Main UI: use the `ui` endpoint reported by `aspire describe --format Json`

```powershell
aspire describe --format Json
aspire stop --non-interactive
```

The external infrastructure connection strings are stored in the AppHost user
secrets under `ConnectionStrings:postgresql` and `ConnectionStrings:redis`.
Aspire does not create or stop those Docker containers.

## OpenTelemetry

The AppHost only configures FeatBit's existing OpenTelemetry support; it does not modify the api-server or evaluation-server projects.

- Logs are exported by FeatBit's existing Serilog OpenTelemetry sink when `ENABLE_OPENTELEMETRY=true`.
- Traces and metrics require .NET Automatic Instrumentation for local source debugging, because Aspire starts the projects with `dotnet run` instead of the FeatBit Docker image `start.sh`.

If .NET Automatic Instrumentation is installed in one of the standard Windows locations, or `OTEL_DOTNET_AUTO_HOME` points to it, AppHost passes the startup hook/profiler environment variables to `api-server` and `evaluation-server`.

For this workspace, .NET Automatic Instrumentation is expected at:

```text
%USERPROFILE%\.otel-dotnet-auto
```

## Cleanup

Always stop the AppHost through Aspire so project processes and port bindings are
released cleanly:

```powershell
aspire stop --non-interactive
```
