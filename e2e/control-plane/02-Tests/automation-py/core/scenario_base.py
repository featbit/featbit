"""Scenario framework: base class and scenario definition utilities."""

ABC_module = __import__("abc")
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional
import json
import subprocess
import time
import uuid

from .api_client import ApiClient, extract_data
from .assertions import AssertionRegistry
from .auth import resolve_authorization_header, resolve_request_context
from .models import FlagState, SegmentState, ScenarioConfig, TimelineEvent


@dataclass
class ScenarioDefinition:
    """Definition of a scenario variant."""

    scenario_type: str  # cp02, cp03
    source_region: str
    target_region: str
    default_flag_key: str
    target_status: bool


class BaseScenario(ABC):
    """Base class for all scenario implementations."""

    def __init__(self, config: ScenarioConfig):
        """Initialize scenario.

        Args:
            config: ScenarioConfig with all parameters
        """
        self.config = config
        self.run_id = str(uuid.uuid4())
        self.run_started_utc = datetime.utcnow().isoformat() + "Z"
        self.timeline: list[TimelineEvent] = []
        self.assertions = AssertionRegistry()
        self.artifact_dir: Optional[Path] = None
        self._on_step: Optional[Any] = None

    @abstractmethod
    def definition(self) -> ScenarioDefinition:
        """Return scenario definition (source/target region, flag key, etc.)."""
        raise NotImplementedError

    @abstractmethod
    def run(self) -> bool:
        """Execute scenario. Return True if passed, False if failed."""
        raise NotImplementedError

    def _notify_step(self, name: str, status: str, detail: str = "") -> None:
        """Fire step callback if one is configured."""
        if self._on_step is not None:
            self._on_step(name, status, detail)

    def setup_artifacts(self) -> None:
        """Create artifact directory."""
        artifacts_root = Path(self.config.artifacts_root)
        self.artifact_dir = (
            artifacts_root
            / self.config.scenario_name
            / self.run_id
        )
        self.artifact_dir.mkdir(parents=True, exist_ok=True)

    def write_artifacts(self) -> None:
        """Write timeline, assertions, and summary JSON files."""
        if not self.artifact_dir:
            return

        # Write timeline
        timeline_data = [json.loads(event.json()) for event in self.timeline]
        timeline_path = self.artifact_dir / "timeline.json"
        timeline_path.write_text(json.dumps(timeline_data, indent=2), encoding="utf-8")

        # Write assertions
        assertions_data = [json.loads(a.json()) for a in self.assertions.assertions]
        assertions_path = self.artifact_dir / "assertions.json"
        assertions_path.write_text(json.dumps(assertions_data, indent=2), encoding="utf-8")

        # Write summary
        definition = self.definition()
        failed_assertions = self.assertions.get_failed()
        summary_data = {
            "runId": self.run_id,
            "scenario": self.config.scenario_name,
            "startedUtc": self.run_started_utc,
            "finishedUtc": datetime.utcnow().isoformat() + "Z",
            "envId": self.config.env_id,
            "flagKey": definition.default_flag_key,
            "sourceRegion": definition.source_region,
            "targetRegion": definition.target_region,
            "expectedStatus": definition.target_status,
            "passed": self.assertions.all_passed(),
            "failedAssertions": [json.loads(a.json()) for a in failed_assertions],
            "artifacts": {
                "summary": str(self.artifact_dir / "summary.json"),
                "assertions": str(assertions_path),
                "timeline": str(timeline_path),
            },
        }
        summary_path = self.artifact_dir / "summary.json"
        summary_path.write_text(json.dumps(summary_data, indent=2), encoding="utf-8")

    def add_timeline_event(
        self,
        event_type: str,
        **kwargs: Any,
    ) -> None:
        """Add event to timeline."""
        event_dict = {
            "type": event_type,
            "timestamp_utc": datetime.utcnow().isoformat() + "Z",
            **kwargs,
        }
        # Remove None values
        event_dict = {k: v for k, v in event_dict.items() if v is not None}
        event = TimelineEvent(**event_dict)
        self.timeline.append(event)

    def get_api_base_url(self, region: str) -> str:
        """Get API base URL for region."""
        if region == "west":
            return self.config.west_api_base_url.rstrip("/")
        else:
            return self.config.east_api_base_url.rstrip("/")

    def toggle_flag(
        self,
        base_url: str,
        flag_key: str,
        status: bool,
        headers: Dict[str, str],
    ) -> Dict[str, Any]:
        """Toggle a feature flag.

        Args:
            base_url: API base URL
            flag_key: Feature flag key
            status: Target status (true/false)
            headers: Request headers with auth

        Returns:
            API response
        """
        client = ApiClient(
            base_url,
            self.config.skip_certificate_check,
            self.config.api_version,
        )
        status_str = "true" if status else "false"
        endpoint = (
            f"/api/v{self.config.api_version}/envs/{self.config.env_id}/"
            f"feature-flags/{flag_key}/toggle/{status_str}"
        )
        response = client.put(endpoint, body="{}", headers=headers)
        return response

    def get_flag_state(
        self,
        base_url: str,
        flag_key: str,
        region: str,
        headers: Dict[str, str],
    ) -> FlagState:
        """Get current flag state from API.

        Args:
            base_url: API base URL
            flag_key: Feature flag key
            region: Source/target region label
            headers: Request headers with auth

        Returns:
            FlagState with current flag status
        """
        client = ApiClient(
            base_url,
            self.config.skip_certificate_check,
            self.config.api_version,
        )
        endpoint = (
            f"/api/v{self.config.api_version}/envs/{self.config.env_id}/"
            f"feature-flags/{flag_key}"
        )
        try:
            response = client.get(endpoint, headers=headers)
            data = extract_data(response)
            return FlagState(
                region=region,
                observed_at_utc=datetime.utcnow().isoformat() + "Z",
                is_enabled=data.get("isEnabled") if data else None,
                key=data.get("key") if data else None,
                version=data.get("version") if data else None,
                id=data.get("id") if data else None,
                error=None,
            )
        except Exception as e:
            return FlagState(
                region=region,
                observed_at_utc=datetime.utcnow().isoformat() + "Z",
                is_enabled=None,
                key=flag_key,
                version=None,
                id=None,
                error=str(e),
            )

    def poll_convergence(
        self,
        source_base_url: str,
        target_base_url: str,
        flag_key: str,
        expected_status: bool,
        headers: Dict[str, str],
    ) -> tuple[bool, Optional[FlagState], Optional[FlagState]]:
        """Poll until source and target flag states converge.

        Args:
            source_base_url: Source region API URL
            target_base_url: Target region API URL
            flag_key: Feature flag key
            expected_status: Expected final status
            headers: Request headers with auth

        Returns:
            (converged: bool, source_state: FlagState, target_state: FlagState)
        """
        deadline = time.time() + self.config.timeout_seconds

        while time.time() < deadline:
            source_state = self.get_flag_state(
                source_base_url, flag_key, "source", headers
            )
            target_state = self.get_flag_state(
                target_base_url, flag_key, "target", headers
            )

            self.add_timeline_event(
                "poll",
                source=json.loads(source_state.json()),
                target=json.loads(target_state.json()),
            )

            source_match = (
                source_state.error is None
                and source_state.is_enabled == expected_status
            )
            target_match = (
                target_state.error is None
                and target_state.is_enabled == expected_status
            )

            if source_match and target_match:
                return True, source_state, target_state

            time.sleep(self.config.poll_interval_ms / 1000.0)

        return False, None, None

    def run_optional_check(
        self,
        name: str,
        command: Optional[str],
        required: bool = False,
        timeout: int = 30,
    ) -> None:
        """Run optional check command.

        Args:
            name: Check name
            command: Shell command to run
            required: If True, fail if command not provided or fails
            timeout: Seconds before the command is killed (ops commands that wait
                for kubectl rollouts need far more than the 30s default)
        """
        self._notify_step(name, "running")
        if not command:
            if required:
                self.assertions.add_fail(
                    name, "Command is required but was not provided."
                )
                self._notify_step(name, "failed", "command not provided")
            else:
                self.assertions.add_skip(name, "Not configured.")
                self._notify_step(name, "skipped")
            return

        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=timeout,
            )
            output = result.stdout + result.stderr

            self.add_timeline_event(
                "optional-check",
                check=name,
                output=output.strip(),
            )

            if result.returncode == 0:
                self.assertions.add_pass(name, "Command executed successfully.")
                self._notify_step(name, "ok")
            else:
                self.assertions.add_fail(
                    name,
                    f"Command failed with exit code {result.returncode}. "
                    f"Output: {output.strip()}",
                )
                self._notify_step(name, "failed", f"exit {result.returncode}")
        except subprocess.TimeoutExpired:
            self.assertions.add_fail(name, "Command timed out after 30 seconds.")
            self._notify_step(name, "failed", "timed out")
        except Exception as e:
            self.assertions.add_fail(name, f"Command execution error: {e}")
            self._notify_step(name, "failed", str(e)[:40])

    def _run_kubectl(self, args: list[str], timeout: int = 20) -> subprocess.CompletedProcess[str]:
        """Run kubectl command and capture output."""
        return subprocess.run(
            ["kubectl", *args],
            capture_output=True,
            text=True,
            timeout=timeout,
        )

    def _discover_redis_pod(self, context: str, namespace: str) -> Optional[str]:
        """Discover a Redis pod name in the target cluster.

        The Sentinel statefulset (featbit-redis-node-*) is the authoritative
        per-cluster cache whenever it is present: a fresh deploy also leaves a
        legacy "redis" pod Running (labeled app=redis) that points at an empty
        orphan Redis, so a label match must never win over a sentinel node
        (#113 follow-up — the old label-first order sent every observation to
        the orphan).
        """
        all_pods = self._run_kubectl(
            ["--context", context, "-n", namespace, "get", "pods", "-o", "json"]
        )
        if all_pods.returncode != 0:
            return None

        try:
            items = json.loads(all_pods.stdout).get("items", [])
        except json.JSONDecodeError:
            return None

        running = [
            item for item in items
            if item.get("metadata", {}).get("name")
            and item.get("status", {}).get("phase") == "Running"
        ]
        # 1. Sentinel statefulset nodes (per-cluster HA topology).
        for item in running:
            if item.get("metadata", {}).get("name", "").startswith("featbit-redis-node"):
                return item["metadata"]["name"]
        # 2. Pods labeled app=redis (legacy single-pod topology).
        for item in running:
            if (item.get("metadata", {}).get("labels") or {}).get("app") == "redis":
                return item["metadata"]["name"]
        # 3. Name-prefix fallback for unlabeled legacy pods.
        for item in running:
            if item.get("metadata", {}).get("name", "").startswith("redis"):
                return item["metadata"]["name"]

        return None

    def _run_redis_key_lookup(
        self,
        assertion_name: str,
        command: Optional[str],
        redis_key: str,
        identifier: str,
        identifier_label: str,
        region: str,
        context: Optional[str] = None,
        diagnostics: bool = True,
        timeline_event: str = "redis-auto-check",
        timeline_extra: Optional[dict] = None,
    ) -> tuple:
        """Core Redis key lookup logic shared by all redis check methods.

        Returns (found: bool, keys: list, sampled_values: list).
        Handles service discovery, PING, GET, fallback SCAN, and diagnostics.
        On failure, records assertions and returns (False, [], []).
        """
        if command:
            self.run_optional_check(assertion_name, command, required=True)
            return (True, [], [])

        self._notify_step(assertion_name, "running")
        effective_context = context or region
        namespace = "featbit"
        service_name = "redis"

        try:
            svc_result = self._run_kubectl(
                [
                    "--context",
                    effective_context,
                    "-n",
                    namespace,
                    "get",
                    "svc",
                    service_name,
                    "-o",
                    "json",
                ]
            )
            if svc_result.returncode != 0:
                # No legacy "redis" service — Sentinel topology (featbit-redis-node-*).
                # Fall back to exec'ing redis-cli against localhost inside the node pod.
                service_name = None
                cluster_ip = None
                redis_port = 6379
            else:
                svc = json.loads(svc_result.stdout)
                cluster_ip = svc.get("spec", {}).get("clusterIP")
                ports = svc.get("spec", {}).get("ports", [])
                redis_port = ports[0].get("port") if ports else 6379

            pod_name = self._discover_redis_pod(context=effective_context, namespace=namespace)
            if not pod_name:
                self.assertions.add_fail(
                    assertion_name,
                    f"Auto-discovery failed: no running redis pod found in context '{effective_context}' namespace '{namespace}'.",
                )
                self._notify_step(assertion_name, "failed", "no redis pod found")
                return (False, [], [])

            # Sentinel node pods run two containers (redis + sentinel): pin the exec to
            # the redis container AND target localhost in-pod — an orphaned legacy
            # "redis" service may still resolve to the wrong (empty) redis, so the
            # sentinel topology always wins over the service name.
            if pod_name.startswith("featbit-redis-node"):
                container_args = ["-c", "redis"]
                service_name = None
            else:
                container_args = []
            host_args = ["-h", service_name] if service_name else []
            ping_result = self._run_kubectl(
                [
                    "--context",
                    effective_context,
                    "-n",
                    namespace,
                    "exec",
                    pod_name,
                    *container_args,
                    "--",
                    "redis-cli",
                    *host_args,
                    "-p",
                    str(redis_port),
                    "ping",
                ],
                timeout=30,
            )

            output = (ping_result.stdout + ping_result.stderr).strip()
            if ping_result.returncode != 0 or "PONG" not in ping_result.stdout.upper():
                self.assertions.add_fail(
                    assertion_name,
                    f"Auto-check failed for context={effective_context}, namespace={namespace}, pod={pod_name}, endpoint={cluster_ip}:{redis_port}. Output: {output}",
                )
                self._notify_step(assertion_name, "failed", "redis ping failed")
                return (False, [], [])

            if not identifier:
                self.assertions.add_fail(
                    assertion_name,
                    f"Redis check requires {identifier_label} for key lookup in context={effective_context}.",
                )
                self._notify_step(assertion_name, "failed", f"{identifier_label} not resolved")
                return (False, [], [])

            keys: list[str] = []
            sampled_values: list[str] = []

            def _redis_cli(*args):
                return self._run_kubectl(
                    [
                        "--context",
                        effective_context,
                        "-n",
                        namespace,
                        "exec",
                        pod_name,
                        *container_args,
                        "--",
                        "redis-cli",
                        *host_args,
                        "-p",
                        str(redis_port),
                        *args,
                    ],
                    timeout=30,
                )

            get_primary_result = _redis_cli("GET", redis_key)
            primary_value = (get_primary_result.stdout + get_primary_result.stderr).strip()
            if get_primary_result.returncode == 0 and primary_value and "(nil)" not in primary_value.lower():
                keys = [redis_key]
                sampled_values.append(primary_value)
            else:
                scan_result = _redis_cli("--scan", "--pattern", f"{redis_key}*")
                if scan_result.returncode == 0:
                    keys = [line.strip() for line in scan_result.stdout.splitlines() if line.strip()]
                else:
                    self.assertions.add_fail(
                        assertion_name,
                        f"Redis key scan failed for {identifier_label}={identifier} (key={redis_key}) in context={effective_context}. Output: {(scan_result.stdout + scan_result.stderr).strip()}",
                    )
                    self._notify_step(assertion_name, "failed", "key scan failed")
                    return (False, [], [])

                if not keys:
                    diag_hint = ""
                    if diagnostics:
                        diag_scan = _redis_cli("--scan", "--pattern", f"*{identifier}*")
                        diag_keys = [line.strip() for line in diag_scan.stdout.splitlines() if line.strip()]
                        diag_hint = (
                            f" Wildcard scan found keys: {diag_keys}" if diag_keys
                            else f" Wildcard scan also found no keys containing the {identifier_label}."
                        )
                    self.assertions.add_fail(
                        assertion_name,
                        f"Redis is reachable but no keys found for {identifier_label}={identifier} "
                        f"(tried key={redis_key}) in context={effective_context}.{diag_hint}",
                    )
                    self._notify_step(assertion_name, "failed", "no keys found")
                    return (False, [], [])

            # GatedCommit: at commit time the peer DC receives the committed
            # pointer and the versioned key, but its legacy single-value key
            # is NOT rewritten (eval reads are pointer-gated; the legacy key
            # is the BestEffort transport). Sample the pointer's versioned
            # key too, so value expectations see what the evaluation servers
            # actually serve (#113). featbit:{res}:{id} -> featbit:{res}-committed:{id}
            key_prefix, _, key_ident = redis_key.rpartition(":")
            if key_prefix and key_ident:
                pointer_key = f"{key_prefix}-committed:{key_ident}"
                ptr_result = _redis_cli("GET", pointer_key)
                ptr_value = (ptr_result.stdout + ptr_result.stderr).strip()
                if (
                    ptr_result.returncode == 0
                    and ptr_value
                    and "(nil)" not in ptr_value.lower()
                ):
                    versioned_key = f"{redis_key}:v{ptr_value}"
                    if versioned_key not in keys:
                        keys.append(versioned_key)

            for key in keys[:5]:
                get_result = _redis_cli("GET", key)
                text = (get_result.stdout + get_result.stderr).strip()
                sampled_values.append(text)

            event_data = {
                "check": assertion_name,
                "output": output,
                identifier_label: identifier,
                "matched_key_count": len(keys),
                "sampled_keys": keys[:5],
            }
            if timeline_extra:
                event_data.update(timeline_extra)
            self.add_timeline_event(timeline_event, **event_data)

            return (True, keys, sampled_values)

        except subprocess.TimeoutExpired:
            self.assertions.add_fail(
                assertion_name,
                f"Auto-check timed out while querying Redis in context '{effective_context}'.",
            )
            self._notify_step(assertion_name, "failed", "timed out")
            return (False, [], [])
        except Exception as e:
            self.assertions.add_fail(assertion_name, f"Auto-check error: {e}")
            self._notify_step(assertion_name, "failed", str(e)[:40])
            return (False, [], [])

    def run_redis_check(
        self,
        region: str,
        command: Optional[str],
        flag_id: Optional[str] = None,
        flag_key: Optional[str] = None,
        expected_status: Optional[bool] = None,
        context: Optional[str] = None,
    ) -> None:
        """Run Redis check for flag via provided command or automatic Kubernetes discovery.

        When ``expected_status`` is given, the value check POLLS until it
        matches or ``config.timeout_seconds`` elapses: under GatedCommit the
        legacy ``featbit:flag:{id}`` key only updates at commit time
        (coordinator tick), while the management API converges instantly
        (shared Mongo) — a single sample races the commit (#113).
        """
        assertion_name = f"redis-{region}-check"

        deadline = time.time() + (self.config.timeout_seconds or 60)
        poll_interval = (self.config.poll_interval_ms or 1000) / 1000.0

        while True:
            found, keys, sampled_values = self._run_redis_key_lookup(
                assertion_name=assertion_name,
                command=command,
                redis_key=f"featbit:flag:{flag_id}" if flag_id else "",
                identifier=flag_id or "",
                identifier_label="flag_id",
                region=region,
                context=context,
                diagnostics=True,
                timeline_event="redis-auto-check",
                timeline_extra={
                    "flag_key": flag_key,
                    "expected_status": expected_status,
                },
            )
            if not found or command:
                return

            expected_state_ok = True
            if expected_status is not None:
                expected_token = f'"isenabled":{str(expected_status).lower()}'
                expected_state_ok = any(
                    expected_token in value.lower() for value in sampled_values
                )

            if expected_state_ok:
                self.assertions.add_pass(
                    assertion_name,
                    f"Redis contains {len(keys)} key(s) for flag_id={flag_id} in context={context or region}.",
                )
                self._notify_step(assertion_name, "ok")
                return

            if time.time() >= deadline:
                break
            time.sleep(poll_interval)

        self.assertions.add_fail(
            assertion_name,
            f"Redis contains keys for flag_key={flag_key} in context={context or region}, "
            f"but sampled values did not include expected isEnabled={expected_status} "
            f"within {self.config.timeout_seconds}s.",
        )
        self._notify_step(assertion_name, "failed", "isEnabled mismatch")

    def run_segment_redis_check(
        self,
        region: str,
        command: Optional[str],
        segment_id: Optional[str] = None,
        segment_key: Optional[str] = None,
        context: Optional[str] = None,
    ) -> None:
        """Run Redis check for segment via provided command or automatic Kubernetes discovery."""
        assertion_name = f"redis-{region}-segment-check"

        found, keys, _ = self._run_redis_key_lookup(
            assertion_name=assertion_name,
            command=command,
            redis_key=f"featbit:segment:{segment_id}" if segment_id else "",
            identifier=segment_id or "",
            identifier_label="segment_id",
            region=region,
            context=context,
            diagnostics=True,
            timeline_event="redis-segment-check",
            timeline_extra={"segment_key": segment_key},
        )
        if not found or command:
            return

        self.assertions.add_pass(
            assertion_name,
            f"Redis contains {len(keys)} key(s) for segment_id={segment_id} in context={context or region}.",
        )
        self._notify_step(assertion_name, "ok")

    def run_secret_redis_check(
        self,
        region: str,
        command: Optional[str],
        secret_string: Optional[str] = None,
        context: Optional[str] = None,
    ) -> None:
        """Run Redis check for secret via provided command or automatic Kubernetes discovery."""
        assertion_name = f"redis-{region}-secret-check"

        found, keys, _ = self._run_redis_key_lookup(
            assertion_name=assertion_name,
            command=command,
            redis_key=f"featbit:secret:{secret_string}" if secret_string else "",
            identifier=secret_string or "",
            identifier_label="secret_string",
            region=region,
            context=context,
            diagnostics=False,
            timeline_event="redis-secret-check",
        )
        if not found or command:
            return

        self.assertions.add_pass(
            assertion_name,
            f"Redis contains {len(keys)} key(s) for secret in context={context or region}.",
        )
        self._notify_step(assertion_name, "ok")

    def run_license_redis_check(
        self,
        region: str,
        command: Optional[str],
        workspace_id: Optional[str] = None,
        context: Optional[str] = None,
    ) -> None:
        """Run Redis check for license via provided command or automatic Kubernetes discovery."""
        assertion_name = f"redis-{region}-license-check"

        found, keys, _ = self._run_redis_key_lookup(
            assertion_name=assertion_name,
            command=command,
            redis_key=f"featbit:license:{workspace_id}" if workspace_id else "",
            identifier=workspace_id or "",
            identifier_label="workspace_id",
            region=region,
            context=context,
            diagnostics=False,
            timeline_event="redis-license-check",
        )

        if not found or command:
            return

        self.assertions.add_pass(
            assertion_name,
            f"Redis contains license key for workspace in context={context or region}.",
        )
        self._notify_step(assertion_name, "ok")

    _KAFKA_BIN = "/opt/bitnami/kafka/bin"
    _KAFKA_BOOTSTRAP = "kafka:9092"
    _KAFKA_AGGREGATE_BOOTSTRAP = "kafka-aggregate:9092"

    def _discover_kafka_pod(self, context: str, namespace: str) -> Optional[str]:
        """Discover the Kafka broker pod in the target cluster.

        Several kafka-* pods run alongside the broker (kafka-ui,
        kafka-aggregate, the mirrormakers); only the broker pod labeled
        ``app=kafka`` carries kafka-console-consumer.sh, so match the label
        exactly (#113 follow-up — the auto check used to reference an
        undefined ``self._KAFKA_POD``).
        """
        all_pods = self._run_kubectl(
            ["--context", context, "-n", namespace, "get", "pods", "-o", "json"]
        )
        if all_pods.returncode != 0:
            return None
        try:
            items = json.loads(all_pods.stdout).get("items", [])
        except json.JSONDecodeError:
            return None
        for item in items:
            meta = item.get("metadata", {})
            if (
                (meta.get("labels") or {}).get("app") == "kafka"
                and item.get("status", {}).get("phase") == "Running"
            ):
                return meta.get("name")
        return None

    def run_kafka_topic_check(
        self,
        name: str,
        command: Optional[str],
        context: str,
        bootstrap: str,
        topic: str,
        flag_id: Optional[str] = None,
        namespace: str = "featbit",
        fallback_context: Optional[str] = None,
    ) -> None:
        """Assert a flag-change message exists on a Kafka topic.

        Uses kubectl exec into the main kafka pod with kafka-console-consumer.sh.
        Delegates to a custom shell command when one is provided.

        ``fallback_context``: under GatedCommit the evaluation-server publish
        happens at commit time in the COMMITTING coordinator's DC — which may
        be the peer, not the source region (#113). When given, a GUID miss in
        the primary context consults the fallback context before failing.
        """
        if command:
            self.run_optional_check(name, command)
            return

        self._notify_step(name, "running")

        if not flag_id:
            self.assertions.add_fail(name, f"Kafka topic check requires flag_id in context={context}.")
            self._notify_step(name, "failed", "flag_id not resolved")
            return

        contexts_to_check = [context]
        if fallback_context and fallback_context != context:
            contexts_to_check.append(fallback_context)

        try:
            checked: list[str] = []
            for ctx in contexts_to_check:
                kafka_pod = self._discover_kafka_pod(ctx, namespace)
                if not kafka_pod:
                    self.assertions.add_fail(
                        name,
                        f"Kafka topic check found no running kafka broker pod "
                        f"(label app=kafka) in context={ctx} namespace={namespace}.",
                    )
                    self._notify_step(name, "failed", "no kafka pod found")
                    return

                result = self._run_kubectl(
                    [
                        "--context", ctx,
                        "-n", namespace,
                        "exec", kafka_pod, "--",
                        f"{self._KAFKA_BIN}/kafka-console-consumer.sh",
                        "--bootstrap-server", bootstrap,
                        "--topic", topic,
                        "--from-beginning",
                        "--timeout-ms", "5000",
                    ],
                    timeout=30,
                )

                # kafka-console-consumer exits 1 on timeout even when messages were
                # found; treat any output as potentially valid and rely on content
                # search. A hard consumer failure in the PRIMARY context is an
                # infrastructure error, not a miss — fail without the fallback.
                output = result.stdout + result.stderr
                if (
                    result.returncode != 0
                    and not result.stdout.strip()
                    and ctx == context
                    and "TimeoutException" not in output
                ):
                    self.assertions.add_fail(
                        name,
                        f"Kafka consumer failed for topic={topic} on bootstrap={bootstrap} "
                        f"in context={ctx}. Output: {output.strip()[:200]}",
                    )
                    self._notify_step(name, "failed", "consumer error")
                    return

                checked.append(ctx)
                if flag_id in output:
                    where = (
                        f"context={ctx}"
                        if ctx == context
                        else f"fallback context={ctx} (eval publish lands in the "
                        f"committing coordinator's DC under GatedCommit)"
                    )
                    self.assertions.add_pass(
                        name,
                        f"Flag GUID found in topic={topic} on bootstrap={bootstrap} in {where}.",
                    )
                    self._notify_step(name, "ok")
                    return

            self.assertions.add_fail(
                name,
                f"Flag GUID not found in topic={topic} on bootstrap={bootstrap} "
                f"in context(s)={', '.join(checked)}.",
            )
            self._notify_step(name, "failed", "guid not in messages")

        except subprocess.TimeoutExpired:
            self.assertions.add_fail(name, f"Kafka topic check timed out for topic={topic} in context={context}.")
            self._notify_step(name, "failed", "timed out")
        except Exception as e:
            self.assertions.add_fail(name, f"Kafka topic check error: {e}")
            self._notify_step(name, "failed", str(e)[:40])

    def create_segment(
        self,
        base_url: str,
        segment_key: str,
        headers: Dict[str, str],
    ) -> Dict[str, Any]:
        """Create a segment via the API.

        Args:
            base_url: API base URL.
            segment_key: Unique key for the segment.
            headers: Request headers with auth.

        Returns:
            API response dict with segment data including 'id'.
        """
        client = ApiClient(
            base_url,
            self.config.skip_certificate_check,
            self.config.api_version,
        )
        endpoint = (
            f"/api/v{self.config.api_version}/envs/{self.config.env_id}/segments"
        )
        payload = {
            "name": segment_key,
            "key": segment_key,
            "type": "environment-specific",
            "scopes": [],
            "description": f"Automated CP-04 test segment ({segment_key})",
        }
        response = client.post(endpoint, payload, headers=headers)
        return extract_data(response)

    def get_segment(
        self,
        base_url: str,
        segment_id: str,
        headers: Dict[str, str],
    ) -> SegmentState:
        """Get segment state from API.

        Args:
            base_url: API base URL.
            segment_id: Segment ID (GUID).
            headers: Request headers with auth.

        Returns:
            SegmentState with current segment info.
        """
        client = ApiClient(
            base_url,
            self.config.skip_certificate_check,
            self.config.api_version,
        )
        endpoint = (
            f"/api/v{self.config.api_version}/envs/{self.config.env_id}/"
            f"segments/{segment_id}"
        )
        try:
            response = client.get(endpoint, headers=headers)
            data = extract_data(response)
            return SegmentState(
                region="",
                observed_at_utc=datetime.utcnow().isoformat() + "Z",
                id=data.get("id") if data else None,
                name=data.get("name") if data else None,
                key=data.get("key") if data else None,
                is_archived=data.get("isArchived") if data else None,
                error=None,
            )
        except Exception as e:
            return SegmentState(
                region="",
                observed_at_utc=datetime.utcnow().isoformat() + "Z",
                error=str(e),
            )

    def delete_segment(
        self,
        base_url: str,
        segment_id: str,
        headers: Dict[str, str],
    ) -> None:
        """Archive a segment to clean up after test.

        Args:
            base_url: API base URL.
            segment_id: Segment ID (GUID).
            headers: Request headers with auth.
        """
        client = ApiClient(
            base_url,
            self.config.skip_certificate_check,
            self.config.api_version,
        )
        endpoint = (
            f"/api/v{self.config.api_version}/envs/{self.config.env_id}/"
            f"segments/{segment_id}/archive"
        )
        try:
            client.put(endpoint, body="{}", headers=headers)
        except Exception:
            pass

    def poll_segment_exists(
        self,
        target_base_url: str,
        segment_id: str,
        headers: Dict[str, str],
    ) -> tuple[bool, Optional[SegmentState]]:
        """Poll target region until segment is accessible via API.

        Args:
            target_base_url: Target region API URL.
            segment_id: Segment ID (GUID).
            headers: Request headers with auth.

        Returns:
            (found: bool, segment_state: SegmentState or None)
        """
        deadline = time.time() + self.config.timeout_seconds

        while time.time() < deadline:
            state = self.get_segment(target_base_url, segment_id, headers)
            self.add_timeline_event(
                "poll",
                result={"segment_id": segment_id, "error": state.error, "found": state.error is None},
            )
            if state.error is None and state.id:
                return True, state
            time.sleep(self.config.poll_interval_ms / 1000.0)

        return False, None

    def run_disruption_command(
        self,
        phase: str,  # start, stop
        command: Optional[str],
    ) -> None:
        """Run disruption command (start or stop).

        Args:
            phase: Phase (start or stop)
            command: Shell command to run

        Raises:
            RuntimeError: If command not provided or fails
        """
        if not command:
            raise RuntimeError(f"{phase} disruption command is required for CP-03.")

        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=60,
            )
            output = result.stdout + result.stderr

            self.add_timeline_event(
                "disruption-command",
                phase=phase,
                output=output.strip(),
            )

            if result.returncode != 0:
                raise RuntimeError(
                    f"Disruption command failed: {output.strip()}"
                )
        except subprocess.TimeoutExpired as e:
            raise RuntimeError(f"Disruption command timed out: {e}") from e
        except Exception as e:
            raise RuntimeError(f"Disruption command error: {e}") from e
