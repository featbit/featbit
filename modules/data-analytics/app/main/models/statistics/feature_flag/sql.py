from typing import Any, Dict
from app.clickhouse.models.event import event_table_name
from app.main.models.statistics.time_series import date_trunc
from app.mongodb.models.event.util import get_events_sample_from_mongod


FLAG_EVENTS_BY_INTERVAL_CTE = f"""flag_events_by_interval as
(SELECT tag_0 AS target_user, tag_1 AS variation, date_trunc(%(interval_type)s, timestamp, %(tz)s) AS time
FROM {event_table_name()}
WHERE distinct_id = %(flag_id)s
AND event = 'FlagValue'
AND env_id = %(env_id)s
AND timestamp > %(start)s
AND timestamp < %(end)s
)"""

GET_FLAG_EVENTS_BY_INTERVAL_STATISTICS_SQL = """SELECT count(target_user), variation, time
FROM flag_events_by_interval
GROUP BY variation, time
ORDER BY variation
"""

GET_FLAG_EVENTS_BY_INTERVAL_SQL = f"""WITH
{FLAG_EVENTS_BY_INTERVAL_CTE}
{GET_FLAG_EVENTS_BY_INTERVAL_STATISTICS_SQL}
"""


def _query_ff_events_sample_from_mongod(query_params: Dict[str, Any]) -> Dict[str, Any]:
    return [
        {
            '$match': {
                'event': 'FlagValue',
                'env_id': query_params['env_id'],
                'distinct_id': query_params['flag_id'],
                'timestamp': {
                    '$gt': query_params['start'],
                    '$lt': query_params['end']
                }
            }
        }, {
            '$project': {
                '_id': 0,
                'timestamp': 1,
                'user_key': '$properties.userKeyId',
                'variation': '$properties.variationId'
            }
        }
    ]


def make_statistic_ff_events_from_mongod(query_params: Dict[str, Any]):
    df = get_events_sample_from_mongod(_query_ff_events_sample_from_mongod(query_params), cols=['timestamp', 'user_key', 'variation'])
    if df.empty:
        return []
    df = date_trunc(df, 'timestamp', freq=query_params['interval_type'], to_tz=query_params['tz'])
    df = df.groupby(['variation', 'timestamp']) \
        .agg(count=('user_key', 'count')) \
        .sort_values(['variation', 'timestamp']) \
        .reset_index()
    for count, var_key, time in df[['count', 'variation', 'timestamp']].values.tolist():
        yield count, var_key, time.to_pydatetime()
