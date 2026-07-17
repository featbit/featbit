"""cp04 regression: run_segment_redis_check must exist exactly once with the
command-delegating signature that scenarios/cp04.py calls (#113)."""

import inspect

from core import scenario_base
from core.scenario_base import BaseScenario


def test_run_segment_redis_check_defined_exactly_once():
    src = inspect.getsource(scenario_base)
    assert src.count("def run_segment_redis_check(") == 1


def test_signature_matches_cp04_call_shape():
    sig = inspect.signature(BaseScenario.run_segment_redis_check)
    params = set(sig.parameters)
    assert {"region", "command", "segment_id", "segment_key", "context"} <= params
    # cp04.py:213 calls: ("west", <command>, segment_id=..., segment_key=...)
    sig.bind(object(), "west", "kubectl ...", segment_id="s-1", segment_key="k-1")
