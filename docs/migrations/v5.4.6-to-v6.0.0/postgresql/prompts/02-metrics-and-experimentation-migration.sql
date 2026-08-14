\set ON_ERROR_STOP on

-- FeatBit PostgreSQL migration: 5.4.6 -> 6.0.0
-- Migration 2: legacy metric definitions, experiments, and iteration results.
--
-- Run this script after the v6.0.0 schema has been installed and while the
-- legacy experiment tables are frozen:
--
--   psql "$DATABASE_URL" -f 02-metrics-and-experimentation-migration.sql
--
-- The script is transactional and immediately repeatable. It does not change
-- the legacy source tables or any event/layer/assignment table. Invalid source
-- rows are reported; conflicting target rows abort the whole transaction.

BEGIN;

SET LOCAL TIME ZONE 'UTC';
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '0';
SET LOCAL search_path = public, pg_temp;

DO $migration$
DECLARE
    missing_relations text[] := ARRAY[]::text[];
    relation_name text;
BEGIN
    FOREACH relation_name IN ARRAY ARRAY[
        'experiment_metrics',
        'experiments',
        'feature_flags',
        'environments',
        'projects',
        'release_decision_metrics',
        'release_decision_experiments',
        'release_decision_experiment_runs',
        'release_decision_activities'
    ]
    LOOP
        IF to_regclass('public.' || relation_name) IS NULL THEN
            missing_relations := array_append(missing_relations, relation_name);
        END IF;
    END LOOP;

    IF cardinality(missing_relations) > 0 THEN
        RAISE EXCEPTION 'Required tables are missing: %', array_to_string(missing_relations, ', ');
    END IF;
END
$migration$;

-- The source is expected to be frozen. Target locks close the gap between the
-- conflict checks and inserts.
LOCK TABLE experiment_metrics, experiments, feature_flags, environments, projects IN SHARE MODE;
LOCK TABLE release_decision_metrics, release_decision_experiments,
           release_decision_experiment_runs, release_decision_activities
    IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE _migration_session
(
    started_at timestamptz NOT NULL
) ON COMMIT DROP;

INSERT INTO _migration_session VALUES (clock_timestamp());

