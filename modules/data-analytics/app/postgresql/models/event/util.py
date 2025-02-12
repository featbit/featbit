from typing import Any, Dict, List

import psycopg
from flask import current_app
from psycopg.types.json import Json

from utils import create_event

POSTGRES_USER = 'postgres'
POSTGRES_PASSWORD = '0tJXCokSvOB8'
POSTGRES_HOST = 'localhost'
POSTGRES_PORT = '5432'
POSTGRES_DATABASE = 'featbit'


def bulk_create_events(list_properties: List[Dict[str, Any]]) -> None:
    events = [create_event(props) for props in list_properties]
    # TODO bulk insert events to postgresql

    if not events:
        return  # No events to insert

    query = """
        INSERT INTO events (id, distinct_id, env_id, event, properties, timestamp)
        VALUES (%(id)s, %(distinct_id)s, %(env_id)s, %(event)s, %(properties)s, %(timestamp)s)
        ON CONFLICT (id) DO NOTHING
        """

    # Wrap JSONB fields with `Json()`
    for event in events:
        event["properties"] = Json(event["properties"])

    db_config = {
        "dbname": POSTGRES_DATABASE,
        "user": POSTGRES_USER,
        "password": POSTGRES_PASSWORD,
        "host": POSTGRES_HOST,
        "port": POSTGRES_PORT
    }

    try:
        with psycopg.connect(**db_config) as conn:
            with conn.cursor() as cur:
                cur.executemany(query, events)
    except psycopg.Error as e:
        current_app.logger.error(f'Database error: {e}')
