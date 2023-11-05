from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Iterable, Optional, Tuple

import numpy as np
from scipy.stats import t as t_test
from statsmodels.stats.power import tt_ind_solve_power

from utils import format_float_positional, to_UTC_datetime

EXPT_NECESSARY_COLUMNS = ["exptId", "envId", "flagExptId", "eventName", "eventType", "startExptTime", "baselineVariationId", "variationIds"]
EXPT_EVENT_TYPE_MAPPING = {1: "CustomEvent", 2: "PageView", 3: "Click"}
EXPT_DEFAULT_EVENT_TYPE = "CustomEvent"


class Experiment:

    @staticmethod
    def from_properties(properties: Dict[str, Any] = {}) -> "Experiment":
        assert all(key in properties for key in EXPT_NECESSARY_COLUMNS), "Experiment properties missing necessary columns"
        return Experiment(id=properties.pop("exptId"),
                          env_id=properties.pop("envId"),
                          flag_id=properties.pop("flagExptId"),
                          event_name=properties.pop("eventName"),
                          event_type=properties.pop("eventType"),
                          baseline=properties.pop("baselineVariationId"),
                          variations=properties.pop("variationIds"),
                          start=properties.pop("startExptTime"),
                          end=properties.pop("endExptTime", None),
                          **properties)

    def __init__(self,
                 id: str,
                 env_id: str,
                 flag_id: str,
                 event_name: str,
                 event_type: int,
                 baseline: str,
                 variations: Iterable[str],
                 start: Optional[str] = None,
                 end: Optional[str] = None,
                 **kwargs):
        self._id = id
        self._env_id = env_id
        self._flag_id = flag_id
        self._event_name = event_name
        self._event_numeric_type = event_type
        self._event_type = EXPT_EVENT_TYPE_MAPPING.get(event_type, EXPT_DEFAULT_EVENT_TYPE)
        self._baseline = baseline
        self._variations = variations
        self._start = to_UTC_datetime(start) if start else datetime.utcnow()
        self._end = to_UTC_datetime(end) if end else to_UTC_datetime(datetime(year=2100, month=1, day=1))
        self._extra_props = kwargs.copy()

    def extra_prop(self, key: str, default: Any = None) -> Any:
        return self._extra_props.get(key, default)

    @property
    def id(self) -> str:
        return self._id

    @property
    def env_id(self) -> str:
        return self._env_id

    @property
    def flag_id(self) -> str:
        return self._flag_id

    @property
    def event_name(self) -> str:
        return self._event_name

    @property
    def event_type(self) -> str:
        return self._event_type

    @property
    def baseline(self) -> str:
        return self._baseline

    @property
    def variations(self) -> Iterable[str]:
        return self._variations

    @property
    def start(self) -> datetime:
        return self._start

    @property
    def end(self) -> datetime:
        return self._end

    @property
    def is_numeric_expt(self):
        return self._event_type == EXPT_DEFAULT_EVENT_TYPE and self.extra_prop('customEventTrackOption', None) == 2

    @property
    def is_finished(self) -> bool:
        return self._end.timestamp() < datetime.utcnow().timestamp()

    @property
    def event_numeric_type(self) -> int:
        return self._event_numeric_type


@dataclass
class Variation(ABC):
    var_id: str
    count: float

    @property
    @abstractmethod
    def mean(self) -> float:
        pass

    @property
    @abstractmethod
    def variance(self) -> float:
        pass

    @property
    def stddev(self) -> float:
        return 0 if self.variance <= 0 else np.sqrt(self.variance)

    @property
    @abstractmethod
    def output(self, is_empty: bool = False) -> Dict[str, Any]:
        pass


@dataclass
class BinomialVariation(Variation):
    sum: float

    @property
    def variance(self) -> float:
        return self.mean * (1 - self.mean)

    @property
    def mean(self) -> float:
        if self.count == 0:
            return 0
        return self.sum / self.count

    @property
    def output(self) -> Dict[str, Any]:
        return {
            "variationId": self.var_id,
            "uniqueUsers": int(self.count),
            "conversion": int(self.sum),
            "conversionRate": format_float_positional(self.mean),
        }


@dataclass
class NumericVariation(Variation):
    sum: float
    mean_sample: float
    variance_sample: float

    @property
    def variance(self) -> float:
        return self.variance_sample

    @property
    def mean(self) -> float:
        return self.mean_sample

    @property
    def output(self) -> Dict[str, Any]:
        return {
            "variationId": self.var_id,
            "totalEvents": int(self.count),
            "average": format_float_positional(self.mean),
        }


@dataclass
class FrequenstSettings:
    alpha: float = 0.05
    power: float = 0.8
    min_sample_size: int = 30


@dataclass
class ABTestingResult(ABC):
    delta: Optional[float]
    ci: Optional[Tuple[float, float]]
    is_baseline: bool
    is_winner: bool

    @property
    @abstractmethod
    def output(self) -> Dict[str, Any]:
        pass


