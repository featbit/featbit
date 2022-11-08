from datetime import datetime
from itertools import groupby
from typing import Any, Dict, Iterable, Optional

from dateutil.parser import isoparse

from app.clickhouse.client import sync_execute
from app.clickhouse.models.time_series import FrequencyType, time_series
from app.main.models.statistics.feature_flag.sql import \
    GET_FLAG_EVENTS_BY_INTERVAL_SQL
from app.setting import CH_UTC_FMT

INTERVAL_PARAMS_NECESSARY_COLUMNS = ['flagExptId', 'envId', 'startTime', 'intervalType']


class IntervalParams:
    def __init__(self,
                 flag_id: str,
                 env_id: str,
                 start_time: str,
                 end_time: Optional[str] = None,
                 interval_type: str = "DAY"):
        self.__flag_id = flag_id
        self.__env_id = env_id
        self.__start = isoparse(start_time)
        self.__end = isoparse(end_time) if end_time else datetime.utcnow()
        self.__interval = FrequencyType[interval_type]

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

    @staticmethod
    def from_properties(properties: Dict[str, Any] = {}) -> "IntervalParams":
        assert all(key in properties for key in INTERVAL_PARAMS_NECESSARY_COLUMNS), "interval properties missing necessary columns"
        return IntervalParams(flag_id=properties['flagExptId'],
                              env_id=properties['envId'],
                              start_time=properties['startTime'],
                              end_time=properties.get('endTime', None),
                              interval_type=properties['intervalType'])


class FeatureFlagIntervalStatistics:
    def __init__(self, params: "IntervalParams"):
        self._params = params
        self._query_params = {
            'interval_type': params.interval.value,
            'flag_id': params.flag_id,
            'env_id': params.env_id,
            'start': params.start,
            'end': params.end
        }

    def get_results(self) -> Iterable[Dict[str, Any]]:

        def iter(groups):
            for ts in time_series(self._params.start, self._params.end, self._params.interval):
                ts_str = ts[0].strftime(CH_UTC_FMT)
                counts = groups.get(ts_str, [])
                yield {"time": ts_str, "variations": counts}

        counts_gen = ({"time": time.strftime(CH_UTC_FMT), "id": var_key, "val": count} for count, var_key, time in sync_execute(GET_FLAG_EVENTS_BY_INTERVAL_SQL, args=self._query_params))
        counts_by_group = dict((time, list(group)) for time, group in groupby(counts_gen, key=lambda x: x.pop("time")))
        return list(iter(counts_by_group))
