from app.clickhouse.models.event.sql import event_table_name

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
SELECT tag_0 AS target_user, toInt64(tag_1) AS exposure_weight
FROM {event_table_name()}
WHERE distinct_id = %(event_name)s
AND event = %(event)s
AND env_id = %(env_id)s
AND timestamp > %(start)s
AND timestamp < %(end)s
)"""

VARIATION_CTE = """variations as
(
SELECT target_user, any(if(empty(exposure_user),0,1)) AS exposure_weight, variation
FROM flag_events GLOBAL LEFT JOIN custom_events USING target_user
GROUP BY target_user, variation
)"""

VARIATION_WITH_WEIGHT_CTE = """variations as
(
SELECT target_user, any(exposure_weight) AS exposure_weight, variation
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
