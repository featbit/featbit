# Testing the migration locally

_How-to._ Validate the tool end-to-end against a safe snapshot of a real
database before you run it anywhere important. For how the tool behaves
internally, see [how-it-works.md](how-it-works.md).

> **Provider assumptions:** only `DbProvider` and the database connection
> strings change. The message-queue and cache providers your deployment uses are
> unaffected by this tool.

## Prerequisites

- Docker
- .NET 10 SDK
- MongoDB Database Tools (`mongodump` / `mongorestore`)
- Read access to a non-production MongoDB instance with representative data

## Why snapshot into throwaway containers

1. **Deterministic verification.** The verify pass and live-write guard require a
   *quiesced* source. A live database drifts mid-run and trips false failures. A
   frozen snapshot makes `sourceCount == targetCount` meaningful.
2. **Repeatability.** You will truncate-and-re-run many times; a fixed snapshot
   gives identical counts every pass.
3. **Isolation/safety.** Keeps experimental tooling off shared infrastructure.
4. **Version fidelity.** Match the local MongoDB major version to your source to
   avoid dump/restore quirks.

## Overview

```
[source MongoDB] --mongodump--> ./_snapshot --mongorestore--> [local mongo]   (SOURCE, quiesced)
                                                                    |
                                                MongoToPostgresMigrator --dry-run -> real
                                                                    v
                                  [local postgres, schema created, domain tables emptied]  (TARGET)
```

> **Option B — reuse `docker-compose-infra` instead of throwaway containers.**
> The throwaway `mig-mongo`/`mig-pg` below are the safest way to validate the
> _migrator_ (steps 1–5): they are disposable, unseeded, and guaranteed quiesced.
> But when you also want **step 6** — booting the app on the migrated data — the
> repo's `docker/composes/docker-compose-infra.yml` already provides Mongo,
> PostgreSQL, Redis, Kafka (topics seeded), and ClickHouse on one network, so the
> app runs with no extra setup. Two costs come with it: its Mongo is
> **seed-initialised**, so restore with `--drop` (step 2), and its PostgreSQL is
> seeded too, so `TRUNCATE` still applies (step 4). Use throwaways to validate the
> tool; use `docker-compose-infra` when the goal is a full app smoke test.

## Steps

**1. Snapshot the source MongoDB**

```bash
mongodump --uri="mongodb://<user>:<pw>@<host>:27017/featbit?authSource=admin" --gzip --out ./_snapshot \
  2>&1 | tee "mongodump-$(date +%Y%m%d-%H%M%S).log"
```

The `tee` keeps a copy of the progress/summary you can review afterwards. If you
gate on the exit code, run `set -o pipefail` first (or check `${PIPESTATUS[0]}`)
so the pipe reports `mongodump`'s status, not `tee`'s.

> **Wait for the dump to finish before restoring.** `mongodump` streams large
> collections (e.g. `EndUsers`, `AuditLogs`, `FlagRevisions`) after the small
> ones already print `done dumping`. Confirm the process **exited `0`** — do not
> start the restore against a still-writing dump, or `mongorestore` will fail
> with `unexpected EOF` on a half-written `.bson.gz`.

**2. Start a throwaway local source MongoDB and restore into it**

```bash
docker run -d --name mig-mongo -p 27018:27017 mongo:5.0.32   # match your source's major version
mongorestore --uri="mongodb://localhost:27018" --gzip ./_snapshot \
  2>&1 | tee "mongorestore-$(date +%Y%m%d-%H%M%S).log"
```

No seed scripts are mounted — the restore is the only data source.

> **Restoring into an already-seeded Mongo?** If you reuse a shared Mongo that
> ran the FeatBit init scripts (e.g. the `docker-compose-infra` stack) instead of
> a clean `mig-mongo`, add `--drop` so each collection is replaced rather than
> colliding on the seeded fixed-UUID documents:
> `mongorestore --drop --gzip --host=... -u ... -p ... --authenticationDatabase=admin ./_snapshot`.

**3. Start a local target PostgreSQL with the schema**

