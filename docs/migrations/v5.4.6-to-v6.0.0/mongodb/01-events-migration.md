# Migration 1: MongoDB Events Migration Plan (5.4.6 → 6.0.0)

## Goal and Scope

Migrate historical events from the MongoDB 5.4.6 `Events` collection into the v6.0.0 release-decision event collections so Feature Flag Insights and the new experimentation statistics can read historical data.

- No new events are added to the source database during migration, so dual writes, watermarks, and change streams are unnecessary.
- This plan applies only to MongoDB.
- This plan migrates event evidence only. It does not migrate metric definitions, experiments, or iterations.

## Collections Involved

| Role | Collection | Purpose |
|---|---|---|
| Source | `Events` | 5.4.6 `FlagValue` and metric events |
| Target | `ReleaseDecisionExposureEvents` | Feature flag evaluation/exposure events |
| Target | `ReleaseDecisionMetricEvents` | Metric events such as `CustomEvent`, `PageView`, and `Click` |
| Read-only lookup | `FeatureFlags`, `Environments` | Validate environments, flag keys, and variations; never modified |

A normal 5.4.6 Evaluation Server write has the following BSON document shape:

```text
{
  _id: <UUID string>,
  distinct_id: <string>,
  env_id: <UUID string>,
  event: <string>,
  properties: <BSON document>,
  timestamp: <BSON Date>
}
```

The legacy DAS internal `/events` path may also have left documents with `_id: ObjectId` and `id: <UUID string>`. Preflight checks must inspect actual BSON types and must not assume that every `_id` is MongoDB UUID binary.

The v6 target collections use camelCase fields and Standard UUID binary (subtype 4). The target `properties` field is not a BSON subdocument; it is a string containing the complete JSON value. The migration must use the same BSON-to-JSON serialization behavior as the current `ReleaseDecisionInsightWriter`. Read each source event as its original `BsonDocument` so deserialization cannot discard unknown fields or BSON types.

## Legacy Field and Property Inventory

### Top-level Fields

| 5.4.6 field | Legacy use | Migration handling |
|---|---|---|
| `_id` | Unique event ID for normal ingestion | Preferred source for the target `_id` |
| `id` | UUID written by the legacy DAS internal path | Fallback when `_id` is not a UUID |
| `distinct_id` | Metric event name; also contains `env_id-featureFlagKey` | Used as the event name, or for exact flag-key derivation when the flag key is missing |
| `env_id` | Environment filter in legacy queries | Convert to target `envId` UUID binary |
| `event` | Distinguishes `FlagValue`, `CustomEvent`, `PageView`, and `Click` | Selects the target collection and becomes metric `eventType` |
| `properties` | User, variation, metric value, and context | Preserve completely; never select only known fields |
| `timestamp` | Event time used by legacy statistics | Write to `exposedAt` or `occurredAt` |

### `FlagValue.properties`

| Property | Meaning/use in 5.4.6 | Target handling |
|---|---|---|
| `route` | Ingestion route | Preserve in the complete `properties` value |
| `flagId` | Flag UUID context | Preserve; the target event has no equivalent column |
| `envId` | Redundant environment ID inside properties | Preserve; report when it differs from top-level `env_id` |
| `accountId` | Workspace/account context | Preserve |
| `projectId` | Project context | Preserve |
| `featureFlagKey` | Flag key used by flag insights | Write to `flagKey` |
| `sendToExperiment` | Filter used by legacy experiment exposure queries | Preserve completely; do not use it to exclude Insights events |
| `userKeyId` | User key used by flag/end-user/experiment statistics | Write to `userKey` |
| `userName` | Display value in legacy end-user insights | Preserve; the target has no user-name column |
| `variationId` | Exposure and variation statistics | Write to `variationId` |
| `tag_0` | Compatibility copy of the user key | Fallback when the named field is missing |
| `tag_1` | Compatibility copy of the variation ID | Fallback when the named field is missing |
| `tag_2` | String copy of `sendToExperiment` | Preserve and use for consistency checks |
| `tag_3` | Compatibility copy of the user name | Preserve |

### Metric Event `properties`

| Property | Meaning/use in 5.4.6 | Target handling |
|---|---|---|
| `route` | Ingestion route | Preserve |
| `type` | Copy of the metric event type | Preserve; report when it differs from top-level `event` |
| `eventName` | Metric event name | Cross-check with `distinct_id` and use as fallback |
| `numericValue` | Value used by legacy numeric experiments | Write to `numericValue` |
| `user.keyId` | User key actually read by legacy MongoDB experiment queries | Write to `userKey` |
| `user.name` | User name | Preserve |
| `applicationType` | SDK/application context | Preserve |
| `projectId`, `envId`, `accountId` | Event context | Preserve; cross-check `envId` against the top-level value |
| `tag_0` | Compatibility copy of the user key | Fallback when the named user field is missing |
| `tag_1` | String copy of the numeric value | Fallback when `numericValue` is missing |
| `tag_2` | Compatibility copy of the user name | Preserve |

Before migration, use `$objectToArray` to profile the actual keys in `properties`. Customer-specific and historical fields not listed above must also be preserved in the target `properties` JSON string and verified by tests. The migration implementation must not use a property whitelist.

Unlike PostgreSQL, the 5.4.6 MongoDB DAS actually queried named properties instead of `tag_*`. Therefore, report a mismatch when named fields and tags conflict and prefer the named value; use tags only as compatibility fallbacks for missing fields.

