from datetime import datetime, timedelta
from enum import Enum
from math import ceil

from app.clickhouse.client import sync_execute
from app.clickhouse.models.time_series.sql import (DAY_SERIES, HOUR_SERIES,
                                                   MINUTE_SERIES, MONTH_SERIES,
                                                   WEEK_SERIES)
from app.setting import DATE_SIM_FMT
from utils import time_to_special_tz


class FrequencyType(Enum):
    MONTH = 'month'
    WEEK = 'week'
    DAY = 'day'
    HOUR = 'hour'
    MINUTE = 'minute'


def time_series(utc_start: datetime,
                utc_end: datetime,
                localtz: str,
                freq: FrequencyType = FrequencyType.DAY):
    def delta_time(delta: timedelta, base: int) -> int:
        v = delta.total_seconds() / base
        return ceil(v + 1) if v % 1 == 0 else ceil(v)

    if utc_start > utc_end:
        return []
    delta = utc_end - utc_start
    query_params = {"start": time_to_special_tz(utc_start, localtz).strftime(DATE_SIM_FMT),
                    "tz": localtz}

    if (freq == FrequencyType.MONTH):
        upper_bound = delta_time(delta, 86400 * 30) + 1
        sql = MONTH_SERIES
    elif freq == FrequencyType.WEEK:
        upper_bound = delta_time(delta, 86400 * 7) + 1
        sql = WEEK_SERIES
    elif freq == FrequencyType.HOUR:
        upper_bound = delta_time(delta, 3600)
        sql = HOUR_SERIES
    elif freq == FrequencyType.MINUTE:
        upper_bound = delta_time(delta, 60)
        sql = MINUTE_SERIES
    else:
        upper_bound = delta_time(delta, 86400) + 1
        sql = DAY_SERIES
    query_params['upperbound'] = upper_bound
    for dt, *_ in sync_execute(sql, args=query_params):
        yield dt
