"""Provision FeatBit resources for UAT test instances."""

import argparse
import json
import math
import os
import sys
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

# Ensure the automation-py root is on sys.path so 'core' package is importable
# when this script is invoked directly (e.g. python scripts/provision_uat.py).
_AUTOMATION_ROOT = str(Path(__file__).resolve().parent.parent)
if _AUTOMATION_ROOT not in sys.path:
    sys.path.insert(0, _AUTOMATION_ROOT)

from dotenv import load_dotenv

from core.api_client import ApiClient, ApiClientError, extract_data
from core.auth import resolve_authorization_header
from core.logging_config import get_logger

logger = get_logger("automation.provision_uat")


def _as_list(value: Any) -> List[Dict[str, Any]]:
    """Normalize API payload to a list of dicts."""
    if value is None:
        return []
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    if isinstance(value, dict):
        return [value]
    return []


def _find_by_key(items: List[Dict[str, Any]], key: str) -> Optional[Dict[str, Any]]:
    """Find resource by key."""
    return next((item for item in items if item.get("key") == key), None)


def _distribute_flag_counts(instance_count: int) -> List[int]:
    """Distribute flag counts evenly from 1 to 6 across instances."""
    if instance_count == 1:
        return [3]
    counts = []
    for i in range(instance_count):
        value = 1 + math.floor(i * 5 / max(instance_count - 1, 1))
        counts.append(value)
    return counts


def _extract_env_secret(env_data: Dict[str, Any]) -> str:
    """Extract server SDK secret from environment data.

    Prefers the server-type secret since FeatBit Server SDK connects
    with type=server. Falls back to the first available secret.
    """
    # Shape: { "secrets": [{"type": "server", "value": "..."}, {"type": "client", "value": "..."}] }
    secrets = env_data.get("secrets") or env_data.get("Secrets") or []
    if isinstance(secrets, list):
        server_secret = ""
        fallback_secret = ""
        for secret in secrets:
            if isinstance(secret, dict):
                secret_type = (secret.get("type") or secret.get("Type") or "").lower()
                secret_key = secret.get("value") or secret.get("Value") or secret.get("key") or secret.get("Key") or ""
                if secret_key:
                    if secret_type == "server":
                        server_secret = secret_key
                    elif not fallback_secret:
                        fallback_secret = secret_key
        if server_secret:
            return server_secret
        if fallback_secret:
            return fallback_secret

    # Shape: { "clientSdkKey": "...", "serverSdkKey": "..." }
    for field in ("serverSdkKey", "ServerSdkKey", "clientSdkKey", "ClientSdkKey"):
        if env_data.get(field):
            return env_data[field]

    # Shape: { "settings": { "sdkKey": "..." } }
    settings = env_data.get("settings") or env_data.get("Settings") or {}
    if isinstance(settings, dict):
        for field in ("sdkKey", "SdkKey", "serverSdkKey", "clientSdkKey"):
            if settings.get(field):
                return settings[field]

    return ""


