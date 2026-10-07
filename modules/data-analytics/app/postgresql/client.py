import psycopg
import psycopg_pool
import sqlparse
from time import perf_counter, sleep
from typing import Any, Dict, List, Optional, Tuple, Union
from flask import current_app

from app.setting import SHELL_PLUS_PRINT_SQL, POSTGRES_CONNECTION_STRING, POSTGRES_DATABASE, POSTGRES_USER, \
    POSTGRES_PASSWORD, POSTGRES_HOST, POSTGRES_PORT, POSTGRES_POOL_MIN_SIZE, POSTGRES_POOL_MAX_SIZE, \
    POSTGRES_POOL_MAX_IDLE

InsertParams = Union[List, Tuple]
NonInsertParams = Dict[str, Any]
QueryArgs = Optional[Union[InsertParams, NonInsertParams]]

PG_QUERY_MAX_ATTEMPTS = 2
PG_QUERY_RETRY_DELAY = 0.2

PG_CONNECT_KWARGS = {
    "connect_timeout": 10,
    "keepalives": 1,
    "keepalives_idle": 60,
    "keepalives_interval": 10,
    "keepalives_count": 3,
}

# Global connection pool
__pg_pool: Optional[psycopg_pool.ConnectionPool] = None


def create_pg_pool():
    """Create a PostgreSQL connection pool"""
    global __pg_pool

    if __pg_pool is None:
        conninfo = POSTGRES_CONNECTION_STRING if POSTGRES_CONNECTION_STRING else (
            f"dbname={POSTGRES_DATABASE} user={POSTGRES_USER} password={POSTGRES_PASSWORD} "
            f"host={POSTGRES_HOST} port={POSTGRES_PORT}"
        )

        __pg_pool = psycopg_pool.ConnectionPool(
            conninfo=conninfo,
            kwargs=PG_CONNECT_KWARGS,
            min_size=POSTGRES_POOL_MIN_SIZE,
            max_size=POSTGRES_POOL_MAX_SIZE,
            # Recycle idle connections before network middleboxes silently drop them
            max_idle=POSTGRES_POOL_MAX_IDLE,
            # Verify a connection is alive before handing it out
            check=psycopg_pool.ConnectionPool.check_connection,
            open=True,
        )

    return __pg_pool


def execute_query(query: str, args: QueryArgs = None, fetch_all=True):
    """Execute a read-only SQL query using psycopg.

    A dropped connection (e.g. 'SSL error: unexpected eof') is retried once on a fresh
    connection. This is safe because every caller only issues SELECT statements.
    """
    pool = create_pg_pool()
    prepared_sql, prepared_args = _prepare_query(query, args)

    for attempt in range(1, PG_QUERY_MAX_ATTEMPTS + 1):
        start_time = perf_counter()
        try:
            with pool.connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(prepared_sql, prepared_args)
                    return cur.fetchall() if fetch_all else cur.fetchone()
        except psycopg.OperationalError as err:
            if attempt >= PG_QUERY_MAX_ATTEMPTS:
                raise
            current_app.logger.warning(
                "PostgreSQL connection error (%s), attempt %d/%d, retrying: %s",
                type(err).__name__, attempt, PG_QUERY_MAX_ATTEMPTS, err
            )
            sleep(PG_QUERY_RETRY_DELAY)
        finally:
            execution_time = perf_counter() - start_time
            if SHELL_PLUS_PRINT_SQL:
                current_app.logger.info("SQL execution time: %.6fs" % execution_time)


def _prepare_query(query: str, args: QueryArgs):
    """Prepare SQL query for execution by replacing placeholders."""
    prepared_args = {}

    if isinstance(args, (List, Tuple)):
        # Handle bulk inserts
        rendered_sql = query
        prepared_args = args
    elif not args:
        # No substitution needed
        rendered_sql = query
    else:
        # Convert named dict args to ordered values
        rendered_sql = query
        prepared_args = args  # psycopg supports dict-based substitution

    formatted_sql = sqlparse.format(rendered_sql, strip_comments=True)

    if SHELL_PLUS_PRINT_SQL:
        current_app.logger.info('SQL => %s' % format_sql(formatted_sql))

    return formatted_sql, prepared_args


def format_sql(rendered_sql, colorize=True):
    """Format SQL queries for logging or debugging"""
    formatted_sql = sqlparse.format(rendered_sql, reindent_aligned=True)
    if colorize:
        try:
            import pygments.formatters
            import pygments.lexers

            return pygments.highlight(
                formatted_sql, pygments.lexers.get_lexer_by_name("sql"),
                pygments.formatters.TerminalFormatter()
            )
        except:
            pass

    return formatted_sql

