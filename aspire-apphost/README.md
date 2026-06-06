# FeatBit Aspire AppHost

This .NET Aspire AppHost runs a local pg-only FeatBit standalone debug topology:

- `postgresql`: PostgreSQL 15.10-compatible local resource on port `5432`, using the existing SQL scripts from `infra/postgresql/docker-entrypoint-initdb.d`.
- `da-server`: `featbit/featbit-data-analytics-server:latest` on port `8200`, only when `FEATURE_FLAG_INSIGHTS_PROVIDER=featbit-das`.
- `api-server`: `modules/back-end/src/Api/Api.csproj` on ports from its launch profile.
- `evaluation-server`: `modules/evaluation-server/src/Api/Api.csproj` on port `5100`.
- `ui`: `npm run start` from `modules/front-end` on port `4200`.

## Run

```powershell
cd aspire-apphost
dotnet restore
aspire run
```

Open the Aspire Dashboard URL printed by `aspire run`, or use:

- UI: http://localhost:4200
- API Swagger: http://localhost:5000/swagger
- Evaluation server: http://localhost:5100 and https://localhost:5101
- Data analytics server: http://localhost:8200, only when `FEATURE_FLAG_INSIGHTS_PROVIDER=featbit-das`

Aspire defaults feature flag usage insights to the API path:

```powershell
$env:FEATURE_FLAG_INSIGHTS_PROVIDER = "featbit-api"
aspire run
```

To run the legacy Python data analytics path instead:

```powershell
$env:FEATURE_FLAG_INSIGHTS_PROVIDER = "featbit-das"
aspire run
```

If another local PostgreSQL instance already uses port `5432`, stop it first or change the Postgres port in `AppHost.cs` and the `postgresConnectionString` value together.

The Get Started interactive demo is served from `https://featbit-samples.vercel.app`, so local evaluation events must use the HTTPS endpoint (`https://localhost:5101`). An HTTPS page cannot reliably post insight events to `http://localhost:5100`.

## OpenTelemetry

The AppHost only configures FeatBit's existing OpenTelemetry support; it does not modify the api-server or evaluation-server projects.

- Logs are exported by FeatBit's existing Serilog OpenTelemetry sink when `ENABLE_OPENTELEMETRY=true`.
- Traces and metrics require .NET Automatic Instrumentation for local source debugging, because Aspire starts the projects with `dotnet run` instead of the FeatBit Docker image `start.sh`.

If .NET Automatic Instrumentation is installed in one of the standard Windows locations, or `OTEL_DOTNET_AUTO_HOME` points to it, AppHost passes the startup hook/profiler environment variables to `api-server` and `evaluation-server`.

For this workspace, .NET Automatic Instrumentation is expected at:

```text
%USERPROFILE%\.otel-dotnet-auto
```

When `FEATURE_FLAG_INSIGHTS_PROVIDER=featbit-das`, the data analytics server image already contains Python OpenTelemetry packages and runs `opentelemetry-instrument` when `ENABLE_OPENTELEMETRY=true`. AppHost configures it to export to the Aspire Dashboard OTLP endpoint and mounts `certs/aspire-dashboard.pem` so Python gRPC can trust Aspire's local TLS certificate.

## Cleanup Stale Local Processes

This AppHost uses fixed local ports. If a previous failed run left a `dotnet` or `node` process listening on one of those ports, clean it up before starting again:

```powershell
.\Stop-FeatBitAspire.ps1
```

To also stop the Aspire-created PostgreSQL and data analytics containers that use ports `5432` and `8200`:

```powershell
.\Stop-FeatBitAspire.ps1 -IncludeDocker
```
