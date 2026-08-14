-- FeatBit Kafka + ClickHouse migration: 5.4.6 -> 6.0.0
-- Migration 1: featbit.events -> release-decision event tables.
--
-- Run with ClickHouse 23.7 after old insight production has stopped, the old
-- Kafka consumer group is at lag 0, and the old Kafka engine consumer has
-- been stopped:
--
--   clickhouse-client --multiquery --queries-file 01-events-migration.sql
--
-- This script deliberately reads the persistent ClickHouse events table. It
-- does not replay the Kafka topic. It supports the v5.4.6 single-node schema;
-- replicated/sharded installations are rejected because v6.0.0 currently has
-- no equivalent ReplicatedMergeTree/Distributed target DDL.
--
-- ClickHouse has no multi-statement transaction here. All conflict checks run
-- before the first target insert, and every insert excludes IDs already in the
-- target. An interrupted run is therefore safe to run again. The three
-- _migration_546_to_600_* tables are an inspectable report and are rebuilt on
-- each run; the source featbit.events table is never modified.

SET join_use_nulls = 1;
SET allow_experimental_analyzer = 0;

SELECT throwIf(
    count() = 0,
    'Migration stopped: source table featbit.events does not exist'
)
FROM system.tables
WHERE database = 'featbit' AND name = 'events';

SELECT throwIf(
    countIf(name IN (
        'uuid', 'distinct_id', 'env_id', 'event', 'properties', 'timestamp',
        'tag_0', 'tag_1', 'tag_2', 'tag_3'
    )) != 10,
    'Migration stopped: featbit.events is not the expected v5.4.6 schema'
)
FROM system.columns
WHERE database = 'featbit' AND table = 'events';

SELECT throwIf(
    countIf(name = 'distributed_events') > 0
        OR countIf(name = 'events' AND startsWith(engine, 'Replicated')) > 0,
    'Migration stopped: replicated/sharded ClickHouse needs cluster target DDL and a topology-specific migration'
)
FROM system.tables
WHERE database = 'featbit' AND name IN ('events', 'distributed_events');

-- The new Kafka engine and materialized views must not consume during the
-- backfill. DETACH them before running this script if v6 init.sql was already
-- executed in full. They can be attached after the new group offset is set.
SELECT throwIf(
    count() > 0,
    'Migration stopped: detach the v6 Kafka queue and materialized views before backfilling'
)
FROM system.tables
WHERE database = 'featbit'
  AND name IN (
      'kafka_insight_events_queue',
      'release_decision_exposure_events_mv',
      'release_decision_metric_events_mv'
  );

CREATE DATABASE IF NOT EXISTS featbit;

-- Only the two persistent v6 tables are created here. The Kafka engine table
-- and materialized views are intentionally left for the post-migration cutover.
CREATE TABLE IF NOT EXISTS featbit.release_decision_exposure_events
(
    id UUID,
    env_id UUID,
    flag_key LowCardinality(String),
    user_key String,
    user_name String,
    variation_id LowCardinality(String),
    variation_value String,
    exposed_at DateTime64(6, 'UTC'),
    properties String,
    created_at DateTime64(6, 'UTC') DEFAULT now64(6)
)
ENGINE = MergeTree
PARTITION BY (env_id, toYYYYMM(exposed_at))
ORDER BY (env_id, flag_key, exposed_at, cityHash64(user_key))
SETTINGS index_granularity = 8192;

CREATE TABLE IF NOT EXISTS featbit.release_decision_metric_events
(
    id UUID,
    env_id UUID,
    user_key String,
    user_name String,
    event_name LowCardinality(String),
    event_type LowCardinality(String),
    numeric_value Float64,
    occurred_at DateTime64(6, 'UTC'),
    properties String,
    created_at DateTime64(6, 'UTC') DEFAULT now64(6)
)
ENGINE = MergeTree
PARTITION BY (env_id, toYYYYMM(occurred_at))
ORDER BY (env_id, event_name, occurred_at, cityHash64(user_key))
SETTINGS index_granularity = 8192;

DROP TABLE IF EXISTS featbit._migration_546_to_600_event_conflicts SYNC;
DROP TABLE IF EXISTS featbit._migration_546_to_600_event_canonical SYNC;
DROP TABLE IF EXISTS featbit._migration_546_to_600_event_stage SYNC;

