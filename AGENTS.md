# AGENTS.md

This file is the first local operating guide for agents working in this repository.

## Repository Shape

FeatBit is a multi-service application. For local debugging in this branch, prefer the .NET Aspire AppHost instead of ad-hoc Docker Compose or independently chosen ports.

Main modules:

- `aspire-apphost`: .NET Aspire AppHost for local pg-only standalone debugging.
- `modules/back-end`: FeatBit API server.
- `modules/evaluation-server`: FeatBit evaluation/streaming server.
- `modules/front-end`: FeatBit Angular UI.
- `modules/data-analytics`: FeatBit data analytics server code; the Aspire AppHost currently runs the published Docker image.
- `modules/release-decision-web`: standalone Next.js release-decision frontend copied from the release-decision-agent project.
- `infra/postgresql/docker-entrypoint-initdb.d`: PostgreSQL initialization and migration SQL scripts.

## Tech Stack And Versions

Use versions from project files, not memory.

- Aspire AppHost:
  - `net10.0`
  - `Aspire.AppHost.Sdk/13.4.0`
  - `Aspire.Hosting.PostgreSQL 13.4.0`
- Back-end API:
  - ASP.NET Core on `net10.0`
  - EF Core packages around `10.0.x`
  - Npgsql EF provider `10.0.1`
  - API versioning `10.0.0`
  - Serilog `10.0.0`, OpenTelemetry sink `4.2.0`
- Evaluation server:
  - ASP.NET Core on `net10.0`
  - Serilog `10.0.0`, OpenTelemetry sink `4.2.0`
- Angular UI:
  - Angular `19.2.x`
  - Angular CLI `19.2.15`
  - TypeScript `5.5.4`
  - ng-zorro-antd `19.3.1`
  - RxJS `7.8.x`
- Release-decision web:
  - Next.js `16.2.x`
  - React `19.2.4`
  - TypeScript `5.x`
  - Tailwind CSS `4.x`
  - Prisma `5.22.0` is still present only as a transitional type-generation dependency. Runtime data access must go through FeatBit API.
- Data analytics:
  - Python service with Flask `2.1.2`, Werkzeug `2.2.3`, Gunicorn `20.1.0`
  - Uses Postgres, ClickHouse, Kafka-related libraries, and OpenTelemetry packages.

## Aspire Local Debugging

Use Aspire as the preferred local debug topology:

```powershell
cd C:\Code\featbit\featbit
aspire run
```

The AppHost is `aspire-apphost/FeatBit.AppHost.csproj`.

Current Aspire resources and fixed ports:

- `postgresql`: PostgreSQL exposed at `localhost:5432`
- `da-server`: `featbit/featbit-data-analytics-server:latest` exposed at `http://localhost:8200`
- `api-server`: `modules/back-end/src/Api/Api.csproj` exposed at `http://localhost:5000` and `https://localhost:5001`
- `evaluation-server`: `modules/evaluation-server/src/Api/Api.csproj` exposed at `http://localhost:5100` and `https://localhost:5101`
- `ui`: Angular UI via `npm run start` in `modules/front-end`, exposed at `http://localhost:4200`
- `release-decision-web`: Next.js app via `npm run dev` in `modules/release-decision-web`, exposed at `http://localhost:3000` and proxied by Angular at `http://localhost:4200/release-decision`

Do not increment ports after failures. This AppHost intentionally uses fixed ports. If a port is busy, clean up the stale process or container.

Use:

```powershell
cd C:\Code\featbit\featbit\aspire-apphost
.\Stop-FeatBitAspire.ps1
```

If Aspire-created PostgreSQL or data analytics containers are also stale:

```powershell
.\Stop-FeatBitAspire.ps1 -IncludeDocker
```

## Aspire PostgreSQL Rules

The Aspire AppHost exposes PostgreSQL directly on `localhost:5432` with:

```text
database: featbit
username: postgres
password: please_change_me
```

The AppHost bind-mounts:

```text
infra/postgresql/docker-entrypoint-initdb.d -> /docker-entrypoint-initdb.d
```

It also uses the named Aspire data volume:

```text
featbit-aspire-postgres
```

Important:

- Init scripts run only when the PostgreSQL data volume is first initialized.
- Editing `infra/postgresql/docker-entrypoint-initdb.d/*.sql` does not automatically update an existing Aspire PostgreSQL volume.
- To apply a new SQL script to an existing Aspire database, connect through the exposed `localhost:5432` port.
- Do not assume a Docker Compose container name. This is an Aspire-managed PostgreSQL resource, not the Compose topology.
- If `psql` is unavailable, inspect the Aspire resource/container identity first. Do not guess a `docker exec` target.

