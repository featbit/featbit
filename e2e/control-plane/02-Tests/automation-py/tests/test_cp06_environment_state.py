"""cp06 convergence gated on a field the API never returns (#113 follow-up).

_get_environment_state read ``clientSideAvailabilitySecretKey`` from the
env GET response, but EnvironmentVm exposes ``secrets`` (a collection of
{id,name,type,value}) and no such field — so ``secret_key`` was always
None and _poll_environment_convergence could never succeed. This was the
original "cp06 convergence timeout" from the 2026-07-07 sweep.
"""

from core.models import ScenarioConfig
from scenarios import cp06
from scenarios.cp06 import CP06Scenario


def _config() -> ScenarioConfig:
    return ScenarioConfig(
        scenario_name="cp06-west-to-east",
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


class _FakeClient:
    def __init__(self, *args, **kwargs):
        pass

    def get(self, endpoint, headers=None):
        return {"raw": True}


def test_environment_state_reads_secret_from_secrets_collection(monkeypatch):
    scenario = CP06Scenario(_config())
    monkeypatch.setattr(cp06, "ApiClient", _FakeClient)
    monkeypatch.setattr(
        cp06,
        "extract_data",
        lambda response: {
            "id": "env-9",
            "name": "CP-06 Test Environment",
            "secrets": [
                {"id": "s1", "name": "Server Key", "type": "server", "value": "sec-123"},
                {"id": "s2", "name": "Client Key", "type": "client", "value": "sec-456"},
            ],
        },
    )

    state = scenario._get_environment_state("http://x", "p1", "env-9", "source", {})

    assert state.is_present
    assert state.secret_key == "sec-123"


def test_environment_state_without_secrets_has_no_secret_key(monkeypatch):
    scenario = CP06Scenario(_config())
    monkeypatch.setattr(cp06, "ApiClient", _FakeClient)
    monkeypatch.setattr(
        cp06,
        "extract_data",
        lambda response: {"id": "env-9", "name": "n", "secrets": []},
    )

    state = scenario._get_environment_state("http://x", "p1", "env-9", "source", {})

    assert state.is_present
    assert state.secret_key is None
