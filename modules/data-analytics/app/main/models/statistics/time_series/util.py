import pandas as pd

from datetime import datetime, timedelta
from enum import Enum
from math import ceil

from utils import time_to_special_tz


class FrequencyType(Enum):
    MONTH = 'month'
    WEEK = 'week'
    DAY = 'day'
    HOUR = 'hour'
    MINUTE = 'minute'


def generate_time_series(utc_start: datetime,
                         utc_end: datetime,
                         localtz: str,
                         freq_type: FrequencyType = FrequencyType.DAY):
    def delta_time(delta: timedelta, base: int) -> int:
        v = delta.total_seconds() / base
        return ceil(v + 1) if v % 1 == 0 else ceil(v)

    if utc_start > utc_end:
        return []
    delta = utc_end - utc_start
    start = time_to_special_tz(utc_start, localtz)

    if (freq_type == FrequencyType.MONTH):
        upper_bound = delta_time(delta, 86400 * 30) + 1
        freq = 'M'
    elif freq_type == FrequencyType.WEEK:
        upper_bound = delta_time(delta, 86400 * 7) + 1
        freq = 'W'
    elif freq_type == FrequencyType.HOUR:
        upper_bound = delta_time(delta, 3600)
        freq = 'H'
    elif freq_type == FrequencyType.MINUTE:
        upper_bound = delta_time(delta, 60)
        freq = 'T'
    else:
        upper_bound = delta_time(delta, 86400) + 1
        freq = 'D'

    for ts in pd.DataFrame(pd.date_range(start=start, periods=upper_bound, freq=freq, tz=localtz), columns=['timestamp']).values.tolist():
        yield ts[0].to_pydatetime()
