# Migration 2: PostgreSQL Metrics and Experimentation Migration Plan (5.4.6 → 6.0.0)

## Goal and Scope

Migrate 5.4.6 metric definitions, experiment metadata, and historical `iterations` results into the v6.0.0 release-decision data model.

- No new data is added to the source database during migration, so dual writes and incremental catch-up are unnecessary.
- This plan applies only to PostgreSQL.
- Do not migrate `events` or write to `release_decision_exposure_events` or `release_decision_metric_events`.
- Do not recalculate historical iteration results from events.
- Do not invent layers or assignments for legacy experiments; do not write `release_decision_layers` or `release_decision_run_assignments`.
- Preserve the original `experiment_metrics`, `experiments`, and lookup tables unchanged.

## Tables Involved

| Role | Table | Purpose |
|---|---|---|
| Source | `experiment_metrics` | 5.4.6 metric definitions |
| Source | `experiments` | 5.4.6 experiments and `iterations` JSONB |
| Lookup | `feature_flags` | Flag key, name, and variations |
| Lookup | `environments` | Experiment-to-project relationship |
| Lookup | `projects` | Project key |
| Target | `release_decision_metrics` | v6 metric registry |
| Target | `release_decision_experiments` | v6 experiment workspace |
| Target | `release_decision_experiment_runs` | One run for each legacy iteration |
| Target | `release_decision_activities` | Records migration provenance and legacy state that cannot be mapped directly |

## Data Mapping

### 1. `experiment_metrics` → `release_decision_metrics`

5.4.6 enums: `event_type` is Custom=1, PageView=2, Click=3; `custom_event_track_option` is Undefined=0, Conversion=1, Numeric=2; and `custom_event_success_criteria` is Undefined=0, Higher=1, Lower=2.

| Source field | Target field | Rule |
|---|---|---|
| `id` | `id` | Preserve the UUID when no key-based merge occurs |
| `env_id` | `featbit_env_id` | Preserve the UUID |
| `name` | `name` | Preserve the value |
| `event_name` | `key` | Preserve the value; the target unique key is `(featbit_env_id, key)` |
| `description` | `description` | Preserve the value |
| `event_type` + `custom_event_track_option` | `metric_type` | Custom + Numeric → `continuous`; otherwise → `binary` |
| Same fields | `metric_agg` | Custom + Numeric → `sum`; otherwise → `once` |
| `custom_event_success_criteria` | `expected_direction` | Lower → `decrease_good`; Higher/Undefined → `increase_good`, while also reporting Undefined |
| `is_arvhived` | `status` | true → `archived`; false → `active` |
| `created_at`, `updated_at` | Fields with the same names | Preserve the original instants |

`maintainer_user_id`, `custom_event_unit`, `element_targets`, and `target_urls` have no equivalent fields in the target metric table. Do not append them to the description. Retain them in the legacy table and list them in the migration report.

The legacy table may contain duplicate `(env_id, event_name)` values:

- Merge duplicates with fully compatible configurations into one target metric, and create an `old_metric_id → target_metric_id` mapping for experiments.
- Report and require manual resolution when metric type, aggregation, or direction conflicts. Do not silently avoid a conflict by changing the key, because the key must continue to match the historical event name.

### 2. `experiments` → `release_decision_experiments`

| Source | Target field | Rule |
|---|---|---|
| `experiments.id` | `id` | Preserve the UUID |
| `experiments.env_id` | `featbit_env_id` | Preserve the value |
| `feature_flags.key` | `flag_key` | Resolve through the `feature_flag_id` lookup |
| `environments.project_id → projects.key` | `featbit_project_key` | Resolve through lookups |
| Flag name + metric name | `name` | Generate a recognizable name no longer than 256 characters |
| No direct source | `description` | Write `NULL`; do not misrepresent the flag description as an experiment description |
| Iteration count | `stage` | No iterations → `implementing`; one or more iterations → `measuring` |
| Migrated metric | `primary_metric` | Use the v6 JSON shape: name, event, metricType, metricAgg, expectedDirection, and description |
| `feature_flags.variations` | `variants` | Convert to a v6 array containing `key`, `name`, `value`, and `description` |
| `created_at`, `updated_at` | Fields with the same names | Preserve the original instants |

The legacy `status` and `is_archived` fields have no equivalent v6 workspace fields. Write one migration activity to `release_decision_activities` for each experiment, recording the source experiment ID, legacy status, archive state, metric ID, feature flag ID, alpha, and iteration count. Do not invent a hypothesis, decision, or learning merely because a legacy experiment ended.

### 3. `experiments.iterations[]` → `release_decision_experiment_runs`

