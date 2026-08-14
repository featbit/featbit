\set ON_ERROR_STOP on

-- FeatBit PostgreSQL migration: 5.4.6 -> 6.0.0
-- Migration 1: legacy events -> release-decision event tables.
--
-- Run this script against the FeatBit database after the v6.0.0 schema has
-- been installed and while event ingestion is stopped:
--
--   psql "$DATABASE_URL" -f 01-events-migration.sql
--
-- The script is transactional and immediately repeatable. It preserves the
-- source events table, reports rejected/warning rows, and aborts before any
-- insert when a target ID already exists with different content.

BEGIN;

SET LOCAL TIME ZONE 'UTC';
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '0';
SET LOCAL search_path = public, pg_temp;

DO $migration$
DECLARE
    missing_relations text[] := ARRAY[]::text[];
BEGIN
    IF to_regclass('public.events') IS NULL THEN
        missing_relations := array_append(missing_relations, 'events');
    END IF;
    IF to_regclass('public.feature_flags') IS NULL THEN
        missing_relations := array_append(missing_relations, 'feature_flags');
    END IF;
    IF to_regclass('public.environments') IS NULL THEN
        missing_relations := array_append(missing_relations, 'environments');
    END IF;
    IF to_regclass('public.release_decision_exposure_events') IS NULL THEN
        missing_relations := array_append(missing_relations, 'release_decision_exposure_events');
    END IF;
    IF to_regclass('public.release_decision_metric_events') IS NULL THEN
        missing_relations := array_append(missing_relations, 'release_decision_metric_events');
    END IF;

    IF cardinality(missing_relations) > 0 THEN
        RAISE EXCEPTION 'Required tables are missing: %', array_to_string(missing_relations, ', ');
    END IF;
END
$migration$;

-- Source data is assumed to be frozen. These locks also prevent a v6 writer
-- from racing the conflict check and the inserts in this transaction.
LOCK TABLE events IN SHARE MODE;
LOCK TABLE release_decision_exposure_events IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE release_decision_metric_events IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE _migration_event_session
(
    started_at timestamptz NOT NULL
) ON COMMIT DROP;

INSERT INTO _migration_event_session VALUES (clock_timestamp());

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

CREATE OR REPLACE FUNCTION pg_temp.try_finite_float(value text)
RETURNS double precision
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
    parsed double precision;
BEGIN
    IF value IS NULL OR btrim(value) = '' OR
       btrim(value) !~ '^[+-]?((([0-9]+)(\.[0-9]*)?)|(\.[0-9]+))([eE][+-]?[0-9]+)?$' THEN
        RETURN NULL;
    END IF;

    parsed := btrim(value)::double precision;
    RETURN parsed;
EXCEPTION WHEN numeric_value_out_of_range OR invalid_text_representation THEN
    RETURN NULL;
END
$function$;

