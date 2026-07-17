"""CP-11/CP-12 partition manifests must be per-cluster (#113 follow-up).

The old single manifest listed BOTH peer IPs in externalTargets, so each
cluster also blocked its own node on the shared network — severing
node->pod traffic (port-forwards) to its own API and killing the
harness's toggle mid-scenario. Each side now has its own manifest that
never targets its own node.
"""

import inspect
from pathlib import Path

import cli.main as cli_main

QA_ROOT = Path(cli_main.__file__).resolve().parents[3]


def _suite_param_default(name):
    for cmd in cli_main.cli.commands.values():
        for param in cmd.params:
            if param.name == name:
                default = param.default
                return default() if callable(default) else default
    return None


def test_per_cluster_partition_manifest_defaults_exist(monkeypatch):
    monkeypatch.delenv("CROSS_DC_PARTITION_MANIFEST_WEST", raising=False)
    monkeypatch.delenv("CROSS_DC_PARTITION_MANIFEST_EAST", raising=False)
    west = _suite_param_default("cross_dc_partition_manifest_west")
    east = _suite_param_default("cross_dc_partition_manifest_east")
    assert west and (QA_ROOT / west).is_file(), west
    assert east and (QA_ROOT / east).is_file(), east


def test_partition_commands_apply_each_side_to_its_own_cluster():
    src = inspect.getsource(cli_main)
    start = src.index('scenario_name.startswith(("cp11"')
    block = src[start : start + 900]
    assert "cross_dc_partition_manifest_west" in block
    assert "cross_dc_partition_manifest_east" in block


def test_manifests_never_target_own_node():
    west = (QA_ROOT / "01-Infrastructure/chaos-mesh/cross-dc-partition-west.yaml").read_text()
    east = (QA_ROOT / "01-Infrastructure/chaos-mesh/cross-dc-partition-east.yaml").read_text()
    assert "172.31.0.10" not in west.split("externalTargets")[1]  # west's own node
    assert "172.31.0.20" in west.split("externalTargets")[1]
    assert "172.31.0.20" not in east.split("externalTargets")[1]  # east's own node
    assert "172.31.0.10" in east.split("externalTargets")[1]
