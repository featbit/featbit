"""CP-03: Resilience Under Failure Scenarios."""

import json
import time

from core.auth import resolve_authorization_header, resolve_request_context
from core.scenario_base import BaseScenario, ScenarioDefinition


class CP03Scenario(BaseScenario):
    """CP-03 resilience scenario base class."""

    def definition(self) -> ScenarioDefinition:
        """Return scenario definition."""
        if self.config.scenario_name == "cp03-west-with-east-redis-outage":
            return ScenarioDefinition(
                scenario_type="cp03",
                source_region="west",
                target_region="east",
                default_flag_key="ff-cp03-resilience",
                target_status=self.config.target_status,
            )
        else:  # cp03-east-with-west-redis-outage
            return ScenarioDefinition(
                scenario_type="cp03",
                source_region="east",
                target_region="west",
                default_flag_key="ff-cp03-resilience",
                target_status=self.config.target_status,
            )

    def run(self) -> bool:
        """Execute CP-03 scenario."""
        try:
            self.setup_artifacts()
            definition = self.definition()

            # Resolve auth
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

            # Resolve request context
            ctx = resolve_request_context(
                self.get_api_base_url(definition.source_region),
                auth_header,
                self.config.organization_key,
                self.config.skip_certificate_check,
                self.config.api_version,
            )
            self._notify_step("auth", "ok")

            # Build headers
            headers = {
                "Authorization": auth_header,
                "Content-Type": "application/json",
            }
            if ctx.workspace_id:
                headers["Workspace"] = ctx.workspace_id
            if ctx.organization_id:
                headers["Organization"] = ctx.organization_id

            # Log run start
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

            source_url = self.get_api_base_url(definition.source_region)
            target_url = self.get_api_base_url(definition.target_region)

            # Capture baseline state before disruption.
            baseline_target = self.get_flag_state(
                target_url,
                definition.default_flag_key,
                "target",
                headers,
            )
            baseline_target_enabled = baseline_target.is_enabled

            # --- Phase 2: Simulate target Redis unavailable ---

            self._run_disruption_cycle(
                phase_label="phase-2",
                source_url=source_url,
                target_url=target_url,
                flag_key=definition.default_flag_key,
                toggle_to=definition.target_status,
                baseline_target_enabled=baseline_target_enabled,
                headers=headers,
                definition=definition,
            )

            # --- Phase 4: Reverse recovery (opposite toggle direction) ---

            reverse_status = not definition.target_status
            self._run_disruption_cycle(
                phase_label="phase-4",
                source_url=source_url,
                target_url=target_url,
                flag_key=definition.default_flag_key,
                toggle_to=reverse_status,
                baseline_target_enabled=definition.target_status,
                headers=headers,
                definition=definition,
            )

            # --- Post-condition: Reset flag and restore connectivity ---

            self._notify_step("cleanup", "running")
            self.toggle_flag(
                source_url,
                definition.default_flag_key,
                False,
                headers,
            )
            self.add_timeline_event("cleanup", phase="reset-flag-to-false")
            self._notify_step("cleanup", "ok")

            return self.assertions.all_passed()

        except Exception as e:
            self.assertions.add_fail("runner-execution", str(e))
            return False

        finally:
            self.write_artifacts()

    def _run_disruption_cycle(
        self,
        phase_label: str,
        source_url: str,
        target_url: str,
        flag_key: str,
        toggle_to: bool,
        baseline_target_enabled: bool,
        headers: dict,
        definition: ScenarioDefinition,
    ) -> None:
        """Execute one disruption-toggle-recover-verify cycle.

        Extracted so Phase 2 and Phase 4 share identical logic with
        different toggle directions.

        Args:
            phase_label: Label for timeline events and assertions.
            source_url: Source region API URL.
            target_url: Target region API URL.
            flag_key: Feature flag key.
            toggle_to: Target boolean state for the toggle.
            baseline_target_enabled: Expected target state before toggle.
            headers: Request headers with auth.
            definition: Scenario definition for region names.
        """
        self.add_timeline_event("phase-start", phase=phase_label)

        # Step 1: Start disruption.
        step_prefix = f"{phase_label}-"
        self._notify_step(f"{step_prefix}start-disruption", "running")
        try:
            self.run_disruption_command(
                "start", self.config.start_disruption_command
            )
            self._notify_step(f"{step_prefix}start-disruption", "ok")
        except RuntimeError as exc:
            self._notify_step(
                f"{step_prefix}start-disruption",
                "failed",
                str(exc)[:60],
            )
            raise

        # Step 2: Toggle flag while target Redis is disrupted.
        self._notify_step(f"{step_prefix}toggle", "running")
        toggle_result = self.toggle_flag(
            source_url, flag_key, toggle_to, headers
        )
        self.add_timeline_event(
            "api-toggle",
            phase=phase_label,
            result=toggle_result,
        )
        self.assertions.add_pass(
            f"{step_prefix}api-toggle-succeeded",
            f"Toggle to {toggle_to} succeeded during {phase_label}.",
        )
        self._notify_step(f"{step_prefix}toggle", "ok")

        # Step 3: Verify source accepted the toggle; record (not assert) the
        # target's during-outage state.
        self._notify_step(f"{step_prefix}outage-hold", "running")
        deadline = time.time() + self.config.disruption_hold_seconds

        while time.time() < deadline:
            source_state = self.get_flag_state(
                source_url, flag_key, "source", headers
            )
            target_state = self.get_flag_state(
                target_url, flag_key, "target", headers
            )
            self.add_timeline_event(
                "outage-poll",
                phase=phase_label,
                source=json.loads(source_state.json()),
                target=json.loads(target_state.json()),
            )

            time.sleep(self.config.poll_interval_ms / 1000.0)

        # Assert source region accepted the toggle.
        source_check = self.get_flag_state(
            source_url, flag_key, "source", headers
        )
        self.assertions.add(
            f"{step_prefix}source-updated-during-outage",
            source_check.error is None
            and source_check.is_enabled == toggle_to,
            (
                f"Source region shows isEnabled={toggle_to} "
                "while target is disrupted."
            ),
            "evaluated",
        )

        # Target staleness during the outage is NOT assertable on this
        # topology (#113): both regions' management APIs read the same shared
        # Mongo replica set, so the target's API state converges instantly
        # regardless of its Redis being disrupted; and under GatedCommit the
        # target CACHE's during-outage state is timing-dependent (commit gate
        # blocked vs lease eviction + survivor commit). The deterministic
        # resilience signals are asserted after heal: API convergence
        # (step 5) and both DCs' Redis reaching the expected value (step 6).
        # The outage-poll timeline events above carry the observed states.
        self.assertions.add_skip(
            f"{step_prefix}target-unchanged-during-outage",
            "Not assertable: target API state is backed by the shared Mongo "
            "replica set (converges instantly regardless of the Redis outage), "
            "and GatedCommit cache staleness races lease eviction. Post-heal "
            "convergence is asserted instead; during-outage observations are "
            "in the timeline.",
        )
        self._notify_step(f"{step_prefix}outage-hold", "ok")

        # Step 4: Stop disruption and verify recovery.
        self._notify_step(f"{step_prefix}stop-disruption", "running")
        try:
            self.run_disruption_command(
                "stop", self.config.stop_disruption_command
            )
            self._notify_step(f"{step_prefix}stop-disruption", "ok")
        except RuntimeError as exc:
            self._notify_step(
                f"{step_prefix}stop-disruption",
                "failed",
                str(exc)[:60],
            )
            raise

        # Step 5: Poll for convergence after recovery.
        self._notify_step(f"{step_prefix}convergence", "running")
        converged, conv_src, conv_tgt = self.poll_convergence(
            source_url,
            target_url,
            flag_key,
            toggle_to,
            headers,
        )

        self.assertions.add(
            f"{step_prefix}source-target-convergence",
            converged,
            (
                f"Both regions converged to isEnabled={toggle_to} "
                f"after recovery in {phase_label}."
            ),
            "evaluated",
        )
        self._notify_step(
            f"{step_prefix}convergence",
            "ok" if converged else "failed",
        )

        # Step 6: Kafka and Redis verification after recovery.
        flag_id = (self.config.flag_ids_by_key or {}).get(flag_key)

        self.run_kafka_topic_check(
            f"{step_prefix}source-topic-check",
            self.config.source_topic_check_command,
            context=definition.source_region,
            bootstrap=self._KAFKA_BOOTSTRAP,
            topic="featbit-control-plane-feature-flag-change",
            flag_id=flag_id,
        )
        # Under GatedCommit the commit-time eval publish lands in the
        # committing coordinator's DC, which may be the peer (#113).
        self.run_kafka_topic_check(
            f"{step_prefix}downstream-topic-check",
            self.config.downstream_topic_check_command,
            context=definition.source_region,
            bootstrap=self._KAFKA_BOOTSTRAP,
            topic="featbit-feature-flag-change",
            flag_id=flag_id,
            fallback_context=definition.target_region,
        )
        self.run_kafka_topic_check(
            f"{step_prefix}retry-log-check",
            self.config.retry_log_check_command,
            context=definition.target_region,
            bootstrap=self._KAFKA_AGGREGATE_BOOTSTRAP,
            topic="featbit-feature-flag-change",
            flag_id=flag_id,
        )

        self.run_redis_check(
            f"{phase_label}-west",
            self.config.redis_west_check_command,
            flag_id=flag_id,
            flag_key=flag_key,
            expected_status=toggle_to,
            context="west",
        )
        self.run_redis_check(
            f"{phase_label}-east",
            self.config.redis_east_check_command,
            flag_id=flag_id,
            flag_key=flag_key,
            expected_status=toggle_to,
            context="east",
        )