## Data Mapping

### 1. `FlagValue` → `ReleaseDecisionExposureEvents`

Migrate every complete and recognizable `FlagValue`, including records where `sendToExperiment=false`, because they still belong to Feature Flag Insights.

| Source | Target field | Rule |
|---|---|---|
| `_id` / `id` | `_id` | Convert a UUID string or UUID binary to Standard UUID binary; otherwise generate a stable UUID from the source collection and original `_id`, and report it |
| `env_id` | `envId` | Validate the UUID and convert to Standard UUID binary |
| `properties.featureFlagKey` | `flagKey` | If absent, derive only by removing the exact `env_id + '-'` prefix from `distinct_id`; report conflicts |
| `properties.userKeyId` / `tag_0` | `userKey` | Prefer the named field |
| `properties.variationId` / `tag_1` | `variationId` | Prefer the named field |
| No reliable historical source | `variationValue` | Write `null`; 5.4.6 did not record this value, so do not infer it from the current flag configuration |
| `timestamp` | `exposedAt` | Preserve the same UTC instant |
| Complete `properties` BSON document | `properties` | Serialize to a complete JSON string using the current writer behavior, including every tag and unknown field |
| Migration execution time | `createdAt` | UTC |

### 2. Other Events → `ReleaseDecisionMetricEvents`

| Source | Target field | Rule |
|---|---|---|
| `_id` / `id` | `_id` | Use the same deterministic UUID rules as exposure events |
| `env_id` | `envId` | Validate the UUID and convert to Standard UUID binary |
| `properties.user.keyId` / `properties.userKeyId` / `tag_0` | `userKey` | Prefer the nested user read by legacy MongoDB queries; use the other fields as fallbacks in order |
| `distinct_id` / `properties.eventName` | `eventName` | Prefer `distinct_id` because the legacy MongoDB DAS queried it; report conflicts |
| `event` | `eventType` | Preserve the original value, such as `CustomEvent`, `PageView`, or `Click` |
| `properties.numericValue` / `tag_1` | `numericValue` | Prefer a named BSON number; use the tag string as fallback; when absent, write `0` to match current ingestion and report invalid numeric cases |
| `timestamp` | `occurredAt` | Preserve the same UTC instant |
| Complete `properties` BSON document | `properties` | Serialize to a complete JSON string without losing nested users, tags, or customer fields |
| Migration execution time | `createdAt` | UTC |

## Execution Steps

1. Create a recoverable MongoDB snapshot and confirm the database name and target collections used by the v6 application.
2. Run read-only preflight checks: count by `event`; profile top-level fields and every property key/BSON type; count invalid UUIDs, timestamps, required fields, named-only, tag-only, named/tag mismatch, and target `_id` conflicts.
3. Migrate in batches, writing `ReleaseDecisionExposureEvents` first and `ReleaseDecisionMetricEvents` second. Use deterministic `_id` values and insert-if-absent semantics. Treat identical content under the same ID as already migrated; stop and report content conflicts without overwriting existing v6 data.
4. Verify and add target query indexes: exposure must cover at least `envId + flagKey + exposedAt` and `envId + userKey + exposedAt`; metric events must cover at least `envId + eventName + occurredAt` and `envId + eventName + userKey + occurredAt`.
5. Produce a migration report containing source, inserted, already-present, rejected, mismatch, and nonstandard BSON-shape counts, together with the corresponding source `_id` values.

The migration must be repeatable: a second run inserts zero rows, and the source `Events` collection remains unchanged.

## Test Plan

Use a temporary MongoDB instance containing 5.4.6 documents with real BSON types and the current target collections. Cover at least:

- `FlagValue`, `CustomEvent`, `PageView`, and `Click`.
- Named-only, tag-only, matching named/tag values, and conflicting named/tag values, asserting MongoDB's named-first behavior.
- `sendToExperiment=true` and `sendToExperiment=false`.
- `_id` as a UUID string, UUID binary, ObjectId with `id`, and a record requiring a stable fallback ID.
- Nested, top-level, and tag users; BSON int/long/double values; numeric tags; and missing or invalid numeric values.
- Every property listed above, plus nested objects, arrays, and extra customer properties.
- Invalid environment UUIDs, missing required fields, empty properties, and invalid timestamps.
- Identical and conflicting documents already in the target, plus two consecutive migration runs.

Core assertions:

1. Every source event belongs to exactly one category: exposure, metric, already present, or rejected, and the counts reconcile completely.
2. Target UUIDs, UTC times, and flag/user/variation/event/numeric mappings are correct.
3. After parsing the target `properties` string, its fields and values are semantically equivalent to the source BSON document; every known, tag, nested, and extra property is present.
4. Valid `FlagValue` records with `sendToExperiment=false` are also written to the exposure collection.
5. Typical flag counts, end-user projections, binary-once results, and numeric sums calculated from the target collections match the 5.4.6 MongoDB DAS results for the same dataset.
6. A second run inserts zero documents, and the source `Events` count, BSON types, and content remain unchanged.

## Rollback and Completion Criteria

Record the IDs already present in the target collections before writing. To roll back, delete only target IDs inserted by this migration according to the migration report; do not touch pre-existing target records or source `Events`. Migration 1 is complete only after the field profiles, mappings, counts, query results, complete properties, and idempotency assertions all pass.