def _resolve_auth_and_context(
    client: ApiClient,
    api_base_url: str,
    login_api_base_url: str,
    api_authorization_header: Optional[str],
    login_email: str,
    login_password: str,
    workspace_key: str,
    organization_key: str,
    skip_certificate_check: bool,
    api_version: str,
    verbose: bool,
    on_step: Optional[Callable],
) -> tuple:
    """Resolve auth, workspace, and organization. Returns (headers, workspace_id, organization_id)."""
    if on_step:
        on_step("auth", "running")

    auth_header = resolve_authorization_header(
        login_api_base_url or api_base_url,
        api_authorization_header,
        login_email,
        login_password,
        workspace_key,
        skip_certificate_check,
        api_version,
    )

    headers: Dict[str, str] = {
        "Authorization": auth_header,
        "Content-Type": "application/json",
    }

    # Resolve workspace from profile
    profile_endpoint = f"/api/v{api_version}/user/profile"
    if verbose:
        logger.info("provision_uat.profile.fetching", endpoint=profile_endpoint)

    try:
        profile_response = client.get(profile_endpoint, headers=headers)
        profile_data = extract_data(profile_response)
        workspace_id = profile_data.get("workspaceId") or profile_data.get("WorkspaceId")

        # Fallback: profile no longer includes workspaceId. Look it up via /user/workspaces.
        if not workspace_id:
            workspaces_endpoint = f"/api/v{api_version}/user/workspaces"
            if verbose:
                logger.info(
                    "provision_uat.workspace.fetching",
                    endpoint=workspaces_endpoint,
                    reason="profile_missing_workspace_id",
                )
            workspaces_response = client.get(workspaces_endpoint, headers=headers)
            workspaces_list = _as_list(extract_data(workspaces_response))
            workspace = _find_by_key(workspaces_list, workspace_key) if workspace_key else None
            if not workspace and workspaces_list:
                workspace = workspaces_list[0]
            if workspace:
                workspace_id = workspace.get("id") or workspace.get("Id")

        if not workspace_id:
            raise RuntimeError(
                "Unable to resolve workspace: profile has no workspaceId and "
                "/user/workspaces returned no workspaces for this user."
            )

        headers["Workspace"] = workspace_id
        logger.info("provision_uat.profile.resolved", workspace_id=workspace_id)
    except Exception as e:
        if on_step:
            on_step("auth", "failed")
        logger.error("provision_uat.profile.failed", error=str(e))
        raise

    # Resolve organization
    org_list_endpoint = f"/api/v{api_version}/organizations"
    if verbose:
        logger.info("provision_uat.organization.querying", endpoint=org_list_endpoint)

    try:
        org_list_response = client.get(org_list_endpoint, headers=headers)
        orgs_list = _as_list(extract_data(org_list_response))
        organization = _find_by_key(orgs_list, organization_key)

        if not organization:
            # Also try matching by name
            organization = next(
                (o for o in orgs_list if o.get("name") == organization_key), None
            )

        if not organization:
            if verbose:
                logger.info("provision_uat.organization.creating", key=organization_key)
            try:
                org_create_response = client.post(
                    org_list_endpoint,
                    {"name": organization_key, "key": organization_key},
                    headers=headers,
                )
                organization = extract_data(org_create_response)
                logger.info("provision_uat.organization.created", org_id=organization.get("id"))
            except ApiClientError as create_err:
                logger.warning(
                    "provision_uat.organization.create_failed",
                    error=str(create_err),
                    hint="MultiOrg license may be required",
                )
                # Re-query and fall back to first available org
                org_list_response = client.get(org_list_endpoint, headers=headers)
                orgs_list = _as_list(extract_data(org_list_response))
                organization = _find_by_key(orgs_list, organization_key)
                if not organization and orgs_list:
                    organization = orgs_list[0]
                    logger.info(
                        "provision_uat.organization.fallback",
                        org_id=organization.get("id"),
                        org_name=organization.get("name"),
                    )
        else:
            if verbose:
                logger.info("provision_uat.organization.found", org_id=organization.get("id"))
    except Exception as e:
        if on_step:
            on_step("auth", "failed")
        logger.error("provision_uat.organization.failed", error=str(e))
        raise

    if not organization:
        raise RuntimeError("Unable to resolve organization after create/retry.")

    organization_id = organization.get("id")
    headers["Organization"] = organization_id

    # Onboard if needed
    if not organization.get("initialized"):
        if verbose:
            logger.info("provision_uat.organization.onboarding", org_id=organization_id)
        onboard_endpoint = f"/api/v{api_version}/organizations/{organization_id}/onboarding"
        try:
            client.post(onboard_endpoint, {}, headers=headers)
        except Exception as e:
            logger.warning("provision_uat.organization.onboard_failed", error=str(e))

    if on_step:
        on_step("auth", "ok")

    return headers, workspace_id, organization_id