CREATE TABLE featbit._migration_546_to_600_event_stage
(
    source_id UUID,
    source_event String,
    event_kind LowCardinality(String),
    env_id Nullable(UUID),
    flag_key String,
    user_key String,
    user_name String,
    variation_id String,
    variation_value String,
    event_name String,
    event_type String,
    numeric_value Float64,
    event_at DateTime64(6, 'UTC'),
    properties String,
    reject_reasons Array(String),
    warnings Array(String),
    target_was_present UInt8
)
ENGINE = MergeTree
ORDER BY (event_kind, source_id, event_at);

INSERT INTO featbit._migration_546_to_600_event_stage
WITH
raw AS
(
    SELECT
        uuid AS source_id,
        event AS source_event,
        distinct_id,
        env_id AS source_env_id,
        toUUIDOrNull(trimBoth(env_id)) AS parsed_env_id,
        properties,
        timestamp AS event_at,
        isValidJSON(properties) AS properties_json_valid,
        nullIf(JSONExtractString(properties, 'featureFlagKey'), '') AS named_flag_key,
        if(
            startsWith(distinct_id, concat(env_id, '-')),
            nullIf(substring(distinct_id, length(env_id) + 2), ''),
            CAST(NULL AS Nullable(String))
        ) AS derived_flag_key,
        nullIf(tag_0, '') AS tag_user_key,
        nullIf(JSONExtractString(properties, 'userKeyId'), '') AS direct_user_key,
        nullIf(JSONExtractString(JSONExtractRaw(properties, 'user'), 'keyId'), '') AS nested_user_key,
        nullIf(tag_1, '') AS tag_value,
        nullIf(JSONExtractString(properties, 'variationId'), '') AS named_variation_id,
        nullIf(tag_3, '') AS exposure_tag_user_name,
        nullIf(JSONExtractString(properties, 'userName'), '') AS direct_user_name,
        nullIf(tag_2, '') AS metric_tag_user_name,
        nullIf(JSONExtractString(JSONExtractRaw(properties, 'user'), 'name'), '') AS nested_user_name,
        nullIf(JSONExtractString(properties, 'variationValue'), '') AS named_variation_value,
        nullIf(JSONExtractString(properties, 'eventName'), '') AS named_event_name,
        toFloat64OrNull(nullIf(trimBoth(tag_1), '')) AS parsed_tag_numeric,
        toFloat64OrNull(nullIf(JSONExtractRaw(properties, 'numericValue'), '')) AS parsed_named_numeric
    FROM featbit.events
),
normalized AS
(
    SELECT
        *,
        if(
            isNotNull(parsed_tag_numeric) AND isFinite(assumeNotNull(parsed_tag_numeric)),
            parsed_tag_numeric,
            CAST(NULL AS Nullable(Float64))
        ) AS tag_numeric_value,
        if(
            isNotNull(parsed_named_numeric) AND isFinite(assumeNotNull(parsed_named_numeric)),
            parsed_named_numeric,
            CAST(NULL AS Nullable(Float64))
        ) AS named_numeric_value
    FROM raw
),
resolved AS
(
    SELECT
        *,
        if(source_event = 'FlagValue', 'exposure', 'metric') AS event_kind,
        coalesce(derived_flag_key, named_flag_key, '') AS resolved_flag_key,
        coalesce(tag_user_key, direct_user_key, nested_user_key, '') AS resolved_user_key,
        coalesce(tag_value, named_variation_id, '') AS resolved_variation_id,
        coalesce(exposure_tag_user_name, direct_user_name, '') AS resolved_exposure_user_name,
        coalesce(metric_tag_user_name, nested_user_name, direct_user_name, '') AS resolved_metric_user_name,
        coalesce(named_variation_value, '') AS resolved_variation_value,
        coalesce(nullIf(distinct_id, ''), named_event_name, '') AS resolved_event_name,
        coalesce(tag_numeric_value, named_numeric_value, 0.0) AS resolved_numeric_value
    FROM normalized
)
SELECT
    source_id,
    source_event,
    event_kind,
    parsed_env_id AS env_id,
    if(event_kind = 'exposure', resolved_flag_key, '') AS flag_key,
    resolved_user_key AS user_key,
    if(event_kind = 'exposure', resolved_exposure_user_name, resolved_metric_user_name) AS user_name,
    if(event_kind = 'exposure', resolved_variation_id, '') AS variation_id,
    if(event_kind = 'exposure', resolved_variation_value, '') AS variation_value,
    if(event_kind = 'metric', resolved_event_name, '') AS event_name,
    if(event_kind = 'metric', source_event, '') AS event_type,
    if(event_kind = 'metric', resolved_numeric_value, 0.0) AS numeric_value,
    event_at,
    properties,
    arrayFilter(reason -> notEmpty(reason), [
        if(not properties_json_valid, 'invalid_properties_json', ''),
        if(isNull(parsed_env_id), 'invalid_env_id', ''),
        if(empty(source_event), 'missing_event_type', ''),
        if(event_kind = 'exposure' AND empty(resolved_flag_key), 'missing_flag_key', ''),
        if(empty(resolved_user_key), 'missing_user_key', ''),
        if(event_kind = 'exposure' AND empty(resolved_variation_id), 'missing_variation_id', ''),
        if(event_kind = 'metric' AND empty(resolved_event_name), 'missing_event_name', '')
    ]) AS reject_reasons,
    arrayFilter(warning -> notEmpty(warning), [
        if(
            event_kind = 'exposure' AND isNotNull(derived_flag_key) AND isNotNull(named_flag_key)
                AND derived_flag_key != named_flag_key,
            'flag_key_distinct_id_named_mismatch',
            ''
        ),
        if(isNotNull(tag_user_key) AND isNotNull(coalesce(direct_user_key, nested_user_key))
                AND tag_user_key != coalesce(direct_user_key, nested_user_key),
            'user_key_tag_named_mismatch',
            ''
        ),
        if(event_kind = 'exposure' AND isNotNull(tag_value) AND isNotNull(named_variation_id)
                AND tag_value != named_variation_id,
            'variation_id_tag_named_mismatch',
            ''
        ),
        if(event_kind = 'exposure' AND isNotNull(exposure_tag_user_name) AND isNotNull(direct_user_name)
                AND exposure_tag_user_name != direct_user_name,
            'user_name_tag_named_mismatch',
            ''
        ),
        if(event_kind = 'metric' AND notEmpty(distinct_id) AND isNotNull(named_event_name)
                AND distinct_id != named_event_name,
            'event_name_distinct_id_named_mismatch',
            ''
        ),
        if(event_kind = 'metric' AND isNotNull(metric_tag_user_name) AND isNotNull(nested_user_name)
                AND metric_tag_user_name != nested_user_name,
            'user_name_tag_named_mismatch',
            ''
        ),
        if(event_kind = 'metric' AND isNotNull(tag_numeric_value) AND isNotNull(named_numeric_value)
                AND tag_numeric_value != named_numeric_value,
            'numeric_value_tag_named_mismatch',
            ''
        ),
        if(event_kind = 'metric' AND isNull(tag_numeric_value) AND isNull(named_numeric_value),
            'numeric_value_defaulted_to_zero',
            ''
        ),
        if(event_kind = 'exposure' AND isNull(derived_flag_key) AND isNotNull(named_flag_key),
            'flag_key_from_named_fallback',
            ''
        ),
        if(isNull(tag_user_key) AND isNotNull(coalesce(direct_user_key, nested_user_key)),
            'user_key_from_named_fallback',
            ''
        ),
        if(event_kind = 'exposure' AND isNull(tag_value) AND isNotNull(named_variation_id),
            'variation_id_from_named_fallback',
            ''
        )
    ]) AS warnings,
    toUInt8(
        if(
            event_kind = 'exposure',
            source_id IN (SELECT id FROM featbit.release_decision_exposure_events),
            source_id IN (SELECT id FROM featbit.release_decision_metric_events)
        )
    ) AS target_was_present
