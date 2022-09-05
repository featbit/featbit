
from app.setting import CLICKHOUSE_KAFKA_HOSTS

KAFKA_ENGINE = """
Kafka SETTINGS kafka_broker_list = '{kafka_host}',
               kafka_topic_list = '{topic}',
               kafka_group_name = '{group}',
               kafka_format = '{format_func_name}',
               kafka_num_consumers = '{num_consumers}',
               kafka_skip_broken_messages = '{skip_broken_messages}'
"""

KAFKA_COLUMNS = """,_timestamp DateTime
    ,_offset UInt64"""

KAFKA_QUERY_COLUMNS = "_timestamp, _offset"


def kafka_engine(
    topic: str,
    kafka_host=None,
    group="ch_group",
    format_func_name: str = "JSONEachRow",
    num_consumers=1,
    skip_broken_messages=100
):
    if kafka_host is None:
        kafka_host = CLICKHOUSE_KAFKA_HOSTS
    return KAFKA_ENGINE.format(topic=topic,
                               kafka_host=kafka_host,
                               group=group,
                               format_func_name=format_func_name,
                               num_consumers=num_consumers,
                               skip_broken_messages=skip_broken_messages)
