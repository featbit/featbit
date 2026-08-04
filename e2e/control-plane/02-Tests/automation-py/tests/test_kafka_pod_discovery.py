"""Kafka topic checks must discover the broker pod (#113 follow-up).

run_kafka_topic_check's auto path referenced ``self._KAFKA_POD``, which was
never defined — every auto Kafka check died with an AttributeError (caught
and recorded as "Kafka topic check error"). The cluster runs several
kafka-* pods (ui, aggregate, mirrormakers); only the broker pod labeled
``app=kafka`` can run kafka-console-consumer.sh.
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


KAFKA_FLEET = [
    _pod("kafka-ui-d4c845c65-b4djj", {"app": "kafka-ui"}),
    _pod("kafka-aggregate-6d44db66f9-n7szg", {"app": "kafka-aggregate"}),
    _pod("kafka-mirrormaker-local-7b5b9f4fdb-9snxp", {"app": "kafka-mirrormaker-local"}),
    _pod("kafka", {"app": "kafka"}),
]


def test_discovery_picks_broker_pod_not_ui_or_mirrormakers(monkeypatch):
    scenario = CP09Scenario(_config())
    monkeypatch.setattr(
        CP09Scenario,
        "_run_kubectl",
        lambda self, args, timeout=60, **kw: SimpleNamespace(
            returncode=0, stdout=json.dumps({"items": KAFKA_FLEET}), stderr=""
        ),
    )

    assert scenario._discover_kafka_pod("west", "featbit") == "kafka"


def test_discovery_returns_none_without_broker_pod(monkeypatch):
    scenario = CP09Scenario(_config())
    monkeypatch.setattr(
        CP09Scenario,
        "_run_kubectl",
        lambda self, args, timeout=60, **kw: SimpleNamespace(
            returncode=0, stdout=json.dumps({"items": KAFKA_FLEET[:3]}), stderr=""
        ),
    )

    assert scenario._discover_kafka_pod("west", "featbit") is None


def test_auto_topic_check_passes_when_flag_id_in_messages(monkeypatch):
    scenario = CP09Scenario(_config())
    calls = []

    def fake_kubectl(self, args, timeout=60, **kw):
        calls.append(args)
        if args[4] == "get":  # pod discovery
            return SimpleNamespace(
                returncode=0, stdout=json.dumps({"items": KAFKA_FLEET}), stderr=""
            )
        # kafka-console-consumer exec: emit the flag id among messages
        return SimpleNamespace(returncode=1, stdout='{"id": "flag-123"}\n', stderr="")

    monkeypatch.setattr(CP09Scenario, "_run_kubectl", fake_kubectl)

    scenario.run_kafka_topic_check(
        "source-topic-check",
        None,
        context="west",
        bootstrap="kafka:9092",
        topic="featbit-feature-flag-change",
        flag_id="flag-123",
    )

    results = {a.name: a for a in scenario.assertions.assertions}
    check = results["source-topic-check"]
    assert check.passed, check.details
    exec_call = [c for c in calls if "exec" in c][0]
    assert exec_call[exec_call.index("exec") + 1] == "kafka"


def test_auto_topic_check_fails_cleanly_without_broker_pod(monkeypatch):
    scenario = CP09Scenario(_config())
    monkeypatch.setattr(
        CP09Scenario,
        "_run_kubectl",
        lambda self, args, timeout=60, **kw: SimpleNamespace(
            returncode=0, stdout=json.dumps({"items": []}), stderr=""
        ),
    )

    scenario.run_kafka_topic_check(
        "source-topic-check",
        None,
        context="west",
        bootstrap="kafka:9092",
        topic="featbit-feature-flag-change",
        flag_id="flag-123",
    )

    results = {a.name: a for a in scenario.assertions.assertions}
    check = results["source-topic-check"]
    assert not check.passed
    assert "no running kafka broker pod" in check.details


def test_auto_topic_check_falls_back_to_peer_context(monkeypatch):
    """Under GatedCommit the eval publish lands in the committing coordinator's
    DC, which may be the peer — a source-context miss must consult the
    fallback context before failing (#113)."""
    scenario = CP09Scenario(_config())

    def fake_kubectl(self, args, timeout=60, **kw):
        if args[4] == "get":
            return SimpleNamespace(
                returncode=0, stdout=json.dumps({"items": KAFKA_FLEET}), stderr=""
            )
        ctx = args[args.index("--context") + 1]
        stdout = '{"id": "flag-123"}\n' if ctx == "west" else ""
        # A timed-out (possibly empty) read always carries TimeoutException.
        return SimpleNamespace(
            returncode=1,
            stdout=stdout,
            stderr="org.apache.kafka.common.errors.TimeoutException\n",
        )

    monkeypatch.setattr(CP09Scenario, "_run_kubectl", fake_kubectl)

    scenario.run_kafka_topic_check(
        "downstream-topic-check",
        None,
        context="east",
        bootstrap="kafka:9092",
        topic="featbit-feature-flag-change",
        flag_id="flag-123",
        fallback_context="west",
    )

    result = {a.name: a for a in scenario.assertions.assertions}["downstream-topic-check"]
    assert result.passed, result.details
    assert "west" in result.details


def test_auto_topic_check_fails_when_both_contexts_miss(monkeypatch):
    scenario = CP09Scenario(_config())

    def fake_kubectl(self, args, timeout=60, **kw):
        if args[4] == "get":
            return SimpleNamespace(
                returncode=0, stdout=json.dumps({"items": KAFKA_FLEET}), stderr=""
            )
        # Timed-out empty reads in BOTH contexts (TimeoutException = a valid
        # empty read, not a consumer failure).
        return SimpleNamespace(
            returncode=1,
            stdout="",
            stderr="org.apache.kafka.common.errors.TimeoutException\n",
        )

    monkeypatch.setattr(CP09Scenario, "_run_kubectl", fake_kubectl)

    scenario.run_kafka_topic_check(
        "downstream-topic-check",
        None,
        context="east",
        bootstrap="kafka:9092",
        topic="featbit-feature-flag-change",
        flag_id="flag-123",
        fallback_context="west",
    )

    result = {a.name: a for a in scenario.assertions.assertions}["downstream-topic-check"]
    assert not result.passed
    assert "east" in result.details and "west" in result.details


def test_auto_topic_check_hard_consumer_failure_does_not_fall_back(monkeypatch):
    """rc!=0 with NO TimeoutException is a broken consumer, not an empty
    read — fail on the primary context without consulting the fallback."""
    scenario = CP09Scenario(_config())

    def fake_kubectl(self, args, timeout=60, **kw):
        if args[4] == "get":
            return SimpleNamespace(
                returncode=0, stdout=json.dumps({"items": KAFKA_FLEET}), stderr=""
            )
        return SimpleNamespace(returncode=1, stdout="", stderr="connection refused")

    monkeypatch.setattr(CP09Scenario, "_run_kubectl", fake_kubectl)

    scenario.run_kafka_topic_check(
        "downstream-topic-check",
        None,
        context="east",
        bootstrap="kafka:9092",
        topic="featbit-feature-flag-change",
        flag_id="flag-123",
        fallback_context="west",
    )

    result = {a.name: a for a in scenario.assertions.assertions}["downstream-topic-check"]
    assert not result.passed
    assert "consumer failed" in result.details