FROM resolved;

-- Report every duplicate UUID. Exact duplicate source rows are collapsed to a
-- single target row; one UUID mapping to different content is a hard conflict.
SELECT
    source_id,
    count() AS source_rows,
    uniqExact(tuple(
        event_kind, env_id, flag_key, user_key, user_name, variation_id,
        variation_value, event_name, event_type, numeric_value, event_at,
        properties, reject_reasons
    )) AS mapped_content_variants
FROM featbit._migration_546_to_600_event_stage
GROUP BY source_id
HAVING source_rows > 1
ORDER BY source_id;

SELECT throwIf(
    count() > 0,
    'Migration stopped: one or more source UUIDs map to different content'
)
FROM
(
    SELECT source_id
    FROM featbit._migration_546_to_600_event_stage
    GROUP BY source_id
    HAVING uniqExact(tuple(
        event_kind, env_id, flag_key, user_key, user_name, variation_id,
        variation_value, event_name, event_type, numeric_value, event_at,
        properties, reject_reasons
    )) > 1
);

CREATE TABLE featbit._migration_546_to_600_event_canonical
(
    id UUID,
    event_kind LowCardinality(String),
    env_id UUID,
    flag_key String,
    user_key String,
    user_name String,
    variation_id String,
    variation_value String,
    event_name String,
    event_type String,
    numeric_value Float64,
    event_at DateTime64(6, 'UTC'),
    properties String,
    target_was_present UInt8
)
ENGINE = MergeTree
ORDER BY (event_kind, id);

