# Migration 1: PostgreSQL Events Migration Plan (5.4.6 → 6.0.0)

## Goal and Scope

Migrate historical events from the PostgreSQL 5.4.6 `events` table into the v6.0.0 release-decision event tables so Feature Flag Insights and the new experimentation statistics can read historical events.

- No new events are added to the source database during migration, so dual writes, watermarks, and incremental catch-up are unnecessary.
- This plan applies only to PostgreSQL.
- This plan migrates event evidence only. It does not migrate metric definitions, experiments, or iterations.

## Tables Involved

| Role | Table | Purpose |
|---|---|---|
| Source | `events` | 5.4.6 `FlagValue` and metric events |
| Target | `release_decision_exposure_events` | Feature flag evaluation/exposure events |
| Target | `release_decision_metric_events` | Metric events such as `CustomEvent`, `PageView`, and `Click` |
| Validation lookup | `feature_flags`, `environments` | Validate environments, flag keys, and variations; never modified |

The PostgreSQL 5.4.6 `events` schema is:

```text
id uuid primary key
distinct_id varchar not null
env_id varchar
event varchar
properties jsonb
timestamp timestamp without time zone
```

## 5.4.6 Tag Semantics

PostgreSQL has no separate `tag_0` columns; tags are fields inside the `properties` JSONB value. The 5.4.6 Evaluation Server normally writes both named properties and tags, but the legacy DAS PostgreSQL queries actually read the tags, so the migration must not ignore them.

| Event | `tag_0` | `tag_1` | `tag_2` | `tag_3` |
|---|---|---|---|---|
| `FlagValue` | User key | Variation ID | `sendToExperiment` as `"true"` or `"false"` | User name |
| Metric event | User key | Numeric value as a string | User name | Usually absent |

Migration rule: migrate normally when tags and named properties both exist and agree; migrate when only tags exist; when they disagree, report the mismatch and use the tag value consumed by the legacy PostgreSQL DAS. Preserve the complete `properties` value unchanged.

## Data Mapping

### 1. `FlagValue` → `release_decision_exposure_events`

Migrate every complete and recognizable `FlagValue`, including records where `sendToExperiment=false`. Those records still belong to Feature Flag Insights. Preserve `sendToExperiment` in `properties`; do not use it as a migration filter.

| Source | Target field | Rule |
|---|---|---|
| `events.id` | `id` | Preserve the UUID |
| `events.env_id` | `env_id` | Validate and convert to UUID |
| `properties.featureFlagKey` | `flag_key` | If absent, derive it only by removing the exact `env_id + '-'` prefix from `distinct_id`; report conflicts between the two values |
| `properties.tag_0` / `properties.userKeyId` | `user_key` | Prefer the tag; use the named field as fallback |
| `properties.tag_1` / `properties.variationId` | `variation_id` | Prefer the tag; use the named field as fallback |
| No reliable historical source | `variation_value` | Write `NULL`; the 5.4.6 payload did not record this value, so do not infer historical values from the current flag configuration |
| `events.timestamp` | `exposed_at` | Interpret as UTC and write to `timestamptz` |
| `events.properties` | `properties` | Preserve completely, including every tag |
| Migration execution time | `created_at` | UTC |

### 2. Other Events → `release_decision_metric_events`

This path matches the current v6 ingestion behavior: any non-`FlagValue` event with the required fields is written to the metric event table.

| Source | Target field | Rule |
|---|---|---|
| `events.id` | `id` | Preserve the UUID |
| `events.env_id` | `env_id` | Validate and convert to UUID |
| `properties.tag_0` / `properties.userKeyId` / `properties.user.keyId` | `user_key` | Prefer the tag; use the other fields as fallbacks |
| `events.distinct_id` / `properties.eventName` | `event_name` | Prefer `distinct_id` because the legacy DAS queried it; report a mismatch when the values conflict |
| `events.event` | `event_type` | Preserve the original value, such as `CustomEvent`, `PageView`, or `Click` |
| `properties.tag_1` / `properties.numericValue` | `numeric_value` | Parse the tag string first, then read the JSON number; write `0` when absent to match v6 ingestion behavior |
| `events.timestamp` | `occurred_at` | Interpret as UTC and write to `timestamptz` |
| `events.properties` | `properties` | Preserve completely, including every tag |
| Migration execution time | `created_at` | UTC |

User names in `tag_2`/`tag_3` have no corresponding target column, but they are not lost because the complete JSON value is written to `properties`.

## Execution Steps

1. Create a recoverable database snapshot, deploy the v6.0.0 schema, and confirm that both target tables and their indexes exist.
2. Run read-only preflight checks:
   - Count source rows by `event`.
   - Count invalid `env_id` values, missing required fields, and unparseable numeric values.
   - Count tag-only, named-only, and tag/named mismatch records.
   - Check whether either target table already contains the same `id`, distinguishing identical content from conflicting content.
3. Write migratable `FlagValue` records to the exposure table, then write the other events to the metric event table. For large datasets, process deterministic batches keyed by source `id`.
4. Treat an identical record with the same `id` as already migrated. Stop and report when the same `id` has different content; never overwrite it silently.
5. Produce a migration report containing source, inserted, already-present, invalid, and mismatch counts, together with the corresponding IDs.
6. End the migration window only after reconciliation succeeds. Retain the source table for investigation.

The migration must be repeatable: a second run must not add duplicates or change the result of the first run.

## Test Plan

Use a temporary PostgreSQL instance with the real 5.4.6 `events` schema and the current v6.0.0 target schema.

Test data must cover at least:

- `FlagValue`, `CustomEvent`, `PageView`, and `Click`.
- Named-only, tag-only, matching named/tag values, and conflicting named/tag values.
- `sendToExperiment=true` and `sendToExperiment=false`.
- Nested users, top-level users, and `tag_0`.
- JSON numeric values, string `tag_1` values, and missing or invalid numeric values.
- Flag keys containing hyphens and cases that use the `distinct_id` fallback.
- Invalid environment UUIDs, missing required fields, and empty properties.
- Time migration under a non-UTC PostgreSQL session.
- Identical and conflicting records already in the target, plus two consecutive migration runs.

Core assertions:

1. Every source ID belongs to exactly one of four categories: exposure, metric, already present, or rejected.
2. `total source rows = inserted rows + identical already-present rows + rejected rows`.
3. Every field is mapped correctly, `properties` remains semantically equivalent JSON, and no tags are lost.
4. Valid `FlagValue` records with `sendToExperiment=false` are present in the exposure table.
5. Each timestamp represents exactly the same UTC instant as the source event.
6. A second run inserts zero rows, and the source `events` row count and content remain unchanged.
7. Typical flag counts, binary-once results, and numeric sums recomputed from the target tables match the 5.4.6 PostgreSQL DAS results for the same dataset.

## Rollback and Completion Criteria

Record the IDs already present in the target tables before writing. To roll back, delete only IDs inserted by this migration; do not touch pre-existing target records or the source `events` table. Migration 1 is complete only when every reconciliation assertion passes, all conflicts are explicitly reported, and repeated execution has no side effects.
