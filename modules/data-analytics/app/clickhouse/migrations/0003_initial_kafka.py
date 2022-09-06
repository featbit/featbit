from app.clickhouse.models.event import EVENTS_TABLE_MV_SQL, KAFKA_EVENTS_SQL
from infi.clickhouse_orm import migrations

operations = [
    migrations.RunSQL(KAFKA_EVENTS_SQL),
    migrations.RunSQL(EVENTS_TABLE_MV_SQL)
]