def provision_uat_instances(
    api_base_url: str,
    login_api_base_url: str,
    api_authorization_header: Optional[str],
    login_email: str,
    login_password: str,
    workspace_key: str,
    organization_key: str,
    skip_certificate_check: bool,
    instance_count: int = 3,
    flag_counts: Optional[List[int]] = None,
    api_version: str = "1",
    verbose: bool = False,
    on_step: Optional[Callable] = None,
) -> Dict[str, Any]:
    """Provision FeatBit resources for N UAT test instances.

    For each instance creates a project, environment, and feature flags.

    Args:
        api_base_url: Base URL for the FeatBit API.
        login_api_base_url: Login API base URL.
        api_authorization_header: Pre-existing bearer token (optional).
        login_email: Login email.
        login_password: Login password.
        workspace_key: Workspace key.
        organization_key: Organization key.
        skip_certificate_check: Skip TLS verification.
        instance_count: Number of test app instances to provision.
        flag_counts: Number of flags per instance. If None, distributes 1-6 evenly.
        api_version: API version.
        verbose: Verbose logging.
        on_step: Step callback(step_name, status).

    Returns:
        Dict with instances list, workspace_id, and organization_id.
    """
    logger.info(
        "provision_uat.started",
        api_base_url=api_base_url,
        instance_count=instance_count,
    )

    if flag_counts is None:
        flag_counts = _distribute_flag_counts(instance_count)
    if len(flag_counts) < instance_count:
        # Pad with the last value if not enough counts provided
        flag_counts.extend([flag_counts[-1]] * (instance_count - len(flag_counts)))

    client = ApiClient(api_base_url, skip_certificate_check, api_version)

    headers, workspace_id, organization_id = _resolve_auth_and_context(
        client,
        api_base_url,
        login_api_base_url,
        api_authorization_header,
        login_email,
        login_password,
        workspace_key,
        organization_key,
        skip_certificate_check,
        api_version,
        verbose,
        on_step,
    )

    projects_endpoint = f"/api/v{api_version}/projects"
    instances: List[Dict[str, Any]] = []

    for i in range(1, instance_count + 1):
        instance_id = f"uat-instance-{i}"
        project_key = instance_id
        project_name = instance_id
        env_key = "uat-env"
        env_name = "UAT Environment"
        num_flags = flag_counts[i - 1]

        if on_step:
            on_step(instance_id, "running")
        logger.info("provision_uat.instance.start", instance=instance_id, flag_count=num_flags)

        # --- Get or create project (idempotent) ---
        if verbose:
            logger.info("provision_uat.project.querying", key=project_key)

        try:
            projects_response = client.get(projects_endpoint, headers=headers)
            projects = _as_list(extract_data(projects_response))
            project = _find_by_key(projects, project_key)

            if not project:
                if verbose:
                    logger.info("provision_uat.project.creating", key=project_key)
                try:
                    project_create_response = client.post(
                        projects_endpoint,
                        {"name": project_name, "key": project_key},
                        headers=headers,
                    )
                    project = extract_data(project_create_response)
                    logger.info("provision_uat.project.created", project_id=project.get("id"))
                except ApiClientError as e:
                    logger.warning(
                        "provision_uat.project.create_failed", error=str(e), retrying=True
                    )
                    projects_response = client.get(projects_endpoint, headers=headers)
                    projects = _as_list(extract_data(projects_response))
                    project = _find_by_key(projects, project_key)
            else:
                if verbose:
                    logger.info("provision_uat.project.found", project_id=project.get("id"))
        except Exception as e:
            logger.error("provision_uat.project.failed", instance=instance_id, error=str(e))
            if on_step:
                on_step(instance_id, "failed")
            raise

        if not project:
            raise RuntimeError(f"Unable to resolve project {project_key} after create/retry.")

        project_id = project.get("id")
        if not project_id:
            raise RuntimeError(f"Project {project_key} resolved without an id.")

        # --- Get or create environment (idempotent) ---
        if verbose:
            logger.info("provision_uat.environment.resolving", key=env_key)

        environments = _as_list(project.get("environments"))
        environment = _find_by_key(environments, env_key)

        if not environment:
            # The project list may not embed environments; fetch project detail
            try:
                project_detail_endpoint = (
                    f"/api/v{api_version}/projects/{project_id}"
                )
                if verbose:
                    logger.info(
                        "provision_uat.environment.refetch_project",
                        endpoint=project_detail_endpoint,
                    )
                project_detail_response = client.get(
                    project_detail_endpoint, headers=headers
                )
                project_detail = extract_data(project_detail_response)
                environments = _as_list(project_detail.get("environments"))
                environment = _find_by_key(environments, env_key)
            except ApiClientError:
                environment = None

        if not environment:
            if verbose:
                logger.info("provision_uat.environment.creating", key=env_key)
            env_create_endpoint = f"/api/v{api_version}/projects/{project_id}/envs"
            env_create_payload = {
                "name": env_name,
                "key": env_key,
                "description": f"UAT environment for {instance_id}.",
            }
            try:
                env_create_response = client.post(
                    env_create_endpoint, env_create_payload, headers=headers
                )
                environment = extract_data(env_create_response)
                logger.info("provision_uat.environment.created", env_id=environment.get("id"))
            except ApiClientError as e:
                logger.warning(
                    "provision_uat.environment.create_failed", error=str(e), retrying=True
                )
                # Re-fetch project detail to find the environment
                try:
                    project_detail_endpoint = (
                        f"/api/v{api_version}/projects/{project_id}"
                    )
                    project_detail_response = client.get(
                        project_detail_endpoint, headers=headers
                    )
                    project_detail = extract_data(project_detail_response)
                    environments = _as_list(project_detail.get("environments"))
                    environment = _find_by_key(environments, env_key)
                except ApiClientError:
                    environment = None
        else:
            if verbose:
                logger.info("provision_uat.environment.found", env_id=environment.get("id"))

        if not environment:
            raise RuntimeError(
                f"Unable to resolve environment {env_key} for {instance_id} after create/retry."
            )

        environment_id = environment.get("id")
        if not environment_id:
            raise RuntimeError(f"Environment {env_key} resolved without an id.")

        # --- Extract environment secret ---
        env_secret = _extract_env_secret(environment)
        if not env_secret:
            # Re-fetch environment via project detail to get secrets
            if verbose:
                logger.info("provision_uat.env_secret.refetching", env_key=env_key)
            try:
                env_detail_endpoint = (
                    f"/api/v{api_version}/projects/{project_id}/envs/{environment_id}"
                )
                env_detail_response = client.get(env_detail_endpoint, headers=headers)
                env_detail_data = extract_data(env_detail_response)
                env_secret = _extract_env_secret(env_detail_data)
            except ApiClientError as e:
                logger.warning("provision_uat.env_secret.fetch_failed", error=str(e))

        if env_secret:
            logger.info("provision_uat.env_secret.resolved", instance=instance_id)
        else:
            logger.warning("provision_uat.env_secret.not_found", instance=instance_id)

        # --- Create feature flags (idempotent) ---
        flags_endpoint = f"/api/v{api_version}/envs/{environment_id}/feature-flags"
        flag_keys: List[str] = []

        for j in range(1, num_flags + 1):
            flag_key = f"uat-flag-{j}"
            if verbose:
                logger.info("provision_uat.flag.processing", flag_key=flag_key)

            existing_flag = None
            flag_get_endpoint = f"{flags_endpoint}/{flag_key}"

            try:
                existing_flag_response = client.get(flag_get_endpoint, headers=headers)
                existing_flag = extract_data(existing_flag_response)
                logger.info("provision_uat.flag.found", flag_key=flag_key)
            except ApiClientError:
                # Flag doesn't exist, create it
                if verbose:
                    logger.info("provision_uat.flag.creating", flag_key=flag_key)
                true_variation_id = f"{flag_key}-true"
                false_variation_id = f"{flag_key}-false"
                flag_payload = {
                    "name": flag_key,
                    "key": flag_key,
                    "isEnabled": False,
                    "variationType": "boolean",
                    "variations": [
                        {"id": true_variation_id, "name": "true", "value": "true"},
                        {"id": false_variation_id, "name": "false", "value": "false"},
                    ],
                    "enabledVariationId": true_variation_id,
                    "disabledVariationId": false_variation_id,
                }
                try:
                    created_flag_response = client.post(
                        flags_endpoint, flag_payload, headers=headers
                    )
                    existing_flag = extract_data(created_flag_response)
                    logger.info("provision_uat.flag.created", flag_key=flag_key)
                except ApiClientError as create_error:
                    logger.error(
                        "provision_uat.flag.create_failed",
                        flag_key=flag_key,
                        error=str(create_error),
                    )
                    raise RuntimeError(
                        f"Failed to create flag {flag_key} for {instance_id}: {create_error}"
                    )

            flag_keys.append(flag_key)

        instances.append(
            {
                "instance_id": instance_id,
                "project_key": project_key,
                "project_id": project_id,
                "environment_key": env_key,
                "environment_id": environment_id,
                "env_secret": env_secret,
                "flag_keys": flag_keys,
                "flag_count": num_flags,
            }
        )

        if on_step:
            on_step(instance_id, "ok")
        logger.info("provision_uat.instance.done", instance=instance_id, flag_count=num_flags)

    result = {
        "instances": instances,
        "workspace_id": workspace_id,
        "organization_id": organization_id,
    }

    logger.info("provision_uat.completed", instance_count=len(instances))
    return result


