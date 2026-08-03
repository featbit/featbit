"""Seed data bootstrap: create org/project/env/flags."""

from typing import Any, Dict, Optional

from core.api_client import ApiClient, extract_data
from core.api_client import ApiClientError
from core.auth import resolve_authorization_header
from core.logging_config import get_logger

logger = get_logger("automation.seed")


def _as_list(value: Any) -> list[Dict[str, Any]]:
    """Normalize API payload to a list of dicts."""
    if value is None:
        return []
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    if isinstance(value, dict):
        return [value]
    return []


def _find_by_key_or_name(items: list[Dict[str, Any]], key: str, name: str) -> Optional[Dict[str, Any]]:
    """Find resource by key first, then by name."""
    found = next((item for item in items if item.get("key") == key), None)
    if found:
        return found
    return next((item for item in items if item.get("name") == name), None)


def seed(
    west_api_base_url: str,
    login_api_base_url: str,
    api_authorization_header: Optional[str],
    login_email: str,
    login_password: str,
    workspace_key: str,
    organization_key: str,
    skip_certificate_check: bool,
    force_flags_off: bool = True,
    api_version: str = "1",
    verbose: bool = False,
    on_flag=None,
) -> Dict[str, Any]:
    """Seed control-plane QA data.

    Args:
        west_api_base_url: West API base URL
        login_api_base_url: Login API base URL
        api_authorization_header: Pre-existing bearer token (optional)
        login_email: Email for login-by-email
        login_password: Password for login-by-email
        workspace_key: Workspace key
        organization_key: Organization key
        skip_certificate_check: Skip TLS verification
        force_flags_off: Toggle all seed flags to disabled state
        api_version: API version
        verbose: Enable detailed logging

    Returns:
        Dict with workspace_id, organization_id, project_id, environment_id, env_id_guid
    """
    logger.info("seed.started", api_base_url=west_api_base_url, organization_key=organization_key, verbose=verbose)
    
    if on_flag:
        on_flag("auth", "running")
    client = ApiClient(west_api_base_url, skip_certificate_check, api_version)

    # Resolve auth
    if verbose:
        logger.info("seed.auth.resolving", login_api_base_url=login_api_base_url)
    
    auth_header = resolve_authorization_header(
        west_api_base_url,
        api_authorization_header,
        login_email,
        login_password,
        workspace_key,
        skip_certificate_check,
        api_version,
    )

    headers = {
        "Authorization": auth_header,
        "Content-Type": "application/json",
    }

    # Get workspace from profile
    profile_endpoint = f"/api/v{api_version}/user/profile"
    if verbose:
        logger.info("seed.profile.fetching", endpoint=profile_endpoint)
    
    try:
        profile_response = client.get(profile_endpoint, headers=headers)
        profile_data = extract_data(profile_response)

        workspace_id = profile_data.get("workspaceId") or profile_data.get("WorkspaceId")
        if not workspace_id:
            # /user/profile no longer always carries the workspace id; fall back
            # to /user/workspaces (same pattern as core/auth.py and provision_uat.py).
            workspaces = _as_list(extract_data(client.get(f"/api/v{api_version}/user/workspaces", headers=headers)))
            match = _find_by_key_or_name(workspaces, organization_key, organization_key)
            ws = match or (workspaces[0] if workspaces else None)
            workspace_id = (ws or {}).get("id") or (ws or {}).get("Id")
        if not workspace_id:
            raise RuntimeError("Unable to resolve workspace id from /user/profile or /user/workspaces.")
        headers["Workspace"] = workspace_id
        logger.info("seed.profile.resolved", workspace_id=workspace_id)
        if on_flag:
            on_flag("auth", "ok")
    except Exception as e:
        if on_flag:
            on_flag("auth", "failed")
        logger.error("seed.profile.failed", error=str(e), endpoint=profile_endpoint)
        raise

    # Get or create organization (idempotent)
    org_list_endpoint = f"/api/v{api_version}/organizations"
    if on_flag:
        on_flag("org / project / env", "running")
    if verbose:
        logger.info("seed.organization.querying", endpoint=org_list_endpoint)
    
    try:
        org_list_response = client.get(org_list_endpoint, headers=headers)
        orgs = extract_data(org_list_response)
        orgs_list = _as_list(orgs)
        if verbose:
            logger.info("seed.organization.list_received", count=len(orgs_list))

        organization = _find_by_key_or_name(orgs_list, organization_key, organization_key)

        if not organization:
            if verbose:
                logger.info("seed.organization.creating", key=organization_key)
            # Create organization; on conflict/validation errors, re-query list.
            org_create_endpoint = f"/api/v{api_version}/organizations"
            org_create_payload = {
                "name": organization_key,
                "key": organization_key,
            }
            try:
                org_create_response = client.post(org_create_endpoint, org_create_payload, headers=headers)
                organization = extract_data(org_create_response)
                logger.info("seed.organization.created", org_id=organization.get("id"))
            except ApiClientError as e:
                logger.warning("seed.organization.create_failed", error=str(e), retrying=True)
                org_list_response = client.get(org_list_endpoint, headers=headers)
                orgs_list = _as_list(extract_data(org_list_response))
                organization = _find_by_key_or_name(orgs_list, organization_key, organization_key)
        else:
            if verbose:
                logger.info("seed.organization.found", org_id=organization.get("id"))

    except Exception as e:
        logger.error("seed.organization.failed", error=str(e))
        raise

    if not organization:
        logger.error("seed.organization.not_resolved")
        raise RuntimeError("Unable to resolve organization after create/retry.")

    organization_id = organization.get("id")
    headers["Organization"] = organization_id

    # Onboard if needed
    if not organization.get("initialized"):
        if verbose:
            logger.info("seed.organization.onboarding", org_id=organization_id)
        onboard_endpoint = f"/api/v{api_version}/organizations/{organization_id}/onboarding"
        try:
            client.post(onboard_endpoint, {}, headers=headers)
            logger.info("seed.organization.onboarded", org_id=organization_id)
        except Exception as e:
            logger.warning("seed.organization.onboard_failed", error=str(e))
    else:
        if verbose:
            logger.info("seed.organization.already_initialized", org_id=organization_id)

    # Get or create project (idempotent). List-first is more reliable than /by-key.
    project_key = "control-plane-test"
    project_name = "control-plane-test"
    projects_endpoint = f"/api/v{api_version}/projects"

    if verbose:
        logger.info("seed.project.querying", endpoint=projects_endpoint)

    try:
        projects_response = client.get(projects_endpoint, headers=headers)
        projects = _as_list(extract_data(projects_response))
        if verbose:
            logger.info("seed.project.list_received", count=len(projects))
        
        project = _find_by_key_or_name(projects, project_key, project_name)

        if not project:
            if verbose:
                logger.info("seed.project.creating", key=project_key)
            project_create_payload = {
                "name": project_name,
                "key": project_key,
            }
            try:
                project_create_response = client.post(projects_endpoint, project_create_payload, headers=headers)
                project = extract_data(project_create_response)
                logger.info("seed.project.created", project_id=project.get("id"))
            except ApiClientError as e:
                logger.warning("seed.project.create_failed", error=str(e), retrying=True)
                projects_response = client.get(projects_endpoint, headers=headers)
                projects = _as_list(extract_data(projects_response))
                project = _find_by_key_or_name(projects, project_key, project_name)
        else:
            if verbose:
                logger.info("seed.project.found", project_id=project.get("id"))

    except Exception as e:
        logger.error("seed.project.failed", error=str(e))
        raise

    if not project:
        logger.error("seed.project.not_resolved")
        raise RuntimeError("Unable to resolve project after create/retry.")

    project_id = project.get("id")
    if not project_id:
        raise RuntimeError("Project resolved without an id.")

    # Get or create environment (idempotent). Prefer project payload if present.
    environment_key = "dev"
    environment_name = "Dev"
    if verbose:
        logger.info("seed.environment.resolving", key=environment_key)
    
    environments = _as_list(project.get("environments"))
    if verbose:
        logger.info("seed.environment.from_project", count=len(environments))
    
    environment = _find_by_key_or_name(environments, environment_key, environment_name)

    if not environment:
        try:
            env_by_key_endpoint = f"/api/v{api_version}/projects/{project_id}/envs/by-key/{environment_key}"
            if verbose:
                logger.info("seed.environment.by_key", endpoint=env_by_key_endpoint)
            env_response = client.get(env_by_key_endpoint, headers=headers)
            environment = extract_data(env_response)
        except ApiClientError as e:
            if verbose:
                logger.info("seed.environment.by_key_failed", error=str(e))
            environment = None

    if not environment:
        if verbose:
            logger.info("seed.environment.creating", key=environment_key)
        env_create_endpoint = f"/api/v{api_version}/projects/{project_id}/envs"
        env_create_payload = {
            "name": environment_name,
            "key": environment_key,
            "description": "Seeded environment for control-plane QA automation.",
        }
        try:
            env_create_response = client.post(env_create_endpoint, env_create_payload, headers=headers)
            environment = extract_data(env_create_response)
            logger.info("seed.environment.created", env_id=environment.get("id"))
        except ApiClientError as e:
            logger.warning("seed.environment.create_failed", error=str(e), retrying=True)
            try:
                env_by_key_endpoint = f"/api/v{api_version}/projects/{project_id}/envs/by-key/{environment_key}"
                env_response = client.get(env_by_key_endpoint, headers=headers)
                environment = extract_data(env_response)
                logger.info("seed.environment.found_after_create_failed", env_id=environment.get("id"))
            except ApiClientError:
                environment = None
    else:
        if verbose:
            logger.info("seed.environment.found", env_id=environment.get("id"))

    if not environment:
        logger.error("seed.environment.not_resolved")
        raise RuntimeError("Unable to resolve environment after create/retry.")

    environment_id = environment.get("id")
    if not environment_id:
        logger.error("seed.environment.no_id")
        raise RuntimeError("Environment resolved without an id.")

    # Seed feature flags
    flag_keys = [
        "ff-cp01-basic",
        "ff-cp02-west",
        "ff-cp02-east",
        "ff-cp03-resilience",
        # GatedCommit consistency scenarios (CP-10 – CP-14).
        "ff-cp10-gatedcommit",
        "ff-cp11-eviction",
        "ff-cp12-recovery",
        "ff-cp14-mode",
    ]
    flag_ids_by_key: Dict[str, str] = {}
    flags_endpoint = f"/api/v{api_version}/envs/{environment_id}/feature-flags"
    logger.info("seed.flags.seeding", flag_count=len(flag_keys), endpoint=flags_endpoint)
    if on_flag:
        on_flag("org / project / env", "ok")

    for flag_key in flag_keys:
        existing_flag = None
        flag_get_endpoint = f"{flags_endpoint}/{flag_key}"
        
        if verbose:
            logger.info("seed.flag.processing", flag_key=flag_key)
        
        if on_flag:
            on_flag(flag_key, "running")
        try:
            # Try to get existing flag
            if verbose:
                logger.info("seed.flag.checking", flag_key=flag_key)
            existing_flag_response = client.get(flag_get_endpoint, headers=headers)
            existing_flag = extract_data(existing_flag_response)
            logger.info("seed.flag.found", flag_key=flag_key, flag_id=existing_flag.get("id"))
        except ApiClientError as get_error:
            # Flag doesn't exist, create it
            if verbose:
                logger.info("seed.flag.creating", flag_key=flag_key)
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
                if verbose:
                    logger.info("seed.flag.post_request", flag_key=flag_key, endpoint=flags_endpoint, payload=flag_payload)
                created_flag_response = client.post(flags_endpoint, flag_payload, headers=headers)
                existing_flag = extract_data(created_flag_response)
                logger.info("seed.flag.created", flag_key=flag_key, flag_id=existing_flag.get("id"))
            except ApiClientError as create_error:
                logger.error("seed.flag.create_failed", flag_key=flag_key, error=str(create_error), endpoint=flags_endpoint, payload=flag_payload)
                if on_flag:
                    on_flag(flag_key, "failed")
                raise RuntimeError(f"Failed to create flag {flag_key}: {create_error}")

        if existing_flag and existing_flag.get("id"):
            flag_ids_by_key[flag_key] = str(existing_flag.get("id"))
            if on_flag:
                on_flag(flag_key, "ok")

        # Toggle to false to normalize state
        if force_flags_off and existing_flag:
            toggle_endpoint = f"{flags_endpoint}/{flag_key}/toggle/false"
            try:
                if verbose:
                    logger.info("seed.flag.toggling", flag_key=flag_key, endpoint=toggle_endpoint)
                client.put(toggle_endpoint, "{}", headers=headers)
                logger.info("seed.flag.toggled", flag_key=flag_key, state="false")
            except ApiClientError as toggle_error:
                logger.error("seed.flag.toggle_failed", flag_key=flag_key, error=str(toggle_error), endpoint=toggle_endpoint)
                raise RuntimeError(f"Failed to toggle flag {flag_key}: {toggle_error}")

    logger.info("seed.completed", workspace_id=workspace_id, org_id=organization_id, project_id=project_id, env_id=environment_id)
    
    return {
        "workspace_id": workspace_id,
        "organization_id": organization_id,
        "project_id": project_id,
        "environment_id": environment_id,
        "env_id_guid": str(environment_id),
        "flag_ids_by_key": flag_ids_by_key,
    }
