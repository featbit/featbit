# E2E Core Tests

End-to-end validation of core system capabilities across five deployment stacks, for local development and CI.

## Getting started

Requires Node.js 22+, Docker Compose v2 and the .NET 8 SDK. Start Docker, then **run from this directory**:

```powershell
npm ci
npx playwright install chromium

# Test published images across all five stacks
npm run test:all -- --image-version 6.0.1

# Build the current source once and test all stacks
npm run test:all -- --local
```

All tests remove their containers, networks and test data volumes afterward, whether they pass or fail. The full suite runs one stack at a time. Test or preparation failures do not skip later stacks; cleanup failure stops the suite. Any failure produces a nonzero exit code. Run one suite at a time on a dedicated Docker environment.

## Commands

```powershell
# Run the complete suite on one stack
npm run test:all -- --local --stack postgres

# Run one scenario; defaults to Postgres and local images
npm run test -- --scenario sdk-client

# Select a stack and published image version for a single scenario
npm run test -- --scenario track --stack mongo-redis --image-version 6.0.1

# Rebuild local images before running one scenario
npm run test -- --scenario sdk-server --local --build

# Keep the environment after testing for local diagnosis
npm run test -- --scenario sdk-client --keep-environment

# Clean retained environments manually
npm run down -- --stack postgres
npm run down -- --all
```

Tests clean up the environment by default. Use `--keep-environment` to retain it after success or failure. `--local` and `--image-version` are mutually exclusive.

Stacks: `postgres`, `postgres-redis`, `mongo-redis`, `postgres-kafka-clickhouse`, `mongo-kafka-clickhouse`.

## Scenarios

| Scenario | Coverage |
| --- | --- |
| [track](./scenarios/track/README.md) | Track persistence, Insights aggregation and experiment statistics |
| [sdk-server](./scenarios/sdk/server/README.md) | .NET SDK evaluation and live flag/segment updates |
| [sdk-client](./scenarios/sdk/client/README.md) | JS SDK evaluation and live flag/segment updates in isolated browser contexts |

## Results

Each invocation prints its archive path, such as `.runs/6.0.1-20261018-073618/` (UTC). It contains `run.json`, per-stack logs and evidence, and `suite-results.json`. Environment state is stored separately under `.runs/state/`; successful teardown removes it while preserving archived evidence.

## GitHub Actions

[E2E Core Tests](../../.github/workflows/e2e-core.yml) runs Postgres on relevant PR updates and all five stacks on relevant `main` pushes. Manual runs support either a source branch/tag/commit or a published image version. Test evidence is retained for 7 days.