CREATE OR REPLACE FUNCTION pg_temp.try_uuid(value text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
AS $function$
BEGIN
    IF value IS NULL OR btrim(value) = '' THEN
        RETURN NULL;
    END IF;
    RETURN btrim(value)::uuid;
EXCEPTION WHEN invalid_text_representation THEN
    RETURN NULL;
END
$function$;

CREATE OR REPLACE FUNCTION pg_temp.try_integer(value text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $function$
BEGIN
    IF value IS NULL OR btrim(value) !~ '^[+-]?[0-9]+$' THEN
        RETURN NULL;
    END IF;
    RETURN btrim(value)::integer;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RETURN NULL;
END
$function$;

CREATE OR REPLACE FUNCTION pg_temp.try_boolean(value text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $function$
BEGIN
    CASE lower(btrim(value))
        WHEN 'true' THEN RETURN true;
        WHEN 't' THEN RETURN true;
        WHEN '1' THEN RETURN true;
        WHEN 'false' THEN RETURN false;
        WHEN 'f' THEN RETURN false;
        WHEN '0' THEN RETURN false;
        ELSE RETURN NULL;
    END CASE;
END
$function$;

CREATE OR REPLACE FUNCTION pg_temp.try_timestamptz(value text)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
AS $function$
BEGIN
    IF value IS NULL OR btrim(value) = '' THEN
        RETURN NULL;
    END IF;

    -- .NET DateTime JSON without an offset is interpreted as UTC, matching the
    -- old service's experiment-time semantics.
    IF btrim(value) ~ '(Z|z|[+-][0-9]{2}:[0-9]{2})$' THEN
        RETURN btrim(value)::timestamptz;
    END IF;
    RETURN btrim(value)::timestamp AT TIME ZONE 'UTC';
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END
$function$;

CREATE OR REPLACE FUNCTION pg_temp.try_jsonb(value text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $function$
BEGIN
    IF value IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN value::jsonb;
EXCEPTION WHEN invalid_text_representation THEN
    RETURN NULL;
END
$function$;

CREATE OR REPLACE FUNCTION pg_temp.deterministic_uuid(value text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
STRICT
AS $function$
    SELECT (
        substring(md5(value), 1, 8) || '-' ||
        substring(md5(value), 9, 4) || '-' ||
        substring(md5(value), 13, 4) || '-' ||
        substring(md5(value), 17, 4) || '-' ||
        substring(md5(value), 21, 12)
    )::uuid
$function$;

-- ---------------------------------------------------------------------------
-- 1. experiment_metrics -> release_decision_metrics
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE _migration_metric_stage ON COMMIT DROP AS
SELECT
    m.id AS source_id,
    m.env_id,
    m.name,
    m.event_name AS metric_key,
    m.description,
    m.event_type,
    m.custom_event_track_option,
    m.custom_event_success_criteria,
    CASE
        WHEN m.event_type = 1 AND m.custom_event_track_option = 2 THEN 'continuous'
        ELSE 'binary'
    END AS metric_type,
    CASE
        WHEN m.event_type = 1 AND m.custom_event_track_option = 2 THEN 'sum'
        ELSE 'once'
    END AS metric_agg,
    CASE
        WHEN m.custom_event_success_criteria = 2 THEN 'decrease_good'
        ELSE 'increase_good'
    END AS expected_direction,
    CASE WHEN m.is_arvhived THEN 'archived' ELSE 'active' END AS status,
    m.created_at,
    m.updated_at,
    m.maintainer_user_id,
    m.custom_event_unit,
    m.element_targets,
    m.target_urls,
    array_remove(ARRAY[
        CASE WHEN NOT EXISTS (SELECT 1 FROM environments env WHERE env.id = m.env_id)
            THEN 'environment_not_found' END,
        CASE WHEN m.name IS NULL OR btrim(m.name) = '' THEN 'missing_name' END,
        CASE WHEN char_length(m.name) > 256 THEN 'name_too_long' END,
        CASE WHEN m.event_name IS NULL OR btrim(m.event_name) = '' THEN 'missing_event_name' END,
        CASE WHEN char_length(m.event_name) > 128 THEN 'event_name_too_long' END,
        CASE WHEN m.event_type NOT IN (1, 2, 3) THEN 'invalid_event_type' END,
        CASE WHEN m.custom_event_track_option NOT IN (0, 1, 2)
            THEN 'invalid_custom_event_track_option' END,
        CASE WHEN m.custom_event_success_criteria NOT IN (0, 1, 2)
            THEN 'invalid_custom_event_success_criteria' END
    ]::text[], NULL) AS reject_reasons,
    array_remove(ARRAY[
        CASE WHEN m.custom_event_success_criteria = 0
            THEN 'undefined_success_criteria_defaulted_to_increase_good' END,
        CASE WHEN m.custom_event_unit IS NOT NULL AND btrim(m.custom_event_unit) <> ''
            THEN 'custom_event_unit_has_no_v6_metric_column' END,
        CASE WHEN m.element_targets IS NOT NULL AND btrim(m.element_targets) <> ''
            THEN 'element_targets_has_no_v6_metric_column' END,
        CASE WHEN m.target_urls IS NOT NULL AND m.target_urls IS DISTINCT FROM 'null'::jsonb
            THEN 'target_urls_has_no_v6_metric_column' END,
        'maintainer_user_id_has_no_v6_metric_column'
    ]::text[], NULL) AS warnings
FROM experiment_metrics m;

CREATE INDEX ON _migration_metric_stage (source_id);
CREATE INDEX ON _migration_metric_stage (env_id, metric_key);

-- Duplicate source keys may only merge when every field represented by the v6
-- metric row is identical. Otherwise selecting one would silently lose data.
CREATE TEMP TABLE _migration_metric_duplicate_conflicts ON COMMIT DROP AS
SELECT
    env_id,
    metric_key,
    array_agg(source_id ORDER BY source_id) AS source_metric_ids,
    'same_env_key_has_different_v6_metric_content'::text AS conflict_reason
FROM _migration_metric_stage
WHERE cardinality(reject_reasons) = 0
GROUP BY env_id, metric_key
HAVING count(DISTINCT jsonb_build_object(
    'name', name,
    'description', description,
    'metricType', metric_type,
    'metricAgg', metric_agg,
    'expectedDirection', expected_direction,
    'status', status
)) > 1;

\echo 'Conflicting duplicate legacy metrics (the migration aborts when non-empty):'
TABLE _migration_metric_duplicate_conflicts;

DO $migration$
BEGIN
    IF EXISTS (SELECT 1 FROM _migration_metric_duplicate_conflicts) THEN
        RAISE EXCEPTION 'Metric migration stopped: conflicting duplicate (env_id, event_name) groups were found';
    END IF;
END
$migration$;

CREATE TEMP TABLE _migration_metric_canonical ON COMMIT DROP AS
SELECT *
FROM (
    SELECT
        s.*,
        row_number() OVER (
            PARTITION BY s.env_id, s.metric_key
            ORDER BY s.created_at, s.source_id
        ) AS source_rank
    FROM _migration_metric_stage s
    WHERE cardinality(s.reject_reasons) = 0
) ranked
WHERE source_rank = 1;

CREATE TEMP TABLE _migration_metric_target_conflicts ON COMMIT DROP AS
SELECT
    c.source_id,
    t.id AS target_id,
    'same_env_key_different_content'::text AS conflict_reason
FROM _migration_metric_canonical c
JOIN release_decision_metrics t
  ON t.featbit_env_id = c.env_id AND t.key = c.metric_key
WHERE NOT (
    t.name = c.name AND
    t.description IS NOT DISTINCT FROM c.description AND
    t.metric_type = c.metric_type AND
    t.metric_agg = c.metric_agg AND
    t.expected_direction = c.expected_direction AND
    t.status = c.status
)
UNION ALL
SELECT
    c.source_id,
    t.id,
    'source_id_already_used_by_different_target_metric'
FROM _migration_metric_canonical c
JOIN release_decision_metrics t ON t.id = c.source_id
WHERE NOT EXISTS (
    SELECT 1
    FROM release_decision_metrics by_key
    WHERE by_key.featbit_env_id = c.env_id AND by_key.key = c.metric_key
);

\echo 'Target metric conflicts (the migration aborts when non-empty):'
TABLE _migration_metric_target_conflicts;

DO $migration$
BEGIN
    IF EXISTS (SELECT 1 FROM _migration_metric_target_conflicts) THEN
        RAISE EXCEPTION 'Metric migration stopped: target conflicts were found';
    END IF;
END
$migration$;

CREATE TEMP TABLE _migration_inserted_metric_ids ON COMMIT DROP AS
WITH inserted AS
(
    INSERT INTO release_decision_metrics
    (
        id, featbit_env_id, name, key, description, metric_type, metric_agg,
        expected_direction, status, created_at, updated_at
    )
    SELECT
        c.source_id, c.env_id, c.name, c.metric_key, c.description,
        c.metric_type, c.metric_agg, c.expected_direction, c.status,
        c.created_at, c.updated_at
    FROM _migration_metric_canonical c
    WHERE NOT EXISTS (
        SELECT 1
        FROM release_decision_metrics t
        WHERE t.featbit_env_id = c.env_id AND t.key = c.metric_key
    )
    ON CONFLICT (featbit_env_id, key) DO NOTHING
    RETURNING id
)
SELECT id FROM inserted;

-- All compatible old metric IDs, including merged duplicates, resolve through
-- this mapping before experiments are processed.
CREATE TEMP TABLE _migration_metric_id_map ON COMMIT DROP AS
SELECT
    s.source_id AS old_metric_id,
    t.id AS target_metric_id,
    s.env_id,
    s.metric_key,
    (s.source_id IS DISTINCT FROM t.id) AS was_merged
FROM _migration_metric_stage s
JOIN release_decision_metrics t
  ON t.featbit_env_id = s.env_id AND t.key = s.metric_key
WHERE cardinality(s.reject_reasons) = 0;

CREATE UNIQUE INDEX ON _migration_metric_id_map (old_metric_id);

DO $migration$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM _migration_metric_stage s
        LEFT JOIN _migration_metric_id_map map ON map.old_metric_id = s.source_id
        WHERE cardinality(s.reject_reasons) = 0 AND map.old_metric_id IS NULL
    ) THEN
        RAISE EXCEPTION 'Metric migration post-insert verification failed';
    END IF;
END
$migration$;

-- ---------------------------------------------------------------------------
-- 2. experiments -> release_decision_experiments
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE _migration_experiment_stage ON COMMIT DROP AS
WITH joined AS
(
    SELECT
        e.*,
        map.target_metric_id,
        target_metric.featbit_env_id AS target_metric_env_id,
        target_metric.name AS target_metric_name,
        target_metric.key AS target_metric_key,
        target_metric.description AS target_metric_description,
        target_metric.metric_type AS target_metric_type,
        target_metric.metric_agg AS target_metric_agg,
        target_metric.expected_direction AS target_metric_direction,
        source_metric.event_type AS source_metric_event_type,
        source_metric.custom_event_track_option AS source_metric_track_option,
        source_metric.custom_event_success_criteria AS source_metric_success_criteria,
        ff.id AS found_flag_id,
        ff.env_id AS flag_env_id,
        ff.name AS flag_name,
        ff.key AS flag_key,
        ff.variations AS flag_variations,
        env.id AS found_env_id,
        env.project_id,
        project.id AS found_project_id,
        project.key AS project_key
    FROM experiments e
    LEFT JOIN _migration_metric_id_map map ON map.old_metric_id = e.metric_id
    LEFT JOIN release_decision_metrics target_metric ON target_metric.id = map.target_metric_id
    LEFT JOIN experiment_metrics source_metric ON source_metric.id = e.metric_id
    LEFT JOIN feature_flags ff ON ff.id = e.feature_flag_id
    LEFT JOIN environments env ON env.id = e.env_id
    LEFT JOIN projects project ON project.id = env.project_id
), normalized AS
(
    SELECT
        j.*,
        CASE
            WHEN j.iterations IS NULL OR j.iterations = 'null'::jsonb THEN '[]'::jsonb
            WHEN jsonb_typeof(j.iterations) = 'array' THEN j.iterations
            ELSE '[]'::jsonb
        END AS iterations_json,
        CASE
            WHEN jsonb_typeof(j.flag_variations) = 'array' THEN
                COALESCE((
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'key', variation.item ->> 'id',
                            'name', variation.item ->> 'name',
                            'value', variation.item ->> 'value',
                            'description', CASE
                                WHEN COALESCE(btrim(variation.item ->> 'value'), '') = ''
                                    THEN variation.item ->> 'name'
                                ELSE (variation.item ->> 'name') || ' (' || (variation.item ->> 'value') || ')'
                            END
                        ) ORDER BY variation.ordinality
                    )
                    FROM jsonb_array_elements(j.flag_variations)
                         WITH ORDINALITY AS variation(item, ordinality)
                ), '[]'::jsonb)
            ELSE '[]'::jsonb
        END AS variants_json,
        CASE
            WHEN jsonb_typeof(j.flag_variations) = 'array' THEN ARRAY(
                SELECT variation.item ->> 'id'
                FROM jsonb_array_elements(j.flag_variations)
                     WITH ORDINALITY AS variation(item, ordinality)
                ORDER BY variation.ordinality
            )
            ELSE ARRAY[]::text[]
        END AS variation_ids
    FROM joined j
), mapped AS
(
    SELECT
        n.*,
        left(n.flag_name || ' / ' || n.target_metric_name, 256) AS target_name,
        CASE WHEN jsonb_array_length(n.iterations_json) = 0 THEN 'implementing' ELSE 'measuring' END AS target_stage,
        jsonb_strip_nulls(jsonb_build_object(
            'name', n.target_metric_name,
            'event', n.target_metric_key,
            'metricType', n.target_metric_type,
            'metricAgg', n.target_metric_agg,
            'expectedDirection', n.target_metric_direction,
            'description', n.target_metric_description
        )) AS primary_metric_json
    FROM normalized n
)
SELECT
    m.*,
    array_remove(ARRAY[
        CASE WHEN m.found_env_id IS NULL THEN 'environment_not_found' END,
        CASE WHEN m.found_project_id IS NULL THEN 'project_not_found' END,
        CASE WHEN m.found_flag_id IS NULL THEN 'feature_flag_not_found' END,
        CASE WHEN m.found_flag_id IS NOT NULL AND m.flag_env_id IS DISTINCT FROM m.env_id
            THEN 'feature_flag_environment_mismatch' END,
        CASE WHEN m.target_metric_id IS NULL THEN 'metric_not_mapped' END,
        CASE WHEN m.target_metric_id IS NOT NULL AND m.target_metric_env_id IS DISTINCT FROM m.env_id
            THEN 'metric_environment_mismatch' END,
        CASE WHEN m.iterations IS NOT NULL AND m.iterations IS DISTINCT FROM 'null'::jsonb
                       AND jsonb_typeof(m.iterations) IS DISTINCT FROM 'array'
            THEN 'iterations_not_an_array' END,
        CASE WHEN jsonb_typeof(m.flag_variations) IS DISTINCT FROM 'array'
            THEN 'flag_variations_not_an_array' END,
        CASE WHEN jsonb_typeof(m.flag_variations) = 'array' AND EXISTS (
                SELECT 1
                FROM jsonb_array_elements(m.flag_variations) variation(item)
                WHERE jsonb_typeof(variation.item) IS DISTINCT FROM 'object'
                   OR COALESCE(btrim(variation.item ->> 'id'), '') = ''
                   OR COALESCE(btrim(variation.item ->> 'name'), '') = ''
            ) THEN 'invalid_flag_variation' END,
        CASE WHEN jsonb_typeof(m.flag_variations) = 'array' AND EXISTS (
                SELECT 1
                FROM jsonb_array_elements(m.flag_variations) variation(item)
                GROUP BY variation.item ->> 'id'
                HAVING count(*) > 1
            ) THEN 'duplicate_flag_variation_id' END,
        CASE WHEN m.target_name IS NULL OR btrim(m.target_name) = '' THEN 'missing_generated_name' END
    ]::text[], NULL) AS reject_reasons,
    array_remove(ARRAY[
        CASE WHEN m.baseline_variation_id IS NULL OR btrim(m.baseline_variation_id) = ''
            THEN 'missing_baseline_variation_id' END,
        CASE WHEN m.baseline_variation_id IS NOT NULL
                       AND NOT (m.baseline_variation_id = ANY(m.variation_ids))
            THEN 'baseline_variation_not_found_in_flag' END,
        CASE WHEN m.alpha IS NULL THEN 'legacy_alpha_is_null' END
    ]::text[], NULL) AS warnings
FROM mapped m;

CREATE INDEX ON _migration_experiment_stage (id);

CREATE TEMP TABLE _migration_experiment_target_conflicts ON COMMIT DROP AS
SELECT
    s.id AS source_id,
    'same_id_different_content'::text AS conflict_reason
FROM _migration_experiment_stage s
JOIN release_decision_experiments t ON t.id = s.id
WHERE cardinality(s.reject_reasons) = 0
  AND NOT (
      t.name = s.target_name AND
      t.description IS NULL AND
      t.stage = s.target_stage AND
      t.flag_key IS NOT DISTINCT FROM s.flag_key AND
      t.featbit_project_key IS NOT DISTINCT FROM s.project_key AND
      t.featbit_env_id IS NOT DISTINCT FROM s.env_id AND
      pg_temp.try_jsonb(t.primary_metric) IS NOT DISTINCT FROM s.primary_metric_json AND
      pg_temp.try_jsonb(t.variants) IS NOT DISTINCT FROM s.variants_json AND
      t.sandbox_status IS NOT DISTINCT FROM 'idle' AND
      t.created_at = s.created_at AND
      t.updated_at = s.updated_at
  );

\echo 'Target experiment conflicts (the migration aborts when non-empty):'
TABLE _migration_experiment_target_conflicts;

DO $migration$
BEGIN
    IF EXISTS (SELECT 1 FROM _migration_experiment_target_conflicts) THEN
        RAISE EXCEPTION 'Experiment migration stopped: target ID conflicts were found';
    END IF;
END
$migration$;

CREATE TEMP TABLE _migration_inserted_experiment_ids ON COMMIT DROP AS
WITH inserted AS
(
    INSERT INTO release_decision_experiments
    (
        id, name, description, stage, flag_key, featbit_project_key,
        featbit_env_id, primary_metric, variants, sandbox_status,
        created_at, updated_at
    )
    SELECT
        s.id, s.target_name, NULL, s.target_stage, s.flag_key, s.project_key,
        s.env_id, s.primary_metric_json::text, s.variants_json::text, 'idle',
        s.created_at, s.updated_at
    FROM _migration_experiment_stage s
    WHERE cardinality(s.reject_reasons) = 0
    ON CONFLICT (id) DO NOTHING
    RETURNING id
)
SELECT id FROM inserted;

-- ---------------------------------------------------------------------------
-- 3. experiments.iterations[] -> release_decision_experiment_runs
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE _migration_run_stage ON COMMIT DROP AS
WITH raw AS
(
    SELECT
        e.id AS experiment_id,
        e.baseline_variation_id,
        e.alpha,
        e.variation_ids,
        e.target_metric_description,
        e.target_metric_key,
        e.target_metric_type,
        e.target_metric_agg,
        e.source_metric_event_type,
        e.source_metric_track_option,
        e.source_metric_success_criteria,
        iteration.item AS source_iteration,
        iteration.ordinality::integer AS iteration_number
    FROM _migration_experiment_stage e
    CROSS JOIN LATERAL jsonb_array_elements(e.iterations_json)
        WITH ORDINALITY AS iteration(item, ordinality)
    WHERE cardinality(e.reject_reasons) = 0
), parsed AS
(
    SELECT
        r.*,
        NULLIF(btrim(r.source_iteration ->> 'id'), '') AS source_iteration_id,
        pg_temp.try_uuid(r.source_iteration ->> 'id') AS run_uuid,
        pg_temp.try_timestamptz(r.source_iteration ->> 'startTime') AS parsed_start_time,
        pg_temp.try_timestamptz(r.source_iteration ->> 'endTime') AS parsed_end_time,
        pg_temp.try_timestamptz(r.source_iteration ->> 'updatedAt') AS parsed_updated_at,
        pg_temp.try_boolean(r.source_iteration ->> 'isFinish') AS parsed_is_finish,
        COALESCE(
            pg_temp.try_integer(r.source_iteration ->> 'eventType'),
            r.source_metric_event_type
        ) AS resolved_event_type,
        COALESCE(
            pg_temp.try_integer(r.source_iteration ->> 'customEventTrackOption'),
            r.source_metric_track_option
        ) AS resolved_track_option,
        COALESCE(
            pg_temp.try_integer(r.source_iteration ->> 'customEventSuccessCriteria'),
            r.source_metric_success_criteria
        ) AS resolved_success_criteria,
        COALESCE(NULLIF(btrim(r.source_iteration ->> 'eventName'), ''), r.target_metric_key) AS resolved_event_name,
        CASE
            WHEN r.source_iteration -> 'results' IS NULL
                 OR r.source_iteration -> 'results' = 'null'::jsonb THEN '[]'::jsonb
            WHEN jsonb_typeof(r.source_iteration -> 'results') = 'array'
                THEN r.source_iteration -> 'results'
            ELSE '[]'::jsonb
        END AS results_json
    FROM raw r
), variation_data AS
(
    SELECT
        p.*,
        ARRAY(
            SELECT result_id
            FROM (
                SELECT
                    result.item ->> 'variationId' AS result_id,
                    min(result.ordinality) AS first_ordinality
                FROM jsonb_array_elements(p.results_json)
                     WITH ORDINALITY AS result(item, ordinality)
                WHERE jsonb_typeof(result.item) = 'object'
                  AND COALESCE(btrim(result.item ->> 'variationId'), '') <> ''
                  AND result.item ->> 'variationId' IS DISTINCT FROM p.baseline_variation_id
                GROUP BY result.item ->> 'variationId'
            ) distinct_results
            ORDER BY first_ordinality
        ) AS result_treatment_ids,
        ARRAY(
            SELECT variation_id
            FROM unnest(p.variation_ids) WITH ORDINALITY AS variation(variation_id, ordinality)
            WHERE variation_id IS DISTINCT FROM p.baseline_variation_id
            ORDER BY ordinality
        ) AS fallback_treatment_ids
    FROM parsed p
), resolved AS
(
    SELECT
        v.*,
        'legacy-' || v.iteration_number::text AS slug,
        CASE
            WHEN COALESCE(v.parsed_is_finish, false) OR jsonb_array_length(v.results_json) > 0
                THEN 'analyzing'
            ELSE 'collecting'
        END AS target_status,
        CASE
            WHEN v.resolved_event_type = 1 AND v.resolved_track_option = 2 THEN 'continuous'
            ELSE 'binary'
        END AS snapshot_metric_type,
        CASE
            WHEN v.resolved_event_type = 1 AND v.resolved_track_option = 2 THEN 'sum'
            ELSE 'once'
        END AS snapshot_metric_agg,
        NULLIF(array_to_string(
            CASE
                WHEN cardinality(v.result_treatment_ids) > 0 THEN v.result_treatment_ids
                ELSE v.fallback_treatment_ids
            END,
            '|'
        ), '') AS treatment_variants,
        jsonb_build_object(
            'artifactVersion', 1,
            'kind', 'featbit_legacy_frequentist',
            'sourceVersion', '5.4.6',
            'sourceProvider', 'PostgreSQL',
            'recomputed', false,
            'sourceExperimentId', v.experiment_id,
            'alpha', v.alpha,
            'iteration', v.source_iteration,
            'results', v.results_json
        ) AS analysis_result_json
    FROM variation_data v
)
SELECT
    r.*,
    COALESCE(r.parsed_updated_at, r.parsed_end_time, r.parsed_start_time) AS target_updated_at,
    array_remove(ARRAY[
        CASE WHEN jsonb_typeof(r.source_iteration) IS DISTINCT FROM 'object'
            THEN 'iteration_not_an_object' END,
        CASE WHEN r.source_iteration_id IS NULL THEN 'missing_iteration_id' END,
        CASE WHEN r.source_iteration_id IS NOT NULL AND r.run_uuid IS NULL
            THEN 'iteration_id_not_uuid' END,
        CASE WHEN r.parsed_start_time IS NULL THEN 'invalid_start_time' END,
        CASE WHEN r.source_iteration -> 'endTime' IS NOT NULL
                       AND r.source_iteration -> 'endTime' IS DISTINCT FROM 'null'::jsonb
                       AND r.parsed_end_time IS NULL
            THEN 'invalid_end_time' END,
        CASE WHEN r.source_iteration -> 'updatedAt' IS NOT NULL
                       AND r.source_iteration -> 'updatedAt' IS DISTINCT FROM 'null'::jsonb
                       AND r.parsed_updated_at IS NULL
            THEN 'invalid_updated_at' END,
        CASE WHEN r.source_iteration -> 'isFinish' IS NOT NULL
                       AND r.source_iteration -> 'isFinish' IS DISTINCT FROM 'null'::jsonb
                       AND r.parsed_is_finish IS NULL
            THEN 'invalid_is_finish' END,
        CASE WHEN r.source_iteration -> 'eventType' IS NOT NULL
                       AND r.source_iteration -> 'eventType' IS DISTINCT FROM 'null'::jsonb
                       AND pg_temp.try_integer(r.source_iteration ->> 'eventType') IS NULL
            THEN 'invalid_iteration_event_type' END,
        CASE WHEN r.resolved_event_type NOT IN (1, 2, 3)
            THEN 'unsupported_iteration_event_type' END,
        CASE WHEN r.source_iteration -> 'customEventTrackOption' IS NOT NULL
                       AND r.source_iteration -> 'customEventTrackOption' IS DISTINCT FROM 'null'::jsonb
                       AND pg_temp.try_integer(r.source_iteration ->> 'customEventTrackOption') IS NULL
            THEN 'invalid_iteration_track_option' END,
        CASE WHEN r.resolved_track_option NOT IN (0, 1, 2)
            THEN 'unsupported_iteration_track_option' END,
        CASE WHEN r.resolved_success_criteria NOT IN (0, 1, 2)
            THEN 'unsupported_iteration_success_criteria' END,
        CASE WHEN r.resolved_event_name IS NULL OR btrim(r.resolved_event_name) = ''
            THEN 'missing_iteration_event_name' END,
        CASE WHEN char_length(r.resolved_event_name) > 256
            THEN 'iteration_event_name_too_long' END,
        CASE WHEN r.source_iteration -> 'results' IS NOT NULL
                       AND r.source_iteration -> 'results' IS DISTINCT FROM 'null'::jsonb
                       AND jsonb_typeof(r.source_iteration -> 'results') IS DISTINCT FROM 'array'
            THEN 'iteration_results_not_an_array' END,
        CASE WHEN EXISTS (
                SELECT 1
                FROM jsonb_array_elements(r.results_json) result(item)
                WHERE jsonb_typeof(result.item) IS DISTINCT FROM 'object'
                   OR COALESCE(btrim(result.item ->> 'variationId'), '') = ''
            ) THEN 'invalid_iteration_result' END,
        CASE WHEN EXISTS (
                SELECT 1
                FROM jsonb_array_elements(r.results_json) result(item)
                WHERE jsonb_typeof(result.item) = 'object'
                  AND COALESCE(btrim(result.item ->> 'variationId'), '') <> ''
                  AND NOT ((result.item ->> 'variationId') = ANY(r.variation_ids))
            ) THEN 'result_variation_not_found_in_flag' END,
        CASE WHEN r.baseline_variation_id IS NULL OR btrim(r.baseline_variation_id) = ''
            THEN 'missing_control_variation' END,
        CASE WHEN r.baseline_variation_id IS NOT NULL
                       AND NOT (r.baseline_variation_id = ANY(r.variation_ids))
            THEN 'control_variation_not_found_in_flag' END,
        CASE WHEN char_length(r.baseline_variation_id) > 256 THEN 'control_variation_too_long' END,
        CASE WHEN char_length(r.treatment_variants) > 256 THEN 'treatment_variations_too_long' END
    ]::text[], NULL) AS reject_reasons,
    array_remove(ARRAY[
        CASE WHEN r.source_iteration ->> 'eventName' IS NULL
            THEN 'event_name_fell_back_to_metric_definition' END,
        CASE WHEN r.source_iteration ->> 'eventType' IS NULL
            THEN 'event_type_fell_back_to_metric_definition' END,
        CASE WHEN r.source_iteration ->> 'customEventTrackOption' IS NULL
            THEN 'track_option_fell_back_to_metric_definition' END,
        CASE WHEN r.parsed_end_time IS NOT NULL AND r.parsed_start_time IS NOT NULL
                       AND r.parsed_end_time < r.parsed_start_time
            THEN 'observation_end_precedes_start' END,
        CASE WHEN COALESCE(pg_temp.try_boolean(r.source_iteration ->> 'isArchived'), false)
            THEN 'legacy_iteration_was_archived' END,
        'legacy_results_preserved_without_recomputation'
    ]::text[], NULL) AS warnings
FROM resolved r;

CREATE INDEX ON _migration_run_stage (run_uuid);
CREATE INDEX ON _migration_run_stage (experiment_id, slug);

-- A duplicated iteration UUID cannot be preserved as two target primary keys.
WITH duplicate_ids AS
(
    SELECT run_uuid
    FROM _migration_run_stage
    WHERE run_uuid IS NOT NULL
    GROUP BY run_uuid
    HAVING count(*) > 1
)
UPDATE _migration_run_stage stage
SET reject_reasons = stage.reject_reasons || ARRAY['duplicate_iteration_id']::text[]
FROM duplicate_ids duplicate
WHERE stage.run_uuid = duplicate.run_uuid;

CREATE TEMP TABLE _migration_run_target_conflicts ON COMMIT DROP AS
SELECT
    s.experiment_id,
    s.source_iteration_id,
    s.run_uuid AS source_id,
    t.id AS target_id,
    'same_id_different_content'::text AS conflict_reason
FROM _migration_run_stage s
JOIN release_decision_experiment_runs t ON t.id = s.run_uuid
WHERE cardinality(s.reject_reasons) = 0
  AND NOT (
      t.experiment_id = s.experiment_id AND
      t.slug = s.slug AND
      t.status = s.target_status AND
      t.method IS NOT DISTINCT FROM 'legacy_frequentist' AND
      t.method_reason IS NOT DISTINCT FROM 'Imported from FeatBit 5.4.6; historical result was not recomputed.' AND
      t.primary_metric_event IS NOT DISTINCT FROM s.resolved_event_name AND
      t.metric_description IS NOT DISTINCT FROM s.target_metric_description AND
      t.control_variant IS NOT DISTINCT FROM s.baseline_variation_id AND
      t.treatment_variant IS NOT DISTINCT FROM s.treatment_variants AND
      t.observation_start IS NOT DISTINCT FROM s.parsed_start_time AND
      t.observation_end IS NOT DISTINCT FROM s.parsed_end_time AND
      t.input_data IS NULL AND
      pg_temp.try_jsonb(t.analysis_result) IS NOT DISTINCT FROM s.analysis_result_json AND
      t.run_id IS NOT DISTINCT FROM s.source_iteration_id AND
      t.primary_metric_agg IS NOT DISTINCT FROM s.snapshot_metric_agg AND
      t.primary_metric_type IS NOT DISTINCT FROM s.snapshot_metric_type AND
      t.created_at = s.parsed_start_time AND
      t.updated_at = s.target_updated_at
  )
UNION ALL
SELECT
    s.experiment_id,
    s.source_iteration_id,
    s.run_uuid,
    t.id,
    'same_experiment_slug_has_different_id'
FROM _migration_run_stage s
JOIN release_decision_experiment_runs t
  ON t.experiment_id = s.experiment_id AND t.slug = s.slug
WHERE cardinality(s.reject_reasons) = 0
  AND t.id IS DISTINCT FROM s.run_uuid;

\echo 'Target run conflicts (the migration aborts when non-empty):'
TABLE _migration_run_target_conflicts;

DO $migration$
BEGIN
    IF EXISTS (SELECT 1 FROM _migration_run_target_conflicts) THEN
        RAISE EXCEPTION 'Experiment run migration stopped: target conflicts were found';
    END IF;
END
$migration$;

CREATE TEMP TABLE _migration_inserted_run_ids ON COMMIT DROP AS
WITH inserted AS
(
    INSERT INTO release_decision_experiment_runs
    (
        id, experiment_id, slug, status, method, method_reason,
        primary_metric_event, metric_description, control_variant,
        treatment_variant, observation_start, observation_end, input_data,
        analysis_result, run_id, primary_metric_agg, primary_metric_type,
        created_at, updated_at
    )
    SELECT
        s.run_uuid, s.experiment_id, s.slug, s.target_status,
        'legacy_frequentist',
        'Imported from FeatBit 5.4.6; historical result was not recomputed.',
        s.resolved_event_name, s.target_metric_description,
        s.baseline_variation_id, s.treatment_variants,
        s.parsed_start_time, s.parsed_end_time, NULL,
        s.analysis_result_json::text, s.source_iteration_id,
        s.snapshot_metric_agg, s.snapshot_metric_type,
        s.parsed_start_time, s.target_updated_at
    FROM _migration_run_stage s
    WHERE cardinality(s.reject_reasons) = 0
    ON CONFLICT (id) DO NOTHING
    RETURNING id
)
SELECT id FROM inserted;

-- ---------------------------------------------------------------------------
-- 4. Deterministic migration activities
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE _migration_activity_stage ON COMMIT DROP AS
SELECT
    pg_temp.deterministic_uuid(
        'featbit:v5.4.6:postgresql:experiment:' || e.id::text
    ) AS activity_id,
    e.id AS experiment_id,
    'migration.import.v5_4_6'::text AS activity_type,
    'Imported FeatBit 5.4.6 experiment'::text AS title,
    jsonb_build_object(
        'artifactVersion', 1,
        'sourceVersion', '5.4.6',
        'sourceProvider', 'PostgreSQL',
        'sourceExperimentId', e.id,
        'sourceMetricId', e.metric_id,
        'targetMetricId', e.target_metric_id,
        'featureFlagId', e.feature_flag_id,
        'legacyStatus', e.status,
        'legacyIsArchived', e.is_archived,
        'baselineVariationId', e.baseline_variation_id,
        'alpha', e.alpha,
        'iterationCount', jsonb_array_length(e.iterations_json)
    ) AS detail_json,
    'v5.4.6 PostgreSQL migration'::text AS actor_name,
    'system'::text AS actor_type,
    e.updated_at AS created_at
FROM _migration_experiment_stage e
WHERE cardinality(e.reject_reasons) = 0;

CREATE TEMP TABLE _migration_activity_target_conflicts ON COMMIT DROP AS
SELECT
    s.experiment_id,
    s.activity_id,
    'same_id_different_content'::text AS conflict_reason
FROM _migration_activity_stage s
JOIN release_decision_activities t ON t.id = s.activity_id
WHERE NOT (
    t.type = s.activity_type AND
    t.title = s.title AND
    pg_temp.try_jsonb(t.detail) IS NOT DISTINCT FROM s.detail_json AND
    t.actor_id IS NULL AND
    t.actor_name IS NOT DISTINCT FROM s.actor_name AND
    t.actor_email IS NULL AND
    t.actor_type IS NOT DISTINCT FROM s.actor_type AND
    t.experiment_id = s.experiment_id AND
    t.created_at = s.created_at
);

\echo 'Target activity conflicts (the migration aborts when non-empty):'
TABLE _migration_activity_target_conflicts;

DO $migration$
BEGIN
    IF EXISTS (SELECT 1 FROM _migration_activity_target_conflicts) THEN
        RAISE EXCEPTION 'Migration activity insert stopped: target conflicts were found';
    END IF;
END
$migration$;

CREATE TEMP TABLE _migration_inserted_activity_ids ON COMMIT DROP AS
WITH inserted AS
(
    INSERT INTO release_decision_activities
    (
        id, type, title, detail, actor_id, actor_name, actor_email,
        actor_type, experiment_id, created_at
    )
    SELECT
        s.activity_id, s.activity_type, s.title, s.detail_json::text,
        NULL, s.actor_name, NULL, s.actor_type, s.experiment_id, s.created_at
    FROM _migration_activity_stage s
    ON CONFLICT (id) DO NOTHING
    RETURNING id
)
SELECT id FROM inserted;

-- ---------------------------------------------------------------------------
-- Verification and migration report
-- ---------------------------------------------------------------------------

DO $migration$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM _migration_experiment_stage s
        LEFT JOIN release_decision_experiments t ON t.id = s.id
        WHERE cardinality(s.reject_reasons) = 0 AND t.id IS NULL
    ) THEN
        RAISE EXCEPTION 'Experiment migration post-insert verification failed';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _migration_run_stage s
        LEFT JOIN release_decision_experiment_runs t ON t.id = s.run_uuid
        WHERE cardinality(s.reject_reasons) = 0 AND t.id IS NULL
    ) THEN
        RAISE EXCEPTION 'Experiment run migration post-insert verification failed';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM _migration_activity_stage s
        LEFT JOIN release_decision_activities t ON t.id = s.activity_id
        WHERE t.id IS NULL
    ) THEN
        RAISE EXCEPTION 'Migration activity post-insert verification failed';
    END IF;