@dataclass
class TTestResult(ABTestingResult):
    p_value: Optional[float]
    is_significant: bool
    traitment_group: Variation
    reason: str = ""

    @property
    def output(self) -> Dict[str, Any]:
        ci = [format_float_positional(self.ci[0]), format_float_positional(self.ci[1])] if self.ci else None
        return {
            **self.traitment_group.output,
            "confidenceInterval": ci,
            "pValue": format_float_positional(self.p_value),
            "effectSize": format_float_positional(self.delta),
            'isBaseline': self.is_baseline,
            "isWinner": self.is_winner,
            "isInvalid": not self.is_significant,
            "reason": self.reason}


class OnlineABTesting(ABC):
    def __init__(self,
                 control: Variation,
                 traitement: Variation,
                 is_baseline: bool = False):
        self._control = control
        self._traitement = traitement
        self._is_baseline = is_baseline

    @property
    @abstractmethod
    def get_result(self) -> ABTestingResult:
        pass


class OnlineTTest(OnlineABTesting):
    def __init__(self,
                 control: Variation,
                 traitement: Variation,
                 is_baseline: bool = False,
                 settings: FrequenstSettings = FrequenstSettings()):
        super().__init__(control, traitement, is_baseline)
        self._settings = settings

    @property
    def delta(self) -> float:
        return (self._traitement.mean - self._control.mean) / self._control.mean  # type: ignore

    @property
    def viarance_sample_mean(self) -> float:
        vnt = self._traitement.variance / self._traitement.count
        vnc = self._control.variance / self._control.count
        meant = self._traitement.mean
        meanc = self._control.mean
        return vnt / (meanc ** 2) + vnc * (meant ** 2) / (meanc ** 4)

    @property
    def t_statistic(self) -> float:
        return self.delta / np.sqrt(self.viarance_sample_mean)

    @property
    def df(self) -> float:
        nt = self._traitement.count
        nc = self._control.count
        vnt = self._traitement.variance / nt
        vnc = self._control.variance / nc
        return (vnt + vnc)**2 / (vnt**2 / (nt - 1) + vnc**2 / (nc - 1))

    @property
    def p_value(self) -> float:
        return 2 * (1 - t_test.cdf(np.abs(self.t_statistic), self.df))  # type: ignore

    @property
    def ci(self) -> Tuple[float, float]:
        r: float = t_test.ppf(1 - self._settings.alpha / 2, self.df) * np.sqrt(self.viarance_sample_mean)
        return (self.delta - r, self.delta + r)

    @property
    def min_sample_size(self) -> int:
        nt = self._traitement.count
        nc = self._control.count
        vt = self._traitement.variance
        vc = self._control.variance
        meant = self._traitement.mean
        meanc = self._control.mean
        ratio = nt / nc
        pooled_std = np.sqrt(((nt - 1) * vt + (nc - 1) * vc) / (nt + nc - 2))
        abs_effect_size = np.abs((meant - meanc) / pooled_std)
        return np.ceil(tt_ind_solve_power(effect_size=abs_effect_size, nobs1=None, alpha=self._settings.alpha, power=self._settings.power, ratio=ratio, alternative='two-sided'))

    def get_result(self) -> TTestResult:
        if self._control.variance == 0:
            return TTestResult(delta=None,
                               ci=None,
                               p_value=None,
                               is_significant=False,
                               is_baseline=self._is_baseline,
                               is_winner=False,
                               traitment_group=self._traitement,
                               reason="control is empty")
        if self._traitement.variance == 0:
            return TTestResult(delta=None,
                               ci=None,
                               p_value=None,
                               is_significant=False,
                               is_baseline=self._is_baseline,
                               is_winner=False,
                               traitment_group=self._traitement,
                               reason="traitement is empty")
        if self._is_baseline:
            return TTestResult(delta=0,
                               ci=(0, 0),
                               p_value=1,
                               is_significant=False,
                               is_baseline=True,
                               is_winner=False,
                               traitment_group=self._traitement,
                               reason="is baseline")
        delta = self.delta
        p_value = self.p_value
        ci = self.ci
        if self._control.count < self._settings.min_sample_size or self._traitement.count < self._settings.min_sample_size:
            return TTestResult(delta=delta,
                               ci=ci,
                               p_value=p_value,
                               is_significant=False,
                               is_baseline=False,
                               is_winner=False,
                               traitment_group=self._traitement,
                               reason="sample size is too small")
        #  alpha error (type I error:  reject null hypothesis when it should be accepted)
        if p_value >= self._settings.alpha:
            reason = f"p_value >= alpha ({p_value} >= {self._settings.alpha})"
            return TTestResult(delta=delta,
                               ci=ci,
                               p_value=p_value,
                               is_significant=False,
                               is_baseline=False,
                               is_winner=False,
                               traitment_group=self._traitement,
                               reason=reason)
        # beta error (type II error: accept null hypothesis when it should be rejected)
        required_count = self.min_sample_size
        if self._traitement.count < required_count:
            reason = f"sample size is too small ({self._traitement.count} < {required_count})"
            return TTestResult(delta=delta,
                               ci=ci,
                               p_value=p_value,
                               is_significant=False,
                               is_baseline=False,
                               is_winner=False,
                               traitment_group=self._traitement,
                               reason=reason)
        return TTestResult(delta=delta,
                           ci=ci,
                           p_value=p_value,
                           is_significant=True,
                           is_baseline=False,
                           is_winner=False,
                           traitment_group=self._traitement)
