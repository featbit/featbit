from typing import Any, Dict, Iterable

from app.clickhouse.client import sync_execute
from app.experimentation.models.event.sql import (
    GET_BINOMIAL_TEST_VARS_SQL, GET_NUMERIC_TEST_VARS_SQL,
    cal_experiment_vars_from_mongod)
from app.experimentation.models.experiment import Experiment, Variation
from app.experimentation.models.experiment.experiment_types import (
    BinomialVariation, FrequenstSettings, NumericVariation, OnlineTTest,
    TTestResult)
from app.setting import DATE_ISO_FMT, DATE_UTC_FMT, IS_PRO


def analyze_experiment(experiment: Experiment):
    if IS_PRO:
        start = experiment.start.strftime(DATE_ISO_FMT)
        end = experiment.end.strftime(DATE_ISO_FMT)
    else:
        start = experiment.start
        end = experiment.end
    query_params = {
        "flag_id": experiment.flag_id,
        "event_name": experiment.event_name,
        "event": experiment.event_type,
        "env_id": experiment.env_id,
        "start": start,
        "end": end
    }

    settings = FrequenstSettings()
    if (alpha := experiment.extra_prop('alpha')):
        settings.alpha = alpha
    if (pw := experiment.extra_prop('power')):
        settings.power = pw
    vars = _get_variations(experiment, query_params)
    control = vars.get(experiment.baseline)
    res = [OnlineTTest(control=control,  # type: ignore
                       traitement=traitement,
                       is_baseline=(traitement.var_id == experiment.baseline),
                       settings=settings).get_result() for traitement in vars.values()]

    outputs = [r.output for r in _cal_winner_for_each_variation_result(res, experiment)]
    return {
        'exptId': experiment.id,
        'eventType': experiment.event_numeric_type,
        'customEventTrackOption': experiment.extra_prop('customEventTrackOption', None),
        'customEventUnit' : experiment.extra_prop('customEventUnit', None),
        'customEventSuccessCriteria': experiment.extra_prop('customEventSuccessCriteria', None),
        'iterationId': experiment.extra_prop('iterationId', None),
        'startTime': experiment.start.strftime(DATE_UTC_FMT),
        'endTime': experiment.end.strftime(DATE_UTC_FMT) if experiment.is_finished else None,
        'isFinish': experiment.is_finished,
        'alpha': settings.alpha,
        'power': settings.power,
        'results': outputs
    }


def _get_variations(experiment: Experiment, query_params: Dict[str, Any]) -> Dict[str, Variation]:
    binomial_test = not experiment.is_numeric_expt
    if IS_PRO:
        sql = GET_BINOMIAL_TEST_VARS_SQL if binomial_test else GET_NUMERIC_TEST_VARS_SQL
        rs = sync_execute(sql, args=query_params)
    else:
        rs = cal_experiment_vars_from_mongod(query_params, binomial_test)
    vars = {}
    if binomial_test:
        for count, exposure, var_key in rs:  # type: ignore
            vars[var_key] = BinomialVariation(var_id=var_key, count=count, sum=exposure)
    else:
        for count, exposure, mean_sample, var_sample, var_key in rs:  # type: ignore
            vars[var_key] = NumericVariation(var_id=var_key, count=count, sum=exposure, mean_sample=mean_sample, variance_sample=var_sample)
    for var_key in experiment.variations:
        if var_key not in vars:
            vars[var_key] = BinomialVariation(var_id=var_key, count=0, sum=0) if binomial_test else NumericVariation(var_id=var_key, count=0, sum=0, mean_sample=0, variance_sample=0)
    return vars


def _cal_winner_for_each_variation_result(var_results: Iterable[TTestResult], experiment: Experiment) -> Iterable[TTestResult]:
    valid_results, invalid_results = [], []
    for result in var_results:
        if result.is_significant:
            valid_results.append(result)
        else:
            invalid_results.append(result)
    sorted_valid_results = sorted(valid_results, key=lambda r: r.delta)
    if sorted_valid_results:
        if experiment.extra_prop('customEventSuccessCriteria', 1) == 2 and sorted_valid_results[0].delta < 0:
            sorted_valid_results[0].is_winner = True
        elif sorted_valid_results[-1].delta > 0:
            sorted_valid_results[-1].is_winner = True
    return sorted_valid_results + invalid_results
