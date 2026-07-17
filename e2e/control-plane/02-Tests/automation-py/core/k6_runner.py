from __future__ import annotations

import json
import os
import re
import shutil
import signal
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Iterable, Optional

DEFAULT_EVENT_PREFIX = "CP09_EVENT"


@dataclass
class K6Event:
    ts: float
    vu: int
    cluster: str
    event: str
    code: Optional[int] = None
    details: str = ""
    raw: dict = field(default_factory=dict)


class K6Runner:
    """
    Launches a k6 script as a background subprocess, tails its stdout/stderr
    for structured event lines (default prefix CP09_EVENT followed by JSON),
    and exposes helpers to query the event stream and stop the run cleanly.

    Lifetime contract:
      • is_available() may be called at any time, including before start().
      • start() must be called exactly once.
      • read_events(), count_events() may be called any number of times after
        start().
      • stop() must be called exactly once and should be invoked from the
        scenario's finally block.
    """

    def __init__(
        self,
        script_path: Path,
        env: dict[str, str],
        artifacts_dir: Path,
        *,
        output_log_name: str = "k6-output.log",
        summary_name: str = "k6-summary.json",
        event_prefix: str = DEFAULT_EVENT_PREFIX,
        k6_binary: str = "k6",
    ) -> None:
        self.script_path = Path(script_path)
        self.env = env
        self.artifacts_dir = Path(artifacts_dir)
        self.output_log_name = output_log_name
        self.summary_name = summary_name
        self.event_prefix = event_prefix
        self.k6_binary = k6_binary

        self.output_log_path = self.artifacts_dir / self.output_log_name
        self.summary_path = self.artifacts_dir / self.summary_name
        self._process: Optional[subprocess.Popen[bytes]] = None
        self._started_at: Optional[float] = None
        self._start_called = False
        self._stopped = False
        self._stop_returncode: Optional[int] = None

    @staticmethod
    def is_available(k6_binary: str = "k6") -> bool:
        """True iff `shutil.which(k6_binary)` resolves AND `k6 version` returns 0."""
        resolved = shutil.which(k6_binary)
        if not resolved:
            return False

        try:
            result = subprocess.run(
                [resolved, "version"],
                capture_output=True,
                text=True,
                timeout=5,
            )
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return False

        return result.returncode == 0 and "k6" in result.stdout.lower()

    def start(self) -> None:
        """
        Launches k6 with:
          k6 run --summary-export <artifacts_dir>/<summary_name> <script_path>
        Env passed via Popen env arg (merged with os.environ).
        Stdout+stderr both piped to <artifacts_dir>/<output_log_name>.
        Sets self._started_at = time.time().
        Raises RuntimeError if k6 binary not available.
        Raises FileNotFoundError if script_path doesn't exist.
        """
        if self._start_called:
            raise RuntimeError("K6Runner.start() may only be called once.")

        self._start_called = True

        if not self.script_path.exists():
            raise FileNotFoundError(self.script_path)

        if not self.is_available(self.k6_binary):
            raise RuntimeError(f"k6 binary is not available: {self.k6_binary}")

        self.artifacts_dir.mkdir(parents=True, exist_ok=True)
        self.output_log_path.touch(exist_ok=True)

        process_env = os.environ.copy()
        process_env.update(self.env)
        command = [
            self.k6_binary,
            "run",
            "--summary-export",
            str(self.summary_path),
            str(self.script_path),
        ]
        creationflags = (
            subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform.startswith("win") else 0
        )

        output_log = self.output_log_path.open("ab")
        try:
            self._process = subprocess.Popen(
                command,
                stdin=subprocess.DEVNULL,
                stdout=output_log,
                stderr=subprocess.STDOUT,
                env=process_env,
                text=False,
                creationflags=creationflags,
            )
            self._started_at = time.time()
        finally:
            output_log.close()

    def read_events(self, since: float = 0.0) -> list[K6Event]:
        """
        Parses every line of the output log so far that starts with the event
        prefix, returns K6Event instances with ts (in seconds, divided from k6's
        ms) >= since. Tolerant of partially-written lines: lines that don't
        contain valid JSON after the prefix are skipped silently.
        """
        if not self.output_log_path.exists():
            return []

        lines = self._read_log_lines()
        events: list[K6Event] = []
        for line in lines:
            raw_event = self._parse_event_line(line)
            if raw_event is None:
                continue

            event = self._to_event(raw_event)
            if event is None:
                continue

            if event.ts >= since:
                events.append(event)

        return events

    def count_events(
        self,
        predicate: Callable[[K6Event], bool],
        since: float = 0.0,
    ) -> int:
        """Returns len([e for e in self.read_events(since) if predicate(e)])."""
        return len([event for event in self.read_events(since) if predicate(event)])

    def wait_for(
        self,
        predicate: Callable[[K6Event], bool],
        *,
        timeout: float,
        poll_interval: float = 0.5,
        since: float = 0.0,
    ) -> bool:
        """
        Polls read_events until predicate matches at least one event or timeout
        elapses. Returns True on match, False on timeout.
        """
        deadline = time.monotonic() + timeout
        while True:
            if any(predicate(event) for event in self.read_events(since)):
                return True

            if time.monotonic() >= deadline:
                return False

            self._sleep_until_next_poll(deadline, poll_interval)

    def wait_for_count(
        self,
        predicate: Callable[[K6Event], bool],
        *,
        count: int,
        timeout: float,
        poll_interval: float = 0.5,
        since: float = 0.0,
    ) -> int:
        """
        Polls until count_events(predicate, since) >= count or timeout.
        Returns the final count (>= count on success, < count on timeout).
        """
        deadline = time.monotonic() + timeout
        while True:
            current_count = self.count_events(predicate, since)
            if current_count >= count or time.monotonic() >= deadline:
                return current_count

            self._sleep_until_next_poll(deadline, poll_interval)

    def stop(self, timeout: float = 10.0) -> int:
        """
        Sends SIGTERM (or CTRL_BREAK_EVENT on Windows), waits up to timeout,
        force-kills on hang. Returns the process exit code (-signal on POSIX
        when killed by signal). Idempotent: a second call is a no-op.
        """
        if self._stopped:
            return self._stop_returncode if self._stop_returncode is not None else 0

        self._stopped = True

        if self._process is None:
            self._stop_returncode = 0
            return self._stop_returncode

        if self._process.poll() is not None:
            self._stop_returncode = self._process.returncode
            return self._stop_returncode

        try:
            if sys.platform.startswith("win"):
                self._process.send_signal(signal.CTRL_BREAK_EVENT)
            else:
                self._process.send_signal(signal.SIGTERM)
        except (OSError, ValueError):
            self._process.terminate()

        try:
            self._stop_returncode = self._process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            self._process.kill()
            self._stop_returncode = self._process.wait()

        return self._stop_returncode

    def summary(self) -> Optional[dict]:
        """Reads <artifacts_dir>/<summary_name> if it exists, returns parsed JSON."""
        if not self.summary_path.exists():
            return None

        return json.loads(self.summary_path.read_text(encoding="utf-8"))

    def __enter__(self) -> "K6Runner":
        self.start()
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.stop()

    def _read_log_lines(self) -> Iterable[str]:
        return self.output_log_path.read_bytes().decode("utf-8", errors="replace").splitlines()

    def _parse_event_line(self, line: str) -> Optional[dict]:
        prefix_index = line.find(self.event_prefix)
        if prefix_index < 0:
            return None

        # k6 v1.x wraps console.log output as: time="..." level=info msg="CP09_EVENT {\"ts\":...}" source=console
        # The JSON inside msg="..." is backslash-escaped. Older k6 (and direct stdout) writes the
        # JSON unescaped. Try the unescaped form first, then fall back to extracting and unescaping
        # the msg="..." content.
        json_start = line.find("{", prefix_index + len(self.event_prefix))
        if json_start >= 0:
            try:
                raw_event, _ = json.JSONDecoder().raw_decode(line[json_start:])
                if isinstance(raw_event, dict):
                    return raw_event
            except json.JSONDecodeError:
                pass

        # Fallback: parse the k6 v1.x wrapped form. Extract the JSON object embedded in msg="...".
        # We look for `{` (possibly preceded by `\`) after the event prefix and walk until the
        # matching `}` while honoring backslash-escaped quotes (treating \" as a string boundary).
        wrapped = self._extract_wrapped_json(line, prefix_index + len(self.event_prefix))
        if wrapped is None:
            return None
        try:
            raw_event = json.loads(wrapped)
        except json.JSONDecodeError:
            return None
        return raw_event if isinstance(raw_event, dict) else None

    @staticmethod
    def _extract_wrapped_json(line: str, start: int) -> Optional[str]:
        """Extract a JSON object embedded in a k6 v1.x ``msg="..."`` log line.

        The on-disk representation escapes every ``"`` inside the message as ``\\"``.
        We unescape ``\\"`` → ``"`` and ``\\\\`` → ``\\`` and return the JSON substring
        from the first ``{`` through the matching ``}``.
        """

        idx = start
        n = len(line)
        # Skip whitespace/backslashes between prefix and first `{`.
        while idx < n and line[idx] not in "{":
            idx += 1
        if idx >= n:
            return None

        # Walk the wrapped content, tracking string state. Inside the k6 log line every literal
        # quote that belongs to the embedded JSON appears as the two characters \ and ".
        depth = 0
        in_string = False
        buf: list[str] = []
        i = idx
        while i < n:
            ch = line[i]
            if ch == "\\" and i + 1 < n:
                nxt = line[i + 1]
                if nxt == '"':
                    buf.append('"')
                    in_string = not in_string
                    i += 2
                    continue
                if nxt == "\\":
                    buf.append("\\")
                    i += 2
                    continue
                # Pass through other escape sequences (e.g. \n, \t) verbatim — json.loads handles them.
                buf.append(ch)
                buf.append(nxt)
                i += 2
                continue
            if ch == '"' and not in_string:
                # A bare un-escaped quote terminates the k6 msg="..." wrapper.
                break
            buf.append(ch)
            if not in_string:
                if ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        return "".join(buf)
            i += 1

        return None

    def _to_event(self, raw_event: dict) -> Optional[K6Event]:
        try:
            raw_ts = float(raw_event["ts"])
            vu = int(raw_event.get("vu", 0))
        except (KeyError, TypeError, ValueError):
            return None

        return K6Event(
            ts=raw_ts / 1000.0,
            vu=vu,
            cluster=str(raw_event.get("cluster", "")),
            event=str(raw_event.get("event", "")),
            code=self._optional_int(raw_event.get("code")),
            details=str(raw_event.get("details", "")),
            raw=raw_event,
        )

    @staticmethod
    def _optional_int(value: object) -> Optional[int]:
        if value is None:
            return None

        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _sleep_until_next_poll(deadline: float, poll_interval: float) -> None:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return

        time.sleep(min(max(poll_interval, 0.0), remaining))