INSERT INTO featbit._migration_546_to_600_event_canonical
SELECT
    source_id AS id,
    event_kind,
    assumeNotNull(env_id) AS env_id,
    flag_key,
    user_key,
    user_name,
    variation_id,
    variation_value,
    event_name,
    event_type,
    numeric_value,
    event_at,
    properties,
    max(target_was_present) AS target_was_present
FROM featbit._migration_546_to_600_event_stage
WHERE empty(reject_reasons)
GROUP BY
    source_id, event_kind, env_id, flag_key, user_key, user_name, variation_id,
    variation_value, event_name, event_type, numeric_value, event_at, properties;

CREATE TABLE featbit._migration_546_to_600_event_conflicts
(
    id UUID,
    target_table String,
    reason String
)
ENGINE = MergeTree
ORDER BY (target_table, id, reason);

INSERT INTO featbit._migration_546_to_600_event_conflicts
SELECT c.id, 'release_decision_exposure_events', 'same_id_different_content'
FROM featbit._migration_546_to_600_event_canonical c
INNER JOIN featbit.release_decision_exposure_events t ON t.id = c.id
WHERE c.event_kind = 'exposure'
  AND NOT (
      t.env_id = c.env_id
      AND t.flag_key = c.flag_key
      AND t.user_key = c.user_key
      AND t.user_name = c.user_name
      AND t.variation_id = c.variation_id
      AND t.variation_value = c.variation_value
      AND t.exposed_at = c.event_at
      AND t.properties = c.properties
  );

INSERT INTO featbit._migration_546_to_600_event_conflicts
SELECT c.id, 'release_decision_metric_events', 'same_id_different_content'
FROM featbit._migration_546_to_600_event_canonical c
INNER JOIN featbit.release_decision_metric_events t ON t.id = c.id
WHERE c.event_kind = 'metric'
  AND NOT (
      t.env_id = c.env_id
      AND t.user_key = c.user_key
      AND t.user_name = c.user_name
      AND t.event_name = c.event_name
      AND t.event_type = c.event_type
      AND t.numeric_value = c.numeric_value
      AND t.occurred_at = c.event_at
      AND t.properties = c.properties
  );

INSERT INTO featbit._migration_546_to_600_event_conflicts
SELECT c.id, 'release_decision_metric_events', 'id_exists_in_wrong_target_table'
FROM featbit._migration_546_to_600_event_canonical c
INNER JOIN featbit.release_decision_metric_events t ON t.id = c.id
WHERE c.event_kind = 'exposure';

INSERT INTO featbit._migration_546_to_600_event_conflicts
SELECT c.id, 'release_decision_exposure_events', 'id_exists_in_wrong_target_table'
FROM featbit._migration_546_to_600_event_canonical c
INNER JOIN featbit.release_decision_exposure_events t ON t.id = c.id
WHERE c.event_kind = 'metric';

INSERT INTO featbit._migration_546_to_600_event_conflicts
SELECT c.id, 'release_decision_exposure_events', 'duplicate_id_already_in_target'
FROM featbit._migration_546_to_600_event_canonical c
INNER JOIN
(
    SELECT id
    FROM featbit.release_decision_exposure_events
    GROUP BY id
    HAVING count() > 1
) duplicated ON duplicated.id = c.id
WHERE c.event_kind = 'exposure';

INSERT INTO featbit._migration_546_to_600_event_conflicts
SELECT c.id, 'release_decision_metric_events', 'duplicate_id_already_in_target'
FROM featbit._migration_546_to_600_event_canonical c
INNER JOIN
(
    SELECT id
    FROM featbit.release_decision_metric_events
    GROUP BY id
    HAVING count() > 1
) duplicated ON duplicated.id = c.id
WHERE c.event_kind = 'metric';

SELECT id, target_table, reason
FROM featbit._migration_546_to_600_event_conflicts
ORDER BY target_table, id, reason;

