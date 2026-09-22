# Local integration environments

Reusable Docker Compose environments built from this checkout. Environment setup is independent of test scenarios; currently `track` is the only automated scenario. UI is started for manual inspection, with no browser automation.

Requirements: Node.js 22+, Docker with Linux containers and Compose v2+; network access for image pulls, NuGet, npm and the existing image builds. No `npm install` is needed in this directory (Node built-ins only). Run the following commands from `e2e/local-stack`.

```sh
# Start database/MQ infrastructure and apply versioned initialization scripts.
npm run init_dbs -- --scenario postgres

# Reuse initialized infrastructure, build this checkout's API/ELS/UI images and start them.
# Also runs init_dbs automatically when preparing a fresh environment.
npm run up -- --scenario postgres

# Run Track -> actual MQ -> storage -> HTTP insights and metric-statistics queries.
npm run test:track -- --scenario postgres

# Save service logs without stopping anything.
npm run logs -- --scenario postgres

# Stop this scenario and DELETE ITS TEST DATA VOLUMES. Logs/test results are retained.
npm run down -- --scenario postgres
```

## Provider matrix

| Scenario | Database | MQ | Cache | OLAP | API / ELS / UI ports |
| --- | --- | --- | --- | --- | --- |
| `postgres` | Postgres | Postgres | None | Postgres | 15000 / 15001 / 15002 |
| `postgres-redis` | Postgres | Redis | Redis | Postgres | 15010 / 15011 / 15012 |
| `mongo-redis` | MongoDB | Redis | Redis | MongoDB | 15020 / 15021 / 15022 |
| `postgres-kafka-clickhouse` | Postgres | Kafka | Redis | ClickHouse | 15030 / 15031 / 15032 |
| `mongo-kafka-clickhouse` | MongoDB | Kafka | Redis | ClickHouse | 15040 / 15041 / 15042 |

Kafka scenarios use Redis for caching; Insights flow from ELS directly through Kafka into ClickHouse's materialized views. They do not transit Redis.

`--all` runs the command for all scenarios in matrix order, stopping on the first failure. `up --all` leaves all environments running and needs enough memory for five stacks. To minimize resource usage, run `up`, `test:track`, and `down` for one scenario at a time. `up --no-build` reuses previously built images; omit it after source changes. API, ELS and UI use their existing application Dockerfiles, including the API/ELS startup scripts and OpenTelemetry installation steps. Building requires access to their external download sources, including GitHub. Docker reuses shared build layers.

Services bind only to loopback. Databases and brokers are accessible within each Compose network, without host port mappings. No existing service on ports 5000, 5100 or 5173 is touched. All containers, networks and volumes are scoped to the `featbit-local-<scenario>` Compose project; do not use those names for unrelated work.

## Initialization and configuration

`init_dbs` waits for infrastructure health, creates Kafka topics where needed, then runs each database's scripts from:

- `infra/postgresql/docker-entrypoint-initdb.d/v*.sql`
- `infra/mongodb/docker-entrypoint-initdb.d/v*.js`
- `infra/clickhouse/docker-entrypoint-initdb.d/v*.sql`

Scripts are sorted numerically by version (`v5.9.0` before `v5.10.0`), executed one file at a time, and stop on errors. PostgreSQL uses `ON_ERROR_STOP`; MongoDB uses `mongosh --file`. No test fixture `vNext.sql` is appended and no production schema script is rewritten. The supplied MongoDB v6 script must be present in the checkout.

Initialization state records script hashes and the container ID under `.runs/<scenario>`. Calling `init_dbs`/`up` again reuses the initialized database. If a script changes, initialization fails partway through, or the database container is replaced, run `down` then `up` to obtain a fresh database. The runner deliberately refuses to replay non-idempotent migrations into existing data. Use the runner's `down` rather than manual Compose deletion so its state stays synchronized.

Before first preparation, optionally set `API_PORT`, `ELS_PORT`, `UI_PORT`, `POSTGRES_IMAGE`, `MONGO_IMAGE`, `REDIS_IMAGE`, `KAFKA_IMAGE`, or `CLICKHOUSE_IMAGE`. Resolved overrides are saved in `.runs/<scenario>/environment.json`; changing them requires `down` and a fresh setup. MongoDB images must provide `mongosh`; Kafka images must retain the Bitnami command paths. Compose service configuration lives in `compose.yaml`, and the provider matrix in `stack.mjs`.

## Track assertions and evidence

Each test run logs in with the initialization scripts' test account (`test@featbit.com` / `123456`), then creates a unique project, environment and boolean feature flag through the API. The same account can be used for manual UI inspection. Select the project/environment printed in the result JSON before viewing the flag. Each Compose environment owns its own seeded workspace and database; the test never writes to an existing development database.

Track requests include 2, 100, 102 and 250 expanded messages (one exposure and one metric per user), testing the Redis batch boundary as well as the other producers. Assertions cover:

- Exact counts and one event of each kind per user, no missing/duplicate records.
- Environment, user, flag, variation, metric type/name/value and exact millisecond timestamps.
- Missing/empty/normal/65-character/128-character application types.
- Empty requests, invalid users and rejected 129-character application types.
- Flag insights counts by variation via the real management API.
- Metric statistics users, conversions and numeric sums by variation via the real management API.

The test polls storage with a bounded deadline after sending each request only once. It does not retry Track or assume an HTTP 200 proves delivery. After persistence it rechecks counts following another flush interval. It does not claim retry deduplication or exactly-once delivery, nor does it test a complete experiment-run lifecycle.

`.runs/<scenario>/track-*.json` contains requests, row snapshots, query results, environment identifiers and assertions/failure details. SDK keys and login tokens are not saved. Build/init/service logs and `failure.log` are also retained. On failure, the environment stays running for investigation. `test:track` can be rerun and creates another independent project. These files are ignored by Git and are for local use only.

To add another business scenario, reuse `openStack`/`ready` and add a separate test module; database setup and service orchestration do not belong in the test itself.
