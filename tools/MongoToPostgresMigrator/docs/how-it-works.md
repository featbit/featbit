# How MongoToPostgresMigrator works

_Reference._ This document explains what the tool migrates, what it deliberately
excludes, and the properties that make it safe. For running it, see
[local-testing.md](local-testing.md) and
[production-cutover.md](production-cutover.md).

## Why this is a data-copy problem, not a re-modelling one

FeatBit's back-end contains **two parallel persistence implementations**,
selected at runtime by the `DbProvider` configuration value:

- **MongoDB** — `Infrastructure/Persistence/MongoDb/` + `Infrastructure/Services/MongoDb/`
- **PostgreSQL (EF Core)** — `Infrastructure/Persistence/EntityFrameworkCore/` + `Infrastructure/Services/EntityFrameworkCore/`

Both layers read and write the **same `Domain.*` POCO classes** (every entity
inherits `Domain.Bases.Entity`, which exposes a single `Guid Id`). The migrator
never touches raw BSON or raw SQL: it reads each collection into the shared
domain type and writes that same object through EF Core, inheriting all type
conversions from the production code the running application already uses.

## Bootstrap: reusing the application's own registrations

The tool deliberately does almost no setup of its own. It calls the
application's DI extensions (`TryAddMongoDb`, `TryAddPostgres`), which guarantees
byte-identical mapping on both sides:

- Touching `Infrastructure` fires its `[ModuleInitializer]`, which registers the
  camelCase conventions, the `GuidSerializer(GuidRepresentation.Standard)` (the
  exact UUID representation FeatBit stores), the id generator, and the class
  maps. The tool must **not** re-register these.
- `TryAddPostgres` is where `UseSnakeCaseNamingConvention()` (the only place
  `CreatedAt → created_at` mapping is defined) and dynamic-`jsonb` serialization
  live. Reusing it — rather than configuring Npgsql by hand — is what keeps
  column names and `jsonb` contents correct.

## What is migrated

29 domain entities, copied logical-parents-first. PostgreSQL defines no foreign
keys, so ordering does not affect insert success — it only keeps the database
from being referentially broken if a run aborts partway.

| Group | Entities |
|-------|----------|
| Identity & workspace | Workspaces, WorkspaceUsers, Users, RefreshTokens |
| Org / project / env | Organizations, OrganizationUsers, Projects, Environments |
| IAM | Policies, Groups, GroupMembers, GroupPolicies, MemberPolicies |
| Flag domain | Segments, FeatureFlags, FlagDrafts, FlagRevisions, FlagSchedules, FlagChangeRequests, Triggers |
| Experimentation | ExperimentMetrics, Experiments |
| Integrations | AccessTokens, RelayProxies, Webhooks, WebhookDeliveries |
| End-user & audit | EndUserProperties, EndUsers, AuditLogs |

