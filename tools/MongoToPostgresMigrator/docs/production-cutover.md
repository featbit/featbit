# Production cutover

_How-to._ Plan and run the real MongoDB → PostgreSQL cutover, with a go/no-go
gate and a clean rollback. Validate the tool first with
[local-testing.md](local-testing.md); this guide assumes it passes there.

The only thing this migration changes is the persistence provider: `DbProvider`
switches from `MongoDb` to `Postgres` and the database connection string
changes. The message-queue and cache providers stay the same.

> **Adapt the mechanics to your deployment.** The steps below describe *what*
> must happen and *in what order*. Apply each change through whatever mechanism
> your deployment uses — `docker compose` env files, Helm values, or a
> config-management/GitOps pipeline. If your platform reconciles desired state
> automatically (e.g. a GitOps controller), make these changes through that
> pipeline rather than with ad-hoc commands it would revert.

## How the components behave during cutover

These facts drive the sequence and hold regardless of how FeatBit is deployed:

- **The API is the database writer.** The evaluation server does not write
  end-users to the database — it publishes them to the message queue, and the
  API consumes and writes them. Scaling the API down therefore freezes
  flag/segment/end-user/audit writes.
- **The cache repopulates from the database.** If your deployment uses Redis, the
  API rebuilds the cache from the database on startup — so restarting the API on
  PostgreSQL repopulates the cache from PostgreSQL. The evaluation server serves
  SDKs from the cache, so the API must be up and finished populating **before**
  the evaluation server starts.
- **The message-queue backlog outlives the freeze if your MQ is durable.**
  Messages produced while the API is down are consumed once it restarts on
  PostgreSQL. Durability depends on the MQ provider (a log-based broker such as
  Kafka is durable); confirm your provider's behavior.

### Critical rule: clear the cache with a FULL flush

If your deployment uses Redis, the API's cache-populate step is gated by a marker
key. If that marker survives, the API **skips repopulation** and the evaluation
server serves an empty cache. The clear must be a full flush (`FLUSHALL` /
`FLUSHDB`, or an explicit delete of the marker plus all flag/segment/secret
keys) — never a partial clear. Flushing the cache does not touch the message
queue.

## Pre-cutover preparation (no downtime)