The FeatBit PostgreSQL schema is defined by the versioned init scripts in
`infra/postgresql/docker-entrypoint-initdb.d/`. Mount them so the container
creates the database, the full schema, and every index:

```bash
docker run -d --name mig-pg -p 5433:5432 -e POSTGRES_PASSWORD=please_change_me \
  -v "$(pwd)/infra/postgresql/docker-entrypoint-initdb.d/:/docker-entrypoint-initdb.d/" postgres:15.10
```

**4. Empty the seed — the critical step**

The init scripts seed a default workspace, user, organization, and the built-in
policies at **fixed UUIDs**. Those same ids also exist in a real source database,
so a seeded target would (a) fail the tool's empty-table preflight and (b)
primary-key-collide with the same rows coming from MongoDB. Truncating leaves the
schema and indexes intact but gives the migrator a clean slate:

```bash
docker exec -i mig-pg psql -U postgres -d featbit -c "TRUNCATE workspaces, workspace_users, users, refresh_tokens, organizations, organization_users, projects, environments, policies, groups, group_members, group_policies, member_policies, segments, feature_flags, flag_drafts, flag_revisions, flag_schedules, flag_change_requests, triggers, experiment_metrics, experiments, access_tokens, relay_proxies, webhooks, webhook_deliveries, end_user_properties, end_users, audit_logs;"
```

These are the 29 migrated tables. The `queue_messages` and `usage_*` tables are
intentionally left untouched.

> **Provisioning an external target?** The container mount + `TRUNCATE` above is
> the quickest path for a throwaway local target. For an external instance
> (dev/test/prod), use [`scripts/Initialize-MigrationTarget.ps1`](scripts/Initialize-MigrationTarget.ps1)
> instead — it applies the init scripts that are still pending in version order
> (tracked in a `featbit_migration_schema_history` table in the target, so
> re-runs are safe) and truncates the same 29 tables over a `psql` connection.
> See [production-cutover.md](production-cutover.md).

**5. Point the migrator at both — dry-run, then migrate**

```bash
set -o pipefail   # so the pipe reports the migrator's exit code, not tee's

export MongoDb__ConnectionString="mongodb://localhost:27018"
export MongoDb__Database="featbit"
export Postgres__ConnectionString="Host=localhost;Port=5433;Username=postgres;Password=please_change_me;Database=featbit"

dotnet run --project tools/MongoToPostgresMigrator/src/MongoToPostgresMigrator -- --dry-run \
  2>&1 | tee "migrate-dryrun-$(date +%Y%m%d-%H%M%S).log"   # review the count table; confirm target empty
dotnet run --project tools/MongoToPostgresMigrator/src/MongoToPostgresMigrator \
  2>&1 | tee "migrate-$(date +%Y%m%d-%H%M%S).log"          # real run -> expect exit 0, verify matched
```

On PowerShell, set the same variables with `$env:MongoDb__ConnectionString="..."`.

**6. Functional validation — run the app on the migrated data**

Start the API against the migrated PostgreSQL (`DbProvider=Postgres`) and log in
as a **known real user from the snapshot**. Confirm that:

- organizations, projects, and environments render;
- opening a feature flag shows correct variations and rules (validates `jsonb`);
- a flag evaluates correctly.

Because UUIDs are preserved, existing credentials and environment keys work
unchanged.

**7. Iterate and tear down**

```bash
# repeatability check: re-truncate (step 4), then re-run (step 5) -> identical counts
docker rm -f mig-mongo mig-pg
rm -rf ./_snapshot
```

## Success criteria

- Dry-run shows all 29 target tables empty and non-zero source counts.
- The real run exits `0`; per-entity source/target counts match; the
  `FeatureFlag` `jsonb` spot-check passes.
- The app starts on PostgreSQL, a real user logs in, and flags render and
  evaluate identically to MongoDB.

## Related

- [production-cutover.md](production-cutover.md) — run the real migration.
- [how-it-works.md](how-it-works.md) — what the tool does and why it is safe.
