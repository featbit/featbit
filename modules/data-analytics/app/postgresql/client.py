import psycopg_pool
import sqlparse
from time import perf_counter
from typing import Any, Dict, List, Optional, Tuple, Union
from flask import current_app

from app.setting import SHELL_PLUS_PRINT_SQL, POSTGRES_CONNECTION_STRING, POSTGRES_DATABASE, POSTGRES_USER, \
    POSTGRES_PASSWORD, POSTGRES_HOST, POSTGRES_PORT

InsertParams = Union[List, Tuple]
NonInsertParams = Dict[str, Any]
QueryArgs = Optional[Union[InsertParams, NonInsertParams]]

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
            min_size=10,
            max_size=100,
        )

    return __pg_pool


def execute_query(query: str, args: QueryArgs = None, fetch_all=True):
    """Execute a SQL query using psycopg"""
    pool = create_pg_pool()

    with pool.connection() as conn:
        with conn.cursor() as cur:
            prepared_sql, prepared_args = _prepare_query(query, args)
            start_time = perf_counter()

            try:
                cur.execute(prepared_sql, prepared_args)
                result = cur.fetchall() if fetch_all else cur.fetchone()
            except Exception as err:
                raise err
            finally:
                execution_time = perf_counter() - start_time
                if SHELL_PLUS_PRINT_SQL:
                    current_app.logger.info("SQL execution time: %.6fs" % execution_time)

    return result


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

