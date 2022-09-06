import uuid
from app.setting import CLICKHOUSE_CLUSTER, CLICKHOUSE_DATABASE, CLICKHOUSE_REPLICATION


def merge_tree_engine(table: str = None) -> str:
    return str(MergeTree(table))


def distributed_read_engine(data_table: str, sharding_key: str) -> str:
    return str(Distributed(data_table, sharding_key))


class _MergeTreeEngine:
    ENGINE = ""
    REPLICATED_ENGINE = ""

    def __init__(self, table_name: str, **settings):
        self._table_name = table_name
        self._kwargs = settings

    def __str__(self) -> str:
        if not CLICKHOUSE_REPLICATION:
            return self.ENGINE.format(**self._kwargs)
        else:
            shard_key, replica_name = "{shard}", "{replica}"

        # ZK is not automatically cleaned up after DROP TABLE. Avoid zk path conflicts by generating unique paths.
        unique_shard_key = f"{str(uuid.uuid4())}_{shard_key}"

        zoo_path = f"/clickhouse/tables/{unique_shard_key}/{CLICKHOUSE_DATABASE}.{self._table_name}"
        return self.REPLICATED_ENGINE.format(zoo_path=zoo_path, replica_name=replica_name, **self._kwargs)


class MergeTree(_MergeTreeEngine):
    ENGINE = "MergeTree()"
    REPLICATED_ENGINE = "ReplicatedMergeTree('{zoo_path}', '{replica_name}')"


class Distributed:
    def __init__(self, data_table: str, sharding_key: str):
        self._data_table = data_table
        self._sharding_key = sharding_key

    def __str__(self):
        return f"Distributed('{CLICKHOUSE_CLUSTER}', '{CLICKHOUSE_DATABASE}', '{self._data_table}', {self._sharding_key})"
