# MongoToPostgresMigrator

A one-way migration tool that copies a FeatBit database from the **MongoDB**
persistence provider into the **PostgreSQL** provider, preserving entity
identity (UUIDs) and all values exactly.

FeatBit ships two parallel persistence layers behind a single `DbProvider`
switch, and both read and write the *same* `Domain.*` objects. This tool reuses
those layers directly: it reads each MongoDB collection into the shared domain
type and writes it back through EF Core, inheriting every type conversion
(snake_case columns, `jsonb`, `text[]`, enum encoding) from the running
application. That makes the migration a data-copy problem, not a re-modelling
one — so UUIDs and every other value are preserved byte-for-byte.

> **Direction is one-way.** This tool only migrates MongoDB → PostgreSQL. It does
> not migrate PostgreSQL → MongoDB.

## Quick start

```bash
# from the repository root
dotnet run --project tools/MongoToPostgresMigrator/src/MongoToPostgresMigrator -- --dry-run \
  2>&1 | tee "migrate-dryrun-$(date +%Y%m%d-%H%M%S).log"   # read-only preview
dotnet run --project tools/MongoToPostgresMigrator/src/MongoToPostgresMigrator \
  2>&1 | tee "migrate-$(date +%Y%m%d-%H%M%S).log"          # perform the migration
```

Both runs are tee'd to a timestamped log so there is always a record to review.
Run `set -o pipefail` first (or check `${PIPESTATUS[0]}`) if you gate on the
exit code, so the pipeline reports the migrator's status rather than `tee`'s.

Configure the source and target with `appsettings.json` or environment
variables (see [Configuration](#configuration)). The target PostgreSQL schema
must already exist and its domain tables must be **empty** (the tool refuses to
run otherwise).

## Modes

| Mode | Flag | Behaviour |
|------|------|-----------|
| Dry-run | `--dry-run` | Read-only. Runs preflight and prints a per-entity source/target count table. Writes nothing. |
| Migrate | _(default)_ | Runs preflight, copies all entities, then verifies counts and `jsonb` integrity. |

`--dry-run` is the only accepted argument. Anything else — including a near miss
such as `--dryrun` or `--dry-run=true` — exits `1` without running, so a typo can
never turn a rehearsal into a live migration.

## Configuration

Section names match the FeatBit application, so the same values can be reused.
`appsettings.json`:

```json
{
  "MongoDb":  { "ConnectionString": "mongodb://localhost:27017", "Database": "featbit" },
  "Postgres": { "ConnectionString": "Host=localhost;Port=5432;Username=postgres;Password=...;Database=featbit" },
  "Migrator": { "BatchSize": 500, "CopyBatchSize": 1000, "ExcludeEntities": [] }
}
```

`BatchSize` is the EF `SaveChanges` batch; `CopyBatchSize` is the binary COPY
block size for the high-volume tables. See
[how-it-works.md](how-it-works.md#write-paths-and-performance) for both paths.
`ExcludeEntities` skips named entities entirely (e.g. `["EndUsers"]` to defer the
largest table and backfill it online) — see
[Excluding entities at runtime](how-it-works.md#excluding-entities-at-runtime).

Any value can be overridden with an environment variable (double-underscore
syntax):

```
MongoDb__ConnectionString   MongoDb__Database
Postgres__ConnectionString  Postgres__Password
Migrator__BatchSize         Migrator__CopyBatchSize
Migrator__ExcludeEntities__0=EndUsers   # list elements are indexed
```

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Migrate + verify succeeded (all entities matched). |
| `1` | An unrecognized command-line argument was supplied — nothing ran. Only `--dry-run` is accepted; everything else is configuration. |
| `2` | Preflight failed — the target is not empty. |
| `3` | A copy step threw (fail-fast; partial data is left in place for inspection). |
| `4` | Verify failed (count mismatch, `jsonb` spot-check failure, or a live write was detected). |

## Documentation

| Document | Read this when you want to… |
|----------|------------------------------|
| [how-it-works.md](how-it-works.md) | Understand what the tool migrates, what it excludes, and why it is safe. |
| [local-testing.md](local-testing.md) | Validate the tool end-to-end against a safe snapshot of a real database. |
| [production-cutover.md](production-cutover.md) | Plan and run the real cutover with a go/no-go gate and rollback. |
| [scripts/](scripts/) | Provision and empty a target instance: `Initialize-MigrationTarget.ps1` (applies pending schema init scripts in version order — tracked in the target so re-runs are safe — then truncates) and its companion `truncate-domain-tables.sql`. |

## Project layout

```
tools/MongoToPostgresMigrator/
  MongoToPostgresMigrator.slnx        # solution (src + tests)
  src/MongoToPostgresMigrator         # the migrator console app (net10.0)
  tests/MongoToPostgresMigrator.Tests # xUnit unit tests
  docs/                               # this documentation
```

## Building and testing

```bash
# build both projects
dotnet build tools/MongoToPostgresMigrator/MongoToPostgresMigrator.slnx

# run the unit tests
dotnet test tools/MongoToPostgresMigrator/MongoToPostgresMigrator.slnx
```

The app targets `net10.0` and references the back-end `Infrastructure` project;
no additional NuGet packages are required. The tests are DB-free unit tests
(type mapping, `_id` repair, skip accounting, dirty-row isolation, verify count
math, and pipeline wiring) and need no running MongoDB or PostgreSQL.