The 5.4.6 `iterations` value is a JSONB array whose normal fields use camelCase, including `id`, `startTime`, `endTime`, `eventType`, `eventName`, `customEventTrackOption`, `customEventSuccessCriteria`, `results`, and `isFinish`.

| Source iteration | Target field | Rule |
|---|---|---|
| `id` | `id`, `run_id` | A normal value is a UUID string; preserve it as the target UUID and also write the original string to `run_id` |
| JSON array order | `slug` | Generate stable values `legacy-1`, `legacy-2`, and so on |
| `isFinish`, `results` | `status` | Not finished with no results → `collecting`; results present or finished → `analyzing`; never invent `decided` |
| Fixed migration marker | `method` | `legacy_frequentist`; never label it `bayesian_ab` or `bandit` |
| Iteration event snapshot | `primary_metric_event/type/agg` | Prefer the iteration's own fields over current metric values that may have changed |
| `baseline_variation_id` | `control_variant` | Preserve the variation ID |
| Variation IDs in iteration results | `treatment_variant` | Join non-baseline IDs with `\|`; when results are absent, fall back to flag variations |
| `startTime`, `endTime` | `observation_start`, `observation_end` | Preserve the original instants |
| `results` + experiment `alpha` | `analysis_result` | Store a versioned legacy artifact with provenance, preserving the complete legacy result without converting it to v6 Bayesian/Bandit output |
| No reliable source | `input_data` | Write `NULL`; do not fabricate raw observations from aggregate results |
| `startTime` | `created_at` | Preserve the original instant |
| `updatedAt` / `endTime` / `startTime` | `updated_at` | Apply fallbacks in that order |

The current read path must clearly present a legacy `analysis_result` as a read-only result “imported from 5.4.6 and not recalculated.” Preserve original `IterationResult` fields such as variationId, conversion, conversionRate, average, uniqueUsers, totalEvents, confidenceInterval, pValue, effectSize, isWinner, and reason. Never map the legacy `alpha` to a Bayesian prior.

## Execution Steps

1. Create a recoverable database snapshot and deploy the v6.0.0 schema.
2. Run read-only preflight checks:
   - Metric enum values and duplicate/conflicting `(env_id, event_name)` groups.
   - Missing experiment references to environment, project, flag, or metric.
   - Whether `iterations` is a valid array, iteration IDs are UUIDs, and times and results are parseable.
   - Whether baseline/result variations exist on the corresponding flag.
   - Existing target records with the same ID or unique key, including content conflicts.
3. Migrate in dependency order: metrics → experiments → runs → migration activities. Preserve the old metric ID to target metric ID mapping throughout migration.
4. Treat identical records with the same ID/key as already migrated. Stop and report when content differs; never overwrite existing user-owned v6 data.
5. Produce a migration report with migrated, merged, already-present, and rejected counts for each source type, plus every missing reference, conflict, and field without a direct mapping.
6. End the migration window after API/UI smoke tests and count reconciliation succeed.

The migration must be repeatable. A second run must not create duplicate metrics, experiments, runs, or activities.

## Test Plan

Use a temporary PostgreSQL instance loaded with the real 5.4.6 schema and the current v6.0.0 schema. Cover at least:

- Custom Conversion, Custom Numeric, PageView, and Click metrics, plus Higher, Lower, and Undefined criteria.
- Active and archived metrics.
- Compatible and conflicting duplicates with the same event name.
- Zero, one, and multiple iterations.
- Running, finished, archived, and result-less iterations.
- Binary and numeric historical results, with one baseline and multiple treatments.
- Missing flags, metrics, or projects; invalid iteration JSON; and invalid iteration IDs.
- Identical and conflicting records already in the target, plus two consecutive migration runs.

Core assertions:

1. Every source metric is migrated, merged, already present, or rejected, with an old-to-target ID mapping.
2. Every source experiment is migrated, already present, or rejected; every valid iteration maps to exactly one run.
3. Metric type/aggregation/direction, flag/project, primary metric, variants, control/treatments, and observation window are mapped correctly.
4. The legacy result and alpha are preserved completely and marked as 5.4.6 historical results; migration and the first read do not trigger reanalysis.
5. The API lists migrated metrics and experiments, and the UI opens experiments and legacy runs without presenting old results as new Bayesian/Bandit conclusions.
6. A second run inserts zero rows, source table content remains unchanged, and this migration does not modify any of the three event-related tables.

## Rollback and Completion Criteria

Record the target rows that existed before writing. To roll back, delete only rows inserted by this migration, in reverse dependency order: activities → runs → experiments → metrics. Never delete a legacy metric mapping that was merged into a metric that existed before migration. Migration 2 is complete only when every mapping and count, the API/UI smoke tests, historical-result labeling, and idempotency tests pass.
