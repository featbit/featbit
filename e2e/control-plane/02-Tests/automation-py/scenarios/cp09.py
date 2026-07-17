"""CP-09: Pod Heartbeat Lifecycle Scenario.

Validates the evaluation-server pod heartbeat lifecycle as described in
``manual_scripts/connection-management/PodHeartbeats.md``:

* Heartbeats are recorded in the Redis hash ``featbit:heartbeat:all``
  (one entry per pod) in both regions, and their timestamps advance over
  time (manual steps 4-5, expected result #1).
* When a west evaluation-server pod is deleted, its heartbeat entry is
  purged from Redis after the pod heartbeat timeout window expires,
  while the east region heartbeat keeps advancing (manual steps 6-9,
  expected result #2).
* When the Deployment controller replaces the deleted pod, a heartbeat
  with a brand-new ``PodId`` appears in Redis (manual steps 12-13,
  expected result #3).
* When k6 and evaluation-server port-forwards are available, synthetic
  WebSocket clients connect through the nginx active/active load
  balancer (``featbit-eval.local:80``) and the scenario observes real
  client migration: when west dies, nginx routes reconnects to east,
  causing west Redis ``featbit:connection:*`` keys to drain and east
  keys to absorb the load. When west recovers, fresh clients land on
  west again via the LB's round-robin upstream. Otherwise only those
  WebSocket assertions are skipped.
"""

import json
import shutil
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from core.api_client import (
    ApiClient,
    EnvSecrets,
    get_env_secrets,
    resolve_project_id_for_env,
)
from core.auth import resolve_authorization_header, resolve_request_context
from core.k6_runner import K6Event, K6Runner
from core.port_forwarder import PortForwarder
from core.scenario_base import BaseScenario, ScenarioDefinition

# Redis key written by RedisCacheService.UpsertPodHeartbeat() in
# modules/back-end/src/Infrastructure/Caches/Redis/RedisCacheService.cs.
HEARTBEAT_HASH_KEY = "featbit:heartbeat:all"

# Default pod heartbeat timeout used by evaluation-server is 90s.
# We allow a small grace period for the back-end janitor pass.
DEFAULT_HEARTBEAT_TIMEOUT_SECONDS = 91
DEFAULT_FAILOVER_TIMEOUT_SECONDS = 240

# Evaluation-server publishes a heartbeat every
# ControlPlane:HeartbeatIntervalSeconds (default 60) — see
# modules/evaluation-server/src/Api/appsettings.json. Wait at least one
# full interval (plus a small grace) before resampling, otherwise the
# Timestamp field will be unchanged and "timestamp-advances" assertions
# will spuriously fail.
DEFAULT_HEARTBEAT_PUBLISH_INTERVAL_SECONDS = 60
HEARTBEAT_RESAMPLE_GRACE_SECONDS = 10
HEARTBEAT_RESAMPLE_MAX_WAIT_SECONDS = (
    DEFAULT_HEARTBEAT_PUBLISH_INTERVAL_SECONDS + HEARTBEAT_RESAMPLE_GRACE_SECONDS + 30
)

# Evaluation-server deployment metadata in the Minikube clusters.
EVAL_SERVER_LABEL_SELECTOR = "app=evaluation-server"
FEATBIT_NAMESPACE = "featbit"
CONNECTION_KEY_PATTERN = "featbit:connection:*"

# Number of replacement clients to push through the LB in Phase 5.
REPLACEMENT_WEST_CLIENTS = 10

REPO_ROOT = Path(__file__).resolve().parents[4]
CP09_K6_SCRIPT = REPO_ROOT / "benchmark" / "k6-scripts" / "cp09" / "cp09-connections.js"

WS_ASSERTION_IDS = (
    "open-west-client-connections",
    "open-east-client-connections",
    "client-connections-recorded-in-redis",
    "west-clients-migrated-to-east",
    "open-replacement-west-clients",
)

K6_MISSING_SKIP_MESSAGE = (
    "k6 not installed; install via benchmark/install-k6.md or rerun Quickstart with -InstallK6"
)
ENV_SECRETS_SKIP_MESSAGE = "Env secrets unavailable; see resolve-env-secrets failure"
WS_DISABLED_SKIP_MESSAGE = "WebSocket assertions disabled via --ws-disabled"


