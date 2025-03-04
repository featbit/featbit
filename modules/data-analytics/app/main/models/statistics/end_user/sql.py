from typing import Any, Dict, List

from app.clickhouse.models.event import event_table_name
from app.mongodb.models.event import get_events_sample_from_mongod

# Clickhouse
USERS_SUBQUERY_CH = """SELECT tag_0 AS user_key, tag_3 AS user_name, tag_1 AS variation, timestamp
FROM {table}
WHERE distinct_id = %(flag_id)s
AND event = 'FlagValue'
AND env_id = %(env_id)s
AND timestamp > %(start)s
AND timestamp < %(end)s
{variation_clause}
{user_clause}
ORDER BY timestamp DESC"""

VARIATION_CLAUSE_CH = """AND tag_1 = %(variation)s"""
USER_CLAUSE_CH = """AND (tag_0 ILIKE %(user_search_key)s OR tag_3 ILIKE %(user_search_key)s)"""

GET_USERS_STATISTICS_SQL_CH = """WITH users_cte AS
(
{user_subquery}
),
uniq_user_cte AS
(
SELECT uniq(user_key) AS uniq_user
FROM users_cte
GROUP BY variation, user_key
)
select sum(uniq_user)
from uniq_user_cte
"""

GET_USERS_PAGENATION_CH = """WITH users_cte AS
(
{user_subquery}
)
SELECT variation, user_key, any(user_name), max(timestamp) AS time
FROM users_cte
GROUP BY variation, user_key
ORDER BY time DESC
LIMIT %(limit)d OFFSET %(offset)d
"""

def _user_subquery_sql_ch(has_variation: bool = False, has_user: bool = False) -> str:
    variation_clause = VARIATION_CLAUSE_CH if has_variation else ""
    user_clause = USER_CLAUSE_CH if has_user else ""
    return USERS_SUBQUERY_CH.format(table=event_table_name(),
                                 variation_clause=variation_clause,
                                 user_clause=user_clause)


def count_user_sql_ch(has_variation: bool = False, has_user: bool = False) -> str:
    return GET_USERS_STATISTICS_SQL_CH.format(user_subquery=_user_subquery_sql_ch(has_variation, has_user))


def get_users_sql_ch(has_variation: bool = False, has_user: bool = False) -> str:
    return GET_USERS_PAGENATION_CH.format(user_subquery=_user_subquery_sql_ch(has_variation, has_user))

# Postgres
VARIATION_CLAUSE_PG = """AND properties->>'tag_1' = %(variation)s"""
USER_CLAUSE_PG = """AND (properties->>'tag_0' ILIKE %(user_search_key)s OR properties->>'tag_3' ILIKE %(user_search_key)s)"""

USERS_SUBQUERY_PG = """SELECT properties->>'tag_0' AS user_key, properties->>'tag_3' AS user_name, properties->>'tag_1' AS variation, timestamp
FROM events
WHERE distinct_id = %(flag_id)s
AND event = 'FlagValue'
AND env_id = %(env_id)s
AND timestamp > %(start)s
AND timestamp < %(end)s
{variation_clause}
{user_clause}
ORDER BY timestamp DESC"""

GET_USERS_STATISTICS_SQL_PG = """WITH users_cte AS
(
{user_subquery}
),
uniq_user_cte AS
(
SELECT COUNT(DISTINCT user_key) AS uniq_user
FROM users_cte
GROUP BY variation, user_key
)
select sum(uniq_user)
from uniq_user_cte
"""


GET_USERS_PAGENATION_PG = """WITH users_cte AS
(
{user_subquery}
)
SELECT variation, user_key, max(user_name), max(timestamp) AS time
FROM users_cte
GROUP BY variation, user_key
ORDER BY time DESC
LIMIT %(limit)s OFFSET %(offset)s
"""

def _user_subquery_sql_pg(has_variation: bool = False, has_user: bool = False) -> str:
    variation_clause = VARIATION_CLAUSE_PG if has_variation else ""
    user_clause = USER_CLAUSE_PG if has_user else ""
    return USERS_SUBQUERY_PG.format(variation_clause=variation_clause, user_clause=user_clause)

def count_user_sql_pg(has_variation: bool = False, has_user: bool = False) -> str:
    return GET_USERS_STATISTICS_SQL_PG.format(user_subquery=_user_subquery_sql_pg(has_variation, has_user))

def get_users_sql_pg(has_variation: bool = False, has_user: bool = False) -> str:
    return GET_USERS_PAGENATION_PG.format(user_subquery=_user_subquery_sql_pg(has_variation, has_user))

# MongoDB
def _query_ff_events_sample_from_mongod(query_params: Dict[str, Any], has_variation: bool = False, has_user: bool = False) -> List[Dict[str, Any]]:
    match = {
        'event': 'FlagValue',
        'env_id': query_params['env_id'],
        'distinct_id': query_params['flag_id'],
        'timestamp': {
            '$gt': query_params['start'],
            '$lt': query_params['end']
        }
    }
    if has_variation:
        match['properties.variationId'] = query_params['variation']
    if has_user:
        match['$or'] = [
            {'properties.userKeyId': {'$regex': query_params['user_search_key'], '$options': 'i'}},
            {'properties.userName': {'$regex': query_params['user_search_key'], '$options': 'i'}}
        ]
    project = {
        '_id': 0,
        'timestamp': 1,
        'user_key': '$properties.userKeyId',
        'user_name': '$properties.userName',
        'variation': '$properties.variationId'
    }
    return [{'$match': match}, {'$project': project}, {'$sort': {'timestamp': -1}}]


def count_and_list_user_from_mongodb(query_params: Dict[str, Any], has_variation: bool = False, has_user: bool = False) :
    df = get_events_sample_from_mongod(_query_ff_events_sample_from_mongod(query_params, has_variation, has_user), cols=['user_key', 'user_name', 'variation', 'timestamp'])
    if df.empty:
        return 0, []
    num = df[['variation', 'user_key']].groupby(['variation', 'user_key']).agg(uniq=('user_key', 'nunique')).reset_index().loc[:, ['uniq']].sum().values[0]
    lower = query_params['offset']
    upper = query_params['offset'] + query_params['limit']
    df = df.groupby(['variation', 'user_key']) \
        .agg(user_name=('user_name', 'first'), timestamp=('timestamp', 'max')) \
        .sort_values('timestamp', ascending=False)[lower:upper] \
        .reset_index()
    users = [(var_key, user_key, user_name, time.to_pydatetime()) for var_key, user_key, user_name, time in df.values.tolist()]
    return num.item(), users
