"""cp03's during-outage staleness assertion is unassertable (#113 follow-up).

`target-unchanged-during-outage` polled the management API expecting the
target region to stay stale during its Redis outage — but both regions'
APIs read the SAME Mongo replica set, so the target "converges" instantly
and the assertion always false-fails. Under GatedCommit even Redis-level
staleness is timing-dependent (blocked gate vs lease eviction + survivor
commit). The deterministic resilience signals are post-heal: API
convergence and both DCs' Redis reaching the expected value — asserted in
the existing steps 5-6. Step 3 must record an explanatory skip instead.
"""

import json
from types import SimpleNamespace

from core.models import ScenarioConfig
from core.scenario_base import ScenarioDefinition
from scenarios.cp03 import CP03Scenario


def _config() -> ScenarioConfig:
    return ScenarioConfig(
        scenario_name="cp03-west-with-east-redis-outage",
        env_id="env-1",
        west_api_base_url="https://featbit-api.west.local",
        east_api_base_url="https://featbit-api.east.local",
        login_api_base_url="https://featbit-api.west.local",
        login_email="test@featbit.com",
        login_password="123456",
        workspace_key="",
        organization_key="playground",
        skip_certificate_check=True,
        target_status=True,
        timeout_seconds=1,
        poll_interval_ms=10,
        disruption_hold_seconds=0,
        artifacts_root="artifacts",
    )


def _flag_state():
    return SimpleNamespace(error=None, is_enabled=True, json=lambda: "{}")


def test_disruption_cycle_skips_target_staleness_assertion(monkeypatch):
    scenario = CP03Scenario(_config())

    monkeypatch.setattr(CP03Scenario, "run_disruption_command", lambda self, *a, **k: None)
    monkeypatch.setattr(CP03Scenario, "toggle_flag", lambda self, *a, **k: {"ok": True})
    monkeypatch.setattr(CP03Scenario, "get_flag_state", lambda self, *a, **k: _flag_state())
    monkeypatch.setattr(
        CP03Scenario, "poll_convergence", lambda self, *a, **k: (True, None, None)
    )
    monkeypatch.setattr(CP03Scenario, "run_kafka_topic_check", lambda self, *a, **k: None)
    monkeypatch.setattr(CP03Scenario, "run_redis_check", lambda self, *a, **k: None)

    scenario._run_disruption_cycle(
        phase_label="phase-2",
        source_url="https://featbit-api.west.local",
        target_url="https://featbit-api.east.local",
        flag_key="ff-cp03-resilience",
        toggle_to=True,
        baseline_target_enabled=False,
        headers={},
        definition=ScenarioDefinition(
            scenario_type="cp03",
            source_region="west",
            target_region="east",
            default_flag_key="ff-cp03-resilience",
            target_status=True,
        ),
    )

    results = {a.name: a for a in scenario.assertions.assertions}
    staleness = results["phase-2-target-unchanged-during-outage"]
    assert staleness.status == "skipped", staleness.details
    assert "shared Mongo" in staleness.details or "shared-Mongo" in staleness.details
    # The deterministic signals must still be evaluated.
    assert results["phase-2-source-updated-during-outage"].status == "evaluated"
    assert results["phase-2-source-target-convergence"].status == "evaluated"


def test_disruption_cycle_passes_downstream_fallback_context(monkeypatch):
    scenario = CP03Scenario(_config())
    captured = {}

    def capture_kafka(self, name, command, **kwargs):
        captured[name] = kwargs

    monkeypatch.setattr(CP03Scenario, "run_disruption_command", lambda self, *a, **k: None)
    monkeypatch.setattr(CP03Scenario, "toggle_flag", lambda self, *a, **k: {"ok": True})
    monkeypatch.setattr(CP03Scenario, "get_flag_state", lambda self, *a, **k: _flag_state())
    monkeypatch.setattr(
        CP03Scenario, "poll_convergence", lambda self, *a, **k: (True, None, None)
    )
    monkeypatch.setattr(CP03Scenario, "run_kafka_topic_check", capture_kafka)
    monkeypatch.setattr(CP03Scenario, "run_redis_check", lambda self, *a, **k: None)

    scenario._run_disruption_cycle(
        phase_label="phase-2",
        source_url="https://featbit-api.west.local",
        target_url="https://featbit-api.east.local",
        flag_key="ff-cp03-resilience",
        toggle_to=True,
        baseline_target_enabled=False,
        headers={},
        definition=ScenarioDefinition(
            scenario_type="cp03",
            source_region="west",
            target_region="east",
            default_flag_key="ff-cp03-resilience",
            target_status=True,
        ),
    )

    assert captured["phase-2-downstream-topic-check"].get("fallback_context") == "east"
