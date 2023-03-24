from typing import Any, Dict, Iterable, List, Tuple

import pandas as pd

from app.clickhouse.models.event.sql import event_table_name
from app.mongodb.db import get_db
from app.setting import MONGO_DB_EVENTS_COLLECTION

FLAG_EVENTS_CTE = f"""flag_events as
(
SELECT tag_0 AS target_user, tag_1 AS variation
FROM {event_table_name()}
WHERE distinct_id = %(flag_id)s
AND event = 'FlagValue'
AND env_id = %(env_id)s
AND timestamp > %(start)s
AND timestamp < %(end)s
AND tag_2 = 'true'
)"""

CUSTOM_EVENTS_CTE = f"""custom_events as
(
SELECT tag_0 AS target_user, tag_0 AS exposure_user
FROM {event_table_name()}
WHERE distinct_id = %(event_name)s
AND event = %(event)s
AND env_id = %(env_id)s
AND timestamp > %(start)s
AND timestamp < %(end)s
)"""

CUSTOM_EVENTS_WITH_WEIGHT_CTE = f"""custom_events as
(
SELECT tag_0 AS target_user, toFloat64(tag_1) AS exposure_weight
FROM {event_table_name()}
WHERE distinct_id = %(event_name)s
AND event = %(event)s
AND env_id = %(env_id)s
AND timestamp > %(start)s
AND timestamp < %(end)s
)"""

VARIATION_CTE = """variations as
(
SELECT target_user, any(if(empty(exposure_user),0,1.0)) AS exposure_weight, variation
FROM flag_events GLOBAL LEFT JOIN custom_events USING target_user
GROUP BY target_user, variation
)"""

VARIATION_WITH_WEIGHT_CTE = """variations as
(
SELECT target_user, avg(exposure_weight) AS exposure_weight, variation
FROM flag_events GLOBAL INNER JOIN custom_events USING target_user
GROUP BY target_user, variation
)"""

GET_VARS_SQL = """SELECT uniq(target_user), sum(exposure_weight), avg(exposure_weight), stddevSamp(exposure_weight), variation
FROM variations
GROUP BY variation
ORDER BY variation"""


GET_PROP_ZTEST_VARS_SQL = f"""WITH
{FLAG_EVENTS_CTE},
{CUSTOM_EVENTS_CTE},
{VARIATION_CTE}
{GET_VARS_SQL}"""

GET_TTEST_VARS_SQL = f"""WITH
{FLAG_EVENTS_CTE},
{CUSTOM_EVENTS_WITH_WEIGHT_CTE},
{VARIATION_WITH_WEIGHT_CTE}
{GET_VARS_SQL}"""


def _get_events_sample_from_mongod(query_params: Dict[str, Any],
                                   kind: str = 'featureflag',
                                   cols: Iterable[str] = []) -> pd.DataFrame:
    if kind == 'featureflag':
        query = [
            {
                '$match': {
                    'event': 'FlagValue',
                    'env_id': query_params['env_id'],
                    'distinct_id': query_params['flag_id'],
                    'timestamp': {
                        '$gt': query_params['start'],
                        '$lt': query_params['end']
                    },
                    "properties.sendToExperiment": True
                }
            }, {
                '$project': {
                    '_id': 0,
                    'timestamp': 1,
                    'user_key': '$properties.userKeyId',
                    'user_name': '$properties.userName',
                    'variation': '$properties.variationId'
                }
            }
        ]
    else:
        query = [
            {
                '$match': {
                    'event': query_params['event'],
                    'env_id': query_params['env_id'],
                    'distinct_id': query_params['event_name'],
                    'timestamp': {
                        '$gt': query_params['start'],
                        '$lt': query_params['end']
                    },
                }
            }, {
                '$project': {
                    '_id': 0,
                    'timestamp': 1,
                    'user_key': '$properties.user.keyId',
                    'user_name': '$properties.user.name',
                    'weight': '$properties.numericValue'
                }
            }
        ]
    db = get_db()
    df = pd.DataFrame(list(db[MONGO_DB_EVENTS_COLLECTION].aggregate(query)))
    if len(cols) > 0:
        df = df[cols]
    return df


def cal_experiment_vars_from_mongod(query_params: Dict[str, Any], props_test: bool) -> List[Tuple]:
    df_ff_events = _get_events_sample_from_mongod(query_params, kind='featureflag', cols=['user_key', 'variation'])
    df_metric_events = _get_events_sample_from_mongod(query_params, kind='metric', cols=['user_key', 'weight'])
    if props_test:
        df_metric_events["weight"] = 1.0

    df = df_ff_events.merge(df_metric_events, on='user_key', how='left') \
        .fillna(0) \
        .groupby(['user_key', 'variation']).mean() \
        .reset_index()

    df = df.groupby('variation') \
        .agg(uniq=('user_key', lambda x: float(x.nunique())), sum=('weight', lambda x: x.sum()),
             avg=('weight', lambda x: x.mean()), stddev=('weight', lambda x: x.std(ddof=1))) \
        .sort_values('variation') \
        .reset_index()
    return [tuple(row) for row in df[['uniq', 'sum', 'avg', 'stddev', 'variation']].values.tolist()]
