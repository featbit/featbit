"""CP-08: Control Plane API Full Sync to Evaluation Server Scenario.

Validates that the Control-Plane API can push a full sync to the Evaluation
Server and that the sync message appears in Kafka topics.
"""
import json
import subprocess
import time

from core.api_client import ApiClient
from core.auth import resolve_authorization_header, resolve_request_context
from core.scenario_base import BaseScenario, ScenarioDefinition


class CP08Scenario(BaseScenario):
    """CP-08 cache refresh full sync scenario.

    Validates that sending a POST request to the api/admin/push-eval-full-sync
    endpoint triggers a PushFullSync command message that appears in the
    featbit-control-plane-command Kafka topic.
    """

    def definition(self) -> ScenarioDefinition:
        """Return scenario definition."""
        return ScenarioDefinition(
            scenario_type="cp08",
            source_region="west",
            target_region="east",
            default_flag_key="ff-cp08-full-sync",
            target_status=True,
        )

    def run(self) -> bool:
        """Execute CP-08 scenario."""
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
                api_base_url_source=self.get_api_base_url(
                    definition.source_region
                ),
                auth_type=(
                    "bearer"
                    if auth_header.startswith("Bearer")
                    else "openapi"
                ),
                workspace_id=ctx.workspace_id,
                organization_id=ctx.organization_id,
            )

            control_plane_url = self.config.control_plane_base_url or (
                "http://featbit-control-plane.west.local"
                if definition.source_region == "west"
                else "http://featbit-control-plane.east.local"
            )

            # --- Phase 2: Trigger Full Sync ---

            self._notify_step("full-sync-trigger", "running")

            # The control-plane admin endpoint uses X-API-Key authentication,
            # not the standard bearer token used by the backend API.
            admin_headers = {
                "Content-Type": "application/json",
                "X-Api-Key": "api-key",
            }

            sync_result = self._trigger_full_sync(
                control_plane_url,
                admin_headers,
            )

            if not sync_result.get("success"):
                error_msg = sync_result.get("error", "Unknown error")
                
                self.assertions.add_fail(
                    "full-sync-trigger-failed",
                    f"Failed to trigger full sync: {error_msg}",
                )
                return False

            self.add_timeline_event(
                "full-sync-triggered",
                result=sync_result,
            )

            self.assertions.add_pass(
                "api-full-sync-succeeded",
                "Full sync endpoint responded successfully.",
            )
            self._notify_step("full-sync-trigger", "ok")

            # --- Phase 3: Kafka Command Topic Verification ---

            self._run_kafka_command_check(
                "control-plane-command-topic-check",
                self.config.source_topic_check_command,
                definition.source_region,
                self._KAFKA_BOOTSTRAP,
                "featbit-control-plane-command",
                "PushFullSync",
            )

            # --- Phase 4: Optional application message check ---

            if self.config.app_log_check_command:
                self._run_app_message_check(
                    "app-data-sync-message-check",
                    self.config.app_log_check_command,
                )

            # --- Phase 5: Post-condition: Cleanup ---

            self._notify_step("cleanup", "running")
            self.add_timeline_event("cleanup", phase="full-sync-complete")
            self._notify_step("cleanup", "ok")

            return self.assertions.all_passed()

        except Exception as e:
            self.assertions.add_fail("runner-execution", str(e))
            return False

        finally:
            self.write_artifacts()

    def _trigger_full_sync(
        self,
        base_url: str,
        headers: dict,
    ) -> dict:
        """Trigger a full sync via admin endpoint."""
        from core.api_client import ApiClientError

        client = ApiClient(
            base_url,
            self.config.skip_certificate_check,
            self.config.api_version,
        )

        endpoint = "/api/admin/push-eval-full-sync"

        try:
            result = client.post(endpoint, body={}, headers=headers)
            # Admin endpoint may return empty response (204 style) or JSON
            return {"success": True, "response": result}
        except ApiClientError as e:
            return {
                "success": False,
                "error": str(e),
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Unexpected error: {str(e)}",
            }

    def _run_kafka_command_check(
        self,
        check_name: str,
        command: str,
        region: str,
        bootstrap: str,
        topic: str,
        expected_action: str,
    ) -> None:
        """Run a custom Kafka check for PushFullSync command presence."""
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
                expected_action=expected_action,
                exit_code=result.returncode,
                output=result.stdout[:500] if result.stdout else None,
            )

            if result.returncode == 0:
                self.assertions.add_pass(
                    check_name,
                    f"Found {expected_action} message in {topic}.",
                )
            else:
                self.assertions.add_fail(
                    check_name,
                    f"Kafka check failed: {result.stderr[:200]}",
                )
        except subprocess.TimeoutExpired:
            self.assertions.add_fail(
                check_name,
                "Kafka check timed out.",
            )
        except Exception as e:
            self.assertions.add_fail(
                check_name,
                f"Kafka check error: {str(e)[:100]}",
            )

    def _run_app_message_check(
        self,
        check_name: str,
        command: str,
    ) -> None:
        """Run a custom check for application data-sync message."""
        if not command:
            self.assertions.add_skip(
                check_name,
                "No application message check command configured.",
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
                "app-message-check",
                check=check_name,
                exit_code=result.returncode,
                output=result.stdout[:500] if result.stdout else None,
            )

            if result.returncode == 0:
                self.assertions.add_pass(
                    check_name,
                    "Test application received data-sync message.",
                )
            else:
                self.assertions.add_fail(
                    check_name,
                    f"App message check failed: {result.stderr[:200]}",
                )
        except subprocess.TimeoutExpired:
            self.assertions.add_fail(
                check_name,
                "App message check timed out.",
            )
        except Exception as e:
            self.assertions.add_fail(
                check_name,
                f"App message check error: {str(e)[:100]}",
            )

    @staticmethod
    def _get_utc_timestamp() -> str:
        """Get current UTC timestamp in ISO format."""
        from datetime import datetime

        return datetime.utcnow().isoformat() + "Z"
