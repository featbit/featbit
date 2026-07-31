"""Shared helpers for GatedCommit cross-DC consistency scenarios (CP-10 – CP-14).

These scenarios validate the control plane's ``ConsistencyMode=GatedCommit`` feature
(stage → gate → commit → serve → recover). The base class below extends
:class:`core.scenario_base.BaseScenario` with the GatedCommit-specific *observation*
primitives the stock base class lacks:

* committed-pointer reads (``featbit:{flag|segment}-committed:{id}``),
* staged versioned-key presence (``featbit:{flag|segment}:{id}:v{ts}``),
* an evaluation-server ``/health/*`` HTTP probe.

Every helper is built on the existing infrastructure primitives already provided by
``BaseScenario`` (``_run_kubectl``, ``_discover_redis_pod``) or the shared ``requests``
dependency, so no parallel cluster-access logic is introduced.

Redis key shapes mirror ``modules/evaluation-server/.../RedisKeys.cs``:
    featbit:flag:{id}                -- legacy single value (BestEffort path)
    featbit:flag:{id}:v{ts}          -- immutable staged version snapshot
    featbit:flag-committed:{id}      -- committed-pointer (value = committed {ts})
    featbit:segment:{id} / :v{ts} / featbit:segment-committed:{id}  -- segment equivalents
"""

import time
from typing import Dict, List, Optional, Tuple

import requests

from core.auth import resolve_authorization_header, resolve_request_context
from core.scenario_base import BaseScenario, ScenarioDefinition


