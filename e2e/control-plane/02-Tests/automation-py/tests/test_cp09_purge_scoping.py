"""CP-09 purge/recovery polls must only track west-owned PodIds (#113).

On the composite-write topology, live east pods heartbeat into west's Redis
hash; they must not be counted as west pods awaiting purge.
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
        timeout_seconds=60,
        poll_interval_ms=1000,
        disruption_hold_seconds=15,
        artifacts_root="artifacts",
    )


def test_west_owned_filters_out_east_entries():
    heartbeats = {
        "west-pod": {"Timestamp": "t", "DcId": "west"},
        "east-pod": {"Timestamp": "t", "DcId": "east"},
    }
    assert CP09Scenario._west_owned_pod_ids(heartbeats) == {"west-pod"}


def test_region_fallback_and_case_insensitivity():
    heartbeats = {
        "a": {"Timestamp": "t", "Region": "West"},
        "b": {"Timestamp": "t", "region": "east"},
        "c": {"Timestamp": "t", "dcId": "WEST"},
    }
    assert CP09Scenario._west_owned_pod_ids(heartbeats) == {"a", "c"}


def test_legacy_entries_without_dc_marker_count_as_west():
    heartbeats = {
        "legacy": {"Timestamp": "t"},
        "weird": "not-a-dict",
    }
    assert CP09Scenario._west_owned_pod_ids(heartbeats) == {"legacy", "weird"}


def test_recovery_poll_ignores_live_east_pods(monkeypatch):
    scenario = CP09Scenario(_config())
    heartbeats = {
        "east-pod": {"Timestamp": "2026-07-08T10:00:00Z", "DcId": "east"},
        "new-west": {"Timestamp": "2026-07-08T10:00:00Z", "DcId": "west"},
    }
    monkeypatch.setattr(CP09Scenario, "_read_heartbeats", lambda self, ctx: heartbeats)

    pod_id, _ = scenario._poll_for_new_west_pod_id(
        set(), deadline_seconds=1, poll_interval_seconds=0.01
    )
    assert pod_id == "new-west"
