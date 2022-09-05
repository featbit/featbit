
import json

from app.clickhouse.models.event import bulk_create_events
from app.main import get_main_blueprint
from flask import abort, current_app, jsonify, request
from utils import internal_error_handler

main = get_main_blueprint()
main.register_error_handler(500, internal_error_handler)


@main.route('', methods=['GET'])
def index():
    return jsonify(code=200, error='', data={'state': f'{current_app.config["ENV"]} OK'})


@main.route('/events', methods=['POST'])
def create_events():
    json_str = request.get_data()
    try:
        events = json.loads(json_str)
        bulk_create_events(events)
        return jsonify(code=200, error='', data={})
    except Exception as e:
        current_app.logger.exception('unexpected error occurs: %s' % str(e))
        abort(500, description=str(e))
