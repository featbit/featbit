from datetime import datetime, timedelta
from enum import Enum
from math import ceil

import pandas as pd


class FrequencyType(Enum):
    MONTH = 'month'
    WEEK = 'week'
    DAY = 'day'
    HOUR = 'hour'
    MINUTE = 'minute'


def date_trunc_format(freq: FrequencyType = FrequencyType.DAY, date_to_week_num=True) -> str:
    if freq == FrequencyType.MONTH:
        return '%Y-%m-01'
    elif freq == FrequencyType.WEEK:
        return '%G-%V-1' if date_to_week_num else '%G-%V-%u'
    elif freq == FrequencyType.DAY:
        return '%Y-%m-%d'
    elif freq == FrequencyType.HOUR:
        return '%Y-%m-%d %H:00:00'
    else:
        return '%Y-%m-%d %H:%M:00'


def date_trunc(df: pd.DataFrame,
               col: str,
               freq: FrequencyType = FrequencyType.DAY,
               from_tz='UTC',
               to_tz='UTC') -> pd.DataFrame:
    if not df.empty:
        # convert tz to get local time
        df[col] = df[col].dt.tz_localize(None)
        df[col] = df[col].dt.tz_localize(from_tz).dt.tz_convert(to_tz)
        # remove tz info before date trunc
        df[col] = df[col].dt.tz_localize(None)
        if freq == FrequencyType.MONTH:
            df[col] = df[col].dt.to_period('M').dt.start_time
        elif freq == FrequencyType.WEEK:
            df[col] = df[col].dt.to_period('W').dt.start_time
        elif freq == FrequencyType.DAY:
            df[col] = df[col].dt.to_period('D').dt.start_time
        elif freq == FrequencyType.HOUR:
            df[col] = df[col].dt.to_period('H').dt.start_time
        else:
            df[col] = df[col].dt.to_period('T').dt.start_time
        # add tz info after date trunc
        df[col] = df[col].dt.tz_localize(to_tz)
    return df


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

    df = pd.DataFrame(pd.date_range(start=utc_start, periods=upper_bound, freq=freq), columns=['timestamp'])
    df = date_trunc(df, 'timestamp', freq=freq_type, to_tz=localtz)

    for ts in df.values.tolist():
        yield ts[0].to_pydatetime()
