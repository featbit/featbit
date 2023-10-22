from typing import Any, Dict, Iterable, Optional, Tuple

import numpy as np
from scipy.stats import ttest_ind_from_stats
from statsmodels.stats.power import tt_ind_solve_power, zt_ind_solve_power
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
    default_sample_threshold = 100

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
                            change_to_baseline: Optional[float],
                            p_value: Optional[float],
                            is_baseline: bool = False,
                            is_winner: bool = False,
                            result_significant: Tuple[bool, str, Optional[float]] = (False, "", None)) -> Dict[str, Any]:

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
            is_significant, reason, effect_size = result_significant
            return {**output,
                    'changeToBaseline': format_float_positional(change_to_baseline),
                    'confidenceInterval': variation.confidence_interval,
                    'pValue': format_float_positional(p_value) if p_value is not None else None,
                    'isBaseline': is_baseline,
                    'isWinner': is_winner,
                    'isInvalid': not is_significant,
                    'reason': reason,
                    'effectSize': effect_size}

        alpha = self._expt.extra_prop('alpha', self.default_alpha)
        pw = self._expt.extra_prop('power', self.default_power)
        expected_ee = self._expt.extra_prop('expectedExperimentEffect', None)
        variations: Dict[str, Variation] = self._get_variations(alpha=alpha)
        output = [standard_output(Variation(var), None, None, self._expt.baseline == var, False, (False, "variation is missing", None))
                  for var in self._expt.variations if var not in variations.keys()]

        baseline_var = variations.get(self._expt.baseline, None)
        if baseline_var is None or baseline_var.mean == 0:
            for variation in variations.values():
                output.append(standard_output(variation, None, None, self._expt.baseline == variation.key, False, (False, "baseline variation is missing or has no exposure", None)))
        else:
            for variation in variations.values():
                is_baseline = variation.key == self._expt.baseline
                change_to_baseline = variation.mean - baseline_var.mean if self._expt.is_numeric_expt else (variation.mean - baseline_var.mean) / baseline_var.mean  # type: ignore
                p_value = self._p_value(baseline_var, variation) if variation.exposure > 0 else None  # type: ignore
                result_significant = self._are_results_significant(baseline_var,
                                                                   variation, p_value,
                                                                   alpha=alpha, pw=pw,
                                                                   expected_experiment_effect=expected_ee,
                                                                   is_baseline=is_baseline) if variation.exposure > 0 else (False, "variation has no exposure", None)  # type: ignore
                output.append(standard_output(variation, change_to_baseline, p_value, is_baseline, False, result_significant))
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
                                          equal_var=False, alternative='two-sided')
        return p_value

    def _p_value(self, baseline_var: Variation, test_var: Variation) -> Optional[float]:
        p_value_func = self._ttest_p_value if self._expt.is_numeric_expt else self._ztest_p_value
        p_value = p_value_func(baseline_var, test_var)
        return None if np.isnan(p_value) else p_value

    # https://www.statmethods.net/stats/power.html
    # https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3444174/#:~:text=What%20Is%20Effect%20Size%3F,in%20two%20different%20intervention%20groups.
    # Cohen suggests that d values of 0.2, 0.5, and 0.8 represent small, medium, and large effect sizes respectively.
    def _effect_size(self, baseline_var: Variation, test_var: Variation) -> float:
        def cohen_d(baseline_var, test_var):
            pooled_std = np.sqrt(((baseline_var.count - 1) * baseline_var.stdev**2 + (test_var.count - 1) * test_var.stdev**2) / (baseline_var.count + test_var.count - 2))  # type: ignore
            return (test_var.mean - baseline_var.mean) / pooled_std  # type: ignore
        if self._expt.is_numeric_expt:
            return cohen_d(baseline_var, test_var)
        return proportion_effectsize(prop1=test_var.mean, prop2=baseline_var.mean)

    # https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4111019/#:~:text=The%20P%20value%20is%20defined,groups%20is%20due%20to%20chance.
    # Null hypothesis (H0): There’s no effect in the population.
    # Alternative hypothesis (H1): There is an effect in the population.
    def _are_results_significant(self,
                                 baseline_var: Variation,
                                 test_var: Variation,
                                 p_value: Optional[float],
                                 alpha: float = default_alpha,
                                 pw: float = default_power,
                                 expected_experiment_effect: Optional[float] = None,
                                 is_baseline: bool = False) -> Tuple[bool, str, Optional[float]]:
        if baseline_var.count < self.default_sample_threshold or test_var.count < self.default_sample_threshold:  # type: ignore
            return False, f"sample size is too small < {self.default_sample_threshold}", None
        # alpha error (type I error:  reject null hypothesis when it should be accepted)
        if p_value is None or p_value >= alpha:
            return False, "baseline" if is_baseline else f"p-value is too large (>= {alpha})", None
        effect_size = self._effect_size(baseline_var, test_var)
        ratio = baseline_var.count / test_var.count  # type: ignore
        solve_power_func = tt_ind_solve_power if self._expt.is_numeric_expt else zt_ind_solve_power
        nobs_test = np.ceil(solve_power_func(effect_size=np.abs(effect_size), nobs1=None, alpha=alpha, power=pw, ratio=ratio, alternative='two-sided'))
        # beta error (type II error: accept null hypothesis when it should be rejected)
        if test_var.count < nobs_test:
            return False, f"sample size is too small (required {nobs_test})", effect_size,
        # the results are not as expected
        if expected_experiment_effect is not None and np.abs(effect_size) < np.abs(expected_experiment_effect):
            return False, f"the results are not as expected (expected {expected_experiment_effect}, actual {effect_size})", effect_size
        return True, "", effect_size

    def _cal_winner_for_each_variation_result(self, var_results: Iterable[Dict[str, Any]] = []):
        valid_results, invalid_results = [], []
        for result in var_results:
            if not result['isInvalid']:
                valid_results.append(result)
            else:
                invalid_results.append(result)

        sorted_valid_results = sorted(valid_results, key=lambda r: r['effectSize'])
        if sorted_valid_results:
            if self._expt.extra_prop('customEventSuccessCriteria', 1) == 2 and sorted_valid_results[0]['effectSize'] < 0:
                sorted_valid_results[0]['isWinner'] = True
            elif sorted_valid_results[-1]['effectSize'] > 0:
                sorted_valid_results[-1]['isWinner'] = True
        return sorted(map(lambda r: {**r, 'effectSize': format_float_positional(r['effectSize'])}, sorted_valid_results + invalid_results), key=lambda r: r['variationId'])  # type: ignore
