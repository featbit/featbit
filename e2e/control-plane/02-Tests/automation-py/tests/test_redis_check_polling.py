"""run_redis_check must poll for the expected value (#113 follow-up).

Under GatedCommit the legacy ``featbit:flag:{id}`` key is only updated at
commit time (coordinator tick, ~5s+), but the check sampled ONCE right
after management-API convergence (instant, Mongo-backed) — so cp01/cp03
read the pre-commit value and false-failed with "sampled values did not
include expected isEnabled".
"""

from core.models import ScenarioConfig
from scenarios.cp09 import CP09Scenario


def _config() -> ScenarioConfig:
    return ScenarioConfig(
        scenario_name="cp09-pod-heartbeats",
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
        timeout_seconds=5,
        poll_interval_ms=10,
        disruption_hold_seconds=15,
        artifacts_root="artifacts",
    )


def test_redis_check_polls_until_expected_value_appears(monkeypatch):
    scenario = CP09Scenario(_config())
    calls = {"n": 0}

    def fake_lookup(self, **kwargs):
        calls["n"] += 1
        value = '{"isEnabled":false}' if calls["n"] < 3 else '{"isEnabled":true}'
        return (True, ["featbit:flag:x"], [value])

    monkeypatch.setattr(CP09Scenario, "_run_redis_key_lookup", fake_lookup)

    scenario.run_redis_check("west", None, flag_id="x", flag_key="k", expected_status=True)

    result = {a.name: a for a in scenario.assertions.assertions}["redis-west-check"]
    assert result.passed, result.details
    assert calls["n"] >= 3


def test_redis_check_fails_after_deadline_with_stale_value(monkeypatch):
    config = _config()
    config.timeout_seconds = 1
    scenario = CP09Scenario(config)

    monkeypatch.setattr(
        CP09Scenario,
        "_run_redis_key_lookup",
        lambda self, **kwargs: (True, ["featbit:flag:x"], ['{"isEnabled":false}']),
    )

    scenario.run_redis_check("west", None, flag_id="x", flag_key="k", expected_status=True)

    result = {a.name: a for a in scenario.assertions.assertions}["redis-west-check"]
    assert not result.passed
    assert "within" in result.details  # message states the poll window


def test_redis_check_without_expectation_passes_on_first_lookup(monkeypatch):
    scenario = CP09Scenario(_config())
    calls = {"n": 0}

    def fake_lookup(self, **kwargs):
        calls["n"] += 1
        return (True, ["featbit:flag:x"], ['{"isEnabled":false}'])

    monkeypatch.setattr(CP09Scenario, "_run_redis_key_lookup", fake_lookup)

    scenario.run_redis_check("west", None, flag_id="x", flag_key="k")

    result = {a.name: a for a in scenario.assertions.assertions}["redis-west-check"]
    assert result.passed
    assert calls["n"] == 1
