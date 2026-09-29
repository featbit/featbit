# Local Stack

## Data initialization

`up` starts the infrastructure, applies the versioned database initialization scripts, starts the applications, and prepares business data through [bootstrap/](./bootstrap/):

- [organization.mjs](./bootstrap/organization.mjs) initializes the `Local Stack` organization, the `Integration Tests` project, and its `Dev` and `Prod` environments.
- [flag.mjs](./bootstrap/flag.mjs) creates boolean, string, number, and JSON flags in Dev. Each flag has Control and Treatment variations.
- [segment.mjs](./bootstrap/segment.mjs) creates the `tester` segment in Dev, matching users with `role=tester`.

`test` reuses a running stack or prepares one if needed. Repeated runs reuse existing business data. Runtime files are saved under `.runs/<stack>/`.

## CLI commands

Run these commands from this directory. Node.js 22+ and Docker Compose v2 are required.

| Command | Description |
| --- | --- |
| `npm run up` | Start a stack and initialize its data. |
| `npm run test -- --scenario NAME` | Run a test scenario, starting the stack if needed. |
| `npm run logs` | Save service logs to `.runs/<stack>/services.log`. |
| `npm run down` | Stop and remove a stack, **including its test data volumes**. Logs and test results are retained. |

| Option | Commands | Description |
| --- | --- | --- |
| `--stack NAME` | All | Select a stack; defaults to `postgres`. Options: `postgres`, `postgres-redis`, `mongo-redis`, `postgres-kafka-clickhouse`, `mongo-kafka-clickhouse`. |
| `--all` | All | Run the command for every stack. Cannot be combined with `--stack`. |
| `--scenario NAME` | `test` | Required scenario name: `track`, `sdk-server`, or `sdk-client`. |
| `--image-version TAG` | `up`, `test` | Use published API, ELS, and UI images with this tag. By default, application images are built locally. |
| `--no-build` | `up` | Reuse existing local application images without building them. |

## Test scenarios

Scenarios are registered in [scenarios/index.mjs](./scenarios/index.mjs). Each scenario has its own setup and assertions:

- [`track`](./scenarios/track/README.md): Track persistence and Insights aggregation.
- [`sdk-server`](./scenarios/sdk-server/README.md): .NET Server SDK flag evaluation and live flag and segment updates. Requires the .NET 8 SDK.
- [`sdk-client`](./scenarios/sdk-client/README.md): JS Client SDK updates in two isolated browser contexts. Requires `npm ci` and `npx playwright install chromium`.

For example, run the Server SDK scenario on the default PostgreSQL stack:

```powershell
npm run test -- --scenario sdk-server
```

## CLI examples

```powershell
# Start the PostgreSQL stack
npm run up -- --stack postgres

# Save logs from the MongoDB stack
npm run logs -- --stack mongo-redis

# Remove one stack and its test data volumes
npm run down -- --stack postgres

# Remove all stacks and their test data volumes
npm run down -- --all
```
