from app.clickhouse.models.event import event_table_name


USERS_SUBQUERY = """SELECT tag_0 AS user_key, tag_3 AS user_name, tag_1 AS variation, timestamp
FROM {table}
WHERE distinct_id = %(flag_id)s
AND event = 'FlagValue'
AND env_id = %(env_id)s
AND timestamp > %(start)s
AND timestamp < %(end)s
{variation_clause}
{user_clause}
ORDER BY timestamp DESC"""

VARIATION_CLAUSE = """AND tag_1 = %(variation)s"""
USER_CLAUSE = """AND (tag_0 like %(user_search_key)s OR tag_3 like %(user_search_key)s)"""

GET_USERS_STATISTICS_SQL = """WITH users_cte AS
(
{user_subquery}
)
SELECT count(user_key)
FROM users_cte
"""

GET_USERS_PAGENATION = """WITH users_cte AS
(
{user_subquery}
)
SELECT variation, user_key, any(user_name), max(timestamp) AS time
FROM users_cte
GROUP BY variation, user_key
ORDER BY time DESC
LIMIT %(limit)d OFFSET %(offset)d
"""


def _user_subquery_sql(has_variation: bool = False, has_user: bool = False) -> str:
    variation_clause = VARIATION_CLAUSE if has_variation else ""
    user_clause = USER_CLAUSE if has_user else ""
    return USERS_SUBQUERY.format(table=event_table_name(),
                                 variation_clause=variation_clause,
                                 user_clause=user_clause)


def count_user_sql(has_variation: bool = False, has_user: bool = False) -> str:
    return GET_USERS_STATISTICS_SQL.format(user_subquery=_user_subquery_sql(has_variation, has_user))


def get_users_sql(has_variation: bool = False, has_user: bool = False) -> str:
    return GET_USERS_PAGENATION.format(user_subquery=_user_subquery_sql(has_variation, has_user))
