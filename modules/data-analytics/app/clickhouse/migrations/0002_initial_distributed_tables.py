from infi.clickhouse_orm import migrations
from app.clickhouse.models.event.sql import DISTRIBUTED_EVENTS_TABLE_SQL

from app.setting import CLICKHOUSE_REPLICATION

operations = []
if CLICKHOUSE_REPLICATION:
    operations.append(migrations.RunSQL(DISTRIBUTED_EVENTS_TABLE_SQL))
