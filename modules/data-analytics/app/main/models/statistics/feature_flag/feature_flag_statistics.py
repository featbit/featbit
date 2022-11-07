from datetime import datetime
from enum import Enum
from itertools import groupby
from typing import Any, Dict, Optional

from dateutil.parser import isoparse

from app.clickhouse.client import sync_execute
from app.main.models.statistics.feature_flag.sql import GET_FLAG_EVENTS_BY_INTERVAL_SQL
from utils import to_epoch_millis


class IntervalType(Enum):
    MONTH = 'month'
    WEEK = 'week'
    DAY = 'day'
    HOUR = 'hour'
    MINUTE = 'minute'


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
        self.__interval = IntervalType[interval_type].value

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
    def interval(self) -> str:
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
            'interval_type': params.interval,
            'flag_id': params.flag_id,
            'env_id': params.env_id,
            'start': params.start,
            'end': params.end
        }

    def get_results(self) -> Dict[int, Any]:
        def iter():
            for count, var_key, time in sync_execute(GET_FLAG_EVENTS_BY_INTERVAL_SQL, args=self._query_params):
                yield {"time": to_epoch_millis(time), "id": var_key, "val": count}

        return [{"time": time, "variations": list(group)}for time, group in groupby(iter(), key=lambda x: x.pop("time"))]
