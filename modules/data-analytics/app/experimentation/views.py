import json

from app.experimentation import get_expt_blueprint
from app.experimentation.models.experiment import (Experiment,
                                                   TrendsExperimentResult)
from flask import abort, current_app, jsonify, request
from app.extensions import get_cache
from utils import internal_error_handler, to_md5_hexdigest

expt = get_expt_blueprint()
expt.register_error_handler(500, internal_error_handler)


@expt.route('/results', methods=['POST'])
def get_result():
    json_str = request.get_data()
    try:
        if not json_str:
            raise ValueError('post body is empty')
        cache_key = to_md5_hexdigest(json_str)
        data = get_cache().get(cache_key)
        if not data:
            data = TrendsExperimentResult(Experiment.from_properties(json.loads(json_str))).get_results()
            get_cache().set(cache_key, data, timeout=10)
        return jsonify(code=200, error='', data=data)
    except Exception as e:
        current_app.logger.exception('unexpected error occurs: %s' % str(e))
        abort(500, description=str(e))