The end-user and audit collections are typically the highest-volume and dominate
the runtime, so `EndUsers`, `AuditLogs`, and `FlagRevisions` use the binary COPY
path (see [Write paths and performance](#write-paths-and-performance)).

## What is excluded, and why

| Excluded | Reason |
|----------|--------|
| `GlobalUser` | Maps to the same `EndUsers` collection / `end_users` table as `EndUser`. Copying `EndUser` once is complete; adding `GlobalUser` would double-insert. |
| `QueueMessage` (`queue_messages`) | A PostgreSQL-only message-queue table with no MongoDB source. |
| `usage_end_user_stats`, `usage_event_stats` | Usage/MAU analytics, not domain entities (composite natural keys, written via raw SQL — they cannot ride `Set<T>()`). They are out of scope and refill automatically from application traffic after cutover. |

If you need usage/MAU history preserved, this tool does not cover it; plan a
separate export/import for those tables.

## Value fidelity

- Every entity `Id` is a `System.Guid`. The MongoDB `_id` is read into that
  `Guid` and the **same value** is written to the PostgreSQL `uuid` column —
  same 128-bit value, same canonical string. All foreign-key GUIDs (`envId`,
  `organizationId`, …) are plain properties copied field-for-field, so
  relationships stay intact.
- EF Core does not regenerate keys: a `Guid` primary key is `ValueGeneratedOnAdd`
  but EF only substitutes a value when the property is `Guid.Empty`. Migrated
  entities always carry a real id, so it is inserted unchanged.
- Strings, enums, booleans, timestamps, and `jsonb` contents carry identical
  logical values; only the storage representation changes (embedded document →
  `jsonb`, string array → `text[]`, BSON date → `timestamptz`).

Because identity is preserved, environment secrets, SDK keys, and cross-service
references keep working after the switch.

## Dirty-data handling

MongoDB enforces neither PostgreSQL's column types nor its unique indexes, so a
real source database contains rows PostgreSQL will reject. Rather than abort a
multi-million-row run on the first bad row, the tool cleans or skips these rows
and accounts for every one of them in the final verify.

### Non-UUID `_id`: reassigned

Every FeatBit entity keys on a `Guid`, but a stray document can carry a
different `_id` type (most often a leftover Mongo `ObjectId`). Such a document is
given a **fresh `Guid`** before it is written. The id is a surrogate primary key,
never a foreign-key target, so regenerating it preserves the row and its
relationships. Each reassignment is logged, and the run summary reports the total
count.

### Constraint violations: skipped

A row that still cannot be written after id repair is **skipped**, logged with
its id and reason, and counted per entity. Verify expects
`target = source − skipped` (see [Safety model](#safety-model)), so skips never
masquerade as a silent data loss. The three classes observed in real data:

| PostgreSQL error | Cause | Typical source |
|------------------|-------|----------------|
| `23505` unique_violation | Duplicate `(env_id, key_id)` on `end_users` — a pair MongoDB never enforced as unique | High-churn end-user ingestion |
| `22001` string_data_right_truncation | A value longer than the target `varchar(n)` (e.g. `end_user_properties.name`, `varchar(128)`) | Oversized scanner/bot payloads |
| `22021` character_not_in_repertoire | An invalid UTF-8 `0x00` (NUL) byte inside a string value | Corrupted client-supplied values |

`23505` duplicates are the only high-volume class; they are resolved in bulk by
the `end_users` COPY path (see [Write paths](#write-paths-and-performance))
rather than one row at a time.

## Safety model

The migrator is **read-only against MongoDB** — the source is never modified, so
rollback is always possible. Three checks enforce correctness:

- **Preflight (always runs first).** Every one of the 29 target tables must be
  empty. If any is non-empty the tool aborts (exit `2`). This enforces the
  "empty schema / sole data source" contract and makes recovery from a failed
  run safe: a re-run is blocked until the operator truncates, so the tool can
  never silently double-insert.
- **Verify (after a real migration).** For every entity, `target` must equal
  `source − skipped` (rows dropped for the constraint violations described under
  [Dirty-data handling](#dirty-data-handling)); otherwise the tool fails
  (exit `4`). A **`jsonb` integrity spot-check** additionally pulls a sample of
  `FeatureFlag`s by `Id` from both stores and asserts their `jsonb`-backed
  members (`Variations`, `Rules`, `Fallthrough`, `Tags`) are equal — catching a
  silent serialization regression that raw counts would miss.
- **Live-write guard.** Source counts captured during preflight are re-checked
  during verify. If a source count grew during the run, writes were not
  quiesced; this is surfaced as a distinct failure rather than reported as a
  short but "successful" migration. A source count that *shrank* fails the same
  way — the source must stay frozen for the whole run.

## Failure model

Fail-fast for **unrecoverable** errors. A copy step that throws stops the run
(exit `3`) and leaves partial data in place for inspection. Because the target
starts empty, recovery is simply **truncate-all + re-run** — and preflight
enforces the truncate.

Recoverable dirty-data rows do **not** abort the run: a non-UUID `_id` is
repaired and a constraint-violating row is skipped (see
[Dirty-data handling](#dirty-data-handling)). Both are logged, counted, and
summarized at the end, and a run that only skipped rows still exits `0`.

## Write paths and performance

Every entity streams from a MongoDB cursor (so high-volume collections never load
fully into memory). Two write paths turn that stream into PostgreSQL rows:

| Path | Used for | Throughput | Mechanism |
|------|----------|-----------|-----------|
| **EF Core** | All entities except the three below | ~2–3k rows/s | `AddRange` + `SaveChanges` per batch, change tracker cleared after each. On a batch constraint violation, a **binary-split** retry isolates the bad row in ~log₂(batch) sub-saves and skips only it. |
| **Binary COPY** | `EndUsers`, `AuditLogs`, `FlagRevisions` | ~10–100× faster | PostgreSQL `COPY … FROM STDIN (FORMAT BINARY)` through the application's own `NpgsqlDataSource`, so `jsonb`/`timestamptz`/`uuid` bytes stay identical to the EF path. |

At production scale the high-volume tables (tens of millions of rows) dominate
runtime; the COPY paths are what keep a full migration within minutes rather than
hours.

### COPY variants

- **`EndUsers` — stage-and-merge.** The live table carries the unique index
  `ix_end_users_env_id_key_id`, but the source contains duplicate
  `(env_id, key_id)` pairs (see [Dirty-data handling](#dirty-data-handling)). A
  single duplicate would abort a COPY stream, so rows are first COPYed into an
  **UNLOGGED, index-free staging table** (every row lands fast), then merged into
  the target with one `INSERT … SELECT … ON CONFLICT (env_id, key_id) DO NOTHING`.
  The duplicates collapse in a single bulk statement — both against rows already
  present and against each other — and the collapsed count is recorded as skips.
- **`AuditLogs`, `FlagRevisions` — direct COPY.** Their only uniqueness
  constraint is the `id` primary key (distinct source ids → distinct keys), so no
  deduplication is needed and rows COPY straight into the target. The column set,
  value converters, and PostgreSQL types are read from the live EF Core model, so
  the writer stays correct for any such table without hand-written mapping.

### Fallback and safety

If a COPY block ever throws — an unforeseen dirty-data class the load cannot
absorb — that exact block falls back to the EF binary-split save, which isolates
and skips only the genuinely bad row(s). No source row is silently lost, and the
fast path degrades to the proven EF path only for the affected block.

### Tuning

| Setting | Default | Effect |
|---------|---------|--------|
| `Migrator:BatchSize` | `500` | Rows per EF `SaveChanges` batch (the EF path and COPY fallback). |
| `Migrator:CopyBatchSize` | `1000` | Rows per binary COPY block. Batch size is **not** a meaningful throughput lever — per-batch handoff measures under 1% of a block's cost — so the default favours a narrow fallback window: a rejected block degrades 1,000 rows to the EF path rather than 50,000. |
| `Migrator:ExcludeEntities` | `[]` | Entity names to skip this run (case-insensitive). Excluded entities are neither copied nor verified. See [Excluding entities at runtime](#excluding-entities-at-runtime). |

Both are overridable without a rebuild (`Migrator__BatchSize`,
`Migrator__CopyBatchSize`).

### Read/write overlap

Each COPY block is fed by a bounded prefetch channel
(`EntityStep.ReadEntitiesPrefetchedAsync`, capacity 20,000), so the MongoDB
cursor reads ahead while the current block is streaming into PostgreSQL. Without
it the two phases run strictly serially and the run costs `read + write` rather
than `max(read, write)` — barely noticeable against a local database, but the
dominant cost when either endpoint is remote.

The channel is bounded deliberately: `FlagRevision` embeds an entire
`FeatureFlag` object graph, so an unbounded queue would consume unbounded memory
on precisely the largest table. Producer exceptions surface at the consumer, so
fail-fast behaviour is unchanged.

Because the read is prefetched, a remote run is usually **write-bound** — but only
if the source connection can keep up. Over a network, enable driver-level wire
compression (for MongoDB, `compressors=snappy` on the connection URI); without it
the read side, not PostgreSQL, sets the pace.

### Excluding entities at runtime

`Migrator:ExcludeEntities` drops named entities from *this* run. Where the
build-time exclusions in [What is excluded, and why](#what-is-excluded-and-why)
are permanent (no MongoDB source, or duplicates), this is an **operational
choice** you make per run — most usefully to keep the dominant `EndUsers` table
out of a short freeze window and backfill it online afterwards.

```jsonc
// appsettings.json — or the env var Migrator__ExcludeEntities__0=EndUsers
"Migrator": {
  "ExcludeEntities": ["EndUsers"]
}
```

Behaviour:

- **Names are case-insensitive** and matched against the pipeline's entity names
  (the `Entity` column in [What is migrated](#what-is-migrated)).
- **An unknown name is reported, not silently ignored** — the tool logs a warning
  listing the known entity names so a typo is obvious.
- **Excluded entities are skipped end to end** — not preflighted, copied, or
  verified. Their target tables are left untouched, so if you exclude `EndUsers`
  you are responsible for populating `end_users` separately before cutover.

Because PostgreSQL defines no foreign keys, dropping an entity never breaks the
insert order of the rest.

## Known edge case: `DateTime` → `timestamp with time zone`

Npgsql throws when writing a `DateTime` whose `Kind` is not `Utc` to a
`timestamptz` column. The MongoDB driver deserializes BSON dates as `Kind=Utc`
by default, so values normally round-trip cleanly. If a legacy non-UTC value
ever surfaces, the fallback is a `SaveChanges` interceptor that normalizes the
`Kind` to `Utc` — not built here, but a known extension point should testing
reveal the need.

## Related

- [local-testing.md](local-testing.md) — validate the tool against a snapshot.
- [production-cutover.md](production-cutover.md) — run the real migration.
