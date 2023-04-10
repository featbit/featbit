import json
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.clickhouse.client import sync_execute
from app.clickhouse.kafka import KAFKA_EVENTS_TOPIC, ClickhouseProducer
from app.clickhouse.models.event import BULK_INSERT_EVENT_SQL, INSERT_EVENT_SQL
from app.clickhouse.models.event.sql import MERGE_EVENTS_SQL
from app.setting import KAFKA_PRODUCER_ENABLED
from utils import to_UTC_datetime, dt_to_seconds_or_millis_or_micros


def _make_event(properties: Optional[Dict[str, Any]] = {}) -> Dict[str, Any]:
    if properties is None:
        properties = {}

    event_uuid = str(uuid.uuid4())
    event = properties.get("type", 'FlagValue')
    timestamp = to_UTC_datetime(properties.get("timestamp", datetime.utcnow()))
    distinct_id = properties.get("flagId", None) or properties.get("eventName", None)
    env_id = properties.get("envId", None)
    return {
        "uuid": event_uuid,
        "distinct_id": distinct_id,
        "env_id": env_id,
        "event": event,
        "properties": json.dumps(properties),
        "timestamp": dt_to_seconds_or_millis_or_micros(timestamp, timespec="microseconds")
    }


def create_event(properties: Optional[Dict[str, Any]] = {}):
    data = _make_event(properties)
    p = ClickhouseProducer()
    p.produce(topic=KAFKA_EVENTS_TOPIC, data=data, sql=INSERT_EVENT_SQL, params=data)

    return data["uuid"]


def bulk_create_events(list_properties: List[Dict[str, Any]]) -> None:
    data = []
    inserts = []
    params = {}
    for index, properties in enumerate(list_properties):
        event = _make_event(properties)
        if KAFKA_PRODUCER_ENABLED:
            data.append(event)
        else:
            inserts.append("(%(uuid_{i})s, %(distinct_id_{i})s, %(env_id_{i})s, %(event_{i})s, %(properties_{i})s, %(timestamp_{i})s, now(), 0)".format(i=index))
            params = {**params, **{"{}_{}".format(key, index): value for key, value in event.items()}}
    p = ClickhouseProducer()
    p.produce(topic=KAFKA_EVENTS_TOPIC, data=data, sql=BULK_INSERT_EVENT_SQL + ", ".join(inserts), params=params)


def optimize_events() -> None:
    sync_execute(MERGE_EVENTS_SQL)
