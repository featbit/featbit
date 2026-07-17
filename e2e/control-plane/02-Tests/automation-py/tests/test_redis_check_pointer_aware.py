"""Redis value checks must be GatedCommit-pointer-aware (#113 follow-up).

At commit time the peer DC receives the committed pointer and the
versioned key — its legacy ``featbit:flag:{id}`` single-value key is NOT
rewritten (that key is the BestEffort transport; eval reads are
pointer-gated). Sampling only the legacy key made cp01/cp03's peer-DC
value checks fail forever while the evals were serving the new value.
"""

import json
from types import SimpleNamespace

from core.models import ScenarioConfig
from scenarios.cp09 import CP09Scenario

FLAG_ID = "flag-1"
POINTER = "1783540696720"


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
        timeout_seconds=2,
        poll_interval_ms=10,
        disruption_hold_seconds=0,
        artifacts_root="artifacts",
    )


def _fake_redis_kubectl(store):
    """Emulate the kubectl plumbing _run_redis_key_lookup uses: svc lookup
    (absent -> sentinel path), pod discovery, and redis-cli execs against a
    dict-backed store."""

    sentinel = {
        "metadata": {"name": "featbit-redis-node-0", "labels": {}},
        "status": {"phase": "Running"},
    }

    def run(self, args, timeout=60, **kw):
        if "svc" in args:
            return SimpleNamespace(returncode=1, stdout="", stderr="not found")
        if args[4] == "get":  # pod discovery
            return SimpleNamespace(
                returncode=0, stdout=json.dumps({"items": [sentinel]}), stderr=""
            )
        # redis-cli exec
        cli = args[args.index("redis-cli") + 1 :]
        if cli[-1] == "ping" or "ping" in cli:
            return SimpleNamespace(returncode=0, stdout="PONG", stderr="")
        if cli[0] == "GET" or "GET" in cli:
            key = cli[cli.index("GET") + 1]
            value = store.get(key)
            return SimpleNamespace(
                returncode=0, stdout=value if value else "(nil)", stderr=""
            )
        if "--scan" in cli:
            pattern = cli[cli.index("--pattern") + 1].rstrip("*")
            matches = [k for k in store if k.startswith(pattern)]
            return SimpleNamespace(returncode=0, stdout="\n".join(matches), stderr="")
        return SimpleNamespace(returncode=1, stdout="", stderr=f"unhandled: {cli}")

    return run


def test_peer_dc_check_passes_via_committed_versioned_key(monkeypatch):
    """Peer-DC shape after a gated commit: stale legacy key, fresh pointer +
    versioned key. The value expectation must be satisfied."""
    store = {
        f"featbit:flag:{FLAG_ID}": '{"isEnabled":false}',
        f"featbit:flag-committed:{FLAG_ID}": POINTER,
        f"featbit:flag:{FLAG_ID}:v{POINTER}": '{"isEnabled":true}',
    }
    scenario = CP09Scenario(_config())
    monkeypatch.setattr(CP09Scenario, "_run_kubectl", _fake_redis_kubectl(store))

    scenario.run_redis_check(
        "east", None, flag_id=FLAG_ID, flag_key="ff-x", expected_status=True
    )

    result = {a.name: a for a in scenario.assertions.assertions}["redis-east-check"]
    assert result.passed, result.details


def test_besteffort_shape_still_works_via_legacy_key(monkeypatch):
    """No pointer (BestEffort): the legacy key alone satisfies the check."""
    store = {f"featbit:flag:{FLAG_ID}": '{"isEnabled":true}'}
    scenario = CP09Scenario(_config())
    monkeypatch.setattr(CP09Scenario, "_run_kubectl", _fake_redis_kubectl(store))

    scenario.run_redis_check(
        "west", None, flag_id=FLAG_ID, flag_key="ff-x", expected_status=True
    )

    result = {a.name: a for a in scenario.assertions.assertions}["redis-west-check"]
    assert result.passed, result.details


def test_stale_everywhere_still_fails(monkeypatch):
    """Stale legacy AND stale committed version: the check must fail."""
    store = {
        f"featbit:flag:{FLAG_ID}": '{"isEnabled":false}',
        f"featbit:flag-committed:{FLAG_ID}": POINTER,
        f"featbit:flag:{FLAG_ID}:v{POINTER}": '{"isEnabled":false}',
    }
    scenario = CP09Scenario(_config())
    monkeypatch.setattr(CP09Scenario, "_run_kubectl", _fake_redis_kubectl(store))

    scenario.run_redis_check(
        "east", None, flag_id=FLAG_ID, flag_key="ff-x", expected_status=True
    )

    result = {a.name: a for a in scenario.assertions.assertions}["redis-east-check"]
    assert not result.passed
