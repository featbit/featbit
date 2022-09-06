from app.clickhouse.models.commons import cluster
from app.clickhouse.models.event.sql import EVENTS_TABLE_SQL

from app.setting import CLICKHOUSE_DATABASE
from infi.clickhouse_orm import migrations

operations = [
    migrations.RunSQL(f"CREATE DATABASE IF NOT EXISTS {CLICKHOUSE_DATABASE} {cluster()}"),
    migrations.RunSQL(EVENTS_TABLE_SQL)
]