END
$migration$;

\echo 'Metric migration summary:'
SELECT
    count(*) AS source_rows,
    count(*) FILTER (WHERE cardinality(reject_reasons) = 0) AS accepted_rows,
    (SELECT count(*) FROM _migration_inserted_metric_ids) AS inserted_target_rows,
    (SELECT count(*) FROM _migration_metric_id_map WHERE was_merged) AS merged_source_rows,
    count(*) FILTER (WHERE cardinality(reject_reasons) > 0) AS rejected_rows,
    count(*) FILTER (WHERE cardinality(warnings) > 0) AS warning_rows
FROM _migration_metric_stage;

\echo 'Old metric ID -> target metric ID mapping:'
SELECT old_metric_id, target_metric_id, env_id, metric_key, was_merged
FROM _migration_metric_id_map
ORDER BY env_id, metric_key, old_metric_id;

\echo 'Rejected legacy metrics:'
SELECT source_id, env_id, metric_key, reject_reasons
FROM _migration_metric_stage
WHERE cardinality(reject_reasons) > 0
ORDER BY source_id;

\echo 'Legacy metrics migrated with warnings / unmapped legacy-only fields:'
SELECT
    source_id, warnings, maintainer_user_id, custom_event_unit,
    element_targets, target_urls
FROM _migration_metric_stage
WHERE cardinality(reject_reasons) = 0
  AND cardinality(warnings) > 0
