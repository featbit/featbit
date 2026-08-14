# Migration 2: MongoDB Metrics and Experimentation Migration Plan (5.4.6 → 6.0.0)

## Goal and Scope

Migrate MongoDB 5.4.6 metric definitions, experiment metadata, and historical `iterations` results into the v6.0.0 release-decision collections.

- No new data is added to the source database during migration, so dual writes and incremental catch-up are unnecessary.
- This plan applies only to MongoDB.
- Do not migrate `Events` or write to either release-decision event collection.
- Do not recalculate historical iterations from events or invent layers, assignments, hypotheses, decisions, or learnings.
- Preserve the legacy collections and lookup collections unchanged.

## Collections Involved

| Role | Collection | Purpose |
|---|---|---|
| Source | `ExperimentMetrics` | 5.4.6 metric definitions |
| Source | `Experiments` | 5.4.6 experiments with embedded `iterations[]` and `results[]` |
| Read-only lookup | `FeatureFlags` | Flag key, name, and variations |
| Read-only lookup | `Environments` | Experiment-to-project relationship |
| Read-only lookup | `Projects` | Project key |
| Read-only lookup | `Users` | Validate the legacy `maintainerUserId`; never modified |
| Target | `ReleaseDecisionMetrics` | v6 metric registry |
| Target | `ReleaseDecisionExperiments` | v6 experiment workspace |
| Target | `ReleaseDecisionExperimentRuns` | One run for each legacy iteration |
| Target | `ReleaseDecisionActivities` | Migration provenance and complete legacy configuration snapshots |

This migration does not write `ReleaseDecisionLayers` or `ReleaseDecisionRunAssignments` because 5.4.6 contains no data that maps to them reliably.

The typed MongoDB entities in both 5.4.6 and v6 use camelCase element names. Entity `Id` is stored as `_id`, GUID values use Standard UUID binary (subtype 4), and timestamps use BSON Date. Target fields `primaryMetric`, `variants`, `analysisResult`, and activity `detail` are JSON strings rather than BSON subdocuments.

## Complete Field Usage and Mapping

### 1. `ExperimentMetrics` → `ReleaseDecisionMetrics`

5.4.6 enums: `eventType` is Custom=1, PageView=2, Click=3; `customEventTrackOption` is Undefined=0, Conversion=1, Numeric=2; `customEventSuccessCriteria` is Undefined=0, Higher=1, Lower=2; and the only current `targetUrls[].matchType` value is Substring=1.

| 5.4.6 field/property | Legacy use | v6 handling |
|---|---|---|
| `_id` | Metric ID and experiment reference | Preserve the UUID when no key-based merge occurs; otherwise create an old-to-target ID map |
| `envId` | Environment isolation and queries | Map to `featBitEnvId` |
| `name` | Catalog/UI display | Map to `name` |
| `description` | Catalog/UI description | Map to `description` |
| `maintainerUserId` | Legacy UI maintainer lookup | No target metric field; preserve it in the complete migration activity snapshot for referencing experiments and list it in the report |
| `eventName` | Selects metric events from `Events` | Map to `key`, preserving the original event name |
| `eventType` | Custom/PageView/Click behavior | Contributes to `metricType` and `metricAgg`, and remains in the legacy snapshot |
| `customEventTrackOption` | Conversion/Numeric aggregation behavior | Custom+Numeric → continuous/sum; otherwise → binary/once |
| `customEventUnit` | Numeric metric unit and legacy result display | Preserve in the legacy run artifact/activity; neither the target metric nor run has a unit field |
| `customEventSuccessCriteria` | Higher/Lower winner direction | Lower → `decrease_good`; Higher/Undefined → `increase_good`; report Undefined |
| `elementTargets` | Element selector configuration for Click metrics | Preserve in the activity/report; the v6 metric registry has no equivalent field |
| `targetUrls` | URL matching configuration for PageView/Click | Preserve the complete array, including each item's `id`, `matchType`, and `url`; the target metric has no equivalent field |
| `isArvhived` | Legacy catalog archive filter; field name contains the historical typo | true → `status=archived`; false → `status=active` |
| `createdAt`, `updatedAt` | Audit timestamps | Preserve the BSON instants in target fields with the same names |

Core target metric mapping:

| Source | Target |
|---|---|
| `envId` | `featBitEnvId` |
| `eventName` | `key` |
| Custom + Numeric | `metricType=continuous`, `metricAgg=sum` |
| Other combinations | `metricType=binary`, `metricAgg=once` |
| Lower | `expectedDirection=decrease_good` |
| Higher / Undefined | `expectedDirection=increase_good` |

Legacy data may contain duplicate `(envId, eventName)` values. Merge compatible configurations into one target metric and retain a mapping for every old metric ID. Stop and report a group when type, aggregation, or direction conflicts. Do not avoid the conflict by changing `key`, because it must continue to match the historical event name.

### 2. `Experiments` → `ReleaseDecisionExperiments`

