---
name: topologies
description: Defines the required FeatBit local E2E topology order, Docker Compose files, fixed local endpoints, report directories, human-gate prompts, and cleanup commands for the Codex-agent test cycle.
---

# FeatBit E2E Topology Order

Run these topologies in order. Every topology uses fixed local endpoints:

| Service | URL |
| --- | --- |
| UI | `http://localhost:8081` |
| API | `http://localhost:5000` |
| Evaluation/event | `http://localhost:5100` |
| Streaming | `ws://localhost:5100` |

Do not increment ports. If a port is busy, stop the stale process/container
before starting the next topology.

## Execution Procedure

```
load_topology_order() -> topology[]

read Required Order table
for each topology:
    use topology_id, compose_file, report_directory
    apply Per-Topology Command Template
    use Human Gate Prompt before E2E execution
    use Manual Review Prompt after report generation
return ordered topology list
```

## Required Order

These are the unique Docker Compose topologies. The topology id is the report
label and directory name; the compose file is the actual runtime definition.

| Order | Topology id | Human label | Compose file | Report directory |
| --- | --- | --- | --- | --- |
| 1 | `compose-new` | PostgreSQL only | `docker-compose-new.yml` | `integration-tests\featbit-rest-api-e2e\reports\compose-new` |
| 2 | `compose-new-stdpg` | Redis + PostgreSQL | `docker-compose-new-stdpg.yml` | `integration-tests\featbit-rest-api-e2e\reports\compose-new-stdpg` |
| 3 | `compose-new-stdmongo` | Redis + MongoDB | `docker-compose-new-stdmongo.yml` | `integration-tests\featbit-rest-api-e2e\reports\compose-new-stdmongo` |
| 4 | `compose-new-pro` | Redis + PostgreSQL + Kafka + ClickHouse | `docker-compose-new-pro.yml` | `integration-tests\featbit-rest-api-e2e\reports\compose-new-pro` |

## Per-Topology Command Template

Replace `<compose-file>` and `<topology-id>` from the table.

Cleanup before start:

```powershell
.\.aspire\Stop-FeatBitAspire.ps1 -IncludeDocker
docker compose -f <compose-file> down -v --remove-orphans
```

Start:

```powershell
docker compose -f <compose-file> up -d --build
```

Check service state:

```powershell
docker compose -f <compose-file> ps
```

Run E2E after the topology is ready:

```powershell
.\integration-tests\featbit-rest-api-e2e\run-featbit-rest-api-e2e.ps1 `
  -LoginEmail $(if ($env:FEATBIT_LOGIN_EMAIL) { $env:FEATBIT_LOGIN_EMAIL } else { "test@featbit.com" }) `
  -LoginPassword $(if ($env:FEATBIT_LOGIN_PASSWORD) { $env:FEATBIT_LOGIN_PASSWORD } else { "123456" }) `
  -ApiUrl http://localhost:5000 `
  -EventUrl http://localhost:5100 `
  -StreamingUrl ws://localhost:5100 `
  -Users 1500 `
  -MinUsersPerVariant 500 `
  -ReportDir "integration-tests\featbit-rest-api-e2e\reports\<topology-id>"
```

Destroy after tester says the manual report check passed:

```powershell
docker compose -f <compose-file> down -v --remove-orphans
```

## Human Gate Prompt

After startup, use the seeded local login account by default:

```text
The topology is ready. I will run the E2E with login-by-email using
test@featbit.com / 123456 unless you provide FEATBIT_LOGIN_EMAIL and
FEATBIT_LOGIN_PASSWORD overrides.
```

After the E2E run, ask:

```text
Please open the generated Markdown report and compare it against
integration-tests/featbit-rest-api-e2e/TEST_SCRIPT.md#91-manual-final-inspection-checklist.
Reply "pass" when the manual check passes, or describe the mismatch.
```

Only proceed to `docker compose down -v --remove-orphans` after the tester says
the manual check passes.
