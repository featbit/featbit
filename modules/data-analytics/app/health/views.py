from app.health import get_health_blueprint
from flask import current_app, jsonify
from utils import internal_error_handler

health = get_health_blueprint()
health.register_error_handler(500, internal_error_handler)


@health.route('/liveness', methods=['GET'])
def get_liveness():
    return jsonify(code=200, error='', data={'state': f'{current_app.config["ENV"]} OK'})


@health.route('/readiness', methods=['GET'])
def get_readiness():
    return jsonify(code=200, error='', data={'state': f'{current_app.config["ENV"]} OK'})