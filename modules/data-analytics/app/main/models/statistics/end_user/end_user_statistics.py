from datetime import datetime
from typing import Any, Dict, Optional

from app.clickhouse.client import sync_execute
from app.main.models.statistics.end_user.sql import (
    count_and_list_user_from_mongodb, count_user_sql, get_users_sql)
from app.setting import DATE_ISO_FMT, DATE_UTC_FMT, IS_PRO
from utils import to_UTC_datetime

END_USER_PARAMS_NECESSARY_COLUMNS = ['flagExptId', 'envId', 'startTime']


class EndUserParams:
    def __init__(self,
                 flag_id: str,
                 env_id: str,
                 start_time: str,
                 end_time: Optional[str] = None,
                 variation: Optional[str] = None,
                 user_search_key: Optional[str] = None,
                 page: Optional[int] = 0,
                 limit: Optional[int] = 10):
        self.__flag_id = flag_id
        self.__env_id = env_id
        self.__start = to_UTC_datetime(start_time)
        self.__end = to_UTC_datetime(end_time) if end_time else datetime.utcnow()
        self.__variation = variation
        self.__user_search_key = f'%{user_search_key}%' if user_search_key else None
        self.__page = page if page is not None else 0
        self.__limit = limit if limit is not None else 10

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
    def page(self) -> int:
        return self.__page

    @property
    def limit(self) -> int:
        return self.__limit

    @property
    def variation(self) -> Optional[str]:
        return self.__variation

    @property
    def user_search_key(self) -> Optional[str]:
        return self.__user_search_key

    @staticmethod
    def from_properties(properties: Dict[str, Any] = {}) -> "EndUserParams":
        assert all(key in properties for key in END_USER_PARAMS_NECESSARY_COLUMNS), "end user properties missing necessary columns"
        return EndUserParams(flag_id=properties['flagExptId'],
                             env_id=properties['envId'],
                             start_time=properties['startTime'],
                             end_time=properties.get('endTime', None),
                             variation=properties.get('variationId', None),
                             user_search_key=properties.get('query', None),
                             page=properties.get('pageIndex', 0),
                             limit=properties.get('pageSize', 10))


class EndUserStatistics:
    def __init__(self, params: "EndUserParams"):
        if IS_PRO:
            start = params.start.strftime(DATE_ISO_FMT)
            end = params.end.strftime(DATE_ISO_FMT)
        else:
            start = params.start
            end = params.end
        self._params = params
        self._query_params = {
            'flag_id': params.flag_id,
            'env_id': params.env_id,
            'start': start,
            'end': end,
            'limit': params.limit,
            'offset': params.limit * params.page
        }
        if params.variation:
            self._query_params['variation'] = params.variation
        if params.user_search_key:
            self._query_params['user_search_key'] = params.user_search_key

    def get_results(self) -> Dict[str, Any]:
        has_variation = 'variation' in self._query_params
        has_user = 'user_search_key' in self._query_params

        if IS_PRO:
            for res in sync_execute(count_user_sql(has_variation, has_user), args=self._query_params):  # type: ignore
                user_count = res[0]
            rs = sync_execute(get_users_sql(has_variation, has_user), args=self._query_params)
        else:
            user_count, rs = count_and_list_user_from_mongodb(self._query_params, has_variation=has_variation, has_user=has_user)

        items = [{"variationId": var_key, "keyId": user_key, "name": user_name, "lastEvaluatedAt": time.strftime(DATE_UTC_FMT)}
                 for var_key, user_key, user_name, time in rs]  # type: ignore
        return {"totalCount": user_count,  # type: ignore
                "items": items}