def teardown_uat_instances(
    api_base_url: str,
    login_api_base_url: str,
    api_authorization_header: Optional[str],
    login_email: str,
    login_password: str,
    workspace_key: str,
    organization_key: str,
    skip_certificate_check: bool,
    provisioned_config: Dict[str, Any],
    api_version: str = "1",
    verbose: bool = False,
    on_step: Optional[Callable] = None,
) -> Dict[str, Any]:
    """Tear down provisioned UAT resources by archiving flags and removing projects.

    Args:
        api_base_url: Base URL for the FeatBit API.
        login_api_base_url: Login API base URL.
        api_authorization_header: Pre-existing bearer token (optional).
        login_email: Login email.
        login_password: Login password.
        workspace_key: Workspace key.
        organization_key: Organization key.
        skip_certificate_check: Skip TLS verification.
        provisioned_config: Config dict returned by provision_uat_instances().
        api_version: API version.
        verbose: Verbose logging.
        on_step: Step callback(step_name, status).

    Returns:
        Dict with teardown results per instance.
    """
    logger.info("teardown_uat.started")

    client = ApiClient(api_base_url, skip_certificate_check, api_version)

    headers, _, _ = _resolve_auth_and_context(
        client,
        api_base_url,
        login_api_base_url,
        api_authorization_header,
        login_email,
        login_password,
        workspace_key,
        organization_key,
        skip_certificate_check,
        api_version,
        verbose,
        on_step,
    )

    results: List[Dict[str, Any]] = []
    instances = provisioned_config.get("instances", [])

    for instance in instances:
        instance_id = instance.get("instance_id", "unknown")
        environment_id = instance.get("environment_id")
        flag_keys = instance.get("flag_keys", [])
        project_key = instance.get("project_key")

        if on_step:
            on_step(f"teardown-{instance_id}", "running")
        logger.info("teardown_uat.instance.start", instance=instance_id)

        instance_result: Dict[str, Any] = {
            "instance_id": instance_id,
            "flags_archived": [],
            "flags_failed": [],
            "project_removed": False,
        }

        # Archive each flag
        if environment_id:
            flags_endpoint = f"/api/v{api_version}/envs/{environment_id}/feature-flags"
            for flag_key in flag_keys:
                archive_endpoint = f"{flags_endpoint}/{flag_key}/archive"
                try:
                    client.put(archive_endpoint, body="{}", headers=headers)
                    instance_result["flags_archived"].append(flag_key)
                    if verbose:
                        logger.info("teardown_uat.flag.archived", flag_key=flag_key)
                except ApiClientError as e:
                    instance_result["flags_failed"].append(flag_key)
                    logger.warning(
                        "teardown_uat.flag.archive_failed", flag_key=flag_key, error=str(e)
                    )

        # Remove the project
        if project_key:
            project_remove_endpoint = f"/api/v{api_version}/projects/{project_key}/remove"
            try:
                client.put(project_remove_endpoint, body="{}", headers=headers)
                instance_result["project_removed"] = True
                logger.info("teardown_uat.project.removed", project_key=project_key)
            except ApiClientError:
                # Try archive as fallback
                project_archive_endpoint = (
                    f"/api/v{api_version}/projects/{project_key}/archive"
                )
                try:
                    client.put(project_archive_endpoint, body="{}", headers=headers)
                    instance_result["project_removed"] = True
                    logger.info("teardown_uat.project.archived", project_key=project_key)
                except ApiClientError as e:
                    logger.warning(
                        "teardown_uat.project.remove_failed",
                        project_key=project_key,
                        error=str(e),
                    )

        results.append(instance_result)
        if on_step:
            on_step(f"teardown-{instance_id}", "ok")
        logger.info("teardown_uat.instance.done", instance=instance_id)

    logger.info("teardown_uat.completed", count=len(results))
    return {"instances": results}


