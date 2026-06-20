CREATE DATABASE IF NOT EXISTS featbit;

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

CREATE TABLE IF NOT EXISTS featbit.kafka_insight_events_queue
(
    uuid UUID,
    distinct_id String,
    env_id String,
    event String,
    properties String,
    timestamp Int64
)
ENGINE = Kafka
SETTINGS
    kafka_broker_list = 'kafka:9092',
    kafka_topic_list = 'featbit-insights',
    kafka_group_name = 'featbit_clickhouse_release_decision',
    kafka_format = 'JSONEachRow',
    kafka_num_consumers = 1,
    kafka_skip_broken_messages = 100;

DROP VIEW IF EXISTS featbit.release_decision_exposure_events_mv;
DROP VIEW IF EXISTS featbit.release_decision_metric_events_mv;

CREATE MATERIALIZED VIEW IF NOT EXISTS featbit.release_decision_exposure_events_mv
TO featbit.release_decision_exposure_events
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
    properties,
    now64(6) AS created_at
FROM
(
    SELECT
        uuid,
        distinct_id,
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

CREATE MATERIALIZED VIEW IF NOT EXISTS featbit.release_decision_metric_events_mv
TO featbit.release_decision_metric_events
AS
SELECT
    uuid AS id,
    assumeNotNull(toUUIDOrNull(raw_env_id)) AS env_id,
    JSONExtractString(JSONExtractRaw(properties, 'user'), 'keyId') AS user_key,
    JSONExtractString(JSONExtractRaw(properties, 'user'), 'name') AS user_name,
    if(empty(JSONExtractString(properties, 'eventName')), distinct_id, JSONExtractString(properties, 'eventName')) AS event_name,
    event AS event_type,
    if(JSONHas(properties, 'numericValue'), JSONExtractFloat(properties, 'numericValue'), 0.0) AS numeric_value,
    fromUnixTimestamp64Micro(timestamp, 'UTC') AS occurred_at,
    properties,
    now64(6) AS created_at
FROM
(
    SELECT
        uuid,
        distinct_id,
        env_id AS raw_env_id,
        event,
        properties,
        timestamp
    FROM featbit.kafka_insight_events_queue
)
WHERE event != 'FlagValue'
  AND toUUIDOrNull(raw_env_id) IS NOT NULL
  AND notEmpty(JSONExtractString(JSONExtractRaw(properties, 'user'), 'keyId'))
  AND notEmpty(if(empty(JSONExtractString(properties, 'eventName')), distinct_id, JSONExtractString(properties, 'eventName')));
