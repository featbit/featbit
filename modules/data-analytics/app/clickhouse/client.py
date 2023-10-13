
import types
from time import perf_counter
from typing import Any, Dict, List, Optional, Tuple, Union

import sqlparse
from clickhouse_driver import Client as SyncClient
from clickhouse_pool import ChPool
from flask import current_app

from app.setting import (CLICKHOUSE_ALT_HOST, CLICKHOUSE_CA,
                         CLICKHOUSE_CONN_POOL_MAX, CLICKHOUSE_CONN_POOL_MIN,
                         CLICKHOUSE_DATABASE, CLICKHOUSE_HOST,
                         CLICKHOUSE_PASSWORD, CLICKHOUSE_PORT,
                         CLICKHOUSE_SECURE, CLICKHOUSE_USER, CLICKHOUSE_VERIFY,
                         SHELL_PLUS_PRINT_SQL, TEST)

InsertParams = Union[List, Tuple, types.GeneratorType]
NonInsertParams = Dict[str, Any]
QueryArgs = Optional[Union[InsertParams, NonInsertParams]]

__ch_pool = None


def _settings():
    kwargs = {
        "host": CLICKHOUSE_HOST,
        "port": CLICKHOUSE_PORT,
        "database": CLICKHOUSE_DATABASE,
        "secure": CLICKHOUSE_SECURE,
        "user": CLICKHOUSE_USER,
        "password": CLICKHOUSE_PASSWORD,
        "ca_certs": CLICKHOUSE_CA,
        "verify": CLICKHOUSE_VERIFY,
        "connections_min": CLICKHOUSE_CONN_POOL_MIN,
        "connections_max": CLICKHOUSE_CONN_POOL_MAX,
        "settings": {"mutations_sync": "1"} if TEST else {},
    }
    if CLICKHOUSE_ALT_HOST and CLICKHOUSE_ALT_HOST.strip():
        kwargs.update({"alt_hosts": CLICKHOUSE_ALT_HOST, "round_robin": True})
    return kwargs


def make_ch_pool(reload=False, **overrides) -> ChPool:
    global __ch_pool
    kwargs = {**_settings(), **overrides}
    if __ch_pool is None or reload:
        __ch_pool = ChPool(**kwargs)
    return __ch_pool


def make_ch_client() -> SyncClient:
    return SyncClient(**_settings())


def sync_execute(query, args=None, settings=None, with_column_types=False):

    with make_ch_pool().get_client() as client:
        prepared_sql, prepared_args = _prepare_query(client=client, query=query, args=args)
        start_time = perf_counter()
        try:
            result = client.execute(
                prepared_sql, params=prepared_args, settings=settings, with_column_types=with_column_types,
            )
        except Exception as err:
            raise err
        finally:
            execution_time = perf_counter() - start_time
            if SHELL_PLUS_PRINT_SQL:
                current_app.logger.info("SQL execution time: %.6fs" % (execution_time,))
    return result


def _prepare_query(client: SyncClient, query: str, args: QueryArgs):
    """
    Given a string query with placeholders we do one of two things:

        1. for a insert query we just format, and remove comments
        2. for non-insert queries, we return the sql with placeholders
        evaluated with the contents of `args`

    We also return `tags` which contains some detail around the context
    within which the query was executed e.g. the django view name

    NOTE: `client.execute` would normally handle substitution, but
    because we want to strip the comments to make it easier to copy
    and past queries from the `system.query_log` easily with metabase
    (metabase doesn't show new lines, so with comments, you can't get
    a working query without exporting to csv or similar), we need to
    do it manually.

    We only want to try to substitue for SELECT queries, which
    clickhouse_driver at this moment in time decides based on the
    below predicate.
    """
    prepared_args: Any = QueryArgs
    if isinstance(args, (List, Tuple, types.GeneratorType)):
        # If we get one of these it means we have an insert, let the clickhouse
        # client handle substitution here.
        rendered_sql = query
        prepared_args = args
    elif not args:
        # If `args` is not truthy then make prepared_args `None`, which the
        # clickhouse client uses to signal no substitution is desired. Expected
        # args balue are `None` or `{}` for instance
        rendered_sql = query
        prepared_args = None
    else:
        # Else perform the substitution so we can perform operations on the raw
        # non-templated SQL
        rendered_sql = client.substitute_params(query, args, client.connection.context)
        prepared_args = None

    formatted_sql = sqlparse.format(rendered_sql, strip_comments=True)

    if SHELL_PLUS_PRINT_SQL:
        current_app.logger.info('SQL => %s' % format_sql(formatted_sql))

    return formatted_sql, prepared_args


def format_sql(rendered_sql, colorize=True):
    formatted_sql = sqlparse.format(rendered_sql, reindent_aligned=True)
    if colorize:
        try:
            import pygments.formatters
            import pygments.lexers

            return pygments.highlight(
                formatted_sql, pygments.lexers.get_lexer_by_name("sql"), pygments.formatters.TerminalFormatter()
            )
        except:
            pass

    return formatted_sql