Example with local `psql`:

```powershell
psql "postgresql://postgres:please_change_me@localhost:5432/featbit" -f infra/postgresql/docker-entrypoint-initdb.d/v5.5.0.sql
```

## Release Decision Data Ownership

The canonical release-decision experiment tables live in FeatBit API/PostgreSQL:

```text
release_decision_experiments
release_decision_experiment_runs
release_decision_activities
release_decision_messages
```

They are defined in:

```text
infra/postgresql/docker-entrypoint-initdb.d/v5.5.0.sql
```

The standalone `modules/release-decision-web` app must query and mutate core experiment data through FeatBit API endpoints, not through old Prisma experiment tables.

Current FeatBit API release-decision endpoint family:

```text
/api/v1/envs/{envId}/release-decision/experiments
/api/v1/envs/{envId}/release-decision/experiments/{id}
/api/v1/envs/{envId}/release-decision/experiments/{id}/runs
/api/v1/envs/{envId}/release-decision/experiments/{id}/runs/{runId}
/api/v1/envs/{envId}/release-decision/experiments/{id}/runs/{runId}/analyze
/api/v1/envs/{envId}/release-decision/experiments/{id}/messages
```

Experiment stats query endpoint:

```text
/api/v1/envs/{envId}/experiment-stats/query
```

`modules/release-decision-web/prisma/schema.prisma` is transitional. Do not apply its old experiment migrations as database truth. Runtime auth/session state is stored in a signed HttpOnly cookie, not in `auth_session`.

## Angular Release Decision Status

The Angular `/release-decision` migration was intentionally backed out in this branch. Do not recreate Angular release-decision UI changes unless explicitly requested.

The release-decision frontend direction is:

1. Keep `modules/release-decision-web` as the standalone frontend for now.
2. Move server/data logic into FeatBit API.
3. Serve it under the Angular dev-server origin at `/release-decision`.
4. Replace Next.js API routes with FeatBit API calls.
5. `/data/ai-memory`, `/data/apis-sdks`, `/data-warehouse`, marketing/blog pages, memory APIs, agent token APIs, customer endpoint APIs, sandbox0 APIs, and their Prisma models are intentionally removed.
6. A/B testing analysis routes may remain in Next temporarily, but they must call FeatBit API for experiment data and stats.

## Build And Verification Commands

Back-end API:

```powershell
dotnet build modules\back-end\src\Api\Api.csproj -p:OutDir=C:\tmp\featbit-api-build\
```

Evaluation server:

```powershell
dotnet build modules\evaluation-server\src\Api\Api.csproj -p:OutDir=C:\tmp\featbit-evaluation-build\
```

Angular UI:

```powershell
cd modules\front-end
npm run build:dev
```

Release-decision web:

```powershell
cd modules\release-decision-web
npm ci
npm run build
```

When testing the Aspire path, open Angular at `http://localhost:4200` and navigate to `/release-decision`. The Angular proxy forwards that subpath to the Next dev server.

## OpenTelemetry In Aspire

The AppHost configures OpenTelemetry for:

- `api-server`
- `evaluation-server`
- `da-server`

The .NET projects export OTLP logs with existing FeatBit configuration. Traces and metrics require .NET automatic instrumentation when running source projects locally.

The AppHost searches for .NET auto-instrumentation at:

```text
%USERPROFILE%\.otel-dotnet-auto
%USERPROFILE%\.opentelemetry-dotnet-auto
C:\Program Files\OpenTelemetry .NET AutoInstrumentation
C:\ProgramData\OpenTelemetry .NET AutoInstrumentation
```

If it is not found, do not modify API/evaluation project code just to make Aspire traces appear. Fix the local auto-instrumentation setup instead.

## Coding Boundaries

- Follow existing ASP.NET Core architecture: controllers call MediatR request models; application services define contracts; infrastructure services implement storage.
- Do not alter existing public API endpoints when adding release-decision support; add new endpoints where needed.
- Keep SQL changes in the versioned files under `infra/postgresql/docker-entrypoint-initdb.d`.
- Do not revive DAS as the future experimentation query layer. Release-decision experiment stats should move through FeatBit API and current FeatBit data stores.
- Do not use ad-hoc port changes as a workaround. Clean up the stale process.
- Do not revert user changes. Check `git status` before broad edits.