SELECT throwIf(
    count() > 0,
    'Migration stopped: target ID conflicts were found; inspect featbit._migration_546_to_600_event_conflicts'
)
FROM featbit._migration_546_to_600_event_conflicts;

-- First target write. Existing exact IDs are excluded explicitly because
-- MergeTree does not enforce UUID uniqueness.
INSERT INTO featbit.release_decision_exposure_events
(
    id, env_id, flag_key, user_key, user_name, variation_id,
    variation_value, exposed_at, properties, created_at
)
SELECT
    id, env_id, flag_key, user_key, user_name, variation_id,
    variation_value, event_at, properties, now64(6, 'UTC')
FROM featbit._migration_546_to_600_event_canonical
WHERE event_kind = 'exposure'
  AND id NOT IN (SELECT id FROM featbit.release_decision_exposure_events);

INSERT INTO featbit.release_decision_metric_events
(
    id, env_id, user_key, user_name, event_name, event_type,
    numeric_value, occurred_at, properties, created_at
)
SELECT
    id, env_id, user_key, user_name, event_name, event_type,
    numeric_value, event_at, properties, now64(6, 'UTC')
FROM featbit._migration_546_to_600_event_canonical
WHERE event_kind = 'metric'
  AND id NOT IN (SELECT id FROM featbit.release_decision_metric_events);

-- Verify that the source remained frozen and every accepted canonical row is
-- present with exact mapped content. created_at is intentionally excluded.
SELECT throwIf(
    count() != (SELECT count() FROM featbit._migration_546_to_600_event_stage),
    'Migration verification failed: featbit.events changed during the migration'
)
FROM featbit.events;

SELECT throwIf(
    count() > 0,
    'Migration verification failed: exposure target content does not match the mapping'
)
FROM featbit._migration_546_to_600_event_canonical c
LEFT JOIN featbit.release_decision_exposure_events t ON t.id = c.id
WHERE c.event_kind = 'exposure'
  AND (
      isNull(t.id)
      OR NOT ifNull(
          t.env_id = c.env_id
          AND t.flag_key = c.flag_key
          AND t.user_key = c.user_key
          AND t.user_name = c.user_name
          AND t.variation_id = c.variation_id
          AND t.variation_value = c.variation_value
          AND t.exposed_at = c.event_at
          AND t.properties = c.properties,
          0
      )
  );

SELECT throwIf(
    count() > 0,
    'Migration verification failed: metric target content does not match the mapping'
)
FROM featbit._migration_546_to_600_event_canonical c
LEFT JOIN featbit.release_decision_metric_events t ON t.id = c.id
WHERE c.event_kind = 'metric'
  AND (
      isNull(t.id)
      OR NOT ifNull(
          t.env_id = c.env_id
          AND t.user_key = c.user_key
          AND t.user_name = c.user_name
          AND t.event_name = c.event_name
          AND t.event_type = c.event_type
          AND t.numeric_value = c.numeric_value
          AND t.occurred_at = c.event_at
          AND t.properties = c.properties,
          0
      )
  );

SELECT
    event_kind,
    count() AS source_rows,
    countIf(empty(reject_reasons)) AS accepted_source_rows,
    uniqExactIf(source_id, empty(reject_reasons)) AS accepted_unique_ids,
    countIf(not empty(reject_reasons)) AS rejected_rows,
    countIf(empty(reject_reasons) AND not empty(warnings)) AS warning_rows
FROM featbit._migration_546_to_600_event_stage
GROUP BY event_kind
ORDER BY event_kind;

SELECT
    event_kind,
    count() AS accepted_unique_ids,
    countIf(target_was_present = 0) AS inserted_this_run,
    countIf(target_was_present = 1) AS already_present_before_run
FROM featbit._migration_546_to_600_event_canonical
GROUP BY event_kind
ORDER BY event_kind;

SELECT
    event_kind,
    env_id,
    toYYYYMM(event_at) AS event_month,
    count() AS accepted_unique_ids
FROM featbit._migration_546_to_600_event_canonical
GROUP BY event_kind, env_id, event_month
ORDER BY event_kind, env_id, event_month;

SELECT
    source_id,
    source_event,
    reject_reasons
FROM featbit._migration_546_to_600_event_stage
WHERE not empty(reject_reasons)
ORDER BY source_id;

SELECT
    source_id,
    source_event,
    warnings
FROM featbit._migration_546_to_600_event_stage
WHERE empty(reject_reasons) AND not empty(warnings)
ORDER BY source_id;

SELECT 'ClickHouse event migration completed' AS result;
