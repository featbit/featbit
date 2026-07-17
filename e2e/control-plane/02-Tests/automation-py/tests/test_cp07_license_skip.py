"""CP-07 must skip cleanly (not fail) when no license key is configured (#113)."""

from types import SimpleNamespace

from core.models import ScenarioConfig
from scenarios import cp07
from scenarios.cp07 import CP07Scenario


def _config(tmp_path) -> ScenarioConfig:
    return ScenarioConfig(
        scenario_name="cp07-west-to-east",
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
        artifacts_root=str(tmp_path),
        license_key="",
    )


def test_missing_license_key_records_skip_and_passes(tmp_path, monkeypatch):
    scenario = CP07Scenario(_config(tmp_path))

    monkeypatch.setattr(cp07, "resolve_authorization_header", lambda *args: "Bearer token")
    monkeypatch.setattr(
        cp07,
        "resolve_request_context",
        lambda *args: SimpleNamespace(workspace_id="workspace-1", organization_id="org-1"),
    )
    monkeypatch.setattr(
        CP07Scenario,
        "_update_license",
        lambda self, *args, **kwargs: (_ for _ in ()).throw(
            AssertionError("must not attempt a license update without a key")
        ),
    )

    result = scenario.run()

    assert result is True
    skipped = [a for a in scenario.assertions.assertions if a.status == "skipped"]
    assert "license-key-missing" in [a.name for a in skipped]
    assert scenario.assertions.get_failed() == []