class ConsistencyScenarioBase(BaseScenario):
    """Base class for GatedCommit consistency scenarios."""

    _REDIS_NAMESPACE = "featbit"
    _REDIS_SERVICE = "redis"

    # ------------------------------------------------------------------ setup --

    def prepare(self, definition: ScenarioDefinition) -> Dict[str, str]:
        """Resolve auth + request context and emit the ``run-start`` timeline event.

        Mirrors the preamble used by every existing scenario (see ``cp03.py``) so the
        artifact format is identical. Returns the request headers dict.
        """
        self._notify_step("auth", "running")
        source_url = self.get_api_base_url(definition.source_region)
        auth_header = resolve_authorization_header(
            source_url,
            self.config.api_authorization_header,
            self.config.login_email,
            self.config.login_password,
            self.config.workspace_key,
            self.config.skip_certificate_check,
            self.config.api_version,
        )
        ctx = resolve_request_context(
            source_url,
            auth_header,
            self.config.organization_key,
            self.config.skip_certificate_check,
            self.config.api_version,
        )
        self._notify_step("auth", "ok")

        headers = {
            "Authorization": auth_header,
            "Content-Type": "application/json",
        }
        if ctx.workspace_id:
            headers["Workspace"] = ctx.workspace_id
        if ctx.organization_id:
            headers["Organization"] = ctx.organization_id

        self.add_timeline_event(
            "run-start",
            scenario=self.config.scenario_name,
            source_region=definition.source_region,
            target_region=definition.target_region,
            api_base_url_source=self.get_api_base_url(definition.source_region),
            api_base_url_target=self.get_api_base_url(definition.target_region),
            env_id=str(self.config.env_id),
            flag_key=definition.default_flag_key,
            expected_status=definition.target_status,
            auth_type="bearer" if auth_header.startswith("Bearer") else "openapi",
            workspace_id=ctx.workspace_id,
            organization_id=ctx.organization_id,
        )
        return headers

    def resolve_flag_id(
        self, base_url: str, flag_key: str, headers: Dict[str, str]
    ) -> Optional[str]:
        """Resolve a flag's GUID via the management API (no seed dependency).

        Prefers a pre-seeded ``flag_ids_by_key`` entry, then falls back to the
        ``GET feature-flags/{key}`` response id.
        """
        seeded = (self.config.flag_ids_by_key or {}).get(flag_key)
        if seeded:
            return seeded
        state = self.get_flag_state(base_url, flag_key, "source", headers)
        return state.id

    # ----------------------------------------------------------- redis access --

    def _redis_target(self, context: str) -> Tuple[Optional[str], int, Optional[str]]:
        """Resolve ``(pod_name, port, host)`` for the redis service in a DC context.

        ``host`` is the legacy ``redis`` service name, or ``None`` under the
        Sentinel topology (featbit-redis-node-*), where redis-cli should target
        localhost inside the node pod instead.
        """
        port = 6379
        host: Optional[str] = None
        pod = self._discover_redis_pod(context=context, namespace=self._REDIS_NAMESPACE)
        if pod and pod.startswith("featbit-redis-node"):
            # Sentinel topology: the per-cluster HA redis is the authoritative cache.
            # Ignore any orphaned legacy "redis" service (it may still resolve — to the
            # WRONG, empty redis) and target localhost inside the node pod instead.
            return pod, port, None
        svc = self._run_kubectl(
            [
                "--context",
                context,
                "-n",
                self._REDIS_NAMESPACE,
                "get",
                "svc",
                self._REDIS_SERVICE,
                "-o",
                "json",
            ]
        )
        if svc.returncode == 0:
            host = self._REDIS_SERVICE
            try:
                import json

                ports = json.loads(svc.stdout).get("spec", {}).get("ports", [])
                if ports:
                    port = ports[0].get("port", 6379)
            except (ValueError, KeyError):
                pass
        return pod, port, host

    def _redis_cli(self, context: str, *args: str, timeout: int = 30) -> Tuple[bool, str]:
        """Run ``redis-cli <args>`` inside the DC's redis pod via kubectl exec.

        Returns ``(ok, output)``; ``ok`` is False when the pod can't be reached.
        """
        pod, port, host = self._redis_target(context)
        if not pod:
            return False, f"no running redis pod in context '{context}'"
        # Sentinel node pods run two containers (redis + sentinel): pin the exec to
        # the redis container; with no legacy service, redis-cli targets localhost.
        container_args = ["-c", "redis"] if pod.startswith("featbit-redis-node") else []
        host_args = ["-h", host] if host else []
        result = self._run_kubectl(
            [
                "--context",
                context,
                "-n",
                self._REDIS_NAMESPACE,
                "exec",
                pod,
                *container_args,
                "--",
                "redis-cli",
                *host_args,
                "-p",
                str(port),
                *args,
            ],
            timeout=timeout,
        )
        return result.returncode == 0, (result.stdout + result.stderr).strip()

    def redis_get(self, context: str, key: str) -> Optional[str]:
        """``GET key``; returns the value or None when missing/unreachable."""
        ok, out = self._redis_cli(context, "GET", key)
        if ok and out and "(nil)" not in out.lower():
            return out
        return None

    def redis_scan(self, context: str, pattern: str) -> List[str]:
        """``--scan --pattern <pattern>``; returns matched keys (empty on failure)."""
        ok, out = self._redis_cli(context, "--scan", "--pattern", pattern)
        if not ok:
            return []
        return [line.strip() for line in out.splitlines() if line.strip()]

    def get_committed_pointer(self, context: str, resource: str, resource_id: str) -> Optional[str]:
        """Return the committed timestamp held by ``featbit:{resource}-committed:{id}``."""
        return self.redis_get(context, f"featbit:{resource}-committed:{resource_id}")

    def get_legacy_value(self, context: str, resource: str, resource_id: str) -> Optional[str]:
        """Return the legacy single-value key ``featbit:{resource}:{id}`` (BestEffort)."""
        return self.redis_get(context, f"featbit:{resource}:{resource_id}")

    def staged_versions(self, context: str, resource: str, resource_id: str) -> List[str]:
        """Return all staged versioned keys ``featbit:{resource}:{id}:v*`` in a DC."""
        return self.redis_scan(context, f"featbit:{resource}:{resource_id}:v*")

    # -------------------------------------------------------------- poll loops --

    def poll_committed_pointer(
        self,
        context: str,
        resource: str,
        resource_id: str,
        *,
        expect_ts: Optional[str] = None,
        advanced_from: Optional[str] = None,
        expect_present: bool = True,
        timeout: Optional[int] = None,
    ) -> Tuple[bool, Optional[str]]:
        """Poll a single DC's committed pointer until it matches the expectation.

        Returns ``(matched, observed_ts)``. Precedence:
        - ``expect_ts``: the pointer must equal that exact timestamp.
        - ``advanced_from``: the pointer must be present AND differ from this value
          (i.e. a *new* commit advanced it past the given baseline). Use this rather
          than ``expect_present`` whenever a committed pointer may already exist, so
          the poll waits for the new commit instead of returning the stale value.
        - otherwise ``expect_present`` toggles present-vs-absent.
        """
        deadline = time.time() + (timeout or self.config.timeout_seconds)
        observed: Optional[str] = None
        while time.time() < deadline:
            observed = self.get_committed_pointer(context, resource, resource_id)
            if expect_ts is not None:
                if observed == expect_ts:
                    return True, observed
            elif advanced_from is not None:
                if observed is not None and observed != advanced_from:
                    return True, observed
            elif expect_present and observed is not None:
                return True, observed
            elif not expect_present and observed is None:
                return True, observed
            time.sleep(self.config.poll_interval_ms / 1000.0)
        return False, observed

    def poll_committed_convergence(
        self,
        resource: str,
        resource_id: str,
        contexts: List[str],
        *,
        not_equal_to: Optional[str] = None,
        timeout: Optional[int] = None,
    ) -> Tuple[bool, Dict[str, Optional[str]]]:
        """Poll until every context shares the same non-null committed pointer.

        When ``not_equal_to`` is given, the shared value must also differ from it
        (used to prove a *new* commit advanced the pointer).
        """
        deadline = time.time() + (timeout or self.config.timeout_seconds)
        observed: Dict[str, Optional[str]] = {}
        while time.time() < deadline:
            observed = {c: self.get_committed_pointer(c, resource, resource_id) for c in contexts}
            self.add_timeline_event(
                "committed-poll",
                result={"resource": resource, "resource_id": resource_id, **observed},
            )
            values = list(observed.values())
            converged = all(v is not None for v in values) and len(set(values)) == 1
            if converged and (not_equal_to is None or values[0] != not_equal_to):
                return True, observed
            time.sleep(self.config.poll_interval_ms / 1000.0)
        return False, observed

    # ----------------------------------------------------------- http probing --

    def probe_http(self, url: str, timeout: int = 10) -> Tuple[Optional[int], str]:
        """GET an arbitrary URL (eval-server health endpoint). Returns (status, body).

        Status is None on a connection-level failure (body holds the error string).
        """
        try:
            if self.config.skip_certificate_check:
                import urllib3

                urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
            resp = requests.get(url, timeout=timeout, verify=not self.config.skip_certificate_check)
            return resp.status_code, resp.text.strip()
        except Exception as exc:  # noqa: BLE001 - any transport error means "not ready"
            return None, str(exc)

    def poll_http_status(
        self,
        url: str,
        expected_status: int,
        *,
        timeout: Optional[int] = None,
    ) -> Tuple[bool, Optional[int], str]:
        """Poll a URL until it returns ``expected_status``. Returns (matched, status, body)."""
        deadline = time.time() + (timeout or self.config.timeout_seconds)
        status: Optional[int] = None
        body = ""
        while time.time() < deadline:
            status, body = self.probe_http(url)
            self.add_timeline_event(
                "health-probe",
                result={"url": url, "status": status, "body": body[:200]},
            )
            if status == expected_status:
                return True, status, body
            time.sleep(self.config.poll_interval_ms / 1000.0)
        return False, status, body

    # ----------------------------------------------------------- disruptions --

    def run_named_command(
        self, name: str, command: Optional[str], *, required: bool, timeout: int = 30
    ) -> bool:
        """Execute a configured disruption/ops command, recording the outcome.

        Reuses :meth:`BaseScenario.run_optional_check` (records pass/fail/skip and a
        timeline event). Returns True only when a command was provided AND succeeded,
        so callers can gate dependent assertions on a real disruption having occurred.
        """
        before = len(self.assertions.assertions)
        self.run_optional_check(name, command, required=required, timeout=timeout)
        if not command:
            return False
        # The most recent assertion recorded by run_optional_check reflects the result.
        recorded = self.assertions.assertions[before:]
        return bool(recorded) and recorded[-1].passed and recorded[-1].status == "evaluated"

    def is_gated_commit(self) -> bool:
        """True when this run targets ``ConsistencyMode=GatedCommit``."""
        return (self.config.consistency_mode or "").strip().lower() == "gatedcommit"
