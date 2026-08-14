# Migration 1: Kafka + ClickHouse Events Migration Plan (5.4.6 → 6.0.0)

## Goal and Scope

Migrate historical events already persisted by 5.4.6 in ClickHouse `featbit.events` into the two v6.0.0 release-decision event tables:

- `FlagValue` → `featbit.release_decision_exposure_events`
- Other valid insight events → `featbit.release_decision_metric_events`

The Kafka `featbit-insights` topic is a transport channel, not the authoritative historical data source. This migration uses the ClickHouse `events` table and does not move historical data by replaying the Kafka topic.

No new events are produced during migration, so dual writes and incremental catch-up are unnecessary. Before cutover, however, verify that the 5.4.6 consumer has processed the topic's existing backlog.

This plan handles event data only. Metric definitions, experiments, and iterations are not stored in Kafka/ClickHouse; see Migration 2.

## Legacy and New Objects

| Role | Object | Purpose |
|---|---|---|
| 5.4.6 Kafka topic | `featbit-insights` | Carries insight messages from the Evaluation Server |
| 5.4.6 Kafka engine table | `featbit.kafka_events_queue` | Consumes the topic; not a migration source |
| 5.4.6 materialized view | `featbit.events_mv` | Writes Kafka messages to the legacy fact table |
| 5.4.6 source table | `featbit.events` | Persistent fact source for this migration |
| 5.4.6 cluster query table | `featbit.distributed_events` | Exists only in replicated/sharded deployments |
| v6 target table | `featbit.release_decision_exposure_events` | Feature Flag Insights and experiment exposures |
| v6 target table | `featbit.release_decision_metric_events` | Experiment metric events |
| v6 Kafka engine table | `featbit.kafka_insight_events_queue` | Consumes new insight messages after cutover |
| v6 materialized views | `release_decision_exposure_events_mv`, `release_decision_metric_events_mv` | Write new messages to the two target tables after cutover |

The actual 5.4.6 `events` schema is:

```text
uuid UUID
distinct_id String
env_id String
event String
properties String
timestamp DateTime64(6, 'UTC')
tag_0 ... tag_19 String MATERIALIZED from properties
_timestamp DateTime
_offset UInt64
```

`_timestamp` and `_offset` are legacy Kafka ingestion metadata and are not migrated into the new event tables. The legacy table did not store the Kafka partition, so cutover offsets must be read from the Kafka consumer group; they cannot be reconstructed from `events._offset`.

## 5.4.6 Tag Semantics

The 5.4.6 Evaluation Server sends both named properties and tags. Legacy ClickHouse DAS queries actually use the tags, so the migration cannot parse only the named fields used by the v6 materialized views.

| Event | `tag_0` | `tag_1` | `tag_2` | `tag_3` |
|---|---|---|---|---|
| `FlagValue` | User key | Variation ID | `sendToExperiment` as `"true"` or `"false"` | User name |
| Metric event | User key | Numeric value as a string | User name | Usually absent |

Prefer the values seen by the legacy DAS: tags take precedence for user, variation, and numeric value; `distinct_id`, which the legacy DAS queried, takes precedence for flag and metric event names. Named properties are fallbacks and are also used for mismatch checks. Preserve the original complete `properties` string so no other tags are lost.

## Data Mapping

### 1. `FlagValue` → `release_decision_exposure_events`

Migrate every valid `FlagValue`, including records where `sendToExperiment=false`. Those records still belong to Feature Flag Insights; do not filter migration by `tag_2`.

| 5.4.6 source | v6 target field | Rule |
|---|---|---|
| `uuid` | `id` | Preserve the UUID |
| `env_id` | `env_id` | Validate the `String` and convert it to `UUID` |
| `distinct_id` | `flag_key` | Remove the exact `env_id + '-'` prefix; if derivation fails, fall back to `properties.featureFlagKey` |
| `tag_0` / `properties.userKeyId` | `user_key` | Prefer the tag |
| `tag_3` / `properties.userName` | `user_name` | Prefer the tag; write an empty string when both are absent |
| `tag_1` / `properties.variationId` | `variation_id` | Prefer the tag |
| `properties.variationValue` | `variation_value` | The standard 5.4.6 payload has no such field; write an empty string when absent and do not infer historical values from the current flag configuration |
| `timestamp` | `exposed_at` | Preserve the original `DateTime64(6, 'UTC')` instant |
| `properties` | `properties` | Preserve the original complete JSON string |
| Migration execution time | `created_at` | UTC `DateTime64(6)` |

If the flag key derived from `distinct_id` differs from `properties.featureFlagKey`, preserve the legacy DAS `distinct_id` behavior and report the mismatch. Likewise, report tag/named conflicts and use the tag value.

### 2. Other Events → `release_decision_metric_events`

Records where `event != 'FlagValue'` and environment, user, and event name are valid enter the metric event table. Typical event types include `CustomEvent`, `PageView`, and `Click`.

