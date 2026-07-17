"""CP-01: Basic Feature Flag Change Propagation Scenario."""

import json

from core.auth import resolve_authorization_header, resolve_request_context
from core.scenario_base import BaseScenario, ScenarioDefinition


class CP01Scenario(BaseScenario):
    """CP-01 basic flag propagation scenario.

    Validates that a single feature flag toggle propagates from the source
    region through Kafka topics and Redis caches in both west and east
    datacenters.
    """

    def definition(self) -> ScenarioDefinition:
        """Return scenario definition."""
        if self.config.scenario_name == "cp01-west-to-east":
            return ScenarioDefinition(
                scenario_type="cp01",
                source_region="west",
                target_region="east",
                default_flag_key="ff-cp01-basic",
                target_status=self.config.target_status,
            )
        else:  # cp01-east-to-west
            return ScenarioDefinition(
                scenario_type="cp01",
                source_region="east",
                target_region="west",
                default_flag_key="ff-cp01-basic",
                target_status=self.config.target_status,
            )

    def run(self) -> bool:
        """Execute CP-01 scenario."""
        try:
            self.setup_artifacts()
            definition = self.definition()

            # --- Phase 1: Baseline and Authentication ---

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

            source_url = self.get_api_base_url(definition.source_region)
            target_url = self.get_api_base_url(definition.target_region)

            # Manual step 6-7: Confirm flag is false in both Redis instances.
            self._notify_step("baseline-check", "running")
            source_baseline = self.get_flag_state(
                source_url,
                definition.default_flag_key,
                definition.source_region,
                headers,
            )
            target_baseline = self.get_flag_state(
                target_url,
                definition.default_flag_key,
                definition.target_region,
                headers,
            )
            self.add_timeline_event(
                "baseline-check",
                source=json.loads(source_baseline.json()),
                target=json.loads(target_baseline.json()),
            )
            self._notify_step("baseline-check", "ok")

            # --- Phase 2: Toggle flag (manual step 8) ---

            self._notify_step("toggle", "running")
            toggle_result = self.toggle_flag(
                source_url,
                definition.default_flag_key,
                definition.target_status,
                headers,
            )

            self.add_timeline_event(
                "api-toggle",
                result=toggle_result,
            )
            self.assertions.add_pass(
                "api-toggle-succeeded",
                "Toggle endpoint responded successfully.",
            )
            self._notify_step("toggle", "ok")

            # --- Phase 3: Poll for convergence (manual steps 15-16) ---

            self._notify_step("convergence", "running")
            converged, source_state, target_state = self.poll_convergence(
                source_url,
                target_url,
                definition.default_flag_key,
                definition.target_status,
                headers,
            )

            self.assertions.add(
                "source-target-convergence",
                converged,
                f"Both regions reported expected isEnabled={definition.target_status}.",
                "evaluated",
            )
            self._notify_step("convergence", "ok" if converged else "failed")

            # --- Phase 4: Kafka and Redis verification (manual steps 9-33) ---

            flag_id = (self.config.flag_ids_by_key or {}).get(
                definition.default_flag_key
            )

            # Manual steps 9-14: CP topic in source cluster.
            self.run_kafka_topic_check(
                "source-topic-check",
                self.config.source_topic_check_command,
                context=definition.source_region,
                bootstrap=self._KAFKA_BOOTSTRAP,
                topic="featbit-control-plane-feature-flag-change",
                flag_id=flag_id,
            )

            # Manual steps 17-21: Eval topic in source cluster. Under GatedCommit
            # the commit-time eval publish lands in the committing coordinator's
            # DC, which may be the peer (#113) — allow the fallback.
            self.run_kafka_topic_check(
                "downstream-topic-check",
                self.config.downstream_topic_check_command,
                context=definition.source_region,
                bootstrap=self._KAFKA_BOOTSTRAP,
                topic="featbit-feature-flag-change",
                flag_id=flag_id,
                fallback_context=definition.target_region,
            )

            # Manual steps 22-27: Aggregate topic in source cluster.
            self.run_kafka_topic_check(
                "source-aggregate-topic-check",
                None,
                context=definition.source_region,
                bootstrap=self._KAFKA_AGGREGATE_BOOTSTRAP,
                topic="featbit-feature-flag-change",
                flag_id=flag_id,
            )

            # Manual steps 28-33: Aggregate topic in target cluster.
            self.run_kafka_topic_check(
                "target-aggregate-topic-check",
                self.config.retry_log_check_command,
                context=definition.target_region,
                bootstrap=self._KAFKA_AGGREGATE_BOOTSTRAP,
                topic="featbit-feature-flag-change",
                flag_id=flag_id,
            )

            # Manual steps 15-16: Redis in both regions.
            self.run_redis_check(
                "west",
                self.config.redis_west_check_command,
                flag_id=flag_id,
                flag_key=definition.default_flag_key,
                expected_status=definition.target_status,
            )
            self.run_redis_check(
                "east",
                self.config.redis_east_check_command,
                flag_id=flag_id,
                flag_key=definition.default_flag_key,
                expected_status=definition.target_status,
            )

            # --- Post-condition: Reset flag to false ---

            if definition.target_status:
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
