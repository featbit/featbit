"""CP-04: Segment Change Propagation Scenario.

Validates that a segment change (create) message is sent through the control
plane to update Redis in both west and east datacenters. Tests that the control
plane publishes segment changes to Kafka and that both Redis instances are
updated.
"""

import json
import subprocess
import time
import uuid

from core.api_client import ApiClient, extract_data
from core.auth import resolve_authorization_header, resolve_request_context
from core.models import SegmentState
from core.scenario_base import BaseScenario, ScenarioDefinition


class CP04Scenario(BaseScenario):
    """CP-04 segment change propagation scenario.

    Validates that a single segment creation propagates from the source region
    through Kafka topics and Redis caches in both west and east datacenters.
    """

    def definition(self) -> ScenarioDefinition:
        """Return scenario definition."""
        if self.config.scenario_name == "cp04-west-to-east":
            return ScenarioDefinition(
                scenario_type="cp04",
                source_region="west",
                target_region="east",
                default_flag_key="seg-cp04-west",
                target_status=True,
            )
        else:  # cp04-east-to-west
            return ScenarioDefinition(
                scenario_type="cp04",
                source_region="east",
                target_region="west",
                default_flag_key="seg-cp04-east",
                target_status=True,
            )

    def run(self) -> bool:
        """Execute CP-04 scenario."""
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
                api_base_url_target=self.get_api_base_url(
                    definition.target_region
                ),
                env_id=str(self.config.env_id),
                segment_key=definition.default_flag_key,
                auth_type=(
                    "bearer"
                    if auth_header.startswith("Bearer")
                    else "openapi"
                ),
                workspace_id=ctx.workspace_id,
                organization_id=ctx.organization_id,
            )

            source_url = self.get_api_base_url(definition.source_region)
            target_url = self.get_api_base_url(definition.target_region)

            # --- Phase 2: Create Segment ---

            self._notify_step("segment-create", "running")

            # Generate unique segment key
            segment_key = f"{definition.default_flag_key}-{str(uuid.uuid4())[:8]}"
            segment_name = f"CP-04 Test Segment {segment_key}"

            segment_create_result = self._create_segment(
                source_url,
                segment_key,
                segment_name,
                headers,
            )

            if not segment_create_result.get("id"):
                self.assertions.add_fail(
                    "segment-create-failed",
                    "Segment creation returned no ID.",
                )
                return False

            segment_id = segment_create_result["id"]

            self.add_timeline_event(
                "segment-created",
                segment_id=segment_id,
                segment_key=segment_key,
                segment_name=segment_name,
            )

            self.assertions.add_pass(
                "api-segment-create-succeeded",
                "Segment creation endpoint responded successfully.",
            )
            self._notify_step("segment-create", "ok")

            # --- Phase 3: Poll for Convergence ---

            self._notify_step("convergence", "running")

            converged, source_state, target_state = (
                self._poll_segment_convergence(
                    source_url,
                    target_url,
                    segment_id,
                    segment_key,
                    headers,
                )
            )

            self.assertions.add(
                "source-target-convergence",
                converged,
                f"Both regions have segment {segment_key} in Redis.",
                "evaluated",
            )
            self._notify_step("convergence", "ok" if converged else "failed")

            # --- Phase 4: Kafka Topic Verification ---

            self._run_segment_kafka_check(
                "source-segment-topic-check",
                self.config.source_topic_check_command,
                definition.source_region,
                self._KAFKA_BOOTSTRAP,
                "featbit-control-plane-segment-change",
                segment_id,
                segment_key,
            )

            self._run_segment_kafka_check(
                "downstream-segment-topic-check",
                self.config.downstream_topic_check_command,
                definition.source_region,
                self._KAFKA_BOOTSTRAP,
                "featbit-segment-change",
                segment_id,
                segment_key,
            )

            self._run_segment_kafka_check(
                "source-aggregate-segment-topic-check",
                None,
                definition.source_region,
                self._KAFKA_AGGREGATE_BOOTSTRAP,
                "featbit-segment-change",
                segment_id,
                segment_key,
            )

            self._run_segment_kafka_check(
                "target-aggregate-segment-topic-check",
                self.config.retry_log_check_command,
                definition.target_region,
                self._KAFKA_AGGREGATE_BOOTSTRAP,
                "featbit-segment-change",
                segment_id,
                segment_key,
            )

            # --- Phase 5: Redis Verification ---

            self.run_segment_redis_check(
                "west",
                self.config.redis_west_check_command,
                segment_id=segment_id,
                segment_key=segment_key,
            )

            self.run_segment_redis_check(
                "east",
                self.config.redis_east_check_command,
                segment_id=segment_id,
                segment_key=segment_key,
            )

            # --- Post-condition: Cleanup ---

            self._notify_step("cleanup", "running")
            self._delete_segment(source_url, segment_id, headers)
            self.add_timeline_event("cleanup", phase="delete-segment")
            self._notify_step("cleanup", "ok")

            return self.assertions.all_passed()

        except Exception as e:
            self.assertions.add_fail("runner-execution", str(e))
            return False

        finally:
            self.write_artifacts()

    def _create_segment(
        self,
        base_url: str,
        segment_key: str,
        segment_name: str,
        headers: dict,
    ) -> dict:
        """Create a segment via API."""
        client = ApiClient(
            base_url,
            self.config.skip_certificate_check,
            self.config.api_version,
        )

        endpoint = (
            f"/api/v{self.config.api_version}/envs/{self.config.env_id}"
            f"/segments"
        )

        payload = {
            "type": "environment-specific",
            "name": segment_name,
            "key": segment_key,
            "description": "CP-04 test segment",
            "scopes": ["user"],
        }

        response = client.post(endpoint, body=payload, headers=headers)
        data = extract_data(response)
        return data if data else {}

    def _delete_segment(
        self,
        base_url: str,
        segment_id: str,
        headers: dict,
    ) -> bool:
        """Delete a segment via API."""
        client = ApiClient(
            base_url,
            self.config.skip_certificate_check,
            self.config.api_version,
        )

        endpoint = (
            f"/api/v{self.config.api_version}/envs/{self.config.env_id}"
            f"/segments/{segment_id}"
        )

        try:
            client.request("DELETE", endpoint, headers=headers)
            return True
        except Exception:
            return False

    def _get_segment_state(
        self,
        base_url: str,
        segment_id: str,
        region: str,
        headers: dict,
    ) -> SegmentState:
        """Get current segment state from API."""
        client = ApiClient(
            base_url,
            self.config.skip_certificate_check,
            self.config.api_version,
        )

        endpoint = (
            f"/api/v{self.config.api_version}/envs/{self.config.env_id}"
            f"/segments/{segment_id}"
        )

        try:
            response = client.get(endpoint, headers=headers)
            data = extract_data(response)
            return SegmentState(
                region=region,
                observed_at_utc=self._get_utc_timestamp(),
                is_present=data is not None,
                id=data.get("id") if data else None,
                key=data.get("key") if data else None,
                name=data.get("name") if data else None,
                version=data.get("version") if data else None,
                error=None,
            )
        except Exception as e:
            return SegmentState(
                region=region,
                observed_at_utc=self._get_utc_timestamp(),
                is_present=False,
                id=segment_id,
                key=None,
                name=None,
                version=None,
                error=str(e),
            )

    def _poll_segment_convergence(
        self,
        source_url: str,
        target_url: str,
        segment_id: str,
        segment_key: str,
        headers: dict,
    ) -> tuple:
        """Poll both regions until segment converges or timeout."""
        timeout = self.config.convergence_timeout_seconds or 120
        poll_interval = self.config.convergence_poll_interval_seconds or 2
        elapsed = 0
        source_state = None
        target_state = None

        while elapsed < timeout:
            source_state = self._get_segment_state(
                source_url, segment_id, "source", headers
            )
            target_state = self._get_segment_state(
                target_url, segment_id, "target", headers
            )

            self.add_timeline_event(
                "convergence-poll",
                source=json.loads(source_state.json()),
                target=json.loads(target_state.json()),
            )

            if source_state.is_present and target_state.is_present:
                self.add_timeline_event(
                    "convergence-achieved",
                    segment_id=segment_id,
                    segment_key=segment_key,
                    elapsed_seconds=elapsed,
                )
                return True, source_state, target_state

            time.sleep(poll_interval)
            elapsed += poll_interval

        self.add_timeline_event(
            "convergence-timeout",
            segment_id=segment_id,
            segment_key=segment_key,
            timeout_seconds=timeout,
        )
        return False, source_state, target_state

    def _run_segment_kafka_check(
        self,
        check_name: str,
        command: str,
        region: str,
        bootstrap: str,
        topic: str,
        segment_id: str,
        segment_key: str,
    ) -> None:
        """Run a custom Kafka check for segment presence."""
        if not command:
            self.assertions.add_skip(
                check_name,
                f"No Kafka check command configured for {region}.",
            )
            return

        try:
            # Execute custom check command
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
                segment_id=segment_id,
                exit_code=result.returncode,
                output=result.stdout[:500] if result.stdout else None,
            )

            if result.returncode == 0:
                self.assertions.add_pass(
                    check_name,
                    f"Segment {segment_key} found in {topic}.",
                )
            else:
                self.assertions.add_fail(
                    check_name,
                    f"Segment check failed: {result.stderr[:200]}",
                )
        except subprocess.TimeoutExpired:
            self.assertions.add_fail(
                check_name,
                "Segment Kafka check timed out.",
            )
        except Exception as e:
            self.assertions.add_fail(
                check_name,
                f"Segment Kafka check error: {str(e)[:100]}",
            )

    @staticmethod
    def _get_utc_timestamp() -> str:
        """Get current UTC timestamp in ISO format."""
        from datetime import datetime

        return datetime.utcnow().isoformat() + "Z"
