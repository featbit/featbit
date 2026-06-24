---
name: featbit-e2e-test-cycle
description: Run the interactive Codex-agent FeatBit E2E validation cycle across local Docker Compose topologies. Use when testing FeatBit REST API, SDK evaluation, release-decision experiments, manual report review, topology cleanup, and repeated environment validation. Never use `aspire run`.
license: MIT
metadata:
  author: FeatBit
  version: "1.0.0"
---

# FeatBit E2E Test Cycle

Use this skill to drive the human-in-the-loop FeatBit E2E validation cycle.
The agent owns local topology startup, API login, project/environment creation,
script execution, report collection, and cleanup. The tester owns final manual
acceptance.

Hard rule: do not run `aspire run`. Use only the Docker Compose files listed in
[references/topologies.md](references/topologies.md).

## Execution Procedure

```
run_featbit_e2e_cycle() -> completed | blocked

topologies = load_topology_order()                    # references/topologies.md
for topology in topologies:
    cleanup_stale_fixed_ports(topology)
    start_topology(topology)                           # docker compose only; never aspire run
    assert local_services_ready(topology)
    assert_local_login_credentials_present()           # default: test@featbit.com / 123456
    report = run_e2e_with_auto_login(topology)
    assert report.markdown_path
    request_manual_report_review(report)               # HITL: compare against TEST_SCRIPT.md#91
    if tester_passed:
        destroy_topology(topology)
        continue
    keep_topology_running_for_debug()
    return blocked
return completed
```

## Required Inputs

For local Docker Compose E2E execution, use the seeded local login account:

- `loginEmail`: `test@featbit.com`
- `loginPassword`: `123456`

Prefer environment variables when the tester wants to override the defaults:

```powershell
$env:FEATBIT_LOGIN_EMAIL = "test@featbit.com"
$env:FEATBIT_LOGIN_PASSWORD = "123456"
```

The runner calls `POST /api/v1/identity/login-by-email`, uses the returned JWT
as bearer auth, and creates the project/environment automatically. Do not print
passwords or access tokens back to the user.

## Fixed Loop

Run one topology at a time, in the exact order from the topology reference.

1. Clean stale fixed-port services before starting the next topology.
2. Start the topology with Docker Compose, not `aspire run`.
3. Wait until API `http://localhost:5000`, evaluation `http://localhost:5100`,
   and UI `http://localhost:8081` are reachable enough for tester login.
4. Run the E2E script with `-LoginEmail test@featbit.com -LoginPassword 123456`
   unless the tester provided overrides through `FEATBIT_LOGIN_EMAIL` and
   `FEATBIT_LOGIN_PASSWORD`.
5. The runner logs in, creates the project/environment, and executes the
   fixed-data E2E flow.
6. Show the generated Markdown report path.
7. Stop. Ask the tester to manually compare the report against
   `integration-tests/featbit-rest-api-e2e/TEST_SCRIPT.md#91-manual-final-inspection-checklist`.
8. If the tester says the report passes, destroy the topology with volumes and
   orphans removed, then move to the next topology.
9. If the tester says it failed, keep the topology running for inspection and
    do not proceed to cleanup until explicitly told.

## Commands

Use these command shapes from the repository root.

Start:

```powershell
docker compose -f <compose-file> up -d --build
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

Destroy after tester approval:

```powershell
docker compose -f <compose-file> down -v --remove-orphans
```

Before starting the next topology, also clear stale fixed-port local processes:

```powershell
.\.aspire\Stop-FeatBitAspire.ps1 -IncludeDocker
```

This cleanup command is allowed because it stops stale local processes and
containers; it is not `aspire run`.

## Reporting

For every topology, keep the generated Markdown and JSON reports under:

```text
integration-tests/featbit-rest-api-e2e/reports/<topology-id>/
```

Summarize each completed topology with:

- topology id
- compose file
- report path
- E2E script result
- tester manual result
- cleanup result

Never create or claim a passing live report without an actual script run.

## Topology Reference

Read [references/topologies.md](references/topologies.md) before starting.
It defines the exact order, compose files, endpoint assumptions, and cleanup
commands for all required topologies.
