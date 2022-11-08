MONTH_SERIES = """SELECT addMonths(date_trunc('month', toDateTime(%(start)s, 'UTC')), number) AS month
FROM (SELECT arrayJoin(range(0, %(upperbound)d)) AS number)"""

WEEK_SERIES = """SELECT addWeeks(date_trunc('week', toDateTime(%(start)s, 'UTC')), number) AS week
FROM (SELECT arrayJoin(range(0,  %(upperbound)d)) AS number)"""

DAY_SERIES = """SELECT addDays(date_trunc('day', toDateTime(%(start)s, 'UTC')), number) AS day
FROM (SELECT arrayJoin(range(0, %(upperbound)d)) AS number)"""

HOUR_SERIES = """SELECT addHours(date_trunc('hour', toDateTime(%(start)s,'UTC')), number) AS hour
FROM (SELECT arrayJoin(range(0, %(upperbound)d)) AS number)"""

MINUTE_SERIES = """SELECT addMinutes(date_trunc('minute', toDateTime(%(start)s, 'UTC')), number) AS minute
FROM (SELECT arrayJoin(range(0, %(upperbound)d)) AS number)"""
