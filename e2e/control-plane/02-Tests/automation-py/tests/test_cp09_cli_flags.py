from click.testing import CliRunner

from cli.main import cli


WS_FLAGS = ["--ws-west-clients", "--ws-east-clients", "--ws-sdk-type", "--ws-disabled"]


def test_cp09_scenario_help_includes_websocket_flags():
    result = CliRunner().invoke(cli, ["scenario", "cp09-pod-heartbeats", "--help"])

    assert result.exit_code == 0
    for flag in WS_FLAGS:
        assert flag in result.output


def test_cp09_suite_help_includes_websocket_flags():
    result = CliRunner().invoke(cli, ["suite", "cp09", "--help"])

    assert result.exit_code == 0
    for flag in WS_FLAGS:
        assert flag in result.output
