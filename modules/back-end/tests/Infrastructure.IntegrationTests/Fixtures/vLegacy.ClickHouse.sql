-- Legacy ClickHouse initialization, extracted from legacy-data-analytics:
-- app/clickhouse/migrations/0001_initial.py
-- app/clickhouse/migrations/0002_initial_distributed_tables.py
-- app/clickhouse/migrations/0003_initial_kafka.py
-- SQL definitions: app/clickhouse/models/event/sql.py and app/clickhouse/kafka/kafka_enginer.py.
-- Reference only; deliberately outside docker-entrypoint-initdb.d.
-- Expanded for database=featbit, replication=false, storage policy=false,
-- Kafka broker=kafka:9092. Legacy Python defaults replication to true;
-- see the cluster variant notes below. No migration-history bookkeeping is included.

-- 0001_initial: database and local event storage.
CREATE DATABASE IF NOT EXISTS featbit;

CREATE TABLE IF NOT EXISTS featbit.events
(
    uuid UUID,
    distinct_id VARCHAR,
    env_id VARCHAR,
    event VARCHAR,
    properties VARCHAR,
    timestamp DateTime64(6, 'UTC'),
    tag_0 VARCHAR MATERIALIZED JSONExtractString(properties, 'tag_0'),
    tag_1 VARCHAR MATERIALIZED JSONExtractString(properties, 'tag_1'),
    tag_2 VARCHAR MATERIALIZED JSONExtractString(properties, 'tag_2'),
    tag_3 VARCHAR MATERIALIZED JSONExtractString(properties, 'tag_3'),
    tag_4 VARCHAR MATERIALIZED JSONExtractString(properties, 'tag_4'),
    tag_5 VARCHAR MATERIALIZED JSONExtractString(properties, 'tag_5'),
    tag_6 VARCHAR MATERIALIZED JSONExtractString(properties, 'tag_6'),
    tag_7 VARCHAR MATERIALIZED JSONExtractString(properties, 'tag_7'),
    tag_8 VARCHAR MATERIALIZED JSONExtractString(properties, 'tag_8'),
    tag_9 VARCHAR MATERIALIZED JSONExtractString(properties, 'tag_9'),
    tag_10 VARCHAR MATERIALIZED JSONExtractString(properties, 'tag_10'),
    tag_11 VARCHAR MATERIALIZED JSONExtractString(properties, 'tag_11'),
    tag_12 VARCHAR MATERIALIZED JSONExtractString(properties, 'tag_12'),
    tag_13 VARCHAR MATERIALIZED JSONExtractString(properties, 'tag_13'),
    tag_14 VARCHAR MATERIALIZED JSONExtractString(properties, 'tag_14'),
    tag_15 VARCHAR MATERIALIZED JSONExtractString(properties, 'tag_15'),
    tag_16 VARCHAR MATERIALIZED JSONExtractString(properties, 'tag_16'),
    tag_17 VARCHAR MATERIALIZED JSONExtractString(properties, 'tag_17'),
    tag_18 VARCHAR MATERIALIZED JSONExtractString(properties, 'tag_18'),
    tag_19 VARCHAR MATERIALIZED JSONExtractString(properties, 'tag_19'),
    _timestamp DateTime,
    _offset UInt64
)
ENGINE = MergeTree()
PARTITION BY (env_id, toYYYYMM(timestamp))
ORDER BY (env_id, toDate(timestamp), event, cityHash64(distinct_id))
SAMPLE BY cityHash64(distinct_id);

-- 0002_initial_distributed_tables: skipped when replication=false.
-- Cluster variant (reference; requires configured cluster, Keeper/ZooKeeper and macros):
-- 1. Add ON CLUSTER featbit_ch_cluster to database/table/view creation statements.
-- 2. Replace the events engine with:
--    ReplicatedMergeTree('/clickhouse/tables/<generated-uuid>_{shard}/featbit.events', '{replica}')
--    The legacy code generates a fresh UUID when constructing the migration SQL.
-- 3. Create distributed_events with the SAME columns as events above, using:
--    CREATE TABLE IF NOT EXISTS featbit.distributed_events ON CLUSTER featbit_ch_cluster
--    (<same column definitions, including materialized tags and Kafka metadata>)
--    ENGINE = Distributed('featbit_ch_cluster', 'featbit', 'events', sipHash64(distinct_id));
--    Reads use distributed_events; the materialized view still writes to local events.
-- If CLICKHOUSE_ENABLE_STORAGE_POLICY=true, append
-- SETTINGS storage_policy = 'hot_to_cold' to the local events CREATE TABLE statement.

-- 0003_initial_kafka: Kafka ingestion and forwarding into events.
CREATE TABLE IF NOT EXISTS featbit.kafka_events_queue
(
    uuid UUID,
    distinct_id VARCHAR,
    env_id VARCHAR,
    event VARCHAR,
    properties VARCHAR,
    timestamp DateTime64(6, 'UTC')
)
ENGINE = Kafka
SETTINGS kafka_broker_list = 'kafka:9092',
         kafka_topic_list = 'featbit-insights',
         kafka_group_name = 'ch_group',
         kafka_format = 'JSONEachRow',
         kafka_num_consumers = '1',
         kafka_skip_broken_messages = '100';

CREATE MATERIALIZED VIEW IF NOT EXISTS featbit.events_mv
TO featbit.events
AS SELECT
    uuid, distinct_id, env_id, event, properties, timestamp, _timestamp, _offset
FROM featbit.kafka_events_queue;