def provision_uat(
    output_path: str = "uat-config.json",
    instance_count: int = 3,
    flag_counts: str = "",
) -> None:
    """Provision UAT resources and write config to JSON file.

    Loads configuration from .env, provisions the requested instances,
    and writes the resulting config to output_path.

    Args:
        output_path: Path to write the JSON config file.
        instance_count: Number of UAT instances to provision.
        flag_counts: Comma-separated flag counts per instance (e.g. "1,3,6").
    """
    env_file = Path(__file__).resolve().parents[1] / ".env"
    if env_file.exists():
        load_dotenv(env_file)

    parsed_flag_counts: Optional[List[int]] = None
    if flag_counts:
        parsed_flag_counts = [int(c.strip()) for c in flag_counts.split(",") if c.strip()]

    result = provision_uat_instances(
        api_base_url=os.getenv("WEST_API_BASE_URL", ""),
        login_api_base_url=os.getenv("LOGIN_API_BASE_URL", ""),
        api_authorization_header=os.getenv("API_AUTHORIZATION_HEADER"),
        login_email=os.getenv("LOGIN_EMAIL", ""),
        login_password=os.getenv("LOGIN_PASSWORD", ""),
        workspace_key=os.getenv("WORKSPACE_KEY", ""),
        organization_key=os.getenv("ORGANIZATION_KEY", "playground"),
        skip_certificate_check=os.getenv("SKIP_CERTIFICATE_CHECK", "true").lower() == "true",
        instance_count=instance_count,
        flag_counts=parsed_flag_counts,
        api_version="1",
        verbose=True,
    )

    output = Path(output_path)
    output.write_text(json.dumps(result, indent=2, default=str), encoding="utf-8")
    logger.info("provision_uat.config_written", path=str(output.resolve()))

    # Print summary to stdout
    print(f"\n=== UAT Provisioning Summary ===")
    print(f"Instances provisioned: {len(result['instances'])}")
    print(f"Workspace ID: {result['workspace_id']}")
    print(f"Organization ID: {result['organization_id']}")
    for inst in result["instances"]:
        secret_display = inst["env_secret"][:12] + "..." if inst["env_secret"] else "(not found)"
        print(
            f"  {inst['instance_id']}: "
            f"{inst['flag_count']} flags, "
            f"env_secret={secret_display}"
        )
    print(f"\nConfig written to: {output.resolve()}")