class CP09Scenario(BaseScenario):
    """CP-09 pod heartbeat lifecycle scenario."""

    def definition(self) -> ScenarioDefinition:
        """Return scenario definition (single, non-paired scenario)."""
        return ScenarioDefinition(
            scenario_type="cp09",
            source_region="west",
            target_region="east",
            default_flag_key="ff-cp09-pod-heartbeats",
            target_status=True,
        )

    def run(self) -> bool:
        """Execute CP-09 scenario."""
        try:
            self.setup_artifacts()
            self._primary_runner: Optional[K6Runner] = None
            self._port_forwarder: Optional[PortForwarder] = None
            self._env_secrets: Optional[EnvSecrets] = None
            self._redis_connection_baseline: Optional[int] = None
            self._redis_west_baseline: Optional[int] = None
            self._redis_east_baseline: Optional[int] = None
            self._redis_west_pre_failover: Optional[int] = None
            self._redis_east_pre_failover: Optional[int] = None
            self._websocket_assertions_skipped = False
            definition = self.definition()

            # --- Phase 1: Authentication and Authorization ---
            # (Mirrors cp08 lines 41-69; auth is not strictly required for
            # the Redis/kubectl probes below, but we log run-start with the
            # same context every other scenario uses.)
            self._notify_step("auth", "running")
            auth_header = resolve_authorization_header(
                self.get_api_base_url(definition.source_region),
                self.config.api_authorization_header,
                self.config.login_email,
                self.config.login_password,
                self.config.workspace_key,
                self.config.skip_certificate_check,
                self.config.api_version,
            )
            ctx = resolve_request_context(
                self.get_api_base_url(definition.source_region),
                auth_header,
                self.config.organization_key,
                self.config.skip_certificate_check,
                self.config.api_version,
            )
            self._notify_step("auth", "ok")

            self.add_timeline_event(
                "run-start",
                scenario=self.config.scenario_name,
                source_region=definition.source_region,
                target_region=definition.target_region,
                api_base_url_source=self.get_api_base_url(definition.source_region),
                api_base_url_target=self.get_api_base_url(definition.target_region),
                auth_type="bearer" if auth_header.startswith("Bearer") else "openapi",
                workspace_id=ctx.workspace_id,
                organization_id=ctx.organization_id,
                heartbeat_hash_key=HEARTBEAT_HASH_KEY,
            )

            # Tunables: scenario config timeout_seconds drives the failover
            # wait; the per-pod heartbeat window is fixed at 91s by the
            # back-end janitor logic.
            failover_timeout = max(
                self.config.timeout_seconds or 0,
                DEFAULT_FAILOVER_TIMEOUT_SECONDS,
            )
            heartbeat_timeout = DEFAULT_HEARTBEAT_TIMEOUT_SECONDS
            poll_interval = max(self.config.poll_interval_ms or 1000, 1000) / 1000.0
            west_clients = self._configured_west_clients()
            east_clients = self._configured_east_clients()

            # --- Phase 2: Baseline heartbeat presence (manual steps 4-5) ---
            self._notify_step("baseline-heartbeats", "running")

            west_baseline = self._read_heartbeats("west")
            east_baseline = self._read_heartbeats("east")

            self.add_timeline_event(
                "heartbeats-baseline",
                west_pod_ids=list(west_baseline.keys()),
                east_pod_ids=list(east_baseline.keys()),
            )

            self._assert_heartbeats_present("baseline-west-heartbeats", "west", west_baseline)
            self._assert_heartbeats_present("baseline-east-heartbeats", "east", east_baseline)

            # Sample again after at least one full heartbeat publish interval
            # and assert at least one west/east entry's timestamp advanced
            # (expected result #1). Polls up to HEARTBEAT_RESAMPLE_MAX_WAIT
            # seconds so a clean run finishes fast on fast publishers and a
            # slow publisher doesn't false-fail us.
            west_resample = self._wait_for_heartbeat_advance(
                "west", west_baseline, HEARTBEAT_RESAMPLE_MAX_WAIT_SECONDS, poll_interval
            )
            self.add_timeline_event(
                "heartbeats-resample",
                west_pod_ids=list(west_resample.keys()),
            )
            self._assert_timestamps_advanced(
                "west-heartbeat-timestamp-advances", west_baseline, west_resample
            )

            east_resample = self._wait_for_heartbeat_advance(
                "east", east_baseline, HEARTBEAT_RESAMPLE_MAX_WAIT_SECONDS, poll_interval
            )
            self._assert_timestamps_advanced(
                "east-heartbeat-timestamp-advances", east_baseline, east_resample
            )

            self._notify_step("baseline-heartbeats", "ok")

            # --- Phase 3: Synthetic client connections (manual steps 2-3) ---
            self._run_websocket_phase3(west_clients, east_clients, auth_header, ctx, definition)

            # --- Phase 4: West pod failover (manual steps 6-10) ---
            self._notify_step("west-pod-failover", "running")

            pre_delete_west_pods = self._get_eval_server_pods("west")
            self.add_timeline_event(
                "west-pods-before-delete",
                pods=pre_delete_west_pods,
            )

            if not pre_delete_west_pods:
                self.assertions.add_fail(
                    "west-eval-server-present",
                    "No evaluation-server pod found in west cluster before delete.",
                )
                self._notify_step("west-pod-failover", "failed", "no west pod")
                return self.assertions.all_passed()

            self.assertions.add_pass(
                "west-eval-server-present",
                f"Found {len(pre_delete_west_pods)} evaluation-server pod(s) in west.",
            )

            # Map west pod names to their PodId GUID via the heartbeats hash.
            # The hash field IS the PodId, but the pod name (e.g.
            # evaluation-server-abc-xyz) is not directly recorded. On the
            # composite-write topology the west hash also holds live EAST pods'
            # heartbeats, so scope to west-owned entries (by DcId/Region) —
            # only those should be purged after the west delete (#113).
            pre_delete_west_pod_ids = self._west_owned_pod_ids(west_resample)

            # Guard against the empty-baseline footgun: if Redis returned no
            # west heartbeats (e.g. redis-cli/kubectl errored upstream), the
            # purge-after-delete assertion would trivially pass without
            # proving anything. Short-circuit the failover + recovery phases.
            if not pre_delete_west_pod_ids:
                self.assertions.add_fail(
                    "pre-delete-west-podids-known",
                    (
                        "No west PodIds present in heartbeats hash before "
                        "delete; cannot verify purge or recovery. Inspect "
                        "earlier 'baseline-west-heartbeats' assertion and "
                        "the redis-hgetall-failed / redis-pod-not-found "
                        "timeline events."
                    ),
                )
                self._notify_step("west-pod-failover", "failed", "no baseline podids")
                self.assertions.add_skip(
                    "west-heartbeat-purged-after-pod-delete",
                    "Skipped because pre-delete west PodIds set was empty.",
                )
                self.assertions.add_skip(
                    "west-heartbeat-restored-with-new-pod-id",
                    "Skipped because pre-delete west PodIds set was empty.",
                )
                return self.assertions.all_passed()

            self.assertions.add_pass(
                "pre-delete-west-podids-known",
                f"Tracking {len(pre_delete_west_pod_ids)} pre-delete west PodId(s).",
            )

            # Delete west evaluation-server pods (manual step 6).
            t_failover = time.time()
            delete_result = self._run_kubectl(
                [
                    "--context",
                    "west",
                    "-n",
                    FEATBIT_NAMESPACE,
                    "delete",
                    "pod",
                    "-l",
                    EVAL_SERVER_LABEL_SELECTOR,
                    "--wait=false",
                ],
                timeout=30,
            )
            self.add_timeline_event(
                "west-eval-server-deleted",
                returncode=delete_result.returncode,
                stdout=(delete_result.stdout or "").strip()[:300],
                stderr=(delete_result.stderr or "").strip()[:300],
            )
            if delete_result.returncode != 0:
                self.assertions.add_fail(
                    "west-eval-server-delete",
                    f"kubectl delete failed: {(delete_result.stderr or '').strip()[:200]}",
                )
                self._notify_step("west-pod-failover", "failed", "delete failed")
                return self.assertions.all_passed()

            self.assertions.add_pass(
                "west-eval-server-delete",
                f"Deleted {len(pre_delete_west_pods)} west evaluation-server pod(s).",
            )

            # Manual step 7-8: wait at least heartbeat_timeout seconds for
            # the back-end to purge the entry. We poll up to failover_timeout
            # to keep the suite resilient on slow runners.
            self._notify_step("west-heartbeat-purge", "running")
            purged, observed_west, east_during = self._poll_until_west_heartbeat_purged(
                pre_delete_west_pod_ids,
                deadline_seconds=failover_timeout,
                poll_interval_seconds=poll_interval,
            )

            self.add_timeline_event(
                "west-heartbeat-purge-result",
                purged=purged,
                pre_delete_pod_ids=sorted(pre_delete_west_pod_ids),
                final_west_pod_ids=sorted(observed_west.keys()),
                final_east_pod_ids=sorted(east_during.keys()),
                heartbeat_timeout_seconds=heartbeat_timeout,
            )

            if purged:
                self.assertions.add_pass(
                    "west-heartbeat-purged-after-pod-delete",
                    (
                        f"All pre-delete west PodIds removed from "
                        f"{HEARTBEAT_HASH_KEY} within {failover_timeout}s."
                    ),
                )
                self._notify_step("west-heartbeat-purge", "ok")
            else:
                still_present = pre_delete_west_pod_ids & set(observed_west.keys())
                self.assertions.add_fail(
                    "west-heartbeat-purged-after-pod-delete",
                    (
                        f"PodIds still present after {failover_timeout}s: "
                        f"{sorted(still_present)}"
                    ),
                )
                self._notify_step("west-heartbeat-purge", "failed")

            # Manual step 9: east heartbeat still present and advancing.
            self._assert_heartbeats_present(
                "east-heartbeat-survives-west-failover", "east", east_during
            )
            self._assert_timestamps_advanced(
                "east-heartbeat-advances-during-west-failover",
                east_resample,
                east_during,
            )

            if self._primary_runner is not None:
                self._assert_west_clients_migrated_to_east(west_clients, t_failover)

            self._notify_step("west-pod-failover", "ok")

            # --- Phase 5: West pod recovery (manual steps 12-13) ---
            self._notify_step("west-pod-recovery", "running")

            # Use `rollout status` instead of `kubectl wait` so we wait for
            # the Deployment as a whole to converge (readyReplicas ==
            # desiredReplicas) rather than just "any pod with the label is
            # Ready" — the label selector would otherwise match the
            # still-terminating old pod and let us pass before the
            # replacement is up.
            wait_result = self._run_kubectl(
                [
                    "--context",
                    "west",
                    "-n",
                    FEATBIT_NAMESPACE,
                    "rollout",
                    "status",
                    "deployment/evaluation-server",
                    "--timeout=120s",
                ],
                timeout=130,
            )
            self.add_timeline_event(
                "west-eval-server-ready-wait",
                returncode=wait_result.returncode,
                stdout=(wait_result.stdout or "").strip()[:300],
                stderr=(wait_result.stderr or "").strip()[:300],
            )

            if wait_result.returncode == 0:
                self.assertions.add_pass(
                    "west-eval-server-ready",
                    "Replacement west evaluation-server pod reached Ready.",
                )
            else:
                self.assertions.add_fail(
                    "west-eval-server-ready",
                    f"kubectl wait failed: {(wait_result.stderr or '').strip()[:200]}",
                )

            # Poll for a NEW PodId appearing in the west heartbeats hash.
            new_pod_id, west_after = self._poll_for_new_west_pod_id(
                pre_delete_west_pod_ids,
                deadline_seconds=failover_timeout,
                poll_interval_seconds=poll_interval,
            )
            self.add_timeline_event(
                "west-heartbeat-restored",
                new_pod_id=new_pod_id,
                west_pod_ids=sorted(west_after.keys()),
            )

            if new_pod_id:
                self.assertions.add_pass(
                    "west-heartbeat-restored-with-new-pod-id",
                    (
                        f"New west PodId {new_pod_id} present in "
                        f"{HEARTBEAT_HASH_KEY} (distinct from pre-delete set)."
                    ),
                )
                self._notify_step("west-pod-recovery", "ok")
            else:
                self.assertions.add_fail(
                    "west-heartbeat-restored-with-new-pod-id",
                    (
                        f"No new west PodId appeared in {HEARTBEAT_HASH_KEY} "
                        f"within {failover_timeout}s. "
                        f"Current entries: {sorted(west_after.keys())}"
                    ),
                )
                self._notify_step("west-pod-recovery", "failed")

            if self._primary_runner is not None and wait_result.returncode == 0 and new_pod_id:
                self._assert_replacement_west_clients()
            elif not self._has_assertion("open-replacement-west-clients"):
                self.assertions.add_skip(
                    "open-replacement-west-clients",
                    "Skipped because west pod recovery was not confirmed.",
                )

            # --- Phase 6: Cleanup ---
            # No manual teardown — the Deployment controller has already
            # recreated the deleted pod. We log a no-op event for
            # consistency with other scenarios.
            self._notify_step("cleanup", "running")
            self.add_timeline_event("cleanup", phase="cp09-no-op")
            self._notify_step("cleanup", "ok")

            return self.assertions.all_passed()

        except Exception as exc:  # pragma: no cover - defensive
            self.assertions.add_fail("runner-execution", str(exc))
            return False

        finally:
            if getattr(self, "_primary_runner", None) is not None:
                self._primary_runner.stop(timeout=10.0)
            if getattr(self, "_port_forwarder", None) is not None:
                self._port_forwarder.stop_all()
            self._ensure_websocket_assertions_recorded()
            self.write_artifacts()

    # ------------------------------------------------------------------
    # WebSocket client helpers
    # ------------------------------------------------------------------

    def _run_websocket_phase3(
        self,
        west_clients: int,
        east_clients: int,
        auth_header: str,
        ctx: object,
        definition: ScenarioDefinition,
    ) -> None:
        """Start k6 WebSocket clients and assert initial connection state.

        In LB mode (the default), all VUs connect through the nginx
        active/active load balancer at ``ws_lb_host:ws_lb_port``. nginx
        round-robins across the two evaluation-server upstreams (west
        127.0.0.1:5100, east 127.0.0.1:5101), so per-cluster distribution
        is verified server-side via the ``featbit:connection:*`` Redis
        scan rather than from each VU's perspective.
        """
        self._notify_step("client-connections", "running")

        if self.config.ws_disabled:
            self._skip_websocket_assertions(WS_DISABLED_SKIP_MESSAGE)
            self.add_timeline_event("client-connections-skipped", reason="ws-disabled")
            self._notify_step("client-connections", "skipped", "ws-disabled")
            return

        if not K6Runner.is_available():
            self._skip_websocket_assertions(K6_MISSING_SKIP_MESSAGE)
            self.add_timeline_event("client-connections-skipped", reason="k6-missing")
            self._notify_step("client-connections", "skipped", "k6 missing")
            return

        self._resolve_env_secrets(auth_header, ctx, definition)
        if self._env_secrets is None:
            self._skip_websocket_assertions(ENV_SECRETS_SKIP_MESSAGE)
            self.add_timeline_event("client-connections-skipped", reason="env-secrets-unavailable")
            self._notify_step("client-connections", "skipped", "env secrets")
            return

        try:
            self._port_forwarder = PortForwarder(
                artifacts_dir=self._artifact_dir(),
                kubectl_binary=shutil.which("kubectl") or "kubectl",
            )
            self._port_forwarder.add(
                context="west",
                namespace=FEATBIT_NAMESPACE,
                service="evaluation-server",
                local_port=5100,
                remote_port=5100,
            )
            self._port_forwarder.add(
                context="east",
                namespace=FEATBIT_NAMESPACE,
                service="evaluation-server",
                local_port=5101,
                remote_port=5100,
            )
            self._port_forwarder.start_all(ready_timeout=10.0)
            self.add_timeline_event(
                "port-forwards-ready",
                west_local_port=5100,
                east_local_port=5101,
                log_paths=[str(path) for path in self._port_forwarder.log_paths],
            )
        except Exception as exc:
            log_path = self._port_forward_log_path()
            message = (
                "Could not establish port-forward to evaluation-server "
                f"(west:5100, east:5101) — see {log_path}"
            )
            self._skip_websocket_assertions(message)
            self.add_timeline_event(
                "client-connections-skipped",
                reason="port-forward-failed",
                error=str(exc),
                log_path=str(log_path),
            )
            self._notify_step("client-connections", "skipped", "port-forward failed")
            return

        west_baseline = self._count_redis_connection_keys("west") or 0
        east_baseline = self._count_redis_connection_keys("east") or 0
        self._redis_connection_baseline = west_baseline + east_baseline
        self._redis_west_baseline = west_baseline
        self._redis_east_baseline = east_baseline
        self.add_timeline_event(
            "redis-connection-baseline",
            key_pattern=CONNECTION_KEY_PATTERN,
            west_key_count=west_baseline,
            east_key_count=east_baseline,
            total=self._redis_connection_baseline,
        )

        total_clients = west_clients + east_clients
        self._primary_runner = K6Runner(
            script_path=CP09_K6_SCRIPT,
            env=self._build_k6_env(
                west_clients=west_clients,
                east_clients=east_clients,
                run_duration="30m",
            ),
            artifacts_dir=self._artifact_dir() / "k6-phase3",
        )

        try:
            self._primary_runner.start()
        except Exception as exc:
            self._primary_runner = None
            message = f"Could not start k6 WebSocket client: {exc}"
            self.assertions.add_fail("open-west-client-connections", message)
            self.assertions.add_fail("open-east-client-connections", message)
            self.assertions.add_fail("client-connections-recorded-in-redis", message)
            self.assertions.add_skip(
                "west-clients-migrated-to-east",
                "Skipped because the primary k6 WebSocket runner did not start.",
            )
            self.assertions.add_skip(
                "open-replacement-west-clients",
                "Skipped because the primary k6 WebSocket runner did not start.",
            )
            self.add_timeline_event(
                "client-connections-failed",
                reason="k6-start-failed",
                error=str(exc),
            )
            self._notify_step("client-connections", "failed", "k6 start failed")
            return

        t_start = time.time()
        self.add_timeline_event(
            "k6-client-connections-started",
            total_clients=total_clients,
            west_clients_requested=west_clients,
            east_clients_requested=east_clients,
            sdk_type=self._configured_sdk_type(),
            use_load_balancer=self._configured_use_load_balancer(),
            lb_host=self._configured_lb_host(),
            lb_port=self._configured_lb_port(),
            script_path=str(CP09_K6_SCRIPT),
        )

        self._wait_for_k6_opens(expected_count=total_clients, since=t_start, timeout=30.0)
        self._assert_cluster_received_connections(
            assertion_name="open-west-client-connections",
            context="west",
            baseline=west_baseline,
            total_clients=total_clients,
        )
        self._assert_cluster_received_connections(
            assertion_name="open-east-client-connections",
            context="east",
            baseline=east_baseline,
            total_clients=total_clients,
        )
        self._assert_client_connections_recorded_in_redis(total_clients)

        # Capture the post-stabilization per-cluster distribution. This is the
        # authoritative "pre-failover" baseline for `_assert_west_clients_migrated_to_east`:
        # all 30 VUs have established their initial connections via nginx round-robin
        # and Redis has settled. Reading these counts BEFORE phase 4 deletes the west
        # pods is the only way to know how many connections will need to migrate.
        west_post_connect = self._count_redis_connection_keys("west")
        east_post_connect = self._count_redis_connection_keys("east")
        self._redis_west_pre_failover = west_post_connect if west_post_connect is not None else 0
        self._redis_east_pre_failover = east_post_connect if east_post_connect is not None else 0
        self.add_timeline_event(
            "redis-post-connect-distribution",
            west=self._redis_west_pre_failover,
            east=self._redis_east_pre_failover,
            total_clients=total_clients,
        )
        self._notify_step("client-connections", "ok")

    def _wait_for_k6_opens(self, *, expected_count: int, since: float, timeout: float) -> int:
        """Wait for the primary runner to emit `expected_count` open events.

        Returns the observed count for diagnostic timeline events. Does not
        record an assertion — the per-cluster Redis assertions below are
        the authoritative checks.
        """
        runner = self._primary_runner
        if runner is None or expected_count <= 0:
            return 0

        observed = runner.wait_for_count(
            lambda event: event.event == "open",
            count=expected_count,
            timeout=timeout,
            since=since,
        )
        self.add_timeline_event(
            "k6-client-connections-observed",
            expected=expected_count,
            observed=observed,
        )
        return observed

    def _assert_cluster_received_connections(
        self,
        *,
        assertion_name: str,
        context: str,
        baseline: int,
        total_clients: int,
    ) -> None:
        """Assert that `context` Redis received at least one new connection.

        With nginx round-robin and a healthy upstream, distribution across
        the two clusters should be roughly 50/50. We use a forgiving
        threshold of "at least one connection above baseline" so the
        scenario does not false-fail on scheduling jitter or the small
        per-VU upgrade race. The total-count assertion enforces the
        aggregate.
        """
        observed = self._wait_for_redis_growth(
            context=context,
            baseline=baseline,
            min_growth=1,
            timeout=30.0,
            poll_interval=1.0,
        )
        if observed is None:
            self.assertions.add_fail(
                assertion_name,
                f"Could not count {CONNECTION_KEY_PATTERN} keys in {context} Redis.",
            )
            return

        growth = observed - baseline
        if growth >= 1:
            self.assertions.add_pass(
                assertion_name,
                (
                    f"{context} Redis grew from {baseline} to {observed} "
                    f"{CONNECTION_KEY_PATTERN} key(s) after {total_clients} clients "
                    "connected through the LB."
                ),
            )
            return

        self.assertions.add_fail(
            assertion_name,
            (
                f"Expected at least one new {CONNECTION_KEY_PATTERN} key on {context} "
                f"after {total_clients} LB-routed clients; observed {observed} "
                f"(baseline {baseline}). nginx LB may have failed to route to {context}."
            ),
        )

    def _assert_client_connections_recorded_in_redis(self, expected_count: int) -> None:
        """Assert the aggregate (west+east) Redis connection count grew."""
        baseline = self._redis_connection_baseline or 0
        target_count = baseline + expected_count
        observed = self._wait_for_redis_total(
            target_count=target_count,
            timeout=30.0,
            poll_interval=1.0,
        )
        if observed is None:
            self.assertions.add_fail(
                "client-connections-recorded-in-redis",
                f"Could not count {CONNECTION_KEY_PATTERN} keys across west+east Redis.",
            )
            return

        if observed >= target_count:
            self.assertions.add_pass(
                "client-connections-recorded-in-redis",
                (
                    f"west+east Redis contains {observed} {CONNECTION_KEY_PATTERN} key(s), "
                    f"up from baseline {baseline} (target {target_count})."
                ),
            )
            return

        self.assertions.add_fail(
            "client-connections-recorded-in-redis",
            (
                f"Expected at least {target_count} {CONNECTION_KEY_PATTERN} key(s) "
                f"across west+east Redis (baseline {baseline} + {expected_count} clients); "
                f"observed {observed}."
            ),
        )

    def _wait_for_redis_total(
        self,
        *,
        target_count: int,
        timeout: float,
        poll_interval: float,
    ) -> Optional[int]:
        """Poll west+east Redis until the aggregate count reaches target."""
        deadline = time.monotonic() + timeout
        observed: Optional[int] = None

        while True:
            observed = self._count_total_redis_connection_keys()
            if observed is not None and observed >= target_count:
                return observed

            if time.monotonic() >= deadline:
                return observed

            time.sleep(min(poll_interval, max(deadline - time.monotonic(), 0.0)))

    def _wait_for_redis_growth(
        self,
        *,
        context: str,
        baseline: int,
        min_growth: int,
        timeout: float,
        poll_interval: float,
    ) -> Optional[int]:
        """Poll a single cluster's Redis until it grows by at least `min_growth`."""
        deadline = time.monotonic() + timeout
        observed: Optional[int] = None

        while True:
            observed = self._count_redis_connection_keys(context)
            if observed is not None and observed - baseline >= min_growth:
                return observed

            if time.monotonic() >= deadline:
                return observed

            time.sleep(min(poll_interval, max(deadline - time.monotonic(), 0.0)))

    def _wait_for_redis_decline(
        self,
        *,
        context: str,
        target: int,
        timeout: float,
        poll_interval: float,
    ) -> Optional[int]:
        """Poll a single cluster's Redis until count drops to <= target."""
        deadline = time.monotonic() + timeout
        observed: Optional[int] = None

        while True:
            observed = self._count_redis_connection_keys(context)
            if observed is not None and observed <= target:
                return observed

            if time.monotonic() >= deadline:
                return observed

            time.sleep(min(poll_interval, max(deadline - time.monotonic(), 0.0)))

    def _count_total_redis_connection_keys(self) -> Optional[int]:
        """Return west+east aggregate, or None if either cluster scan failed."""
        west = self._count_redis_connection_keys("west")
        east = self._count_redis_connection_keys("east")
        if west is None or east is None:
            return None
        return west + east

    def _assert_west_clients_migrated_to_east(self, west_clients: int, t_failover: float) -> None:
        """Assert that clients reconnect through the LB to east after west dies.

        The nginx upstream marks west down after the first failed
        connection attempt (default ``max_fails=1`` / ``fail_timeout=10s``).
        New connections — including VU reconnects from VUs that were on
        west — route to east. We assert:

        1. west Redis ``featbit:connection:*`` count drops back to its
           pre-test baseline (all west-side connections closed).
        2. east Redis count grew to at least the pre-failover total
           (clients absorbed by east via the LB).

        We also surface the k6-side close/reconnect counts as
        diagnostic timeline events.
        """
        runner = self._primary_runner
        if runner is None:
            return

        west_baseline = self._redis_west_baseline or 0
        # Use the post-stable-connect distribution captured at the end of
        # phase 3 as the authoritative "pre-failover" snapshot. Reading
        # Redis here would be too late: by the time this method runs the
        # purge-poll has already completed and west clients have migrated.
        west_pre_failover = self._redis_west_pre_failover
        east_pre_failover = self._redis_east_pre_failover
        if west_pre_failover is None:
            west_pre_failover = self._count_redis_connection_keys("west") or 0
        if east_pre_failover is None:
            east_pre_failover = self._count_redis_connection_keys("east") or 0
        west_now = self._count_redis_connection_keys("west")
        east_now = self._count_redis_connection_keys("east")
        self.add_timeline_event(
            "redis-pre-failover-snapshot",
            west_pre_failover=west_pre_failover,
            east_pre_failover=east_pre_failover,
            west_now=west_now,
            east_now=east_now,
        )

        observed_west = self._wait_for_redis_decline(
            context="west",
            target=west_baseline,
            timeout=120.0,
            poll_interval=2.0,
        )
        # Expect east to absorb roughly the clients that were on west.
        # If nginx distributed unevenly (e.g. some west pods slow to be
        # marked Ready) we may have started with very few west clients —
        # require at least 70% of the actual west clients (not the
        # configured ``west_clients`` count) to migrate, with a floor of
        # 1 so the assertion can never trivially pass.
        min_east_growth = max(1, int(west_pre_failover * 0.7)) if west_pre_failover > 0 else 1
        observed_east = self._wait_for_redis_growth(
            context="east",
            baseline=east_pre_failover,
            min_growth=min_east_growth,
            timeout=60.0,
            poll_interval=2.0,
        )

        closes = runner.count_events(
            lambda event: event.event == "close",
            since=t_failover,
        )
        reconnects = runner.count_events(
            lambda event: event.event == "reconnect",
            since=t_failover,
        )
        errors = runner.count_events(
            lambda event: event.event == "error",
            since=t_failover,
        )
        self.add_timeline_event(
            "k6-failover-counters",
            since=t_failover,
            closes=closes,
            reconnects=reconnects,
            errors=errors,
            west_redis_after=observed_west,
            east_redis_after=observed_east,
            west_pre_failover=west_pre_failover,
            east_pre_failover=east_pre_failover,
            min_east_growth_required=min_east_growth,
        )

        west_drained = observed_west is not None and observed_west <= west_baseline
        # If no west clients existed pre-failover there is nothing to
        # migrate — treat as a vacuous pass rather than a failure, but
        # surface a diagnostic warning so the operator can investigate
        # the LB distribution.
        if west_pre_failover == 0:
            self.assertions.add_pass(
                "west-clients-migrated-to-east",
                (
                    f"No west clients to migrate (pre-failover west=0, east={east_pre_failover}); "
                    f"nginx routed all {east_pre_failover} VUs to east. "
                    f"Observed post-failover west={observed_west}, east={observed_east}, "
                    f"k6 closes={closes} reconnects={reconnects} errors={errors}."
                ),
            )
            return

        east_absorbed = (
            observed_east is not None
            and (observed_east - east_pre_failover) >= min_east_growth
        )

        if west_drained and east_absorbed:
            self.assertions.add_pass(
                "west-clients-migrated-to-east",
                (
                    f"West Redis returned to baseline ({observed_west}/{west_baseline}); "
                    f"east absorbed {observed_east - east_pre_failover} new connection(s) "
                    f"via the LB (pre-failover west={west_pre_failover} east={east_pre_failover}; "
                    f"closes={closes}, reconnects={reconnects}, errors={errors})."
                ),
            )
            return

        self.assertions.add_fail(
            "west-clients-migrated-to-east",
            (
                "Expected west Redis to drain to baseline and east to absorb migrated "
                f"clients via the nginx LB; observed west={observed_west} "
                f"(baseline {west_baseline}, pre-failover {west_pre_failover}), "
                f"east={observed_east} (pre-failover {east_pre_failover}, "
                f"min growth {min_east_growth}). "
                f"k6 reported closes={closes}, reconnects={reconnects}, errors={errors}."
            ),
        )

    def _assert_replacement_west_clients(self) -> None:
        """Spawn fresh LB-routed clients and assert west re-enters rotation.

        Once west is healthy and nginx's ``fail_timeout`` has elapsed,
        the upstream is re-added to round-robin. Pushing fresh clients
        through the LB should land at least one of them on west,
        observable via the west Redis scan.
        """
        if self._env_secrets is None:
            return

        west_baseline_post_recovery = self._count_redis_connection_keys("west")
        if west_baseline_post_recovery is None:
            west_baseline_post_recovery = self._redis_west_baseline or 0
        self.add_timeline_event(
            "redis-pre-replacement-snapshot",
            west=west_baseline_post_recovery,
        )

        replacement = K6Runner(
            script_path=CP09_K6_SCRIPT,
            env=self._build_k6_env(
                west_clients=REPLACEMENT_WEST_CLIENTS,
                east_clients=0,
                run_duration="60s",
            ),
            artifacts_dir=self._artifact_dir() / "k6-phase5",
        )
        try:
            replacement.start()
            # Wait for k6 to actually open the connections — gives nginx
            # time to distribute and the eval-server time to write Redis.
            opens = replacement.wait_for_count(
                lambda event: event.event == "open",
                count=REPLACEMENT_WEST_CLIENTS,
                timeout=20.0,
            )
            observed_west = self._wait_for_redis_growth(
                context="west",
                baseline=west_baseline_post_recovery,
                min_growth=1,
                timeout=30.0,
                poll_interval=1.0,
            )
            self.add_timeline_event(
                "replacement-clients-result",
                k6_opens=opens,
                west_redis_after=observed_west,
                west_baseline=west_baseline_post_recovery,
            )
            if observed_west is not None and observed_west > west_baseline_post_recovery:
                self.assertions.add_pass(
                    "open-replacement-west-clients",
                    (
                        f"West Redis grew from {west_baseline_post_recovery} "
                        f"to {observed_west} after {REPLACEMENT_WEST_CLIENTS} fresh "
                        f"LB-routed clients (k6 opens={opens})."
                    ),
                )
            else:
                self.assertions.add_fail(
                    "open-replacement-west-clients",
                    (
                        f"Expected west Redis to grow above {west_baseline_post_recovery} "
                        f"after {REPLACEMENT_WEST_CLIENTS} LB-routed clients; "
                        f"observed {observed_west}. nginx may not yet have re-added "
                        "the recovered west backend to its round-robin rotation."
                    ),
                )
        except Exception as exc:
            self.assertions.add_fail(
                "open-replacement-west-clients",
                f"Could not start replacement west k6 runner: {exc}",
            )
        finally:
            replacement.stop(timeout=5.0)

    def _count_redis_connection_keys(self, context: str) -> Optional[int]:
        pod = self._discover_redis_pod(context, FEATBIT_NAMESPACE)
        if not pod:
            self.add_timeline_event(
                "redis-pod-not-found",
                context=context,
                namespace=FEATBIT_NAMESPACE,
                key_pattern=CONNECTION_KEY_PATTERN,
            )
            return None

        result = self._run_kubectl(
            [
                "--context",
                context,
                "-n",
                FEATBIT_NAMESPACE,
                "exec",
                pod,
                "--",
                "redis-cli",
                "--scan",
                "--pattern",
                CONNECTION_KEY_PATTERN,
            ],
            timeout=30,
        )
        output = (result.stdout or "").strip()
        error = (result.stderr or "").strip()
        if result.returncode != 0:
            self.add_timeline_event(
                "redis-connection-scan-failed",
                context=context,
                key_pattern=CONNECTION_KEY_PATTERN,
                stderr=error[:300],
            )
            return None

        keys = [line.strip() for line in output.splitlines() if line.strip()]
        self.add_timeline_event(
            "redis-connection-scan",
            context=context,
            key_pattern=CONNECTION_KEY_PATTERN,
            matched_key_count=len(keys),
            sampled_keys=keys[:5],
        )
        return len(keys)

    def _build_k6_env(
        self,
        *,
        west_clients: int,
        east_clients: int,
        run_duration: str,
        sdk_type: Optional[str] = None,
    ) -> dict[str, str]:
        if self._env_secrets is None:
            raise RuntimeError("Environment secrets are unavailable.")

        return {
            "WEST_CLIENTS": str(west_clients),
            "EAST_CLIENTS": str(east_clients),
            "SDK_TYPE": sdk_type or self._configured_sdk_type(),
            "SERVER_SECRET": self._env_secrets.server,
            "CLIENT_SECRET": self._env_secrets.client,
            # Load balancer settings (default mode).
            "USE_LOAD_BALANCER": "true" if self._configured_use_load_balancer() else "false",
            "STREAMING_HOST": self._configured_lb_host(),
            "STREAMING_PORT": str(self._configured_lb_port()),
            # Legacy per-cluster targets — only consulted when USE_LOAD_BALANCER=false.
            "WEST_PORT": "5100",
            "EAST_PORT": "5101",
            "HOST": "localhost",
            "RUN_DURATION": run_duration,
        }

    def _resolve_env_secrets(
        self,
        auth_header: str,
        ctx: object,
        definition: ScenarioDefinition,
    ) -> None:
        self._notify_step("resolve-env-secrets", "starting")
        try:
            workspace_id = getattr(ctx, "workspace_id", None)
            organization_id = getattr(ctx, "organization_id", None)
            if not workspace_id:
                raise ValueError("Workspace ID was not resolved from the auth context.")

            api_client = ApiClient(
                self.get_api_base_url(definition.source_region),
                self.config.skip_certificate_check,
                self.config.api_version,
            )
            project_id = resolve_project_id_for_env(
                api_client,
                workspace_id=workspace_id,
                env_id=self.config.env_id,
                authorization_header=auth_header,
                organization_id=organization_id,
            )
            self._env_secrets = get_env_secrets(
                api_client,
                workspace_id=workspace_id,
                project_id=project_id,
                env_id=self.config.env_id,
                authorization_header=auth_header,
                organization_id=organization_id,
            )
            self.assertions.add_pass("resolve-env-secrets")
            self.add_timeline_event(
                "env-secrets-resolved",
                project_id=project_id,
                secret_count=len(self._env_secrets.raw),
            )
            self._notify_step("resolve-env-secrets", "ok")
        except Exception as exc:
            self.assertions.add_fail("resolve-env-secrets", f"Could not fetch env secrets: {exc}")
            self._env_secrets = None
            self._notify_step("resolve-env-secrets", "failed", str(exc)[:80])

    def _skip_websocket_assertions(self, message: str) -> None:
        for assertion_id in WS_ASSERTION_IDS:
            if not self._has_assertion(assertion_id):
                self.assertions.add_skip(assertion_id, message)
        self._websocket_assertions_skipped = True

    def _ensure_websocket_assertions_recorded(self) -> None:
        for assertion_id in WS_ASSERTION_IDS:
            if not self._has_assertion(assertion_id):
                self.assertions.add_skip(
                    assertion_id,
                    "Skipped because CP-09 exited before this WebSocket phase.",
                )

    def _has_assertion(self, assertion_id: str) -> bool:
        return any(assertion.name == assertion_id for assertion in self.assertions.assertions)

    def _configured_west_clients(self) -> int:
        return max(0, int(self.config.ws_west_clients))

    def _configured_east_clients(self) -> int:
        return max(0, int(self.config.ws_east_clients))

    def _configured_sdk_type(self) -> str:
        value = (self.config.ws_sdk_type or "server").lower()
        return value if value in ("server", "client") else "server"

    def _configured_use_load_balancer(self) -> bool:
        return bool(getattr(self.config, "ws_use_load_balancer", True))

    def _configured_lb_host(self) -> str:
        return getattr(self.config, "ws_lb_host", "featbit-eval.local") or "featbit-eval.local"

    def _configured_lb_port(self) -> int:
        return int(getattr(self.config, "ws_lb_port", 80) or 80)

    def _artifact_dir(self) -> Path:
        if self.artifact_dir is None:
            raise RuntimeError("Artifact directory has not been initialized.")
        return self.artifact_dir

    def _port_forward_log_path(self) -> Path:
        if self._port_forwarder and self._port_forwarder.log_paths:
            return self._port_forwarder.log_paths[0]
        return self._artifact_dir() / "port-forward-west-5100.log"

    @staticmethod
    def _is_k6_event(event: K6Event, *, cluster: str, event_name: str) -> bool:
        return event.cluster == cluster and event.event == event_name

    # ------------------------------------------------------------------
    # Heartbeat helpers
    # ------------------------------------------------------------------

    def _wait_for_heartbeat_advance(
        self,
        context: str,
        baseline: Dict[str, dict],
        max_wait_seconds: float,
        poll_interval_seconds: float,
    ) -> Dict[str, dict]:
        """Poll heartbeats until at least one entry's timestamp advances.

        Returns the latest snapshot. If no advance is observed within
        ``max_wait_seconds`` the final snapshot is still returned (the
        caller will then record a fail via ``_assert_timestamps_advanced``).
        """
        deadline = time.monotonic() + max_wait_seconds
        sample = self._read_heartbeats(context)
        attempts = 0
        while time.monotonic() < deadline:
            attempts += 1
            if self._any_timestamp_advanced(baseline, sample):
                self.add_timeline_event(
                    "heartbeat-advance-observed",
                    context=context,
                    attempts=attempts,
                )
                return sample
            time.sleep(max(poll_interval_seconds, 2.0))
            sample = self._read_heartbeats(context)
        self.add_timeline_event(
            "heartbeat-advance-timeout",
            context=context,
            attempts=attempts,
            max_wait_seconds=max_wait_seconds,
        )
        return sample

    @staticmethod
    def _any_timestamp_advanced(before: Dict[str, dict], after: Dict[str, dict]) -> bool:
        """Return True if any PodId present in both samples has a newer Timestamp."""
        for pod_id, entry_before in before.items():
            entry_after = after.get(pod_id)
            if entry_after is None:
                continue
            ts_before = CP09Scenario._extract_timestamp(entry_before)
            ts_after = CP09Scenario._extract_timestamp(entry_after)
            if ts_before and ts_after and ts_after > ts_before:
                return True
        return False

    def _read_heartbeats(self, context: str) -> Dict[str, dict]:
        """Return parsed heartbeats hash from the given cluster context.

        Returns a dict ``{pod_id: parsed_json_value}``. Empty dict on any
        error (a diagnostic event is logged via add_timeline_event).
        """
        pod = self._discover_redis_pod(context, FEATBIT_NAMESPACE)
        if not pod:
            self.add_timeline_event(
                "redis-pod-not-found",
                context=context,
                namespace=FEATBIT_NAMESPACE,
            )
            return {}

        result = self._run_kubectl(
            [
                "--context",
                context,
                "-n",
                FEATBIT_NAMESPACE,
                "exec",
                pod,
                "--",
                "redis-cli",
                "HGETALL",
                HEARTBEAT_HASH_KEY,
            ],
            timeout=20,
        )

        if result.returncode != 0:
            self.add_timeline_event(
                "redis-hgetall-failed",
                context=context,
                key=HEARTBEAT_HASH_KEY,
                stderr=(result.stderr or "").strip()[:300],
            )
            return {}

        return self._parse_hgetall(result.stdout or "")

    @staticmethod
    def _parse_hgetall(raw: str) -> Dict[str, dict]:
        """Parse redis-cli HGETALL default output (alternating lines)."""
        lines = [ln for ln in (raw or "").splitlines() if ln != ""]
        out: Dict[str, dict] = {}
        for i in range(0, len(lines) - 1, 2):
            field = lines[i].strip()
            value_raw = lines[i + 1]
            try:
                value = json.loads(value_raw)
            except (json.JSONDecodeError, TypeError):
                value = {"_raw": value_raw}
            out[field] = value
        return out

    @staticmethod
    def _extract_timestamp(entry: dict) -> Optional[str]:
        """Return Timestamp field (case-insensitive) or None."""
        if not isinstance(entry, dict):
            return None
        for key in ("Timestamp", "timestamp"):
            if key in entry and entry[key]:
                return str(entry[key])
        return None

    @staticmethod
    def _west_owned_pod_ids(heartbeats: Dict[str, dict], dc_id: str = "west") -> set:
        """Return PodIds whose heartbeat entry belongs to the given DC.

        Heartbeat entries carry ``DcId`` (and ``Region``) since the consistency
        work; on the composite-write topology the west hash also holds live east
        pods, which must not be counted as west pods awaiting purge. Entries
        lacking both fields predate DcId stamping and are treated as local
        (west), preserving the legacy shared-redis behavior.
        """
        owned = set()
        for pod_id, entry in heartbeats.items():
            if not isinstance(entry, dict):
                owned.add(pod_id)
                continue
            marker = None
            for key in ("DcId", "dcId", "dcid", "Region", "region"):
                if entry.get(key):
                    marker = str(entry[key])
                    break
            if marker is None or marker.lower() == dc_id.lower():
                owned.add(pod_id)
        return owned

    def _assert_heartbeats_present(
        self, assertion_name: str, region: str, heartbeats: Dict[str, dict]
    ) -> None:
        """Pass if at least one valid heartbeat entry exists for region."""
        if not heartbeats:
            self.assertions.add_fail(
                assertion_name,
                f"No heartbeat entries found in {region} {HEARTBEAT_HASH_KEY}.",
            )
            return

        valid_count = 0
        for pod_id, entry in heartbeats.items():
            if self._extract_timestamp(entry) and self._looks_like_guid(pod_id):
                valid_count += 1

        if valid_count > 0:
            self.assertions.add_pass(
                assertion_name,
                (
                    f"{region}: {valid_count}/{len(heartbeats)} heartbeat "
                    "entries have a valid PodId GUID and Timestamp."
                ),
            )
        else:
            self.assertions.add_fail(
                assertion_name,
                (
                    f"{region}: no heartbeat entry has both a GUID PodId "
                    f"and a Timestamp. Entries: {list(heartbeats.keys())}"
                ),
            )

    def _assert_timestamps_advanced(
        self,
        assertion_name: str,
        before: Dict[str, dict],
        after: Dict[str, dict],
    ) -> None:
        """Pass if at least one shared PodId has a newer Timestamp."""
        shared = set(before.keys()) & set(after.keys())
        if not shared:
            # If no shared pods (e.g. pod was replaced), as long as 'after'
            # has at least one entry with a Timestamp, that still proves
            # heartbeats are being written.
            after_has_ts = any(self._extract_timestamp(v) for v in after.values())
            if after_has_ts:
                self.assertions.add_pass(
                    assertion_name,
                    (
                        "No shared PodIds across samples but new "
                        "heartbeat entries are present (pod likely rotated)."
                    ),
                )
            else:
                self.assertions.add_fail(
                    assertion_name,
                    "No shared PodIds and no new heartbeat entries with Timestamps.",
                )
            return

        advanced: List[Tuple[str, str, str]] = []
        for pod_id in shared:
            ts_before = self._extract_timestamp(before[pod_id]) or ""
            ts_after = self._extract_timestamp(after[pod_id]) or ""
            if ts_before and ts_after and ts_after > ts_before:
                advanced.append((pod_id, ts_before, ts_after))

        if advanced:
            self.assertions.add_pass(
                assertion_name,
                (
                    f"{len(advanced)}/{len(shared)} shared PodIds had "
                    f"advancing Timestamps. Example: {advanced[0]}"
                ),
            )
        else:
            self.assertions.add_fail(
                assertion_name,
                (
                    "No shared PodId showed an advancing Timestamp "
                    f"across samples. Shared: {sorted(shared)}"
                ),
            )

    @staticmethod
    def _looks_like_guid(value: str) -> bool:
        """Lightweight GUID format check (8-4-4-4-12 hex)."""
        if not isinstance(value, str):
            return False
        parts = value.split("-")
        if len(parts) != 5:
            return False
        lengths = [8, 4, 4, 4, 12]
        if [len(p) for p in parts] != lengths:
            return False
        return all(all(c in "0123456789abcdefABCDEF" for c in p) for p in parts)

    # ------------------------------------------------------------------
    # kubectl helpers
    # ------------------------------------------------------------------

    def _get_eval_server_pods(self, context: str) -> List[str]:
        """List evaluation-server pod names in the given cluster context."""
        result = self._run_kubectl(
            [
                "--context",
                context,
                "-n",
                FEATBIT_NAMESPACE,
                "get",
                "pods",
                "-l",
                EVAL_SERVER_LABEL_SELECTOR,
                "-o",
                "json",
            ],
            timeout=20,
        )
        if result.returncode != 0:
            return []
        try:
            items = json.loads(result.stdout).get("items", [])
        except json.JSONDecodeError:
            return []
        return [it.get("metadata", {}).get("name", "") for it in items if it.get("metadata")]

    # ------------------------------------------------------------------
    # Polling helpers
    # ------------------------------------------------------------------

    def _poll_until_west_heartbeat_purged(
        self,
        pre_delete_pod_ids: set,
        deadline_seconds: int,
        poll_interval_seconds: float,
    ) -> Tuple[bool, Dict[str, dict], Dict[str, dict]]:
        """Poll west heartbeats hash until all pre_delete IDs are gone.

        Returns (purged, last_west_heartbeats, last_east_heartbeats).
        """
        deadline = time.time() + deadline_seconds
        last_west: Dict[str, dict] = {}
        last_east: Dict[str, dict] = {}

        while time.time() < deadline:
            last_west = self._read_heartbeats("west")
            last_east = self._read_heartbeats("east")

            self.add_timeline_event(
                "failover-poll",
                west_pod_ids=sorted(last_west.keys()),
                east_pod_ids=sorted(last_east.keys()),
            )

            still_present = pre_delete_pod_ids & set(last_west.keys())
            if not still_present:
                return True, last_west, last_east

            time.sleep(poll_interval_seconds)

        return False, last_west, last_east

    def _poll_for_new_west_pod_id(
        self,
        pre_delete_pod_ids: set,
        deadline_seconds: int,
        poll_interval_seconds: float,
    ) -> Tuple[Optional[str], Dict[str, dict]]:
        """Poll west heartbeats hash for a PodId not in pre_delete_pod_ids."""
        deadline = time.time() + deadline_seconds
        last_west: Dict[str, dict] = {}

        while time.time() < deadline:
            last_west = self._read_heartbeats("west")
            new_ids = self._west_owned_pod_ids(last_west) - pre_delete_pod_ids
            self.add_timeline_event(
                "recovery-poll",
                west_pod_ids=sorted(last_west.keys()),
                new_pod_ids=sorted(new_ids),
            )

            # Require the new entry to have a Timestamp (proves it is live).
            for pod_id in new_ids:
                if self._extract_timestamp(last_west.get(pod_id, {})):
                    return pod_id, last_west

            time.sleep(poll_interval_seconds)

        return None, last_west
