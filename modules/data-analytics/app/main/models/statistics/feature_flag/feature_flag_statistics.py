from datetime import datetime
from itertools import groupby
from typing import Any, Dict, Iterable, Optional

from app.clickhouse.client import sync_execute
from app.main.models.statistics.feature_flag.sql import (
    GET_FLAG_EVENTS_BY_INTERVAL_SQL, make_statistic_ff_events_from_mongod)
from app.main.models.statistics.time_series import (FrequencyType,
                                                    generate_time_series)
from app.setting import DATE_ISO_FMT, DATE_UTC_FMT, IS_PRO
from utils import time_to_special_tz, to_UTC_datetime

INTERVAL_PARAMS_NECESSARY_COLUMNS = ['flagExptId', 'envId', 'startTime', 'intervalType']


class IntervalParams:
    def __init__(self,
                 flag_id: str,
                 env_id: str,
                 start_time: str,
                 end_time: Optional[str] = None,
                 interval_type: str = "DAY",
                 timezone: Optional[str] = "UTC"):
        self.__flag_id = flag_id
        self.__env_id = env_id
        self.__start = to_UTC_datetime(start_time)
        self.__end = to_UTC_datetime(end_time) if end_time else time_to_special_tz(datetime.utcnow(), 'UTC')
        self.__interval = FrequencyType[interval_type]
        self.__tz = timezone if timezone else 'UTC'

    @property
    def flag_id(self) -> str:
        return self.__flag_id

    @property
    def env_id(self) -> str:
        return self.__env_id

    @property
    def start(self) -> datetime:
        return self.__start

    @property
    def end(self) -> datetime:
        return self.__end

    @property
    def interval(self) -> FrequencyType:
        return self.__interval

    @property
    def timezone(self) -> str:
        return self.__tz

    @staticmethod
    def from_properties(properties: Dict[str, Any] = {}) -> "IntervalParams":
        assert all(key in properties for key in INTERVAL_PARAMS_NECESSARY_COLUMNS), "interval properties missing necessary columns"
        return IntervalParams(flag_id=properties['flagExptId'],
                              env_id=properties['envId'],
                              start_time=properties['startTime'],
                              end_time=properties.get('endTime', None),
                              interval_type=properties['intervalType'],
                              timezone=properties.get('timezone', 'UTC'))


class FeatureFlagIntervalStatistics:
    def __init__(self, params: "IntervalParams"):
        if IS_PRO:
            interval_type = params.interval.value
            start = params.start.strftime(DATE_ISO_FMT)
            end = params.end.strftime(DATE_ISO_FMT)
        else:
            interval_type = params.interval
            start = params.start
            end = params.end
        self._params = params
        self._query_params = {
            'interval_type': interval_type,
            'flag_id': params.flag_id,
            'env_id': params.env_id,
            'start': start,
            'end': end,
            'tz': params.timezone
        }

    def get_results(self) -> Iterable[Dict[str, Any]]:

        def handle_time(time):
            return time_to_special_tz(time_to_special_tz(time, self._params.timezone), 'UTC')

        def iter(groups):
            for ts in generate_time_series(self._params.start, self._params.end, self._params.timezone, self._params.interval):
                ts_str = handle_time(ts).strftime(DATE_UTC_FMT)
                counts = groups.get(ts_str, [])
                yield {"time": ts_str, "variations": counts}

        if IS_PRO:
            rs = sync_execute(GET_FLAG_EVENTS_BY_INTERVAL_SQL, args=self._query_params)
        else:
            rs = make_statistic_ff_events_from_mongod(self._query_params)
        counts_gen = ({"time": handle_time(time).strftime(DATE_UTC_FMT), "id": var_key, "val": count}
                      for count, var_key, time in rs)  # type: ignore
        counts_by_group = dict((time, list(group)) for time, group in groupby(sorted(counts_gen, key=lambda x: x["time"]), key=lambda x: x.pop("time")))
        return list(iter(counts_by_group))
