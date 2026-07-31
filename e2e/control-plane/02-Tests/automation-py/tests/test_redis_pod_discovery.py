"""Redis pod discovery must prefer the Sentinel statefulset (#113 follow-up).

On a fresh deploy BOTH an orphaned legacy "redis" pod (labeled app=redis,
empty) and the authoritative featbit-redis-node-* Sentinel statefulset are
Running. Preferring the label match sends every Redis observation to the
empty orphan — cp04's segment checks and cp14's committed-pointer reads
return nothing while the keys exist in the Sentinel nodes.
"""

import json
from types import SimpleNamespace

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


def _pod(name: str, labels: dict, phase: str = "Running") -> dict:
    return {
        "metadata": {"name": name, "labels": labels},
        "status": {"phase": phase},
    }


def _kubectl_stub(pods_by_query):
    """Return a _run_kubectl replacement serving canned pod lists.

    pods_by_query maps "label" (a -l app=redis query) and "all" (plain get
    pods) to item lists.
    """

    def run(self, args, timeout=60, **kwargs):
        items = pods_by_query["label"] if "-l" in args else pods_by_query["all"]
        return SimpleNamespace(
            returncode=0, stdout=json.dumps({"items": items}), stderr=""
        )

    return run


def test_sentinel_nodes_preferred_over_labeled_legacy_pod(monkeypatch):
    scenario = CP09Scenario(_config())
    legacy = _pod("redis", {"app": "redis"})
    sentinel = _pod("featbit-redis-node-0", {"app.kubernetes.io/name": "redis"})
    monkeypatch.setattr(
        CP09Scenario,
        "_run_kubectl",
        _kubectl_stub({"label": [legacy], "all": [legacy, sentinel]}),
    )

    assert scenario._discover_redis_pod("west", "featbit") == "featbit-redis-node-0"


def test_legacy_pod_used_when_no_sentinel_nodes(monkeypatch):
    scenario = CP09Scenario(_config())
    legacy = _pod("redis", {"app": "redis"})
    monkeypatch.setattr(
        CP09Scenario,
        "_run_kubectl",
        _kubectl_stub({"label": [legacy], "all": [legacy]}),
    )

    assert scenario._discover_redis_pod("west", "featbit") == "redis"


def test_non_running_sentinel_nodes_are_skipped(monkeypatch):
    scenario = CP09Scenario(_config())
    legacy = _pod("redis", {"app": "redis"})
    pending = _pod("featbit-redis-node-0", {}, phase="Pending")
    monkeypatch.setattr(
        CP09Scenario,
        "_run_kubectl",
        _kubectl_stub({"label": [legacy], "all": [legacy, pending]}),
    )

    assert scenario._discover_redis_pod("west", "featbit") == "redis"


def test_no_running_redis_pod_returns_none(monkeypatch):
    scenario = CP09Scenario(_config())
    monkeypatch.setattr(
        CP09Scenario,
        "_run_kubectl",
        _kubectl_stub({"label": [], "all": []}),
    )

    assert scenario._discover_redis_pod("west", "featbit") is None