1. **Provision and empty the target PostgreSQL.** From a workstation with the
   `psql` client, run
   [`scripts/Initialize-MigrationTarget.ps1`](scripts/Initialize-MigrationTarget.ps1).
   It creates the database if needed, applies **every** versioned schema init
   script (`infra/postgresql/docker-entrypoint-initdb.d/`, v0.0.0 → latest) in
   order, then truncates the 29 domain tables so the tool's preflight passes:

   ```powershell
   $env:PGPASSWORD = "<pg-password>"
   .\scripts\Initialize-MigrationTarget.ps1 `
       -PgHost <pg-host> -Port 5432 -Database featbit -Username <pg-admin-user>
   ```

   Add `-SkipDatabaseCreate` if the managed instance's database is pre-created
   and your user cannot issue `CREATE DATABASE`; use `-TruncateOnly` to reset the
   target between attempts. The tool's preflight refuses to run against a
   non-empty target.
2. **Back up the source MongoDB** (`mongodump`) — cheap insurance and the
   artifact you would restore if you ever needed to roll back after MongoDB is
   decommissioned.
3. **Decide where the migrator runs.** It needs network access to *both* the
   source MongoDB and the target PostgreSQL, plus their credentials. A one-off
   job/pod inside the cluster or a jump host with equivalent access both work.
4. **Stage the provider change** (`DbProvider=Postgres` + PostgreSQL connection
   string) so it is ready to apply, but do not apply it yet.

## Cutover sequence

1. **Freeze writes.** Scale the **API** and, if present, the **control plane** to
   zero. The evaluation server stays up, so SDK clients keep reading last-known
   state from the cache. Scaling the control plane down now (not just restarting
   it later) prevents a stale writer from racing the cache repopulation.
2. **Migrate.** Run the tool in dry-run, then for real:

   ```bash
   dotnet run --project tools/MongoToPostgresMigrator/src/MongoToPostgresMigrator -- --dry-run \
     2>&1 | tee "migrate-dryrun-$(date +%Y%m%d-%H%M%S).log"
   dotnet run --project tools/MongoToPostgresMigrator/src/MongoToPostgresMigrator \
     2>&1 | tee "migrate-$(date +%Y%m%d-%H%M%S).log"
   ```

   Each run is tee'd to a timestamped log so you have a record to review at the
   go/no-go gate. Run `set -o pipefail` first (or check `${PIPESTATUS[0]}`) so the
   pipeline reports the migrator's exit code rather than `tee`'s.

3. **Go / no-go gate.** Proceed only if the migrator exits `0` with matched
   verify counts. **If it fails, abort:** bring the API back up on MongoDB and do
   not apply the provider change. The migrator never modified MongoDB, so writes
   resume with zero harm — nothing destructive has happened yet.
4. **Cut over** (only after the gate passes):
    1. Scale the **evaluation server** to zero (drops SDK connections).
    2. **Fully flush the cache** if Redis is used (the message-queue backlog is
       preserved).
    3. Restart the **API** with `DbProvider=Postgres`. It repopulates the cache
       from PostgreSQL and consumes any message-queue backlog.
    4. Restart the **control plane** (if present) with `DbProvider=Postgres`.
    5. **Wait for cache repopulation to finish before starting the evaluation
       server.** If Redis is used, confirm the API has completed repopulation — the
       marker key exists and flag/segment keys are present — before bringing the
       evaluation server up. Starting it against a half-filled cache would serve
       empty or partial flags to SDK clients.
    6. Start the **evaluation server** with `DbProvider=Postgres`, last. It reads
       the freshly, fully repopulated cache.
5. **Verify.** Log in through the UI; confirm flags render and evaluate. Confirm
   SDK clients reconnect and receive correct values. Toggle a flag and confirm
   the write lands in PostgreSQL.

Only `DbProvider` and the connection string change. Leave the message-queue and
cache providers as they were, and do not reset message-queue consumer offsets.

## Rollback

The migrator is read-only against MongoDB, so rollback is clean at any point:

- **Before the gate / during migration:** bring the API back up on MongoDB;
  discard the staged provider change.
- **After cutover:** revert `DbProvider` to `MongoDb` (and the MongoDB connection
  string) on the API, control plane, and evaluation server; fully flush the cache
  and let the API repopulate it from MongoDB; then restart the control plane and
  evaluation server. Any end-user/insight data written to PostgreSQL after
  cutover would not be reflected back into MongoDB — acceptable when usage
  history is out of scope (see [how-it-works.md](how-it-works.md)).

## Sizing the maintenance window

The freeze window ≈ migrator runtime (dominated by the end-user, audit-log, and
flag-revision copies) + cache repopulation + service restarts. Those high-volume
tables use the binary `COPY` write path, so the copy phase is far shorter than an
all-EF run. Measure the window against a production-sized snapshot in a staging
environment and add margin — and measure it **with the databases as far away as
they will be in production**, since a loopback run can understate a remote one by
several times.

When either endpoint is remote, connection settings dominate batch settings. Wire
compression on the source connection (for MongoDB, `compressors=snappy`) is the
single highest-impact setting, because the copy steps stream whole documents and
the read side will otherwise starve the `COPY` stream. `Migrator:CopyBatchSize` is
**not** a meaningful throughput lever — per-batch overhead is under 1% of a
block's cost — and is better left small to narrow the fallback window (see
[how-it-works.md](how-it-works.md#write-paths-and-performance)).

If the end-user table dominates the runtime and can tolerate eventual
consistency, consider excluding it from the freeze with
`Migrator:ExcludeEntities` (see
[Excluding entities at runtime](how-it-works.md#excluding-entities-at-runtime))
and backfilling it online after cutover — the application also re-registers
end-users from live traffic. This keeps the largest table out of the maintenance
window entirely.

## Related

- [local-testing.md](local-testing.md) — validate the tool against a snapshot.
- [how-it-works.md](how-it-works.md) — what the tool does and why it is safe.
