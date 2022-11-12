from app.clickhouse.kafka import (KAFKA_COLUMNS, KAFKA_EVENTS_TOPIC,
                                  KAFKA_QUERY_COLUMNS, kafka_engine)
from app.clickhouse.models import cluster, storage_policy
from app.clickhouse.table_engines import distributed_read_engine, merge_tree_engine
from app.setting import CLICKHOUSE_DATABASE, CLICKHOUSE_REPLICATION


def _internal_event_table_name(is_kafka=False):
    if is_kafka:
        return 'kafka_events_queue'
    return 'events'


def event_table_name():
    if CLICKHOUSE_REPLICATION:
        return 'distributed_events'
    return 'events'


def _event_partition_by():
    return 'PARTITION BY (env_id, toYYYYMM(timestamp))'


def _event_order_by():
    return 'ORDER BY (env_id, toDate(timestamp), event, cityHash64(distinct_id))'


def _event_sample_by():
    return 'SAMPLE BY cityHash64(distinct_id)'


EVENTS_TABLE_MATERIALIZED_COLUMNS = """,tag_0 VARCHAR MATERIALIZED JSONExtractString(properties, 'tag_0')
    ,tag_1 VARCHAR MATERIALIZED JSONExtractString(properties, 'tag_1')
    ,tag_2 VARCHAR MATERIALIZED JSONExtractString(properties, 'tag_2')
    ,tag_3 VARCHAR MATERIALIZED JSONExtractString(properties, 'tag_3')
    ,tag_4 VARCHAR MATERIALIZED JSONExtractString(properties, 'tag_4')
    ,tag_5 VARCHAR MATERIALIZED JSONExtractString(properties, 'tag_5')
    ,tag_6 VARCHAR MATERIALIZED JSONExtractString(properties, 'tag_6')
    ,tag_7 VARCHAR MATERIALIZED JSONExtractString(properties, 'tag_7')
    ,tag_8 VARCHAR MATERIALIZED JSONExtractString(properties, 'tag_8')
    ,tag_9 VARCHAR MATERIALIZED JSONExtractString(properties, 'tag_9')
    ,tag_10 VARCHAR MATERIALIZED JSONExtractString(properties, 'tag_10')
    ,tag_11 VARCHAR MATERIALIZED JSONExtractString(properties, 'tag_11')
    ,tag_12 VARCHAR MATERIALIZED JSONExtractString(properties, 'tag_12')
    ,tag_13 VARCHAR MATERIALIZED JSONExtractString(properties, 'tag_13')
    ,tag_14 VARCHAR MATERIALIZED JSONExtractString(properties, 'tag_14')
    ,tag_15 VARCHAR MATERIALIZED JSONExtractString(properties, 'tag_15')
    ,tag_16 VARCHAR MATERIALIZED JSONExtractString(properties, 'tag_16')
    ,tag_17 VARCHAR MATERIALIZED JSONExtractString(properties, 'tag_17')
    ,tag_18 VARCHAR MATERIALIZED JSONExtractString(properties, 'tag_18')
    ,tag_19 VARCHAR MATERIALIZED JSONExtractString(properties, 'tag_19')"""

EVENTS_TABLE_BASIC_SQL = """
CREATE TABLE IF NOT EXISTS {table_name} {cluster}
(
    uuid UUID,
    distinct_id VARCHAR,
    env_id VARCHAR,
    event VARCHAR,
    properties VARCHAR,
    timestamp DateTime64(6, 'UTC')
    {materialized_columns}
    {extra_fields}
) ENGINE = {engine}
"""

EVENT_MERGE_TREE_EXTRA_SQL = """{partition_by}
{order_by}
{sample_by}
{storage_policy}"""

EVENTS_TABLE_SQL = (EVENTS_TABLE_BASIC_SQL + EVENT_MERGE_TREE_EXTRA_SQL).format(
    table_name=_internal_event_table_name(),
    cluster=cluster(),
    engine=merge_tree_engine(_internal_event_table_name()),
    materialized_columns=EVENTS_TABLE_MATERIALIZED_COLUMNS,
    extra_fields=KAFKA_COLUMNS,
    partition_by=_event_partition_by(),
    order_by=_event_order_by(),
    sample_by=_event_sample_by(),
    storage_policy=storage_policy())

KAFKA_EVENTS_SQL = EVENTS_TABLE_BASIC_SQL.format(
    table_name=_internal_event_table_name(is_kafka=True),
    cluster=cluster(),
    engine=kafka_engine(topic=KAFKA_EVENTS_TOPIC),
    materialized_columns="",
    extra_fields="")

EVENTS_TABLE_MV_SQL = """
CREATE MATERIALIZED VIEW IF NOT EXISTS events_mv {cluster}
TO {database}.{target_table}
AS SELECT
uuid, distinct_id, env_id, event, properties, timestamp, {extra_fields}
FROM {database}.{from_kafka_table}
""".format(
    cluster=cluster(),
    database=CLICKHOUSE_DATABASE,
    target_table=_internal_event_table_name(),
    extra_fields=KAFKA_QUERY_COLUMNS,
    from_kafka_table=_internal_event_table_name(is_kafka=True))

# This table is responsible for reading from events on a cluster setting
DISTRIBUTED_EVENTS_TABLE_SQL = EVENTS_TABLE_BASIC_SQL.format(
    table_name=event_table_name(),
    cluster=cluster(),
    engine=distributed_read_engine(_internal_event_table_name(), 'sipHash64(distinct_id)'),
    materialized_columns=EVENTS_TABLE_MATERIALIZED_COLUMNS,
    extra_fields=KAFKA_COLUMNS
)


INSERT_EVENT_SQL = f"""
INSERT INTO {_internal_event_table_name()} (uuid, distinct_id, env_id, event, properties, timestamp, _timestamp, _offset)
VALUES (%(uuid)s, %(distinct_id)s, %(env_id)s, %(event)s, %(properties)s, %(timestamp)s, now(), 0)
"""

BULK_INSERT_EVENT_SQL = f"""
INSERT INTO {_internal_event_table_name()} (uuid, distinct_id, env_id, event, properties, timestamp, _timestamp, _offset)
VALUES
"""

# print(EVENTS_TABLE_SQL)
# print(KAFKA_EVENTS_SQL)
# print(EVENTS_TABLE_MV_SQL)

MERGE_EVENTS_SQL = f"OPTIMIZE TABLE {_internal_event_table_name()} {cluster()} FINAL"
