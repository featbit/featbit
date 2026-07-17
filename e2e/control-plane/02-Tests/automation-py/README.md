# Control-Plane Automation Suite (Python)

Cross-DC correctness (CP-02) and resilience (CP-03) scenario automation for FeatBit using pytest + Click CLI.

## Quick Start

### Installation

```bash
cd e2e/control-plane/automation-py
poetry install
```

This project uses Poetry and keeps the virtual environment inside the project directory.

### Configure Environment

Copy `.env.example` to `.env` and customize:

```bash
copy .env.example .env
```

### Run Seed Data

Create org/project/environment/flags:

```bash
poetry run automation seed --seed-data

poetry run automation seed `
  --west-api-base-url https://featbit-api.west.local `
  --login-api-base-url https://featbit-api.west.local `
  --login-email test@featbit.com `
  --login-password 123456 `
  --organization-key playground `
  --log-detail verbose
```

### Run Scenarios

**CP-02 (Cross-DC Correctness):**
```bash
poetry run automation suite cp02 --env-id <env-id>
```

**CP-03 (Resilience):**
```bash
poetry run automation suite cp03 --env-id <env-id> \
  --start-disruption "..." --stop-disruption "..." \
  --redis-west-check "..." --redis-east-check "..."
```

**Individual Scenario:**
```bash
poetry run automation scenario cp02-west-to-east --env-id <env-id>
```

## CLI Parity with PowerShell

| Operation | PowerShell | Python |
|-----------|-----------|--------|
| Seed | `.\Seed-ControlPlaneQaData.ps1` | `poetry run automation seed --seed-data` |
| Suite | `.\Invoke-CPScenarios.ps1 -Suite cp02` | `poetry run automation suite cp02 --env-id <id>` |
| Scenario | `.\Run-ControlPlaneScenario.ps1 -Scenario cp02-west-to-east` | `poetry run automation scenario cp02-west-to-east --env-id <id>` |

## Project Structure

```
automation-py/
├── pyproject.toml          # Dependencies and build config
├── .env.example            # Configuration template
├── core/                   # Core infrastructure
│   ├── api_client.py       # HTTP client wrapper
│   ├── auth.py             # Authentication (login-by-email, bearer tokens)
│   ├── assertions.py       # Assertion registry
│   ├── models.py           # Pydantic models
│   └── scenario_base.py    # Base scenario class
├── scenarios/              # Scenario implementations
│   ├── cp02.py             # CP-02 correctness scenarios
│   └── cp03.py             # CP-03 resilience scenarios
├── cli/                    # Click CLI
│   └── main.py             # CLI entry point
├── scripts/                # Utility scripts
│   └── seed_data.py        # Data seeding
└── README.md               # This file
```

## Requirements

- Python 3.9+
- pytest, requests, click, pydantic, tenacity, python-dotenv, colorama

## Artifact Output

Each scenario run produces:

- `summary.json` — Overall pass/fail and failed assertions
- `timeline.json` — Detailed event log (API calls, polls, disruption commands)
- `assertions.json` — Full assertion results

Example path: `e2e/control-plane/artifacts/cp02-west-to-east/<run-id>/`

## Features

- **Cross-DC correctness** (CP-02): Verify west→east and east→west flag propagation
- **Resilience** (CP-03): Verify convergence under Redis outages with optional disruption commands
- **Required checks**: Redis west/east checks enforced; scenarios fail if not provided
- **Optional checks**: Source/downstream topic checks, retry log checks (skipped if not configured)
- **Structured output**: JSON artifacts for machine parsing and comparison
- **Bearer token auth**: Automatic login-by-email with workspace/org context resolution

## Development

Format and lint:

```bash
poetry run black .
poetry run isort .
poetry run flake8 .
```

Run tests (when implemented):

```bash
poetry run pytest -v
```

Type check:

```bash
poetry run mypy .
```