CREATE TEMP TABLE _migration_event_stage ON COMMIT DROP AS
WITH raw AS
(
    SELECT
        e.id AS source_id,
        e.event AS source_event,
        e.distinct_id,
        e.env_id AS source_env_id,
        pg_temp.try_uuid(e.env_id) AS parsed_env_id,
        e.properties,
        e.timestamp AT TIME ZONE 'UTC' AS event_at,
        NULLIF(e.properties ->> 'featureFlagKey', '') AS named_flag_key,
        CASE
            WHEN e.env_id IS NOT NULL
                 AND left(e.distinct_id, char_length(e.env_id) + 1) = e.env_id || '-'
                THEN NULLIF(substring(e.distinct_id FROM char_length(e.env_id) + 2), '')
            ELSE NULL
        END AS derived_flag_key,
        NULLIF(e.properties ->> 'tag_0', '') AS tag_user_key,
        COALESCE(
            NULLIF(e.properties ->> 'userKeyId', ''),
            NULLIF(e.properties #>> '{user,keyId}', '')
        ) AS named_user_key,
        NULLIF(e.properties ->> 'tag_1', '') AS tag_value,
        NULLIF(e.properties ->> 'variationId', '') AS named_variation_id,
        NULLIF(e.properties ->> 'eventName', '') AS named_event_name,
        CASE
            WHEN jsonb_typeof(e.properties -> 'numericValue') = 'number'
                THEN pg_temp.try_finite_float(e.properties ->> 'numericValue')
            ELSE NULL
        END AS named_numeric_value,
        pg_temp.try_finite_float(e.properties ->> 'tag_1') AS tag_numeric_value
    FROM events e
),
resolved AS
(
    SELECT
        raw.*,
        CASE WHEN source_event = 'FlagValue' THEN 'exposure' ELSE 'metric' END AS event_kind,
        COALESCE(named_flag_key, derived_flag_key) AS flag_key,
        COALESCE(tag_user_key, named_user_key) AS user_key,
        COALESCE(tag_value, named_variation_id) AS variation_id,
        COALESCE(NULLIF(distinct_id, ''), named_event_name) AS event_name,
        COALESCE(tag_numeric_value, named_numeric_value, 0::double precision) AS numeric_value
    FROM raw
)
SELECT
    r.source_id,
    r.source_event,
    r.event_kind,
    r.parsed_env_id AS env_id,
    r.flag_key,
    r.user_key,
    r.variation_id,
    NULL::text AS variation_value,
    r.event_name,
    r.source_event AS event_type,
    r.numeric_value,
    r.event_at,
    r.properties,
    array_remove(ARRAY[
        CASE WHEN r.parsed_env_id IS NULL THEN 'invalid_env_id' END,
        CASE WHEN r.source_event IS NULL OR btrim(r.source_event) = '' THEN 'missing_event_type' END,
        CASE WHEN r.source_event IS NOT NULL AND char_length(r.source_event) > 64 THEN 'event_type_too_long' END,
        CASE WHEN r.event_kind = 'exposure' AND (r.flag_key IS NULL OR btrim(r.flag_key) = '') THEN 'missing_flag_key' END,
        CASE WHEN r.event_kind = 'exposure' AND char_length(r.flag_key) > 256 THEN 'flag_key_too_long' END,
        CASE WHEN r.user_key IS NULL OR btrim(r.user_key) = '' THEN 'missing_user_key' END,
        CASE WHEN r.user_key IS NOT NULL AND char_length(r.user_key) > 512 THEN 'user_key_too_long' END,
        CASE WHEN r.event_kind = 'exposure' AND (r.variation_id IS NULL OR btrim(r.variation_id) = '') THEN 'missing_variation_id' END,
        CASE WHEN r.event_kind = 'exposure' AND char_length(r.variation_id) > 256 THEN 'variation_id_too_long' END,
        CASE WHEN r.event_kind = 'metric' AND (r.event_name IS NULL OR btrim(r.event_name) = '') THEN 'missing_event_name' END,
        CASE WHEN r.event_kind = 'metric' AND char_length(r.event_name) > 256 THEN 'event_name_too_long' END
    ]::text[], NULL) AS reject_reasons,
    array_remove(ARRAY[
        CASE
            WHEN r.named_flag_key IS NOT NULL AND r.derived_flag_key IS NOT NULL
                 AND r.named_flag_key IS DISTINCT FROM r.derived_flag_key
                THEN 'flag_key_named_distinct_id_mismatch'
        END,
        CASE
            WHEN r.tag_user_key IS NOT NULL AND r.named_user_key IS NOT NULL
                 AND r.tag_user_key IS DISTINCT FROM r.named_user_key
                THEN 'user_key_tag_named_mismatch'
        END,
        CASE
            WHEN r.event_kind = 'exposure' AND r.tag_value IS NOT NULL AND r.named_variation_id IS NOT NULL
                 AND r.tag_value IS DISTINCT FROM r.named_variation_id
                THEN 'variation_id_tag_named_mismatch'
        END,
        CASE
            WHEN r.event_kind = 'metric' AND r.distinct_id IS NOT NULL AND r.named_event_name IS NOT NULL
                 AND r.distinct_id IS DISTINCT FROM r.named_event_name
                THEN 'event_name_distinct_id_named_mismatch'
        END,
        CASE
            WHEN r.event_kind = 'metric' AND r.tag_numeric_value IS NOT NULL AND r.named_numeric_value IS NOT NULL
                 AND r.tag_numeric_value IS DISTINCT FROM r.named_numeric_value
                THEN 'numeric_value_tag_named_mismatch'
        END,
        CASE
            WHEN r.event_kind = 'metric' AND r.tag_numeric_value IS NULL AND r.named_numeric_value IS NULL
                THEN 'numeric_value_defaulted_to_zero'
        END,
        CASE
            WHEN r.parsed_env_id IS NOT NULL
                 AND NOT EXISTS (SELECT 1 FROM environments env WHERE env.id = r.parsed_env_id)
                THEN 'environment_not_found'
        END,
        CASE
            WHEN r.event_kind = 'exposure' AND r.parsed_env_id IS NOT NULL AND r.flag_key IS NOT NULL
                 AND NOT EXISTS (
                     SELECT 1
                     FROM feature_flags ff
                     WHERE ff.env_id = r.parsed_env_id AND ff.key = r.flag_key
                 )
                THEN 'feature_flag_not_found'
        END,
        CASE
            WHEN r.event_kind = 'exposure' AND r.parsed_env_id IS NOT NULL
                 AND r.flag_key IS NOT NULL AND r.variation_id IS NOT NULL
                 AND EXISTS (
                     SELECT 1
                     FROM feature_flags ff
                     WHERE ff.env_id = r.parsed_env_id AND ff.key = r.flag_key
                 )
                 AND NOT EXISTS (
                     SELECT 1
                     FROM feature_flags ff
                     CROSS JOIN LATERAL jsonb_array_elements(
                         CASE WHEN jsonb_typeof(ff.variations) = 'array' THEN ff.variations ELSE '[]'::jsonb END
                     ) variation
                     WHERE ff.env_id = r.parsed_env_id
                       AND ff.key = r.flag_key
                       AND variation ->> 'id' = r.variation_id
                 )
                THEN 'variation_not_found'
        END
    ]::text[], NULL) AS warnings
FROM resolved r;

CREATE INDEX ON _migration_event_stage (source_id);

CREATE TEMP TABLE _migration_event_conflicts ON COMMIT DROP AS
SELECT
    s.source_id,
    'release_decision_exposure_events'::text AS target_table,
    'same_id_different_content'::text AS conflict_reason
FROM _migration_event_stage s
JOIN release_decision_exposure_events t ON t.id = s.source_id
WHERE s.event_kind = 'exposure'
  AND cardinality(s.reject_reasons) = 0
  AND NOT (
      t.env_id = s.env_id AND
      t.flag_key = s.flag_key AND
      t.user_key = s.user_key AND
      t.variation_id = s.variation_id AND
      t.variation_value IS NOT DISTINCT FROM s.variation_value AND
      t.exposed_at = s.event_at AND
      t.properties IS NOT DISTINCT FROM s.properties
  )
UNION ALL
SELECT
    s.source_id,
    'release_decision_metric_events',
    'same_id_different_content'
FROM _migration_event_stage s
JOIN release_decision_metric_events t ON t.id = s.source_id
WHERE s.event_kind = 'metric'
  AND cardinality(s.reject_reasons) = 0
  AND NOT (
      t.env_id = s.env_id AND
      t.user_key = s.user_key AND
      t.event_name = s.event_name AND
      t.event_type = s.event_type AND
      t.numeric_value = s.numeric_value AND
      t.occurred_at = s.event_at AND
      t.properties IS NOT DISTINCT FROM s.properties
  )
UNION ALL
SELECT s.source_id, 'release_decision_metric_events', 'id_exists_in_wrong_target_table'
FROM _migration_event_stage s
JOIN release_decision_metric_events t ON t.id = s.source_id
WHERE s.event_kind = 'exposure' AND cardinality(s.reject_reasons) = 0
UNION ALL
SELECT s.source_id, 'release_decision_exposure_events', 'id_exists_in_wrong_target_table'
FROM _migration_event_stage s
JOIN release_decision_exposure_events t ON t.id = s.source_id
WHERE s.event_kind = 'metric' AND cardinality(s.reject_reasons) = 0;

\echo 'Target conflicts (the migration aborts when this result is non-empty):'
TABLE _migration_event_conflicts;

DO $migration$
BEGIN
    IF EXISTS (SELECT 1 FROM _migration_event_conflicts) THEN
        RAISE EXCEPTION 'Event migration stopped: target ID conflicts were found';
    END IF;
END
$migration$;

CREATE TEMP TABLE _migration_inserted_exposure_ids ON COMMIT DROP AS
WITH inserted AS
(
    INSERT INTO release_decision_exposure_events
    (
        id, env_id, flag_key, user_key, variation_id, variation_value,
        exposed_at, properties, created_at
    )
    SELECT
        s.source_id, s.env_id, s.flag_key, s.user_key, s.variation_id,
        s.variation_value, s.event_at, s.properties, session.started_at
    FROM _migration_event_stage s
    CROSS JOIN _migration_event_session session
    WHERE s.event_kind = 'exposure'
      AND cardinality(s.reject_reasons) = 0
    ON CONFLICT (id) DO NOTHING
    RETURNING id
)
SELECT id FROM inserted;

CREATE TEMP TABLE _migration_inserted_metric_ids ON COMMIT DROP AS
WITH inserted AS
(
    INSERT INTO release_decision_metric_events
    (
        id, env_id, user_key, event_name, event_type, numeric_value,
        occurred_at, properties, created_at
    )
    SELECT
        s.source_id, s.env_id, s.user_key, s.event_name, s.event_type,
        s.numeric_value, s.event_at, s.properties, session.started_at
    FROM _migration_event_stage s
    CROSS JOIN _migration_event_session session
    WHERE s.event_kind = 'metric'
      AND cardinality(s.reject_reasons) = 0
    ON CONFLICT (id) DO NOTHING
    RETURNING id
)
SELECT id FROM inserted;

-- Post-insert verification uses all mapped fields, excluding created_at.
DO $migration$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM _migration_event_stage s
        LEFT JOIN release_decision_exposure_events t ON t.id = s.source_id
        WHERE s.event_kind = 'exposure'
          AND cardinality(s.reject_reasons) = 0
          AND (
              t.id IS NULL OR
              NOT (
                  t.env_id = s.env_id AND
                  t.flag_key = s.flag_key AND
                  t.user_key = s.user_key AND
                  t.variation_id = s.variation_id AND
                  t.variation_value IS NOT DISTINCT FROM s.variation_value AND
                  t.exposed_at = s.event_at AND
                  t.properties IS NOT DISTINCT FROM s.properties
              )
          )
    ) OR EXISTS (
        SELECT 1
        FROM _migration_event_stage s
        LEFT JOIN release_decision_metric_events t ON t.id = s.source_id
        WHERE s.event_kind = 'metric'
          AND cardinality(s.reject_reasons) = 0
          AND (
              t.id IS NULL OR
              NOT (
                  t.env_id = s.env_id AND
                  t.user_key = s.user_key AND
                  t.event_name = s.event_name AND
                  t.event_type = s.event_type AND
                  t.numeric_value = s.numeric_value AND
                  t.occurred_at = s.event_at AND
                  t.properties IS NOT DISTINCT FROM s.properties
              )
          )
    ) THEN
        RAISE EXCEPTION 'Event migration post-insert verification failed';
    END IF;
