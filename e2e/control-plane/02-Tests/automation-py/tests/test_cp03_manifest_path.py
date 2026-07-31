"""CP-03 chaos-mesh manifest default must point at a file that exists (#113)."""

import inspect
from pathlib import Path

import cli.main as cli_main

# cli/main.py -> [0]=cli, [1]=automation-py, [2]=02-Tests, [3]=control-plane
QA_ROOT = Path(cli_main.__file__).resolve().parents[3]


def _chaos_manifest_default() -> str:
    for cmd in cli_main.cli.commands.values():
        for param in cmd.params:
            if param.name == "chaos_mesh_manifest":
                default = param.default
                return default() if callable(default) else default
    raise AssertionError("chaos_mesh_manifest option not found on any command")


def test_default_chaos_manifest_exists_under_qa_root(monkeypatch):
    monkeypatch.delenv("CHAOS_MESH_MANIFEST", raising=False)
    default = _chaos_manifest_default()
    assert (QA_ROOT / default).is_file(), (
        f"default '{default}' does not exist relative to {QA_ROOT}"
    )


def test_cp03_block_uses_shared_resolver():
    src = inspect.getsource(cli_main)
    start = src.index('scenario_name.startswith("cp03")')
    end = src.index('scenario_name.startswith(("cp11"')
    cp03_block = src[start:end]
    assert "_resolve_manifest(chaos_mesh_manifest)" in cp03_block
    assert "parents[2]" not in cp03_block
