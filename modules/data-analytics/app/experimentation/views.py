import json

from app.experimentation import get_expt_blueprint
from app.experimentation.models.experiment import (Experiment,
                                                   TrendsExperimentResult)
from flask import abort, current_app, jsonify, request
from utils import internal_error_handler

expt = get_expt_blueprint()
expt.register_error_handler(500, internal_error_handler)


@expt.route('/results', methods=['POST'])
def get_result():
    json_str = request.get_data()
    try:
        if not json_str:
            raise ValueError('post body is empty')
        expt = Experiment.from_properties(json.loads(json_str))
        return jsonify(code=200, error='', data=TrendsExperimentResult(expt).get_results())
    except Exception as e:
        current_app.logger.exception('unexpected error occurs: %s' % str(e))
        abort(500, description=str(e))
