from __future__ import annotations

from typing import Any

import pytest

from core.port_forwarder import PortForwarder


class _FakeProcess:
    def __init__(self) -> None:
        self.pid = 12345
        self.returncode = None
        self.terminated = False
        self.killed = False

    def poll(self) -> int | None:
        return self.returncode

    def terminate(self) -> None:
        self.terminated = True
        self.returncode = 0

    def wait(self, timeout: float | None = None) -> int:
        return self.returncode if self.returncode is not None else 0

    def kill(self) -> None:
        self.killed = True
        self.returncode = -9


class _FakeSocket:
    def __enter__(self) -> "_FakeSocket":
        return self

    def __exit__(self, *exc: Any) -> None:
        return None


def test_start_all_spawns_kubectl_port_forward_and_waits_for_readiness(tmp_path, monkeypatch):
    commands: list[list[str]] = []

    def fake_popen(command, **kwargs):
        commands.append(command)
        return _FakeProcess()

    connections: list[tuple[str, int]] = []

    def fake_create_connection(address, timeout):
        connections.append(address)
        return _FakeSocket()

    monkeypatch.setattr("core.port_forwarder.subprocess.Popen", fake_popen)
    monkeypatch.setattr("core.port_forwarder.socket.create_connection", fake_create_connection)

    forwarder = PortForwarder(artifacts_dir=tmp_path, kubectl_binary="kubectl-test")
    forwarder.add(
        context="west",
        namespace="featbit",
        service="evaluation-server",
        local_port=5100,
        remote_port=5100,
    )

    forwarder.start_all(ready_timeout=0.1)

    assert commands == [
        [
            "kubectl-test",
            "--context",
            "west",
            "-n",
            "featbit",
            "port-forward",
            "svc/evaluation-server",
            "5100:5100",
        ]
    ]
    assert connections == [("127.0.0.1", 5100)]
    assert (tmp_path / "port-forward-west-5100.log").exists()


def test_start_all_stops_processes_and_raises_when_port_never_ready(tmp_path, monkeypatch):
    process = _FakeProcess()

    def fake_popen(command, **kwargs):
        return process

    def fake_create_connection(address, timeout):
        raise OSError("connection refused")

    monkeypatch.setattr("core.port_forwarder.subprocess.Popen", fake_popen)
    monkeypatch.setattr("core.port_forwarder.socket.create_connection", fake_create_connection)

    forwarder = PortForwarder(artifacts_dir=tmp_path, kubectl_binary="kubectl-test")
    forwarder.add(
        context="east",
        namespace="featbit",
        service="evaluation-server",
        local_port=5101,
        remote_port=5100,
    )

    with pytest.raises(RuntimeError, match="port-forward"):
        forwarder.start_all(ready_timeout=0.01)

    assert process.terminated is True
