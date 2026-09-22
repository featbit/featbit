-- Initialization and v6 upgrade for the default single-node deployment.
-- Existing installations: clickhouse-client --multiquery < v6.0.0.sql
-- Stop on the first error; do not use --ignore-error or run concurrent upgrades.
-- API/ELS can keep publishing. Retire legacy analytics queries at cutover.
-- Assumes kafka:9092, featbit-insights and the original consumer group ch_group.
-- Custom Kafka settings or replicated/distributed deployments require a tailored upgrade.
-- Historical data stays in events_legacy; contact FeatBit for historical migration.
-- Kafka delivery remains at-least-once. Do not reset/delete the group's offsets.

CREATE DATABASE IF NOT EXISTS featbit;

-- Reject archive collisions and cluster layouts before changing the old chain.
SELECT throwIf(countIf(name = 'events') > 0 AND countIf(name = 'events_legacy') > 0,
               'Both events and events_legacy exist; resolve the archive conflict first')
FROM system.tables WHERE database = 'featbit';
SELECT throwIf(count() > 0, 'Replicated/distributed deployments need a tailored upgrade')
FROM system.tables WHERE database = 'featbit'
    AND (name = 'distributed_events' OR (name = 'events' AND engine != 'MergeTree'));

CREATE TABLE IF NOT EXISTS featbit.experiment_exposure_events
(
    id UUID,
    env_id UUID,
    flag_key LowCardinality(String),
    user_key String,
    user_name String,
    variation_id LowCardinality(String),
    variation_value String,
    exposed_at DateTime64(3, 'UTC'),
    created_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = MergeTree
PARTITION BY (env_id, toYYYYMM(exposed_at))
ORDER BY (env_id, flag_key, exposed_at, cityHash64(user_key))
SETTINGS index_granularity = 8192;

CREATE TABLE IF NOT EXISTS featbit.experiment_metric_events
(
    id UUID,
    env_id UUID,
    user_key String,
    event_name LowCardinality(String),
    event_type LowCardinality(String),
    numeric_value Float64,
    application_type LowCardinality(String) DEFAULT '',
    occurred_at DateTime64(3, 'UTC'),
    created_at DateTime64(3, 'UTC') DEFAULT now64(3)
)
ENGINE = MergeTree
PARTITION BY (env_id, toYYYYMM(occurred_at))
ORDER BY (env_id, event_name, occurred_at, cityHash64(user_key))
SETTINGS index_granularity = 8192;

-- Keep the old definitions detached for recovery; never reactivate them alongside v6.
DETACH TABLE IF EXISTS featbit.events_mv PERMANENTLY SYNC;
DETACH TABLE IF EXISTS featbit.kafka_events_queue PERMANENTLY SYNC;
RENAME TABLE IF EXISTS featbit.events TO featbit.events_legacy;

CREATE TABLE IF NOT EXISTS featbit.kafka_insight_events_queue
(
    uuid UUID,
    env_id String,
    event String,
    properties String,
    timestamp Int64
)
ENGINE = Kafka
SETTINGS
    kafka_broker_list = 'kafka:9092',
    kafka_topic_list = 'featbit-insights',
    kafka_group_name = 'ch_group',
    kafka_format = 'JSONEachRow',
    input_format_skip_unknown_fields = 1,
    kafka_num_consumers = 1,
    kafka_skip_broken_messages = 100;

-- Create the exposure view first, prioritizing flag-result events.
-- Consumption starts here; metric events may be skipped until the second view exists.
-- This short cutover gap is accepted. Treat any statement failure as an incomplete upgrade.
CREATE MATERIALIZED VIEW IF NOT EXISTS featbit.experiment_exposure_events_mv
TO featbit.experiment_exposure_events
AS
SELECT
    uuid AS id,
    assumeNotNull(toUUIDOrNull(raw_env_id)) AS env_id,
    JSONExtractString(properties, 'featureFlagKey') AS flag_key,
    JSONExtractString(properties, 'userKeyId') AS user_key,
    JSONExtractString(properties, 'userName') AS user_name,
    JSONExtractString(properties, 'variationId') AS variation_id,
    JSONExtractString(properties, 'variationValue') AS variation_value,
    fromUnixTimestamp64Micro(timestamp, 'UTC') AS exposed_at,
    now64(3) AS created_at
FROM
(
    SELECT
        uuid,
        env_id AS raw_env_id,
        event,
        properties,
        timestamp
    FROM featbit.kafka_insight_events_queue
)
WHERE event = 'FlagValue'
  AND toUUIDOrNull(raw_env_id) IS NOT NULL
  AND notEmpty(JSONExtractString(properties, 'featureFlagKey'))
  AND notEmpty(JSONExtractString(properties, 'userKeyId'))
  AND notEmpty(JSONExtractString(properties, 'variationId'));

CREATE MATERIALIZED VIEW IF NOT EXISTS featbit.experiment_metric_events_mv
TO featbit.experiment_metric_events
AS
SELECT
    uuid AS id,
    assumeNotNull(toUUIDOrNull(raw_env_id)) AS env_id,
    JSONExtractString(properties, 'user', 'keyId') AS user_key,
    JSONExtractString(properties, 'eventName') AS event_name,
    event AS event_type,
    if(JSONHas(properties, 'numericValue'), JSONExtractFloat(properties, 'numericValue'), 0.0) AS numeric_value,
    JSONExtractString(properties, 'applicationType') AS application_type,
    fromUnixTimestamp64Micro(timestamp, 'UTC') AS occurred_at,
    now64(3) AS created_at
FROM
(
    SELECT
        uuid,
        env_id AS raw_env_id,
        event,
        properties,
        timestamp
    FROM featbit.kafka_insight_events_queue
)
WHERE event != 'FlagValue'
  AND toUUIDOrNull(raw_env_id) IS NOT NULL
  AND notEmpty(user_key)
  AND notEmpty(event_name);