def main() -> None:
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Provision FeatBit resources for UAT test instances."
    )
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # provision sub-command
    provision_parser = subparsers.add_parser("provision", help="Provision UAT instances")
    provision_parser.add_argument(
        "--output",
        default="uat-config.json",
        help="Output JSON config file path (default: uat-config.json)",
    )
    provision_parser.add_argument(
        "--instances",
        type=int,
        default=3,
        help="Number of UAT instances to provision (default: 3)",
    )
    provision_parser.add_argument(
        "--flag-counts",
        default="",
        help="Comma-separated flag counts per instance (e.g. '1,3,6')",
    )

    # teardown sub-command
    teardown_parser = subparsers.add_parser("teardown", help="Tear down UAT instances")
    teardown_parser.add_argument(
        "--config",
        default="uat-config.json",
        help="Path to the provisioned config JSON file (default: uat-config.json)",
    )

    args = parser.parse_args()

    if args.command == "provision":
        provision_uat(
            output_path=args.output,
            instance_count=args.instances,
            flag_counts=args.flag_counts,
        )
    elif args.command == "teardown":
        config_path = Path(args.config)
        if not config_path.exists():
            print(f"Error: Config file not found: {config_path}", file=sys.stderr)
            sys.exit(1)

        provisioned_config = json.loads(config_path.read_text(encoding="utf-8"))

        env_file = Path(__file__).resolve().parents[1] / ".env"
        if env_file.exists():
            load_dotenv(env_file)

        teardown_uat_instances(
            api_base_url=os.getenv("WEST_API_BASE_URL", ""),
            login_api_base_url=os.getenv("LOGIN_API_BASE_URL", ""),
            api_authorization_header=os.getenv("API_AUTHORIZATION_HEADER"),
            login_email=os.getenv("LOGIN_EMAIL", ""),
            login_password=os.getenv("LOGIN_PASSWORD", ""),
            workspace_key=os.getenv("WORKSPACE_KEY", ""),
            organization_key=os.getenv("ORGANIZATION_KEY", "playground"),
            skip_certificate_check=os.getenv("SKIP_CERTIFICATE_CHECK", "true").lower() == "true",
            provisioned_config=provisioned_config,
            api_version="1",
            verbose=True,
        )
        print("Teardown complete.")
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
