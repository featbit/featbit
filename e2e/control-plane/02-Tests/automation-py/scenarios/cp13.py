"""CP-13: GatedCommit Degraded Health (Stale-Heartbeat Readiness Fence).

Automates e2e/control-plane/02-Tests/manual_scripts/consistency/GatedCommitDegradedHealth.md.

Under GatedCommit, an eval-server pod that cannot publish heartbeats for longer than
``HeartbeatStalenessThresholdSeconds`` must fail ``/health/readiness`` (HTTP 503) while
``/health/liveness`` stays 200, and must recover when heartbeats resume. Under BestEffort
the check is a no-op (always healthy).

Requires the target DC's eval-server readiness URL and a heartbeat-stop/resume command.
The liveness URL is derived from the readiness URL by swapping the path segment.
"""

import time

from core.scenario_base import ScenarioDefinition

from .consistency_base import ConsistencyScenarioBase


class CP13Scenario(ConsistencyScenarioBase):
    """CP-13 GatedCommit degraded-health readiness fence scenario."""

    # No flag toggling: health is the unit under test. Keep a placeholder flag key
    # so ScenarioDefinition/summary stay well-formed.
    FLAG_KEY = "ff-cp13-degraded-health"

    def definition(self) -> ScenarioDefinition:
        return ScenarioDefinition(
            scenario_type="cp13",
            source_region="east",
            target_region="west",
            default_flag_key=self.FLAG_KEY,
            target_status=self.config.target_status,
        )

    @staticmethod
    def _liveness_url(readiness_url: str) -> str:
        """Derive the liveness URL from a readiness URL."""
        return readiness_url.replace("/health/readiness", "/health/liveness")

    def run(self) -> bool:
        try:
            self.setup_artifacts()
            definition = self.definition()
            # prepare() validates auth + emits run-start (consistent artifacts), even though
            # this scenario asserts on health endpoints rather than the management API.
            self.prepare(definition)

            readiness_url = self.config.east_eval_readiness_url
            if not readiness_url:
                self.assertions.add_skip(
                    "readiness-url-configured",
                    "No east_eval_readiness_url configured; cannot probe the readiness fence.",
                )
                return self.assertions.all_passed()
            if not self.config.heartbeat_stop_command:
                self.assertions.add_skip(
                    "heartbeat-stop-configured",
                    "No heartbeat_stop_command configured; cannot stop heartbeats to trip the fence.",
                )
                return self.assertions.all_passed()

            liveness_url = self._liveness_url(readiness_url)

            if not self.is_gated_commit():
                # Phase 4 behavior as the primary path: under BestEffort the fence is a no-op.
                self._run_besteffort_noop(readiness_url)
                return self.assertions.all_passed()

            # --- Phase 1: Baseline (healthy) --------------------------------------
            self.add_timeline_event("phase-start", phase="phase-1-baseline")
            status, body = self.probe_http(readiness_url)
            self.assertions.add(
                "readiness-healthy-baseline",
                status == 200,
                f"Baseline readiness={status} (expected 200). Body: {body[:160]}",
                "evaluated",
            )
            live_status, _ = self.probe_http(liveness_url)
            self.assertions.add(
                "liveness-healthy-baseline",
                live_status == 200,
                f"Baseline liveness={live_status} (expected 200).",
                "evaluated",
            )

            # --- Phase 2: Stop heartbeats -> fence trips --------------------------
            self.add_timeline_event("phase-start", phase="phase-2-stop-heartbeats")
            self.run_named_command(
                "heartbeat-stop", self.config.heartbeat_stop_command, required=True
            )
            # Within the staleness threshold the pod must still be Healthy and in rotation
            # (manual P2.3). Probed immediately after the stop, so staleness ~= 0s.
            grace_status, grace_body = self.probe_http(readiness_url)
            self.assertions.add(
                "readiness-healthy-within-threshold",
                grace_status == 200,
                f"Readiness still {grace_status} (expected 200) immediately after heartbeats "
                f"stopped, within the {self.config.heartbeat_staleness_threshold_seconds}s "
                f"threshold. Body: {grace_body[:160]}",
                "evaluated",
            )

            # Allow staleness to exceed the threshold (+ a margin for the poll cadence).
            fence_timeout = self.config.heartbeat_staleness_threshold_seconds + 60
            tripped, fenced_status, fenced_body = self.poll_http_status(
                readiness_url, 503, timeout=fence_timeout
            )
            self.assertions.add(
                "readiness-fenced-when-stale",
                tripped,
                f"Readiness returned 503 after staleness exceeded "
                f"{self.config.heartbeat_staleness_threshold_seconds}s (observed "
                f"{fenced_status}). Body: {fenced_body[:160]}",
                "evaluated",
            )
            # Liveness must NOT be affected (pod pulled from rotation, not restarted).
            live_status2, _ = self.probe_http(liveness_url)
            self.assertions.add(
                "liveness-unaffected-when-fenced",
                live_status2 == 200,
                f"Liveness stayed {live_status2} (expected 200) while readiness is fenced.",
                "evaluated",
            )
            # A single WARNING must be logged on the transition into the fenced state
            # (manual P2.5). Asserted only when an app-log check command is configured;
            # the grep should match exactly one transition line and exit 0.
            self.run_named_command(
                "fence-transition-warning-logged",
                self.config.app_log_check_command,
                required=False,
            )

            # --- Phase 3: Resume heartbeats -> recover ----------------------------
            self.add_timeline_event("phase-start", phase="phase-3-resume")
            self.run_named_command(
                "heartbeat-resume", self.config.heartbeat_resume_command, required=True
            )
            recovered, rec_status, _ = self.poll_http_status(
                readiness_url, 200, timeout=self.config.timeout_seconds + 60
            )
            self.assertions.add(
                "readiness-recovers-after-resume",
                recovered,
                f"Readiness returned to 200 after heartbeats resumed (observed {rec_status}).",
                "evaluated",
            )

            # --- Phase 4: BestEffort no-op check (optional) -----------------------
            if self.config.set_besteffort_command and self.config.set_gatedcommit_command:
                self._run_besteffort_noop(readiness_url)
            else:
                self.assertions.add_skip(
                    "besteffort-noop",
                    "set_besteffort_command/set_gatedcommit_command not configured; cannot "
                    "validate the BestEffort no-op in the same run.",
                )

            return self.assertions.all_passed()

        except Exception as exc:  # noqa: BLE001
            self.assertions.add_fail("runner-execution", str(exc))
            self.run_named_command(
                "heartbeat-resume", self.config.heartbeat_resume_command, required=False
            )
            return False
        finally:
            self.write_artifacts()

    def _run_besteffort_noop(self, readiness_url: str) -> None:
        """Phase 4: under BestEffort the fence must stay Healthy despite stale heartbeats."""
        self.add_timeline_event("phase-start", phase="phase-4-besteffort-noop")
        switched = True
        if self.config.set_besteffort_command:
            switched = self.run_named_command(
                "set-besteffort", self.config.set_besteffort_command, required=False
            )
        if self.config.heartbeat_stop_command:
            self.run_named_command(
                "heartbeat-stop-besteffort", self.config.heartbeat_stop_command, required=False
            )
            # Give it the same window the GatedCommit fence would have used.
            time.sleep(min(30, self.config.heartbeat_staleness_threshold_seconds))
        status, body = self.probe_http(readiness_url)
        self.assertions.add(
            "besteffort-noop",
            status == 200,
            f"Under BestEffort readiness stayed {status} (expected 200) despite stale "
            f"heartbeats. Body: {body[:160]}",
            "evaluated",
        )
        # Restore GatedCommit + heartbeats for a clean environment.
        self.run_named_command(
            "heartbeat-resume", self.config.heartbeat_resume_command, required=False
        )
        if switched and self.config.set_gatedcommit_command:
            self.run_named_command(
                "set-gatedcommit", self.config.set_gatedcommit_command, required=False
            )