END
$migration$;

\echo 'Migration summary:'
SELECT
    s.event_kind,
    count(*) AS source_rows,
    count(*) FILTER (WHERE cardinality(s.reject_reasons) = 0) AS accepted_rows,
    CASE
        WHEN s.event_kind = 'exposure' THEN (SELECT count(*) FROM _migration_inserted_exposure_ids)
        ELSE (SELECT count(*) FROM _migration_inserted_metric_ids)
    END AS inserted_rows,
    count(*) FILTER (WHERE cardinality(s.reject_reasons) = 0) -
    CASE
        WHEN s.event_kind = 'exposure' THEN (SELECT count(*) FROM _migration_inserted_exposure_ids)
        ELSE (SELECT count(*) FROM _migration_inserted_metric_ids)
    END AS already_present_rows,
    count(*) FILTER (WHERE cardinality(s.reject_reasons) > 0) AS rejected_rows,
    count(*) FILTER (WHERE cardinality(s.warnings) > 0) AS warning_rows
FROM _migration_event_stage s
GROUP BY s.event_kind
ORDER BY s.event_kind;

\echo 'Rejected source rows:'
SELECT source_id, source_event, reject_reasons
FROM _migration_event_stage
WHERE cardinality(reject_reasons) > 0
ORDER BY source_id;

\echo 'Rows migrated with warnings:'
SELECT source_id, source_event, warnings
FROM _migration_event_stage
WHERE cardinality(reject_reasons) = 0
  AND cardinality(warnings) > 0
ORDER BY source_id;

COMMIT;

\echo 'PostgreSQL event migration completed.'
