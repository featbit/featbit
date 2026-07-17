from __future__ import annotations

import socket
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


@dataclass(frozen=True)
class _ForwardSpec:
    context: str
    namespace: str
    service: str
    local_port: int
    remote_port: int


class PortForwarder:
    """Manages a set of long-running 'kubectl port-forward' subprocesses."""

    def __init__(self, *, artifacts_dir: Path, kubectl_binary: str = "kubectl") -> None:
        self.artifacts_dir = Path(artifacts_dir)
        self.kubectl_binary = kubectl_binary
        self._specs: list[_ForwardSpec] = []
        self._processes: list[tuple[_ForwardSpec, subprocess.Popen[bytes]]] = []
        self._started = False

    @property
    def log_paths(self) -> list[Path]:
        return [self._log_path(spec) for spec in self._specs]

    def add(
        self,
        *,
        context: str,
        namespace: str,
        service: str,
        local_port: int,
        remote_port: int,
    ) -> None:
        self._specs.append(
            _ForwardSpec(
                context=context,
                namespace=namespace,
                service=service,
                local_port=local_port,
                remote_port=remote_port,
            )
        )

    def start_all(self, *, ready_timeout: float = 10.0) -> None:
        """Spawn each forward and poll TCP connect on localhost until ready."""
        if self._started:
            return

        self._started = True
        self.artifacts_dir.mkdir(parents=True, exist_ok=True)

        for spec in self._specs:
            log_path = self._log_path(spec)
            log_path.parent.mkdir(parents=True, exist_ok=True)
            output_log = log_path.open("wb")
            try:
                process = subprocess.Popen(
                    self._command_for(spec),
                    stdin=subprocess.DEVNULL,
                    stdout=output_log,
                    stderr=subprocess.STDOUT,
                    text=False,
                    creationflags=(
                        subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform.startswith("win") else 0
                    ),
                )
            finally:
                output_log.close()

            self._processes.append((spec, process))

        try:
            self._wait_until_ready(ready_timeout)
        except Exception:
            self.stop_all()
            raise

    def stop_all(self, *, timeout: float = 5.0) -> None:
        for _spec, process in reversed(self._processes):
            if process.poll() is not None:
                continue

            process.terminate()
            try:
                process.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()

        self._processes.clear()
        self._started = False

    def __enter__(self) -> "PortForwarder":
        self.start_all()
        return self

    def __exit__(self, *exc) -> None:
        self.stop_all()

    def _wait_until_ready(self, ready_timeout: float) -> None:
        deadline = time.monotonic() + ready_timeout

        while True:
            not_ready: list[_ForwardSpec] = []
            for spec, process in self._processes:
                if process.poll() is not None:
                    raise RuntimeError(
                        "kubectl port-forward exited before readiness for "
                        f"{spec.context}:{spec.local_port}; see {self._log_path(spec)}"
                    )

                if not self._is_port_ready(spec.local_port):
                    not_ready.append(spec)

            if not not_ready:
                return

            if time.monotonic() >= deadline:
                ports = ", ".join(f"{spec.context}:{spec.local_port}" for spec in not_ready)
                first_log = self._log_path(not_ready[0])
                raise RuntimeError(
                    f"Timed out waiting for kubectl port-forward readiness ({ports}); "
                    f"see {first_log}"
                )

            time.sleep(min(0.1, max(deadline - time.monotonic(), 0.0)))

    @staticmethod
    def _is_port_ready(local_port: int) -> bool:
        try:
            with socket.create_connection(("127.0.0.1", local_port), timeout=0.2):
                return True
        except OSError:
            return False

    def _command_for(self, spec: _ForwardSpec) -> list[str]:
        return [
            self.kubectl_binary,
            "--context",
            spec.context,
            "-n",
            spec.namespace,
            "port-forward",
            f"svc/{spec.service}",
            f"{spec.local_port}:{spec.remote_port}",
        ]

    def _log_path(self, spec: _ForwardSpec) -> Path:
        return self.artifacts_dir / f"port-forward-{spec.context}-{spec.local_port}.log"
