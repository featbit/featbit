"""CP-15: Cross-DC cache self-heal.

Encodes the cross-cluster cache self-heal simulations as a repeatable scenario.

Scenario (west = source/surviving DC, east = target/failed DC):
  1. Baseline: flag OFF in both DCs.
  2. Take east FULLY down (eval/api/control-plane + the cross-DC master-forwarder), so
     east cannot self-update its cache AND the surviving DC cannot push to it.
  3. Toggle the flag ON via west while east is down.
  4. Assert east's Redis cache stays STALE (still OFF) during the outage — the bug the
     fix addresses (BestEffort drops the cross-DC write; nothing rebuilds the cache).
  5. Recover east. Assert east's Redis cache SELF-HEALS to ON with NO manual re-toggle —
     the CacheReconciler rebuilds it from the source of truth (peer push and/or the
     local refill on east's own startup).

Topology note: this QA harness runs a per-cluster Redis+Sentinel (pods
``featbit-redis-node-*``, container ``redis``) plus a cross-DC master-forwarder
(``featbit-redis-master-fwd``) — not the framework's ``app=redis`` single Redis — so this
scenario reads the cache and drives the disruption with explicit kubectl commands rather
than the base class auto-discovery. Override any of them via the standard
``--start-disruption`` / ``--stop-disruption`` / ``--redis-east-check`` options or the
matching env vars.

Optional to run: it is a live two-cluster scenario invoked via the CLI
(``automation scenario cp15-cross-dc-cache-selfheal``); it is not part of any unattended
suite and requires the west/east clusters to be up.
"""

import time

from core.auth import resolve_authorization_header, resolve_request_context
from core.scenario_base import BaseScenario, ScenarioDefinition


