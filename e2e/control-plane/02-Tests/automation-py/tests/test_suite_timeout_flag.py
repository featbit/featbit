"""The suite command must expose --timeout-seconds (#113 follow-up).

Only the scenario command had it; suite runs hardcoded 60s, so the
convergence window could not be tuned for suite runs (cp14's first
post-flip gated commit takes ~60-65s on a fresh deploy).
"""

from click.testing import CliRunner

from cli.main import cli


def _suite_param(name):
    for param in cli.commands["suite"].params:
        if param.name == name:
            return param
    return None


def test_suite_help_includes_timeout_seconds():
    result = CliRunner().invoke(cli, ["suite", "cp14", "--help"])
    assert "--timeout-seconds" in result.output


def test_suite_timeout_default_honors_env(monkeypatch):
    monkeypatch.setenv("TIMEOUT_SECONDS", "180")
    param = _suite_param("timeout_seconds")
    assert param is not None, "suite command has no timeout_seconds option"
    default = param.default() if callable(param.default) else param.default
    assert default == 180


def test_suite_exposes_control_plane_base_url(monkeypatch):
    """cp08 in a suite run needs the admin URL; only the scenario command had it,
    so suite cp08 always fell back to the .local proxy hostname (#113)."""
    monkeypatch.setenv("CONTROL_PLANE_BASE_URL", "http://127.0.0.1:5200")
    param = _suite_param("control_plane_base_url")
    assert param is not None, "suite command has no control_plane_base_url option"
    default = param.default() if callable(param.default) else param.default
    assert default == "http://127.0.0.1:5200"


def test_ws_lb_host_default_honors_env(monkeypatch):
    """.env.example documents WS_LB_HOST for CP-09 LB-mode failover coverage;
    the option must actually read it (it was a hardcoded default)."""
    monkeypatch.setenv("WS_LB_HOST", "featbit-eval.127.0.0.1.sslip.io")
    param = _suite_param("ws_lb_host")
    assert param is not None
    default = param.default() if callable(param.default) else param.default
    assert default == "featbit-eval.127.0.0.1.sslip.io"
