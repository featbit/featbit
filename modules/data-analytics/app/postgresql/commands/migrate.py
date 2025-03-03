import importlib
import os
import psycopg
from flask import current_app
from importlib import import_module

from app.setting import POSTGRES_DATABASE, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_HOST, POSTGRES_PORT, POSTGRES_CONNECTION_STRING

MIGRATIONS_PACKAGE_NAME = 'app.postgresql.migrations'


def migrate(upto: int = 9999, check: bool = False, plan: bool = False, print_sql: bool = False) -> None:
    current_app.logger.info("Migration in PostgreSQL")

    if POSTGRES_CONNECTION_STRING:
        conn = psycopg.connect(POSTGRES_CONNECTION_STRING)
    else:
        db_config = {
            "dbname": POSTGRES_DATABASE,
            "user": POSTGRES_USER,
            "password": POSTGRES_PASSWORD,
            "host": POSTGRES_HOST,
            "port": POSTGRES_PORT
        }
        conn = psycopg.connect(**db_config)

    with conn:
        conn.autocommit = True

        with conn.cursor() as cur:
            # Check if the database already exists
            cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (POSTGRES_DATABASE,))
            exists = cur.fetchone()

            if not exists:
                cur.execute(f'CREATE DATABASE "{POSTGRES_DATABASE}"')  # Use double quotes for case sensitivity

            # Ensure migrations table exists
            cur.execute("""
                CREATE TABLE IF NOT EXISTS migrations (
                    id SERIAL PRIMARY KEY,
                    migration_name TEXT UNIQUE NOT NULL,
                    applied_at TIMESTAMP DEFAULT now()
                )
            """)

            if check or plan:
                _list_pending_migrations(cur, upto, print_sql)
            else:
                _apply_migrations(cur, conn, upto)

    current_app.logger.info("✅ Migration successful")


def _list_pending_migrations(cur, upto: int, print_sql: bool):
    applied_migrations = _get_applied_migrations(cur)
    all_migrations = _get_all_migrations()

    pending_migrations = sorted(all_migrations - applied_migrations)

    if pending_migrations:
        current_app.logger.info("List of PostgreSQL migrations to be applied:")
        for migration in pending_migrations:
            current_app.logger.info(f"Migration would get applied: {migration}")
            if print_sql:
                sql_statements = _get_migration_sql(migration)
                current_app.logger.info("\n".join(sql_statements))
        exit(1)
    else:
        current_app.logger.info("PostgreSQL migrations up to date!")


def _apply_migrations(cur, conn, upto: int):
    applied_migrations = _get_applied_migrations(cur)
    all_migrations = _get_all_migrations()

    for migration in sorted(all_migrations - applied_migrations):
        if int(migration[:4]) > upto:
            break

        current_app.logger.info(f"Applying migration: {migration}")
        sql_statements = _get_migration_sql(migration)

        for sql in sql_statements:
            cur.execute(sql)

        cur.execute("INSERT INTO migrations (migration_name) VALUES (%s)", (migration,))
        conn.commit()


def _get_applied_migrations(cur):
    cur.execute("SELECT migration_name FROM migrations")
    return {row[0] for row in cur.fetchall()}


def _get_all_migrations():
    module = import_module(MIGRATIONS_PACKAGE_NAME)
    return set(name for name in os.listdir(module.__path__[0]) if name.endswith(".py") and name != "__init__.py")


def _get_migration_sql(migration_name):
    migration_path = os.path.join(MIGRATIONS_PACKAGE_NAME.replace(".", "/"), migration_name)

    if not os.path.exists(migration_path):
        raise FileNotFoundError(f"Migration file not found: {migration_path}")

    spec = importlib.util.spec_from_file_location(migration_name, migration_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    return getattr(module, "operations", [])
