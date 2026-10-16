# E2E Core Tests

End-to-end checks for the system's core capabilities across supported deployment stacks, used locally and as PR, main-branch, and release validation. Add scenarios here when failures should block integration or release.

## Automated suites and CI

```powershell
# All scenarios on all five stacks, sequentially, with cleanup after each stack
npm run test:all -- --image-version 6.0.0
# Build this checkout once and test every stack
npm run test:all -- --local
# All scenarios on Postgres only
npm run test:all -- --local --stack postgres
```

The suite saves the existing setup configuration and restores it afterward. Scenario and preparation failures are included in `.runs/suite-results.json` and do not skip later stacks. Cleanup removes containers, networks, and test data volumes after each stack, including failed stacks; evidence is retained. Cleanup failure stops the suite to avoid accumulating running stacks. Use a dedicated test environment: an already-onboarded organization must contain the script-created `integration-tests` project with Dev and Prod. Run only one suite per Docker daemon/checkout at a time.

GitHub Actions uses `.github/workflows/e2e-core.yml`:

- Relevant PR updates targeting `main` build the PR merge checkout and run all three scenarios on Postgres.
- Relevant pushes to `main` build once and run all three scenarios on each of the five stacks sequentially.
- Manual runs select `source` mode with an optional branch/tag/commit `ref`, or `image` mode with a required `image-version`. These inputs are mutually exclusive. Both run all five stacks. The workflow ref supplies the test harness; a selected source ref supplies application code and database initialization scripts. The tested source SHA is recorded. Older sources must still be compatible with this harness and its API/UI expectations.
- All jobs attempt final cleanup and upload evidence even on failure. A hosted Ubuntu runner provides an isolated Docker daemon. No registry credentials are used by PR tests.

The release image workflow builds multi-platform candidates with a unique run/attempt tag, records their digests, and tests the three default applications on all five stacks using those exact digests on Linux amd64. Only after every test succeeds are the same multi-platform digests assigned the release version tags. A failed suite fails the release workflow and blocks formal version tagging; candidate images may remain. Existing digest-based `latest` promotion still requires a successful release build. This workflow does not publish GitHub Releases. Retries must rerun all jobs so candidate records and tags belong to the same attempt. If final tagging partially fails, inspect existing tags and digests before recovery; formal tags are never silently overwritten.

Boundaries: the suite is a clean-install functional check, not a retained-data upgrade test. It does not exercise optional Control Plane or execute the arm64 variants. All scenarios also require npm/NuGet downloads and Chromium; the CI action installs Node 22, .NET 8 and Chromium.

## Data initialization

`up` starts the infrastructure, applies the versioned database initialization scripts, starts the applications, and prepares business data through [bootstrap/](./bootstrap/):

- [organization.mjs](./bootstrap/organization.mjs) initializes the `Local Stack` organization, the `Integration Tests` project, and its `Dev` and `Prod` environments.
- [flag.mjs](./bootstrap/flag.mjs) creates boolean, string, number, and JSON flags in Dev. Each flag has Control and Treatment variations.
- [segment.mjs](./bootstrap/segment.mjs) creates the `tester` segment in Dev, matching users with `role=tester`.

`test` reuses a running stack or prepares one if needed. Repeated runs reuse existing business data. Runtime files are saved under `.runs/<stack>/`.

All stacks share the same application images: `featbit-local-api:local`, `featbit-local-els:local`, and `featbit-local-ui:local` for local builds, or the configured published version. Stack differences are runtime configuration; containers, networks, and data volumes remain separate. Existing application image tags are reused by default. Missing local images are built; missing published images are pulled. Use `--build` to rebuild local images after source changes. A `test --all --build` invocation builds local images only once, then applies them to each stack.

## CLI commands

Run these commands from this directory. Node.js 22+ and Docker Compose v2 are required.

| Command | Description |
| --- | --- |
| `npm run setup -- --stack NAME --image-version TAG` | Save the current stack and published application version. Use `--local` for local builds. |
| `npm run config` | Show the current configuration. |
| `npm run up` | Start a stack and initialize its data. |
| `npm run test -- --scenario NAME` | Run a test scenario, starting the stack if needed. |
| `npm run logs` | Save service logs to `.runs/<stack>/services.log`. |
| `npm run down` | Stop and remove a stack, **including its test data volumes**. Logs and test results are retained. |

| Option | Commands | Description |
| --- | --- | --- |
| `--stack NAME` | `setup` | Select a stack; defaults to `postgres`. Options: `postgres`, `postgres-redis`, `mongo-redis`, `postgres-kafka-clickhouse`, `mongo-kafka-clickhouse`. |
| `--all` | `test`, `down` | Test all five stacks using the configured application version, or remove all five stacks and their test data volumes. Preserve the selected setup configuration. |
| `--one-time` | `test` | After success or failure, run `down` for the tested stack, including its test data volumes. Preserve logs, results, and setup configuration. With `--all`, clean up each stack before moving to the next. |
| `--scenario NAME` | `test` | Required scenario name: `track`, `sdk-server`, or `sdk-client`. |
| `--image-version TAG` | `setup` | Use published API, ELS, and UI images with this tag. By default, application images are built locally. |
| `--local` | `setup` | Select local application builds. Cannot be combined with `--image-version`. |
| `--build` | `up`, `test` | Explicitly rebuild local application images. Requires local image configuration. |

`setup` only saves configuration in the Git-ignored `.runs/config.json`; it does not start or stop containers. Omitted fields retain their current values. Before the first setup, commands default to `postgres` with local application builds. `config` (or `setup` without options) displays the current values and identifies defaults when no configuration has been saved.

`up`, `test`, `logs`, and `down` use the saved configuration. Application image environment variables (`FEATBIT_VERSION`, `API_IMAGE`, `ELS_IMAGE`, `UI_IMAGE`) do not override it. Switching stacks leaves the previous stack running. To remove it, select it with `setup` and run `down`. `down` preserves the setup configuration.

## Test scenarios

Scenarios are registered in [scenarios/index.mjs](./scenarios/index.mjs). Each scenario has its own setup and assertions:

- [`track`](./scenarios/track/README.md): Track persistence and Insights aggregation.
- [`sdk-server`](./scenarios/sdk/server/README.md): .NET Server SDK flag evaluation and live flag and segment updates. Requires the .NET 8 SDK.
- [`sdk-client`](./scenarios/sdk/client/README.md): JS Client SDK updates in two isolated browser contexts. Requires `npm ci` and `npx playwright install chromium`.

For example, run the Server SDK scenario on the default PostgreSQL stack:

```powershell
npm run test -- --scenario sdk-server
```

## CLI examples

```powershell
# Select a stack and published application version, then start it
npm run setup -- --stack postgres --image-version 6.0.0-preview
npm run config
npm run up

# Switch application images back to local builds, keeping the selected stack
npm run setup -- --local
npm run up

# Select another stack and collect its logs
npm run setup -- --stack mongo-redis
npm run logs

# Remove the selected stack and its test data volumes
npm run down

# Remove all stacks and their test data volumes, preserving logs and setup configuration
npm run down -- --all
```
