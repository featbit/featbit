from typing import Any, Dict, List

import pandas as pd

from app.clickhouse.models.event import event_table_name
from app.main.models.statistics.time_series import date_trunc_format
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


def _query_ff_events_stat_from_mongod(query_params: Dict[str, Any], format: str) -> List[Dict[str, Any]]:
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
                'timestamp': {
                    '$dateToString': {
                        'date': '$timestamp',
                        'timezone': query_params['tz'],
                        'format': format
                    }
                },
                'user_key': '$properties.userKeyId',
                'variation': '$properties.variationId'
            }
        }, {
            '$group': {
                '_id': {'variation': '$variation', 'timestamp': '$timestamp'},
                'count': {'$sum': 1}
            }
        }, {
            '$project': {
                '_id': 0,
                'count': 1,
                'variation': '$_id.variation',
                'timestamp': '$_id.timestamp',
            }
        }
    ]


def make_statistic_ff_events_from_mongod(query_params: Dict[str, Any]):
    format = date_trunc_format(query_params['interval_type'])
    df = get_events_sample_from_mongod(_query_ff_events_stat_from_mongod(query_params, format), cols=['count', 'variation', 'timestamp'])
    if df.empty:
        return []
    format = date_trunc_format(query_params['interval_type'], date_to_week_num=False)
    df['timestamp'] = pd.to_datetime(df['timestamp'], format=format)
    df['timestamp'] = df['timestamp'].dt.tz_localize(query_params['tz'])
    df = df.sort_values(['variation', 'timestamp'])
    for count, var_key, time in df[['count', 'variation', 'timestamp']].values.tolist():
        yield count, var_key, time.to_pydatetime()
