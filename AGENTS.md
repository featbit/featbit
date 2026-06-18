# AGENTS.md

This file is the first local operating guide for agents working in this repository. Keep it simple: understand the project boundaries before changing code.

## Project Structure

- `modules/`: contains the concrete application implementations. For feature work, bug fixes, UI changes, and API changes, start here.
- `infra/`: infrastructure configuration and initialization scripts, including PostgreSQL, MongoDB, Redis, Kafka, ClickHouse, and OpenTelemetry. Database initialization and migration SQL lives under `infra/postgresql/docker-entrypoint-initdb.d/`.
- `docker/`: Docker runtime and packaging configuration, including compose fragments, HTTPS setup, local experiment environment files, and UI/API bundle assets.
- `.aspire/`: the Microsoft Aspire AppHost for local integration debugging. This is the preferred ai-native local debug entry point for starting PostgreSQL, the API server, the evaluation server, the front-end, and release-decision-web together.
- Other directories are not the default focus for agents. Ignore them unless the task explicitly requires them.

## Modules

When writing code under `modules/`, respect the existing code style, modular boundaries, and design patterns of the specific project you are touching. Do not introduce ad-hoc structures, tangled dependencies, or low-quality shortcuts when the repository already has established patterns to follow.

### `modules/back-end`

FeatBit API server.

- Tech stack: ASP.NET Core / .NET `net10.0`, MediatR-style application requests, EF Core `10.x`, Npgsql, Serilog, and OpenTelemetry.
- Responsibility: core business APIs, data access, management capabilities, and release-decision/experimentation backend endpoints.
- Constraint: follow the existing controller -> application request/service -> infrastructure structure. Do not casually change existing public API semantics.

### `modules/evaluation-server`

FeatBit evaluation / streaming server.

- Tech stack: ASP.NET Core / .NET `net10.0`, Serilog, OpenTelemetry, and gRPC client dependencies.
- Responsibility: feature flag evaluation, streaming, and SDK-facing runtime behavior.
- Constraint: this service focuses on flag evaluation and realtime delivery. It should not own release-decision product experimentation orchestration.

### `modules/front-end`

FeatBit Angular UI.

- Tech stack: Angular `19.2.x`, Angular CLI `19.2.x`, TypeScript `5.5.x`, RxJS `7.8.x`, and ng-zorro-antd `19.3.x`.
- Responsibility: the main FeatBit product UI.
- Release-decision direction: `release-decision-web` will be integrated as the experimentation module for `front-end`. In local development, the Angular dev server proxies `/release-decision` to the Next.js app.

### `modules/release-decision-web`

FeatBit experimentation / release decision frontend.

- Tech stack: Next.js `16.2.x`, React `19.2.x`, TypeScript `5.x`, and Tailwind CSS `4.x`.
- Responsibility: the experimentation module for `front-end`, covering experiment creation, runs, analysis, and release decisions.
- Data direction: core experiment data must be read and written through the FeatBit API. Do not treat the old Prisma experiment tables as runtime data truth.

### `modules/data-analytics`

Data analytics server.

- Tech stack: Python `3.9` Docker image, Flask `2.1.x`, Werkzeug `2.2.x`, Gunicorn `20.1.x`, and ClickHouse/Kafka/PostgreSQL/MongoDB-related libraries.
- Status: starting in `5.5.0`, this is legacy and mainly exists for backward compatibility.
- Constraint: this is not required for new experimentation capabilities. Unless the task explicitly asks for compatibility with old DAS behavior, do not put new release-decision / experimentation business logic here.

## Local Integration Debugging

Use Aspire AppHost as the preferred local integration topology:

```powershell
cd C:\Code\featbit\featbit
cd .aspire
aspire run
```

The AppHost project is:

```text
.aspire/FeatBit.AppHost.csproj
```

Do not solve port conflicts by incrementing ports. This local topology intentionally uses fixed ports. If a port is busy, clean up the stale process or container first.

## Release Decision / Experimentation Rules

When a task involves release-decision, meaning FeatBit experimentation, especially any of the following areas, first align with `featbit/featbit-release-decision-skills`:

- A/B test algorithms
- Experiment statistics definitions
- Experiment business workflows
- Exposure, metrics, guardrails, and decision rules
- Experiment analysis, conclusion generation, rollout decisions, and rollback decisions

Alignment sources:

- Local: `~/featbit/featbit-release-decision-skills`
- GitHub: `github.com/featbit/featbit-release-decision-skills`
- Priority references: best practices and theory in `tutorials/`, plus experiment workflow guidance in `skills/`.

If the local material is unavailable, state the gap and continue with the GitHub version or the current repository context. Do not invent new experimentation algorithms or business workflows without aligning with these materials.

## Change Principles

- Inspect existing project files and code patterns before editing.
- Do not revert user changes.
- Put SQL changes in versioned scripts under `infra/postgresql/docker-entrypoint-initdb.d/`.
- Core release-decision experiment data belongs to the FeatBit API/PostgreSQL. Frontends consume it through APIs.
- Unless the task explicitly requires it, ignore directories not named in this file.
