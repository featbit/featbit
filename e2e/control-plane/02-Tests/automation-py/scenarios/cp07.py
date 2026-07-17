"""CP-07: License Change Propagation Scenario.

Validates that a license change message is sent through the control plane
to update Redis in both west and east datacenters.
"""

import subprocess
import time
import uuid

from core.api_client import ApiClient, extract_data
from core.auth import resolve_authorization_header, resolve_request_context
from core.scenario_base import BaseScenario, ScenarioDefinition


class CP07Scenario(BaseScenario):
    """CP-07 license change propagation scenario.

    Validates that updating the workspace license via the API publishes a
    message to the featbit-control-plane-license-change Kafka topic and
    that both Redis instances are updated with the new license value.
    """

    def definition(self) -> ScenarioDefinition:
        """Return scenario definition."""
        if self.config.scenario_name == "cp07-west-to-east":
            return ScenarioDefinition(
                scenario_type="cp07",
                source_region="west",
                target_region="east",
                default_flag_key="license-cp07-west",
                target_status=True,
            )
        else:  # cp07-east-to-west
            return ScenarioDefinition(
                scenario_type="cp07",
                source_region="east",
                target_region="west",
                default_flag_key="license-cp07-east",
                target_status=True,
            )

    def run(self) -> bool:
        """Execute CP-07 scenario."""
        try:
            self.setup_artifacts()
            definition = self.definition()

            # --- Phase 1: Authentication and Authorization ---

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

            if not ctx.workspace_id:
                self.assertions.add_fail(
                    "workspace-id-missing",
                    "Cannot determine workspace ID from auth context.",
                )
                return False

            workspace_id = ctx.workspace_id

            self.add_timeline_event(
                "run-start",
                scenario=self.config.scenario_name,
                source_region=definition.source_region,
                target_region=definition.target_region,
                api_base_url_source=self.get_api_base_url(
                    definition.source_region
                ),
                api_base_url_target=self.get_api_base_url(
                    definition.target_region
                ),
                workspace_id=workspace_id,
                auth_type=(
                    "bearer"
                    if auth_header.startswith("Bearer")
                    else "openapi"
                ),
            )

            source_url = self.get_api_base_url(definition.source_region)

            # --- Phase 2: Update License ---

            self._notify_step("license-update", "running")

            license_key = self.config.license_key
            if not license_key:
                # Environmental prerequisite, not a product failure: without a
                # license key the propagation flow cannot be exercised at all.
                self.assertions.add_skip(
                    "license-key-missing",
                    "No license key configured (set LICENSE_KEY or --license-key); "
                    "license-change propagation not asserted.",
                )
                self._notify_step("license-update", "skipped")
                return self.assertions.all_passed()

            update_result = self._update_license(
                source_url,
                license_key,
                headers,
            )

            if not update_result.get("success"):
                self.assertions.add_fail(
                    "license-update-failed",
                    f"License update failed: {update_result.get('error', 'unknown')}",
                )
                return False

            self.add_timeline_event(
                "license-updated",
                workspace_id=workspace_id,
            )

            self.assertions.add_pass(
                "api-license-update-succeeded",
                "License update endpoint responded successfully.",
            )
            self._notify_step("license-update", "ok")

            # --- Phase 3: Wait for Propagation ---
            self._notify_step("propagation-wait", "running")
            propagation_wait = (
                self.config.convergence_poll_interval_seconds or 5
            )
            time.sleep(propagation_wait)
            self._notify_step("propagation-wait", "ok")

            # --- Phase 4: Kafka Topic Verification ---

            self._run_license_kafka_check(
                "source-license-topic-check",
                self.config.source_topic_check_command,
                definition.source_region,
                self._KAFKA_BOOTSTRAP,
                "featbit-control-plane-license-change",
                workspace_id,
            )

            # --- Phase 5: Redis Verification ---

            self.run_license_redis_check(
                "west",
                self.config.redis_west_check_command,
                workspace_id=workspace_id,
            )

            self.run_license_redis_check(
                "east",
                self.config.redis_east_check_command,
                workspace_id=workspace_id,
            )

            return self.assertions.all_passed()

        except Exception as e:
            self.assertions.add_fail("runner-execution", str(e))
            return False

        finally:
            self.write_artifacts()

    def _update_license(
        self,
        base_url: str,
        license_key: str,
        headers: dict,
    ) -> dict:
        """Update the workspace license via API."""
        client = ApiClient(
            base_url,
            self.config.skip_certificate_check,
            self.config.api_version,
        )

        endpoint = f"/api/v{self.config.api_version}/workspaces/license"

        payload = {
            "license": license_key,
        }

        try:
            response = client.request(
                "PUT", endpoint, body=payload, headers=headers
            )
            return {"success": True, "status_code": response.status_code}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _run_license_kafka_check(
        self,
        check_name: str,
        command: str,
        region: str,
        bootstrap: str,
        topic: str,
        workspace_id: str,
    ) -> None:
        """Run a custom Kafka check for license change message."""
        if not command:
            self.assertions.add_skip(
                check_name,
                f"No Kafka check command configured for {region}.",
            )
            return

        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=30,
            )

            self.add_timeline_event(
                "kafka-check",
                check=check_name,
                region=region,
                bootstrap=bootstrap,
                topic=topic,
                workspace_id=workspace_id,
                exit_code=result.returncode,
                output=result.stdout[:500] if result.stdout else None,
            )

            if result.returncode == 0:
                self.assertions.add_pass(
                    check_name,
                    f"License change found in {topic}.",
                )
            else:
                self.assertions.add_fail(
                    check_name,
                    f"License Kafka check failed: {result.stderr[:200]}",
                )
        except subprocess.TimeoutExpired:
            self.assertions.add_fail(
                check_name,
                "License Kafka check timed out.",
            )
        except Exception as e:
            self.assertions.add_fail(
                check_name,
                f"License Kafka check error: {str(e)[:100]}",
            )
