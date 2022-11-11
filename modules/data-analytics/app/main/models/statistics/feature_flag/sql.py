from app.clickhouse.models.event import event_table_name


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