class CP15Scenario(BaseScenario):
    """CP-15 cross-DC cache self-heal scenario."""

    # Our per-cluster Redis + forwarder topology (override-able via config commands).
    NAMESPACE = "featbit"
    TARGET_CONTEXT = "east"
    REDIS_POD = "featbit-redis-node-0"
    REDIS_CONTAINER = "redis"
    # Seconds to wait after the block so the forwarder pod fully terminates (its NodePort
    # endpoint is removed and the surviving DC's multiplexer connection drops) before the
    # toggle — avoids a write leaking through a draining connection.
    BLOCK_SETTLE_SECONDS = 30

    def definition(self) -> ScenarioDefinition:
        """Return scenario definition (west source, east target)."""
        return ScenarioDefinition(
            scenario_type="cp15",
            source_region="west",
            target_region="east",
            default_flag_key=self.config.flag_key or "ff-cp03-resilience",
            target_status=True,
        )

    # ----- topology-specific commands (defaults; override via config) -----

    def _default_block_command(self) -> str:
        ns, ctx = self.NAMESPACE, self.TARGET_CONTEXT
        return (
            f"kubectl --context {ctx} -n {ns} scale "
            f"deploy/featbit-redis-master-fwd deploy/evaluation-server "
            f"deploy/api-server deploy/control-plane --replicas=0"
        )

    def _default_recover_command(self) -> str:
        ns, ctx = self.NAMESPACE, self.TARGET_CONTEXT
        return (
            f"kubectl --context {ctx} -n {ns} scale "
            f"deploy/featbit-redis-master-fwd deploy/api-server deploy/control-plane --replicas=1 && "
            f"kubectl --context {ctx} -n {ns} scale deploy/evaluation-server --replicas=3 && "
            f"kubectl --context {ctx} -n {ns} rollout status deploy/control-plane --timeout=180s && "
            f"kubectl --context {ctx} -n {ns} rollout status deploy/featbit-redis-master-fwd --timeout=120s"
        )

    def _redis_get(self, key: str) -> "str | None":
        """GET a key from the TARGET DC's Redis (None if missing/unreadable)."""
        result = self._run_kubectl(
            [
                "--context", self.TARGET_CONTEXT,
                "-n", self.NAMESPACE,
                "exec", self.REDIS_POD, "-c", self.REDIS_CONTAINER, "--",
                "redis-cli", "-p", "6379", "GET", key,
            ],
            timeout=20,
        )
        text = (result.stdout or "").strip()
        if result.returncode != 0 or not text or "(nil)" in text.lower():
            return None
        return text

    def _read_cache_enabled(self, flag_id: str) -> "bool | None":
        """Read isEnabled for the flag from the TARGET DC's Redis, the way the eval does.

        Mode-agnostic (mirrors evaluation-server RedisStore): if the committed pointer
        ``featbit:flag-committed:{id}`` exists (GatedCommit), the authoritative value is the
        versioned snapshot ``featbit:flag:{id}:v{pointer}``; otherwise (BestEffort) it is the
        legacy ``featbit:flag:{id}`` key.

        Returns True/False, or None if the value is missing / unreadable.
        """
        pointer = self._redis_get(f"featbit:flag-committed:{flag_id}")
        if pointer and pointer.isdigit():
            value = self._redis_get(f"featbit:flag:{flag_id}:v{pointer}")
        else:
            value = self._redis_get(f"featbit:flag:{flag_id}")
        if not value:
            return None
        low = value.lower()
        if '"isenabled":true' in low:
            return True
        if '"isenabled":false' in low:
            return False
        return None

    # ----- run -----

    def run(self) -> bool:
        """Execute CP-15 scenario."""
        try:
            self.setup_artifacts()
            definition = self.definition()
            flag_key = definition.default_flag_key
            source_url = self.get_api_base_url(definition.source_region)

            block_cmd = self.config.start_disruption_command or self._default_block_command()
            recover_cmd = self.config.stop_disruption_command or self._default_recover_command()

            # --- Auth ---
            self._notify_step("auth", "running")
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
            headers = {"Authorization": auth_header, "Content-Type": "application/json"}
            if ctx.workspace_id:
                headers["Workspace"] = ctx.workspace_id
            if ctx.organization_id:
                headers["Organization"] = ctx.organization_id
            self._notify_step("auth", "ok")

            self.add_timeline_event(
                "run-start",
                scenario=self.config.scenario_name,
                source_region=definition.source_region,
                target_region=definition.target_region,
                env_id=str(self.config.env_id),
                flag_key=flag_key,
            )

            # --- Resolve flag id (needed for the cache key) ---
            self._notify_step("resolve-flag", "running")
            flag_state = self.get_flag_state(source_url, flag_key, "source", headers)
            if flag_state.error or not flag_state.id:
                self.assertions.add_fail(
                    "resolve-flag-id",
                    f"Could not resolve flag '{flag_key}' on source: {flag_state.error}",
                )
                self._notify_step("resolve-flag", "failed")
                return self.assertions.all_passed()
            flag_id = flag_state.id
            self._notify_step("resolve-flag", "ok")

            # --- Baseline: flag OFF in both DCs ---
            self._notify_step("baseline", "running")
            self.toggle_flag(source_url, flag_key, False, headers)
            baseline_deadline = time.time() + self.config.timeout_seconds
            while time.time() < baseline_deadline:
                if self._read_cache_enabled(flag_id) is False:
                    break
                time.sleep(self.config.poll_interval_ms / 1000.0)
            baseline_cache = self._read_cache_enabled(flag_id)
            self.add_timeline_event("baseline", target_cache_enabled=baseline_cache)
            self.assertions.add(
                "baseline-target-off",
                baseline_cache is False,
                f"East cache baseline is OFF before the outage (read={baseline_cache}).",
                "evaluated",
            )
            self._notify_step("baseline", "ok")

            # --- Block: take east fully down + sever the cross-DC link ---
            self._notify_step("block", "running")
            self.run_disruption_command("start", block_cmd)
            time.sleep(self.BLOCK_SETTLE_SECONDS)
            self._notify_step("block", "ok")

            # --- Toggle ON via west while east is down ---
            self._notify_step("toggle", "running")
            self.toggle_flag(source_url, flag_key, True, headers)
            self.add_timeline_event("api-toggle", to=True, region="source")
            self._notify_step("toggle", "ok")

            # --- Hold: east cache must stay STALE (OFF) while east is down ---
            self._notify_step("outage-hold", "running")
            deadline = time.time() + self.config.disruption_hold_seconds
            stale_throughout = True
            while time.time() < deadline:
                observed = self._read_cache_enabled(flag_id)
                self.add_timeline_event("outage-poll", target_cache_enabled=observed)
                if observed is True:
                    stale_throughout = False
                time.sleep(self.config.poll_interval_ms / 1000.0)
            self.assertions.add(
                "target-stale-during-outage",
                stale_throughout,
                "East cache stayed stale (OFF) while east was down and the cross-DC link was severed.",
                "evaluated",
            )
            self._notify_step("outage-hold", "ok" if stale_throughout else "failed")

            # --- Recover east; NO manual flag re-toggle ---
            self._notify_step("recover", "running")
            self.run_disruption_command("stop", recover_cmd)
            self._notify_step("recover", "ok")

            # --- Self-heal: east cache must converge to ON on its own ---
            self._notify_step("self-heal", "running")
            heal_deadline = time.time() + self.config.timeout_seconds
            healed = False
            while time.time() < heal_deadline:
                observed = self._read_cache_enabled(flag_id)
                self.add_timeline_event("self-heal-poll", target_cache_enabled=observed)
                if observed is True:
                    healed = True
                    break
                time.sleep(self.config.poll_interval_ms / 1000.0)
            self.assertions.add(
                "target-self-healed-after-recovery",
                healed,
                "East cache self-healed to ON from the source of truth after recovery, "
                "with no manual flag re-toggle.",
                "evaluated",
            )
            self._notify_step("self-heal", "ok" if healed else "failed")

            return self.assertions.all_passed()

        except Exception as e:  # noqa: BLE001 - record any failure as an assertion
            self.assertions.add_fail("runner-execution", str(e))
            return False

        finally:
            # Best-effort cleanup: restore flag to OFF and ensure east is scaled back up.
            try:
                self.toggle_flag(
                    self.get_api_base_url("west"),
                    self.definition().default_flag_key,
                    False,
                    headers,  # type: ignore[possibly-undefined]
                )
            except Exception:
                pass
            try:
                self.run_disruption_command(
                    "stop",
                    self.config.stop_disruption_command or self._default_recover_command(),
                )
            except Exception:
                pass
            self.write_artifacts()
