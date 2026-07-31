"""CP-06: Environment Added with Secret Propagation Scenario.

Validates that when an environment is added to a project, the secret change
message is sent through the control plane to update Redis in both datacenters.
"""

import json
import subprocess
import time
import uuid

from core.api_client import ApiClient, extract_data
from core.auth import resolve_authorization_header, resolve_request_context
from core.models import EnvironmentState
from core.scenario_base import BaseScenario, ScenarioDefinition


class CP06Scenario(BaseScenario):
    """CP-06 environment added with secret propagation scenario."""

    def definition(self) -> ScenarioDefinition:
        """Return scenario definition."""
        if self.config.scenario_name == "cp06-west-to-east":
            return ScenarioDefinition(
                scenario_type="cp06",
                source_region="west",
                target_region="east",
                default_flag_key="env-cp06-west",
                target_status=True,
            )
        else:  # cp06-east-to-west
            return ScenarioDefinition(
                scenario_type="cp06",
                source_region="east",
                target_region="west",
                default_flag_key="env-cp06-east",
                target_status=True,
            )

    def run(self) -> bool:
        """Execute CP-06 scenario."""
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
                env_key=definition.default_flag_key,
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

            # --- Phase 1b: Retrieve Project ID ---

            self._notify_step("project-lookup", "running")
            project_id = self._get_project_id(source_url, headers)
            if not project_id:
                self.assertions.add_fail(
                    "project-lookup-failed",
                    "Could not find project containing the configured environment.",
                )
                return False
            self.add_timeline_event(
                "project-resolved", project_id=project_id
            )
            self._notify_step("project-lookup", "ok")

            # --- Phase 2: Create Environment ---

            self._notify_step("environment-create", "running")

            env_key = f"{definition.default_flag_key}-{str(uuid.uuid4())[:8]}"
            env_name = f"CP-06 Test Environment {env_key}"

            env_create_result = self._create_environment(
                source_url,
                project_id,
                env_key,
                env_name,
                headers,
            )

            if not env_create_result.get("id"):
                self.assertions.add_fail(
                    "environment-create-failed",
                    "Environment creation returned no ID.",
                )
                return False

            env_id = env_create_result["id"]
            # Extract the auto-generated secret value for Redis key lookup.
            # EnvironmentVm includes a Secrets collection; each secret has a
            # server-generated 'value' used as the Redis key suffix.
            env_secrets = env_create_result.get("secrets", [])
            env_secret_value = env_secrets[0]["value"] if env_secrets else ""

            self.add_timeline_event(
                "environment-created",
                environment_id=env_id,
                environment_key=env_key,
                environment_name=env_name,
                secret_value=env_secret_value,
            )

            self.assertions.add_pass(
                "api-environment-create-succeeded",
                "Environment creation endpoint responded successfully.",
            )
            self._notify_step("environment-create", "ok")

            # --- Phase 3: Kafka Topic Verification ---
            self._run_environment_kafka_check(
                "source-env-secret-topic-check",
                self.config.source_topic_check_command,
                definition.source_region,
                self._KAFKA_BOOTSTRAP,
                "featbit-control-plane-secret-change",
                env_id,
                env_key,
            )

            # --- Phase 4: Convergence Polling ---
            self._notify_step("convergence", "running")
            converged, _, _ = self._poll_environment_convergence(
                source_url,
                target_url,
                project_id,
                env_id,
                env_key,
                headers,
            )
            if converged:
                self.assertions.add_pass(
                    "environment-convergence",
                    "Environment converged in both regions.",
                )
            else:
                self.assertions.add_fail(
                    "environment-convergence",
                    "Environment did not converge within timeout.",
                )
            self._notify_step("convergence", "ok")

            # --- Phase 5: Redis Verification ---

            self.run_secret_redis_check(
                "west",
                self.config.redis_west_check_command,
                secret_string=env_secret_value,
            )

            self.run_secret_redis_check(
                "east",
                self.config.redis_east_check_command,
                secret_string=env_secret_value,
            )

            # --- Post-condition: Cleanup ---

            self._notify_step("cleanup", "running")
            self._delete_environment(
                source_url, project_id, env_id, headers
            )
            self.add_timeline_event("cleanup", phase="delete-environment")
            self._notify_step("cleanup", "ok")

            return self.assertions.all_passed()

        except Exception as e:
            self.assertions.add_fail("runner-execution", str(e))
            return False

        finally:
            self.write_artifacts()

    def _get_project_id(
        self,
        base_url: str,
        headers: dict,
    ) -> str:
        """Retrieve the project ID that contains the configured environment."""
        client = ApiClient(
            base_url,
            self.config.skip_certificate_check,
            self.config.api_version,
        )

        endpoint = f"/api/v{self.config.api_version}/projects"
        response = client.get(endpoint, headers=headers)
        projects = extract_data(response)

        if not projects:
            return ""

        for project in projects:
            environments = project.get("environments", [])
            for env in environments:
                if env.get("id") == self.config.env_id:
                    return project.get("id", "")

        return ""

    def _create_environment(
        self,
        base_url: str,
        project_id: str,
        env_key: str,
        env_name: str,
        headers: dict,
    ) -> dict:
        """Create an environment via API."""
        client = ApiClient(
            base_url,
            self.config.skip_certificate_check,
            self.config.api_version,
        )

        endpoint = (
            f"/api/v{self.config.api_version}/projects/{project_id}/envs"
        )

        payload = {
            "name": env_name,
            "key": env_key,
        }

        response = client.post(endpoint, body=payload, headers=headers)
        data = extract_data(response)
        return data if data else {}

    def _delete_environment(
        self,
        base_url: str,
        project_id: str,
        env_id: str,
        headers: dict,
    ) -> bool:
        """Delete an environment via API."""
        client = ApiClient(
            base_url,
            self.config.skip_certificate_check,
            self.config.api_version,
        )

        endpoint = (
            f"/api/v{self.config.api_version}/projects/{project_id}"
            f"/envs/{env_id}"
        )

        try:
            client.request("DELETE", endpoint, headers=headers)
            return True
        except Exception:
            return False

    def _get_environment_state(
        self,
        base_url: str,
        project_id: str,
        env_id: str,
        region: str,
        headers: dict,
    ) -> EnvironmentState:
        """Get current environment state from API."""
        client = ApiClient(
            base_url,
            self.config.skip_certificate_check,
            self.config.api_version,
        )

        endpoint = (
            f"/api/v{self.config.api_version}/projects/{project_id}"
            f"/envs/{env_id}"
        )

        try:
            response = client.get(endpoint, headers=headers)
            data = extract_data(response)
            # EnvironmentVm exposes a "secrets" collection ({id,name,type,value});
            # there is no clientSideAvailabilitySecretKey field (#113 — polling
            # on it made convergence unachievable). Any secret with a value
            # proves the env's secrets propagated.
            secrets = (data.get("secrets") or []) if data else []
            secret_value = next(
                (s.get("value") for s in secrets if s.get("value")), None
            )
            return EnvironmentState(
                region=region,
                observed_at_utc=self._get_utc_timestamp(),
                is_present=data is not None,
                id=data.get("id") if data else None,
                key=data.get("key") if data else None,
                name=data.get("name") if data else None,
                secret_key=secret_value,
                error=None,
            )
        except Exception as e:
            return EnvironmentState(
                region=region,
                observed_at_utc=self._get_utc_timestamp(),
                is_present=False,
                id=env_id,
                key=None,
                name=None,
                secret_key=None,
                error=str(e),
            )

    def _poll_environment_convergence(
        self,
        source_url: str,
        target_url: str,
        project_id: str,
        env_id: str,
        env_key: str,
        headers: dict,
    ) -> tuple:
        """Poll both regions until environment converges or timeout."""
        timeout = self.config.convergence_timeout_seconds or 120
        poll_interval = self.config.convergence_poll_interval_seconds or 2
        elapsed = 0
        source_state = None
        target_state = None

        while elapsed < timeout:
            source_state = self._get_environment_state(
                source_url, project_id, env_id, "source", headers
            )
            target_state = self._get_environment_state(
                target_url, project_id, env_id, "target", headers
            )

            self.add_timeline_event(
                "convergence-poll",
                source=json.loads(source_state.json()),
                target=json.loads(target_state.json()),
            )

            # Both regions must have environment present with secret
            if (
                source_state.is_present
                and target_state.is_present
                and source_state.secret_key is not None
                and target_state.secret_key is not None
            ):
                self.add_timeline_event(
                    "convergence-achieved",
                    environment_id=env_id,
                    environment_key=env_key,
                    elapsed_seconds=elapsed,
                )
                return True, source_state, target_state

            time.sleep(poll_interval)
            elapsed += poll_interval

        self.add_timeline_event(
            "convergence-timeout",
            environment_id=env_id,
            environment_key=env_key,
            timeout_seconds=timeout,
        )
        return False, source_state, target_state

    def _run_environment_kafka_check(
        self,
        check_name: str,
        command: str,
        region: str,
        bootstrap: str,
        topic: str,
        env_id: str,
        env_key: str,
    ) -> None:
        """Run a custom Kafka check for environment secret."""
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
                environment_id=env_id,
                exit_code=result.returncode,
                output=result.stdout[:500] if result.stdout else None,
            )

            if result.returncode == 0:
                self.assertions.add_pass(
                    check_name,
                    f"Environment {env_key} secret found in {topic}.",
                )
            else:
                self.assertions.add_fail(
                    check_name,
                    f"Environment check failed: {result.stderr[:200]}",
                )
        except subprocess.TimeoutExpired:
            self.assertions.add_fail(
                check_name,
                "Environment Kafka check timed out.",
            )
        except Exception as e:
            self.assertions.add_fail(
                check_name,
                f"Environment Kafka check error: {str(e)[:100]}",
            )

    @staticmethod
    def _get_utc_timestamp() -> str:
        """Get current UTC timestamp in ISO format."""
        from datetime import datetime

        return datetime.utcnow().isoformat() + "Z"