| 5.4.6 source | v6 target field | Rule |
|---|---|---|
| `uuid` | `id` | Preserve the UUID |
| `env_id` | `env_id` | Validate the `String` and convert it to `UUID` |
| `tag_0` / `properties.userKeyId` / `properties.user.keyId` | `user_key` | Prefer the tag; use the other fields as fallbacks |
| `tag_2` / `properties.user.name` | `user_name` | Prefer the tag; write an empty string when both are absent |
| `distinct_id` / `properties.eventName` | `event_name` | Prefer `distinct_id` because the 5.4.6 DAS queried it |
| `event` | `event_type` | Preserve the original value |
| `tag_1` / `properties.numericValue` | `numeric_value` | Parse the tag first, then read the JSON number; when both are absent or invalid, write `0` to match v6 ingestion and report it |
| `timestamp` | `occurred_at` | Preserve the original `DateTime64(6, 'UTC')` instant |
| `properties` | `properties` | Preserve the original complete JSON string |
| Migration execution time | `created_at` | UTC `DateTime64(6)` |

When `distinct_id` conflicts with `properties.eventName`, or a tag conflicts with a named user/numeric value, use the field consumed by the legacy DAS and report the mismatch.

## Execution Plan

1. Stop producing new insight events. Keep the legacy Kafka → ClickHouse pipeline running until the old consumer group `ch_group` reaches `lag=0` on every partition of `featbit-insights`. Save each topic partition, log-end offset, and old-group committed offset.
2. Stop the legacy DAS and stop consumption by the legacy `events_mv`. Take recoverable snapshots of ClickHouse data and Kafka offsets.
3. Explicitly execute the v6 DDL against the existing ClickHouse volume, initially creating only the two persistent target tables. Do not start the new Kafka table/materialized views yet. Do not rely on `docker-entrypoint-initdb.d/init.sql`, because an existing volume is not initialized again.
4. Run preflight checks and generate a report containing source counts by event/environment/month, duplicate `uuid` values, invalid environment UUIDs, invalid JSON, missing fields, tag-only, named-only, tag/named mismatches, and IDs already present in the targets.
5. Batch-write the legacy persistent table into the two target tables using the mappings above. Keep new ingestion stopped. Exclude target records whose `id` and content already match; stop and report when the same ID has different content. ClickHouse MergeTree does not guarantee unique IDs, so do not depend on the table engine for deduplication.
6. On a single node, read `featbit.events` directly. For a replicated/sharded cluster, choose exactly one execution strategy: read `distributed_events` from one coordinator and write to target Distributed tables, or read local `events` once per shard. Never run the migration once per replica. If the current v6 DDL does not yet define replicated local and Distributed target tables, add that cluster DDL before migration.
7. After count and query reconciliation, and while the new consumer group `featbit_clickhouse_release_decision` has no active members, set its offset on each partition to the cutover offset saved in step 1. Because the old group reached `lag=0` and no new messages were produced, these offsets define the cutover boundary.
8. Create or attach v6 `kafka_insight_events_queue` and both materialized views, start the v6 services, and send a small number of new events for smoke testing.

The migration must be repeatable: a second run inserts zero rows. Retain source `events`, the old consumer-group offsets, and the Kafka topic until acceptance is complete.

## Test Plan

Use the same Kafka and ClickHouse versions as the deployment. Run the real 5.4.6 Kafka → `events` pipeline before executing the v6 migration.

Test data must cover at least:

- `FlagValue`, `CustomEvent`, `PageView`, and `Click`.
- `sendToExperiment=true` and `sendToExperiment=false`.
- Matching tag/named fields, tag-only, named-only, and conflicting values.
- Flag keys and event names containing hyphens.
- Integer, fractional, negative, missing, and invalid-string numeric values.
- Missing user names, additional `tag_4 ... tag_19` fields, and extra customer properties.
- Invalid environment UUIDs, invalid JSON, and missing user/variation/event names.
- Duplicate source UUIDs, identical IDs already in the target, and conflicting IDs already in the target.
- One and multiple partitions; if cluster deployments are supported, multiple shards and replicas.
- A topic backlog, a fully caught-up old group, new events after cutover, and two consecutive migration runs.

Core assertions:

1. Every source row belongs to exactly one category: exposure, metric, already present, or rejected, and the counts reconcile completely.
2. UUID, environment, flag/event name, user, variation, numeric value, and UTC timestamp mappings are correct.
3. Target `properties` is byte-for-byte identical to the source JSON string, preserving every tag and extra property.
4. Valid `FlagValue` records with `sendToExperiment=false` are present in the exposure table.
5. Flag counts, end-user projections, binary-once results, and numeric sums calculated from the new tables match the 5.4.6 DAS results for the same standard dataset.
6. No historical records are replayed after Kafka cutover; new messages enter only the new tables and no longer enter the legacy table.
7. A second migration inserts zero rows; cluster deployments do not duplicate data by running once per replica.
8. After configuring the v6 API with `OLAPProvider=ClickHouse`, Feature Flag Insights and experiment statistics read results from the two new tables.

## Rollback and Completion Criteria

To roll back, first stop the v6 materialized views, then delete target IDs inserted by this migration according to the migration report. If the target tables were empty before migration, their pre-migration snapshots can be restored instead. Use the offsets saved in step 1 when restoring the legacy consumer and services. Never delete the legacy `events` table, Kafka topic, or target data that existed before migration.

Migration 1 is complete only after field mappings, counts, statistical queries, Kafka cutover, cluster topology, and idempotency assertions all pass.
