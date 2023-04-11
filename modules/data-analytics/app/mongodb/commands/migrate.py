

from flask import current_app
from flask_pymongo import ASCENDING

from app.mongodb.db import get_db
from app.setting import MONGO_DB_EVENTS_COLLECTION


def migrate() -> None:

    current_app.logger.info("Migration in MongoDB")
    db = get_db()
    if MONGO_DB_EVENTS_COLLECTION not in db.list_collection_names():
        db.Events.create_index([("event", ASCENDING), ("env_id", ASCENDING), ("distinct_id", ASCENDING), ("timestamp", ASCENDING)])
        current_app.logger.info("Clickhouse migrations up to date!")
    current_app.logger.info("✅ Migration successful")
