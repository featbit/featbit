import math
from typing import Any, Dict, Iterable, Optional

from scipy.stats import ttest_ind_from_stats
from statsmodels.stats.power import (NormalIndPower, TTestIndPower,
                                     tt_ind_solve_power, zt_ind_solve_power)
from statsmodels.stats.proportion import (proportion_effectsize,
                                          proportions_ztest)

from app.clickhouse.client import sync_execute
from app.experimentation.models.event.sql import (
    GET_PROP_ZTEST_VARS_SQL, GET_TTEST_VARS_SQL,
    cal_experiment_vars_from_mongod)
from app.experimentation.models.experiment import Experiment, Variation
from app.setting import DATE_ISO_FMT, DATE_UTC_FMT, IS_PRO
from utils import format_float_positional


class TrendsExperimentResult:
    default_alpha = 0.05
    default_power = 0.8

    def __init__(self, experiment: Experiment):
        if IS_PRO:
            start = experiment.start.strftime(DATE_ISO_FMT)
            end = experiment.end.strftime(DATE_ISO_FMT)
        else:
            start = experiment.start
            end = experiment.end
        self._expt = experiment
        self._query_params = {
            "flag_id": experiment.flag_id,
            "event_name": experiment.event_name,
            "event": experiment.event_type,
            "env_id": experiment.env_id,
            "start": start,
            "end": end
        }

    def get_results(self) -> Dict[str, Any]:
        output = self._cal_normal_results()
        return {
            'exptId': self._expt.id,
            'eventType': self._expt.event_numeric_type,
            'customEventTrackOption': self._expt.extra_prop('customEventTrackOption', None),
            'customEventUnit' : self._expt.extra_prop('customEventUnit', None),
            'customEventSuccessCriteria': self._expt.extra_prop('customEventSuccessCriteria', None),
            'iterationId': self._expt.extra_prop('iterationId', None),
            'startTime': self._expt.start.strftime(DATE_UTC_FMT),
            'endTime': self._expt.end.strftime(DATE_UTC_FMT) if self._expt.is_finished else None,
            'isFinish': self._expt.is_finished,
            'results': output
        }

    def _cal_normal_results(self) -> Dict[str, Any]:

        def standard_output(variation: Variation,
                            baseline: str,
                            change_to_baseline: Optional[float],
                            p_value: Optional[float],
                            is_winner: bool = False,
                            is_result_invalid: bool = True):

            if self._expt.is_numeric_expt:
                output = {'variationId': variation.key,
                          'totalEvents': int(variation.count) if variation.count is not None else None,
                          'average': format_float_positional(variation.mean) if variation.mean is not None else None
                          }
            else :
                output = {'variationId': variation.key,
                          'conversion': int(variation.exposure) if variation.exposure is not None else None,
                          'uniqueUsers': int(variation.count) if variation.count is not None else None,
                          'conversionRate': format_float_positional(variation.mean) if variation.mean is not None else None
                          }
            return {**output,
                    'changeToBaseline': change_to_baseline,
                    'confidenceInterval': variation.confidence_interval,
                    'pValue': format_float_positional(p_value) if p_value is not None else None,
                    'isBaseline': variation.key == baseline,
                    'isWinner': is_winner,
                    'isInvalid': is_result_invalid}

        variations: Dict[str, Variation] = self._get_variations(alpha=self.default_alpha)
        output = [standard_output(Variation(var), self._expt.baseline, None, None, False, True) for var in self._expt.variations if var not in variations.keys()]

        baseline_var = variations.get(self._expt.baseline, None)
        if baseline_var is None or baseline_var.mean == 0:
            for variation in variations.values():
                output.append(standard_output(variation, self._expt.baseline, None, None, False, True))
        else:
            for variation in variations.values():
                change_to_baseline = variation.mean - baseline_var.mean if self._expt.is_numeric_expt else (variation.mean - baseline_var.mean) / baseline_var.mean  # type: ignore
                p_value = self._p_value(baseline_var, variation) if variation.exposure > 0 else None  # type: ignore
                is_result_invalid = not self._variation_valid(baseline_var, variation, p_value, alpha=self.default_alpha) if variation.exposure > 0 else True  # type: ignore
                output.append(standard_output(variation, self._expt.baseline, change_to_baseline, p_value, False, is_result_invalid))
        return self._cal_winner_for_each_variation_result(output)  # type: ignore

    def _get_variations(self, alpha=default_alpha) -> Dict[str, Variation]:
        props_test = not self._expt.is_numeric_expt
        if IS_PRO:
            sql = GET_PROP_ZTEST_VARS_SQL if props_test else GET_TTEST_VARS_SQL
            rs = sync_execute(sql, args=self._query_params)
        else:
            rs = cal_experiment_vars_from_mongod(self._query_params, props_test)
        return dict((var_key, Variation(key=var_key, count=count, exposure=exposure, mean_sample=mean_sample, stdev_sample=stdev_sample, alpha=alpha, proportions_test=props_test))
                    for count, exposure, mean_sample, stdev_sample, var_key in rs)  # type: ignore

    def _ztest_p_value(self, baseline_var: Variation, test_var: Variation) -> float:
        _, p_value = proportions_ztest([baseline_var.exposure, test_var.exposure], [baseline_var.count, test_var.count], alternative='two-sided', prop_var=False)
        return p_value  # type: ignore

    def _ttest_p_value(self, baseline_var: Variation, test_var: Variation) -> float:
        _, p_value = ttest_ind_from_stats(baseline_var.mean, baseline_var.stdev, baseline_var.count, test_var.mean, test_var.stdev, test_var.count,
                                          equal_var=True, alternative='two-sided')
        return p_value

    def _p_value(self, baseline_var: Variation, test_var: Variation) -> Optional[float]:
        p_value_func = self._ttest_p_value if self._expt.is_numeric_expt else self._ztest_p_value
        p_value = p_value_func(baseline_var, test_var)
        return None if math.isnan(p_value) else p_value

    def _effect_size(self, baseline_var: Variation, test_var: Variation) -> float:
        if self._expt.is_numeric_expt:
            # simple version base on http://www.bwgriffin.com/gsu/courses/edur9131/content/Effect_Sizes_pdf5.pdf
            s_pool = math.sqrt((baseline_var.stdev**2 + test_var.stdev**2) / 2)  # type: ignore
            return (test_var.mean - baseline_var.mean) / s_pool if s_pool != 0 else 0  # type: ignore
        # https://www.statmethods.net/stats/power.html
        return proportion_effectsize(prop1=baseline_var.mean, prop2=test_var.mean)

    def _variation_valid(self,
                         baseline_var: Variation,
                         test_var: Variation,
                         p_value: Optional[float],
                         alpha: float = default_alpha) -> bool:
        sample_size = min(baseline_var.count, test_var.count)  # type: ignore
        ratio_power = test_var.count / baseline_var.count  # type: ignore
        if not (stat_power := self._expt.extra_prop('power', None)):
            stat_power = self.default_power
            effect = self._effect_size(baseline_var, test_var)
            power_func = TTestIndPower().power if self._expt.is_numeric_expt else NormalIndPower(ddof=0).power
            current_power = power_func(effect, baseline_var.count, alpha, ratio_power)
            return p_value is not None and p_value < alpha and current_power > stat_power  # type: ignore

        else:
            expected_experiment_effect = self._expt.extra_prop('expectedExperimentEffect')
            solve_power_func = tt_ind_solve_power if self._expt.is_numeric_expt else zt_ind_solve_power
            required_n = math.ceil(solve_power_func(
                expected_experiment_effect,
                power=stat_power,
                alpha=alpha,
                ratio=ratio_power)
            )
            return p_value is not None and p_value < alpha and sample_size > required_n

    def _cal_winner_for_each_variation_result(self, var_results: Iterable[Dict[str, Any]] = []):
        valid_results, invalid_results = [], []
        for result in var_results:
            if not result['isInvalid']:
                valid_results.append(result)
            else:
                invalid_results.append(result)

        sorted_valid_results = sorted(valid_results, key=lambda r: r['changeToBaseline'])
        if sorted_valid_results:
            if self._expt.extra_prop('customEventSuccessCriteria', 1) == 2 and sorted_valid_results[0]['changeToBaseline'] < 0:
                sorted_valid_results[0]['isWinner'] = True
            elif sorted_valid_results[-1]['changeToBaseline'] > 0:
                sorted_valid_results[-1]['isWinner'] = True
        return sorted(map(lambda r: {**r, 'changeToBaseline': format_float_positional(r['changeToBaseline'])}, sorted_valid_results + invalid_results), key=lambda r: r['variationId'])  # type: ignore
