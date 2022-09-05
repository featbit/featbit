from app.setting import (CLICKHOUSE_CLUSTER, CLICKHOUSE_REPLICATION,
                         CLICKHOUSE_ENABLE_STORAGE_POLICY)


def cluster() -> str:
    if CLICKHOUSE_REPLICATION:
        return f"ON CLUSTER {CLICKHOUSE_CLUSTER}"
    else:
        return ""


def storage_policy() -> str:
    return "SETTINGS storage_policy = 'hot_to_cold'" if CLICKHOUSE_ENABLE_STORAGE_POLICY else ""


def optimize_tables() -> None:
    from app.clickhouse.models.event.util import optimize_events
    optimize_events()