ORDER BY source_id;

\echo 'Experiment migration summary:'
SELECT
    count(*) AS source_rows,
    count(*) FILTER (WHERE cardinality(reject_reasons) = 0) AS accepted_rows,
    (SELECT count(*) FROM _migration_inserted_experiment_ids) AS inserted_rows,
    count(*) FILTER (WHERE cardinality(reject_reasons) = 0) -
        (SELECT count(*) FROM _migration_inserted_experiment_ids) AS already_present_rows,
    count(*) FILTER (WHERE cardinality(reject_reasons) > 0) AS rejected_rows,
    count(*) FILTER (WHERE cardinality(warnings) > 0) AS warning_rows
FROM _migration_experiment_stage;

\echo 'Rejected legacy experiments:'
SELECT id AS source_id, metric_id, feature_flag_id, reject_reasons
FROM _migration_experiment_stage
WHERE cardinality(reject_reasons) > 0
ORDER BY id;

\echo 'Legacy experiments migrated with warnings:'
SELECT id AS source_id, warnings
FROM _migration_experiment_stage
WHERE cardinality(reject_reasons) = 0
  AND cardinality(warnings) > 0
ORDER BY id;

\echo 'Iteration/run migration summary:'
SELECT
    count(*) AS source_iterations,
    count(*) FILTER (WHERE cardinality(reject_reasons) = 0) AS accepted_iterations,
    (SELECT count(*) FROM _migration_inserted_run_ids) AS inserted_runs,
    count(*) FILTER (WHERE cardinality(reject_reasons) = 0) -
        (SELECT count(*) FROM _migration_inserted_run_ids) AS already_present_runs,
    count(*) FILTER (WHERE cardinality(reject_reasons) > 0) AS rejected_iterations
FROM _migration_run_stage;

\echo 'Rejected legacy iterations:'
SELECT experiment_id, iteration_number, source_iteration_id, reject_reasons
FROM _migration_run_stage
WHERE cardinality(reject_reasons) > 0
ORDER BY experiment_id, iteration_number;

\echo 'Migration activity summary:'
SELECT
    count(*) AS expected_activities,
    (SELECT count(*) FROM _migration_inserted_activity_ids) AS inserted_activities,
    count(*) - (SELECT count(*) FROM _migration_inserted_activity_ids) AS already_present_activities
FROM _migration_activity_stage;

COMMIT;

\echo 'PostgreSQL metrics and experimentation migration completed.'
