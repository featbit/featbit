from datetime import datetime, timedelta
from enum import Enum
from math import ceil
from typing import Iterable, Tuple

from app.clickhouse.client import sync_execute
from app.clickhouse.models.time_series.sql import (DAY_SERIES, HOUR_SERIES,
                                                   MINUTE_SERIES, MONTH_SERIES,
                                                   WEEK_SERIES)
from app.setting import CH_SIM_FMT


class FrequencyType(Enum):
    MONTH = 'month'
    WEEK = 'week'
    DAY = 'day'
    HOUR = 'hour'
    MINUTE = 'minute'


def time_series(start: datetime, end: datetime, freq: FrequencyType) -> Iterable[Tuple[datetime]]:
    def delta_time(delta: timedelta, base: int) -> int:
        return ceil(delta.total_seconds() / base)

    if not start or not end or start > end:
        return []

    query_params = {"start": start.strftime(CH_SIM_FMT)}
    delta = end - start
    if (freq == FrequencyType.MONTH):
        upper_bound = delta_time(delta, 86400 * 30)
        sql = MONTH_SERIES
    elif freq == FrequencyType.WEEK:
        upper_bound = delta_time(delta, 86400 * 7)
        sql = WEEK_SERIES
    elif freq == FrequencyType.HOUR:
        upper_bound = delta_time(delta, 3600) + 1
        sql = HOUR_SERIES
    elif freq == FrequencyType.MINUTE:
        upper_bound = delta_time(delta, 60) + 1
        sql = MINUTE_SERIES
    else:
        upper_bound = delta_time(delta, 86400)
        sql = DAY_SERIES
    query_params['upperbound'] = upper_bound
    return sync_execute(sql, args=query_params)
