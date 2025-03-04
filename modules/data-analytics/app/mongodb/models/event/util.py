from time import perf_counter
from datetime import datetime, timezone
from typing import Any, Dict, List, Mapping, Optional, Sequence
from flask import current_app

import pandas as pd

from app.mongodb.db import get_db
from app.setting import MONGO_DB_EVENTS_COLLECTION, SHELL_PLUS_PRINT_SQL
from utils import create_event


def bulk_create_events(list_properties: List[Dict[str, Any]]) -> None:
    events = [create_event(props) for props in list_properties]
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
