import math
from datetime import datetime
from typing import Any, Dict, Iterable, Optional, Tuple

import scipy as sp

from utils import format_float_positional, to_UTC_datetime

EXPT_NECESSARY_COLUMNS = ["exptId", "envId", "flagExptId", "eventName", "eventType", "startExptTime", "baselineVariationId", "variationIds"]
EXPT_EVENT_TYPE_MAPPING = {1: "CustomEvent", 2: "PageView", 3: "Click"}
EXPT_DEFAULT_EVENT_TYPE = "CustomEvent"


def cal_confidence_interval(sample_size: int,
                            mean: float,
                            stdev: float,
                            confidence_level: float = 0.95,
                            proportions_test: bool = True) -> Optional[Tuple[str, str]]:
    sterr = stdev / math.sqrt(sample_size)
    r = sterr * sp.stats.t.ppf((1 + confidence_level) / 2., sample_size - 1)
    low_bound = mean - r
    upper_bound = mean + r
    if math.isnan(low_bound) or math.isnan(upper_bound):
        return None
    if proportions_test:
        low_bound = 0 if low_bound < 0 else low_bound
        upper_bound = 1 if upper_bound > 1 else upper_bound
    return (format_float_positional(low_bound), format_float_positional(upper_bound))


class Variation:
    def __init__(self,
                 key: str,
                 count: Optional[int] = None,
                 exposure: Optional[int] = None,
                 mean_sample: Optional[float] = None,
                 stdev_sample: Optional[float] = None,
                 alpha: float = 0.05,
                 proportions_test: bool = True):
        self._key = key
        self._count = count
        self._exposure = exposure
        self._mean = mean_sample
        self._stdev = stdev_sample
        self._confidence_interval = None if exposure is None or exposure <= 0 else cal_confidence_interval(count, mean_sample, stdev_sample, 1 - alpha, proportions_test)  # type: ignore

    @property
    def key(self) -> str:
        return self._key

    @property
    def count(self) -> Optional[int]:
        return self._count

    @property
    def exposure(self) -> Optional[int]:
        return self._exposure

    @property
    def mean(self) -> Optional[float]:
        return self._mean

    @property
    def stdev(self) -> Optional[float]:
        return self._stdev

    @property
    def confidence_interval(self) -> Optional[Tuple[str, str]]:
        return self._confidence_interval


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
        self._end = to_UTC_datetime(end) if end else datetime(year=2100, month=1, day=1)
        self._extra_props = kwargs.copy()

    def extra_prop(self, key: str, default: Any = None) -> Dict[str, Any]:
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
        return self._end < datetime.utcnow()

    @property
    def event_numeric_type(self) -> int:
        return self._event_numeric_type
