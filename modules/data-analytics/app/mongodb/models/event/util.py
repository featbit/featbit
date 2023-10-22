import random
from time import perf_counter
import uuid
from datetime import datetime
from typing import Any, Dict, List, Mapping, Optional, Sequence
from flask import current_app

import pandas as pd

from app.mongodb.db import get_db
from app.setting import MONGO_DB_EVENTS_COLLECTION, SHELL_PLUS_PRINT_SQL
from utils import to_UTC_datetime


def _generate_guid() -> str:
    guid_func = random.choice([uuid.uuid4, uuid.uuid1])
    return str(guid_func())


def _make_event(properties: Optional[Dict[str, Any]] = {}) -> Dict[str, Any]:
    if properties is None:
        properties = {}

    event_uuid = _generate_guid()
    event = properties.get("type", 'FlagValue')
    timestamp = to_UTC_datetime(properties.get("timestamp", datetime.utcnow()))
    distinct_id = properties.get("flagId", None) or properties.get("eventName", None)
    env_id = properties.get("envId", None)
    return {
        "_id": event_uuid,
        "distinct_id": distinct_id,
        "env_id": env_id,
        "event": event,
        "properties": properties,
        "timestamp": timestamp
    }


def bulk_create_events(list_properties: List[Dict[str, Any]]) -> None:
    events = [_make_event(props) for props in list_properties]
    db = get_db()
    db[MONGO_DB_EVENTS_COLLECTION].insert_many(events)


def get_events_sample_from_mongod(query: Sequence[Mapping[str, Any]],
                                  cols: List[str] = []) -> pd.DataFrame:
    start_time = perf_counter()
    db = get_db()
    df = pd.DataFrame(list(db[MONGO_DB_EVENTS_COLLECTION].aggregate(query)))
    execution_time = perf_counter() - start_time
    if SHELL_PLUS_PRINT_SQL:
        current_app.logger.info('SQL => %s' % query)
        current_app.logger.info("SQL execution time: %.6fs" % (execution_time,))
    if not df.empty and len(cols) > 0:
        df = df[cols]
    return df