| 5.4.6 field/property | Legacy use | v6 handling |
|---|---|---|
| `_id` | Experiment ID | Preserve the UUID |
| `envId` | Environment and project lookup | Map to `featBitEnvId`; resolve `featBitProjectKey` through `Environments.projectId → Projects.key` |
| `metricId` | Primary metric reference | Use the old-to-target metric map to construct the `primaryMetric` JSON string |
| `featureFlagId` | Flag and variations reference | Look up `FeatureFlags`, then write `flagKey` and `variants` |
| `isArchived` | Legacy experiment archive state | Preserve completely in the activity; do not invent a v6 workspace state |
| `status` | `NotStarted`, `Paused`, or `Recording` lifecycle | Preserve completely in the activity; do not treat it as a v6 decision |
| `baselineVariationId` | Iteration baseline | Write to each target run's `controlVariant` |
| `iterations` | Configuration and historical results for each round | Generate one `ReleaseDecisionExperimentRuns` document per item |
| `alpha` | Legacy frequentist significance threshold | Preserve completely in the legacy analysis artifact/activity; do not map it to a Bayesian prior |
| `createdAt`, `updatedAt` | Audit timestamps | Preserve the BSON instants |

`ReleaseDecisionExperiments` field mapping:

| Target field | Source/rule |
|---|---|
| `_id` | Legacy experiment `_id` |
| `name` | Stable flag name + metric name, no longer than 256 characters |
| `description` | `null`; do not misrepresent the flag description as an experiment description |
| `stage` | No iterations → `implementing`; one or more iterations → `measuring` |
| `flagKey` | `FeatureFlags.key` |
| `featBitProjectKey` | `Environments.projectId → Projects.key` |
| `featBitEnvId` | `Experiments.envId` |
| `primaryMetric` | Complete JSON string containing `name`, `event`, `metricType`, `metricAgg`, `expectedDirection`, and optional `description` |
| `variants` | Complete JSON string array; map each `FeatureFlags.variations[]` item to `key=id`, `name`, and `value`; generate `description` from name/value using the current builder rules |
| `sandboxStatus` | `idle` |
| `createdAt`, `updatedAt` | Legacy audit timestamps |

Generate one `ReleaseDecisionActivities` migration activity for every migrated experiment. Its `detail` is a versioned Extended JSON string containing the complete source `Experiments` document, the complete referenced `ExperimentMetrics` document, lookup IDs, migration mappings, and source version. This prevents `maintainerUserId`, URL/element tracking configuration, legacy state, alpha, and any additional BSON properties discovered later from being silently ignored. Fields without a target on metrics that no experiment references remain in the source collection and must be listed completely in the migration report.

| Activity field | Rule |
|---|---|
| `_id` | Generate deterministically from migration version + experiment ID |
| `experimentId` | Target experiment `_id` |
| `type`, `title` | `migration` and an explicit 5.4.6 MongoDB import title |
| `detail` | The complete, versioned Extended JSON snapshot described above |
| `actorType`, `actorName` | `system` and the migration identifier; never impersonate the legacy maintainer |
| `createdAt` | Migration execution time in UTC |

### 3. `iterations[]` → `ReleaseDecisionExperimentRuns`

Handle every field on each legacy iteration:

| `iterations[]` property | Legacy use | v6 handling |
|---|---|---|
| `id` | Iteration UUID string | Parse into target `_id` UUID binary; write the original string to `runId` |
| `startTime`, `endTime` | Observation window | Map to `observationStart`, `observationEnd` |
| `updatedAt` | Iteration update time | Fallback source for target `updatedAt` |
| `isArchived` | Legacy iteration archive/lock semantics | Preserve completely in the legacy artifact |
| `eventType`, `eventName` | Metric snapshot for that run | Write `primaryMetricType`, `primaryMetricEvent`; prefer the snapshot over the current metric |
| `customEventTrackOption` | Conversion/Numeric behavior for that run | Write `primaryMetricType`, `primaryMetricAgg`, and preserve the original enum |
| `customEventUnit` | Numeric unit for that run | Preserve completely in the legacy artifact; the target run has no unit field |
| `customEventSuccessCriteria` | Higher/Lower direction for that run | Preserve in the legacy artifact |
| `results` | Legacy statistical results | Preserve completely in the versioned legacy `analysisResult` JSON string |
| `isFinish` | Legacy run completion state | Use for status mapping and preserve in the legacy artifact |

Preserve the original value of every following `results[]` property; do not retain only the winner:

`changeToBaseline`, `confidenceInterval`, `conversion`, `conversionRate`, `totalEvents`, `average`, `isBaseline`, `isInvalid`, `isWinner`, `pValue`, `uniqueUsers`, `variationId`, `effectSize`, `reason`.

Target run mapping:

