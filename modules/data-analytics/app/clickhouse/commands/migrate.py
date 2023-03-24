from textwrap import indent

from flask import current_app

from app.setting import (CLICKHOUSE_CLUSTER, CLICKHOUSE_DATABASE, CLICKHOUSE_HOST,
                         CLICKHOUSE_PASSWORD, CLICKHOUSE_REPLICATION,
                         CLICKHOUSE_SECURE, CLICKHOUSE_USER)
from infi.clickhouse_orm import Database
from infi.clickhouse_orm.utils import import_submodules

MIGRATIONS_PACKAGE_NAME = 'app.clickhouse.migrations'


def migrate(upto: int = 9999, check: bool = False, plan: bool = False, print_sql: bool = False) -> None:

    clickhouse_http_protocol = "http://"
    clickhouse_http_port = "8123"
    if CLICKHOUSE_SECURE:
        clickhouse_http_protocol = "https://"
        clickhouse_http_port = "8443"

    db_url = f"{clickhouse_http_protocol}{CLICKHOUSE_HOST}:{clickhouse_http_port}/"

    database = Database(
        CLICKHOUSE_DATABASE,
        cluster=CLICKHOUSE_CLUSTER if CLICKHOUSE_REPLICATION else None,
        db_url=db_url,
        username=CLICKHOUSE_USER,
        password=CLICKHOUSE_PASSWORD,
        verify_ssl_cert=False,
        autocreate=True
    )

    current_app.logger.info("Migration in ClickHouse")

    if check or plan:
        if print_sql:
            current_app.logger.info("List of clickhouse migrations to be applied:")
        migrations = list(_get_unapplied_migrations(database, upto))
        for migration_name, operations in migrations:
            current_app.logger.info(f"Migration would get applied: {migration_name}")
            for op in operations:
                sql = getattr(op, "_sql", None)
                if print_sql and sql is not None:
                    current_app.logger.info(indent("\n\n".join(sql), "    "))
        if len(migrations) == 0:
            current_app.logger.info("Clickhouse migrations up to date!")
        else:
            exit(1)
    else:
        database.migrate(MIGRATIONS_PACKAGE_NAME, upto, replicated=CLICKHOUSE_REPLICATION)
        current_app.logger.info("✅ Migration successful")


def _get_unapplied_migrations(database: Database, upto: int):
    modules = import_submodules(MIGRATIONS_PACKAGE_NAME)
    applied_migrations = _get_applied_migrations(database)
    unapplied_migrations = set(modules.keys()) - applied_migrations

    for migration_name in sorted(unapplied_migrations):
        yield migration_name, modules[migration_name].operations
        if int(migration_name[:4]) >= upto:
            break


def _get_applied_migrations(database: Database):
    return database._get_applied_migrations(MIGRATIONS_PACKAGE_NAME, replicated=CLICKHOUSE_REPLICATION)
