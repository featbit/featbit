import json
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from app.clickhouse.client import sync_execute
from app.clickhouse.kafka import KAFKA_EVENTS_TOPIC, ClickhouseProducer
from app.clickhouse.models.event import BULK_INSERT_EVENT_SQL, INSERT_EVENT_SQL
from app.clickhouse.models.event.sql import MERGE_EVENTS_SQL
from app.setting import KAFKA_PRODUCER_ENABLED, UTC_FMT
from dateutil.parser import isoparse


def _make_event(properties: Optional[Dict[str, Any]] = {}) -> str:
    if properties is None:
        properties = {}

    event_uuid = str(uuid.uuid4())
    event = properties.get("Type", 'FlagValue')
    timestamp = properties.get("Timestamp", datetime.utcnow())
    if isinstance(timestamp, str):
        timestamp = isoparse(timestamp)
    distinct_id = properties.get("FeatureFlagId", None) or properties.get("EventName", None)
    env_id = properties.get("EnvId", None) or properties.get("EnvironmentId", None)

    return {
        "uuid": event_uuid,
        "distinct_id": distinct_id,
        "env_id": env_id,
        "event": event,
        "properties": json.dumps(properties),
        "timestamp": timestamp.strftime(UTC_FMT)
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
