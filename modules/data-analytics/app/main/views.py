
import json
from typing import Union

from flask import abort, current_app, jsonify, request

from app.clickhouse.models.event import bulk_create_events as bulk_create_events_ch
from app.extensions import get_cache
from app.main import get_main_blueprint
from app.main.models.statistics import (EndUserParams, EndUserStatistics,
                                        FeatureFlagIntervalStatistics,
                                        IntervalParams)
from app.mongodb.models.event import bulk_create_events as bulk_create_events_mongod
from app.setting import IS_PRO
from utils import internal_error_handler, to_md5_hexdigest

main = get_main_blueprint()
main.register_error_handler(500, internal_error_handler)


@main.route('', methods=['GET'])
def index():
    return jsonify(code=200, error='', data={'state': f'{current_app.config["ENV"]} OK'})


@main.route('/events', methods=['POST'])
def create_events():
    # this api is only for internal test, not use in prod
    json_str = request.get_data()
    try:
        if not json_str:
            raise ValueError('post body is empty')
        _create_events(json_str)
        return jsonify(code=200, error='', data={})
    except Exception as e:
        current_app.logger.exception('unexpected error occurs: %s' % str(e))
        abort(500, description=str(e))


def _create_events(json_events: Union[str, bytes]) -> None:
    events = json.loads(json_events)
    if IS_PRO:
        bulk_create_events_ch(events)
    else:
        bulk_create_events_mongod(events)


@main.route('/events/stat/<event>', methods=['POST'])
def get_event_stat(event: str):
    json_str = request.get_data()
    try:
        if not json_str:
            raise ValueError('post body is empty')
        cache_key = to_md5_hexdigest(json_str)
        data = get_cache().get(cache_key)
        if not data:
            params = json.loads(json_str)
            if event == 'featureflag':
                data = FeatureFlagIntervalStatistics(IntervalParams.from_properties(params)).get_results()
            elif event == 'enduser':
                data = EndUserStatistics(EndUserParams.from_properties(params)).get_results()
            else:
                raise NotImplementedError('event not supported')
            get_cache().set(cache_key, data, timeout=10)
        return jsonify(code=200, error='', data=data)
    except Exception as e:
        current_app.logger.exception('unexpected error occurs: %s' % str(e))
        abort(500, description=str(e))
