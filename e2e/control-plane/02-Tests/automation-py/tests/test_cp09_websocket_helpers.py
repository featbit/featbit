from types import SimpleNamespace

from core.api_client import EnvSecrets
from core.models import ScenarioConfig
from scenarios import cp09
from scenarios.cp09 import CP09Scenario


WS_ASSERTION_IDS = [
    "open-west-client-connections",
    "open-east-client-connections",
    "client-connections-recorded-in-redis",
    "west-clients-migrated-to-east",
    "open-replacement-west-clients",
]


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


def _heartbeat_sample() -> dict:
    return {"11111111-1111-1111-1111-111111111111": {"Timestamp": "2026-06-16T10:00:00Z"}}


def test_skip_websocket_assertions_records_all_five_ids_once():
    scenario = CP09Scenario(_config())

    scenario._skip_websocket_assertions("skip reason")
    scenario._skip_websocket_assertions("skip reason")

    skipped = [
        assertion for assertion in scenario.assertions.assertions if assertion.status == "skipped"
    ]
    assert [assertion.name for assertion in skipped] == WS_ASSERTION_IDS
    assert all(assertion.details == "skip reason" for assertion in skipped)


def test_ws_disabled_run_does_not_fail_when_env_secret_resolution_would_fail(tmp_path, monkeypatch):
    config = _config()
    config.artifacts_root = str(tmp_path)
    config.ws_disabled = True
    scenario = CP09Scenario(config)

    monkeypatch.setattr(cp09, "resolve_authorization_header", lambda *args: "Bearer token")
    monkeypatch.setattr(
        cp09,
        "resolve_request_context",
        lambda *args: SimpleNamespace(workspace_id="workspace-1", organization_id="org-1"),
    )
    monkeypatch.setattr(
        cp09,
        "resolve_project_id_for_env",
        lambda *args, **kwargs: (_ for _ in ()).throw(ValueError("should not resolve")),
    )
    monkeypatch.setattr(CP09Scenario, "_read_heartbeats", lambda self, context: _heartbeat_sample())
    monkeypatch.setattr(
        CP09Scenario,
        "_wait_for_heartbeat_advance",
        lambda self, context, baseline, max_wait_seconds, poll_interval_seconds: baseline,
    )
    monkeypatch.setattr(CP09Scenario, "_get_eval_server_pods", lambda self, context: [])

    scenario.run()

    failures = scenario.assertions.get_failed()
    assert all(assertion.name != "resolve-env-secrets" for assertion in failures)


def test_replacement_west_clients_honors_configured_sdk_type(tmp_path, monkeypatch):
    config = _config()
    config.artifacts_root = str(tmp_path)
    config.ws_sdk_type = "client"
    scenario = CP09Scenario(config)
    scenario.artifact_dir = tmp_path
    scenario._env_secrets = EnvSecrets(server="server-secret", client="client-secret", raw=[])
    captured_env = {}

    class FakeK6Runner:
        def __init__(self, script_path, env, artifacts_dir):
            captured_env.update(env)

        def start(self):
            return None

        def wait_for_count(self, predicate, *, count, timeout, poll_interval=0.5, since=0.0):
            return count

        def stop(self, timeout=10.0):
            return 0

    # west Redis: baseline poll returns 0, growth-poll returns 5.
    observed_west = iter([0, 5])
    monkeypatch.setattr(
        scenario,
        "_count_redis_connection_keys",
        lambda context: next(observed_west) if context == "west" else 0,
    )
    monkeypatch.setattr(cp09, "K6Runner", FakeK6Runner)
    monkeypatch.setattr(cp09.time, "sleep", lambda _seconds: None)

    scenario._assert_replacement_west_clients()

    assert captured_env["SDK_TYPE"] == "client"
    assert captured_env["USE_LOAD_BALANCER"] == "true"
    assert captured_env["STREAMING_HOST"] == "featbit-eval.local"


def test_connection_redis_assertion_polls_until_new_connection_count_met(monkeypatch):
    scenario = CP09Scenario(_config())
    scenario._redis_connection_baseline = 5
    # Aggregate (west+east) Redis count: first poll returns 5, second 35.
    observed_totals = iter([5, 35])

    monkeypatch.setattr(
        scenario,
        "_count_total_redis_connection_keys",
        lambda: next(observed_totals),
    )
    monkeypatch.setattr(cp09.time, "sleep", lambda _seconds: None)

    scenario._assert_client_connections_recorded_in_redis(30)

    passed = [
        assertion
        for assertion in scenario.assertions.assertions
        if assertion.name == "client-connections-recorded-in-redis" and assertion.passed
    ]
    assert len(passed) == 1