| Target field | Source/rule |
|---|---|
| `_id`, `runId` | Legacy iteration `id` |
| `experimentId` | Parent experiment `_id` |
| `slug` | Generate stable `legacy-1`, `legacy-2`, and so on from source array order |
| `status` | Not finished with no results → `collecting`; finished or results present → `analyzing`; never invent `decided` |
| `method` | `legacy_frequentist`, explicitly distinct from v6 `bayesian_ab` / `bandit` |
| `methodReason` | Explain that the data was imported from a 5.4.6 iteration |
| `primaryMetricEvent/type/agg` | The iteration's event snapshot |
| `metricDescription` | Original metric description; preserve the legacy unit only in the legacy artifact to avoid changing description semantics |
| `controlVariant` | Experiment `baselineVariationId` |
| `treatmentVariant` | Join non-baseline variation IDs from results with `\|`; when results are absent, fall back to flag variations |
| `observationStart`, `observationEnd` | Iteration timestamps |
| `analysisResult` | Versioned legacy artifact containing the complete iteration, every result, experiment alpha, source IDs, and migration version |
| `inputData` | `null`; do not fabricate raw observations from aggregate results |
| Decision/learning fields | `null`; a legacy winner is not a v6 release decision |
| `createdAt`, `updatedAt` | `startTime`; update time falls back in order through `updatedAt`, `endTime`, and `startTime` |

Display a legacy run as a read-only result “imported from 5.4.6 and not recalculated.” The first read must not trigger v6 Bayesian/Bandit analysis and overwrite `analysisResult`. The UI/API must recognize `legacy_frequentist` instead of displaying an unknown method as Bayesian.

## Additional Property Checks

Before migration, use `$objectToArray` and array unwinding to profile fields at these levels:

- Top-level `ExperimentMetrics` and `targetUrls[]`.
- Top-level `Experiments`.
- `iterations[]`.
- `iterations[].results[]`.
- `FeatureFlags.variations[]`.

Reconcile the profile with the field inventory above. Read source collections as original `BsonDocument` values rather than deserializing only to legacy typed entities; the project's `IgnoreExtraElements` convention would silently discard unknown fields. When an unknown property is found, first confirm whether 5.4.6 code or customer data uses it. Any field with business meaning must receive an explicit mapping or be written to the versioned legacy artifact/activity before migration; never drop it silently.

## Execution Steps

1. Create a recoverable MongoDB snapshot, confirm that source and target use the same expected database, and deploy v6 code capable of reading legacy runs.
2. Run read-only preflight checks: complete field/BSON type profiles; duplicate metric keys; missing experiment references to environment/project/flag/metric; iteration IDs, times, results, and variation references; target `_id` and unique-key conflicts.
3. Migrate in dependency order: `ReleaseDecisionMetrics` → `ReleaseDecisionExperiments` → `ReleaseDecisionExperimentRuns` → `ReleaseDecisionActivities`. Generate every `_id` and activity ID deterministically.
4. Treat identical content with the same ID/key as already migrated. Stop and report when content differs; never use `ReplaceOne` to overwrite an existing v6 document. The migration must not depend on a cross-collection transaction and must be safe to rerun.
5. Verify target indexes, ensuring at least uniqueness of metric `(featBitEnvId, key)` and run `(experimentId, slug)`, plus coverage for experiment environment/project/flag queries.
6. Produce a migration report containing migrated, merged, already-present, and rejected counts; the old-to-target ID map; and complete missing references, conflicts, unknown properties, and values without direct target fields.

## Test Plan

Use a temporary MongoDB instance and load 5.4.6 documents with their real BSON types. Cover at least:

- Custom Conversion, Custom Numeric, PageView, and Click; Higher, Lower, and Undefined; active and archived metrics.
- `maintainerUserId`, `customEventUnit`, `elementTargets`, complete `targetUrls[]`, and additional unknown properties.
- Compatible and conflicting duplicates with the same `(envId,eventName)`.
- Experiment states `NotStarted`, `Paused`, `Recording`, and archived; zero, one, and multiple iterations.
- Every iteration field; binary/numeric results; one baseline plus multiple treatments; and all 14 result properties.
- Missing flags, metrics, or projects; invalid UUIDs; unexpected BSON types; and unknown variations.
- Identical and conflicting documents already in the target, plus two consecutive migration runs.

Core assertions:

1. Every source metric and experiment is migrated, merged/already present, or rejected, and every old ID can be traced to a target ID.
2. Every valid iteration generates exactly one run; metric type/aggregation/direction, flag/project, variants, baseline/treatments, and observation window are mapped correctly.
3. The activity source snapshot and legacy `analysisResult` contain every source field; compare every iteration/result/property name, value, and array order.
4. The API lists migrated metrics and experiments; the UI opens legacy runs and labels them explicitly as imported frequentist results.
5. Migration and the first read neither reanalyze nor alter legacy results, and do not create layers, assignments, decisions, or learnings.
6. A second run inserts zero documents; source `ExperimentMetrics`, `Experiments`, and every lookup collection remain unchanged; event collections are never modified.

## Rollback and Completion Criteria

Record IDs already present in the target collections before migration. To roll back, delete only documents inserted by this migration, in reverse dependency order: `ReleaseDecisionActivities` → `ReleaseDecisionExperimentRuns` → `ReleaseDecisionExperiments` → `ReleaseDecisionMetrics`. Never delete a legacy metric mapping merged into a metric that existed before migration. Migration 2 is complete only after full-field reconciliation, API/UI smoke tests, read-only legacy behavior, and idempotency tests all pass.
