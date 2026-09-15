# FeatBit Aspire AppHost

This .NET Aspire AppHost runs the current FeatBit backend core loop with the
`StandardPostgres` topology:

- `postgresql`: Aspire starts PostgreSQL 15.10 on `127.0.0.1:5432`, using the
  retained `featbit-infra_postgres_data` Docker volume for this design branch.
- `redis`: Aspire starts Redis on `127.0.0.1:6379`, using the separate
  `featbit-releasehealth-design-redis` volume. On first start, the API populates
  this cache from the selected PostgreSQL database.
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
aspire wait api-server --non-interactive
aspire wait evaluation-server --non-interactive
aspire wait ui --non-interactive
```

Open the Aspire Dashboard URL printed by `aspire start`, or use:

- API Swagger: http://localhost:5000/swagger
- Evaluation server: http://localhost:5100 and https://localhost:5101
- Main UI: use the `ui` endpoint reported by `aspire describe --format Json`

```powershell
aspire describe --format Json --non-interactive
aspire stop --non-interactive
```

The default volume selection is explicit in `appsettings.json` under
`FeatBit:PostgresDataVolume`, `FeatBit:PostgresDataDirectory`, and
`FeatBit:RedisDataVolume`. The retained PostgreSQL volume stores its cluster at
the volume root, so `PGDATA` must be `/var/lib/postgresql/data`.

This database contains the `Release Health integration 20260902083749` project
and its saved metrics, connections, and bindings. The separate
`featbit-aspire-postgres-vnext` volume belongs to the later `review-experiment`
setup and is not used by this branch. Local backups made before the switch are
stored in the ignored `.logs/db-switch-*` directories.

Keep the old `featbit-infra-postgresql-1` Compose container stopped while Aspire
is running: both mount the same PostgreSQL volume, which must have only one
running database process. Aspire manages the active containers; stopping Aspire
preserves their named data volumes.

To opt into externally managed services, set `FeatBit:UseExistingInfrastructure`
to `true` and configure `ConnectionStrings:postgresql` and
`ConnectionStrings:redis` in the AppHost user secrets. This mode does not manage
those external Docker containers.

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
