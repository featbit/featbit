"""Authentication: login-by-email flow and bearer token context resolution."""

from dataclasses import dataclass
from typing import Any, Dict, Optional

from .api_client import ApiClient, extract_data


@dataclass
class AuthContext:
    """Authentication context after bearer token resolution."""

    authorization_header: str
    workspace_id: Optional[str] = None
    organization_id: Optional[str] = None


def resolve_authorization_header(
    base_url: str,
    api_authorization_header: Optional[str],
    login_email: str,
    login_password: str,
    workspace_key: str,
    skip_certificate_check: bool,
    api_version: str = "1",
) -> str:
    """Resolve authorization header by login or return provided token.

    Args:
        base_url: Base URL for login endpoint
        api_authorization_header: Pre-existing bearer token (if provided, returned as-is)
        login_email: Email for login-by-email flow
        login_password: Password for login-by-email flow
        workspace_key: Workspace key for login-by-email flow
        skip_certificate_check: Whether to skip TLS verification
        api_version: API version

    Returns:
        Bearer token string (e.g., "Bearer eyJ0...")

    Raises:
        RuntimeError: If login fails or token not found in response
    """
    if api_authorization_header:
        return api_authorization_header

    client = ApiClient(base_url, skip_certificate_check, api_version)
    login_endpoint = f"/api/v{api_version}/identity/login-by-email"

    login_payload = {
        "email": login_email,
        "password": login_password,
        "workspaceKey": workspace_key,
    }

    try:
        response = client.post(login_endpoint, body=login_payload)
        data = extract_data(response)

        if not data:
            raise RuntimeError("Login succeeded but response data is empty.")

        token = data.get("token") or data.get("Token")
        if not token:
            raise RuntimeError("Login succeeded but access token not found in response.")

        return f"Bearer {token}"

    except Exception as e:
        raise RuntimeError(f"Login-by-email failed: {e}") from e


def resolve_request_context(
    base_url: str,
    authorization_header: str,
    organization_key: str,
    skip_certificate_check: bool,
    api_version: str = "1",
) -> AuthContext:
    """Resolve workspace and organization IDs from bearer token.

    Args:
        base_url: Base URL for API
        authorization_header: Bearer token string
        organization_key: Organization key to match or use first org if not found
        skip_certificate_check: Whether to skip TLS verification
        api_version: API version

    Returns:
        AuthContext with workspace_id and organization_id

    Raises:
        RuntimeError: If unable to resolve context from bearer token
    """
    # If not using bearer token, return early
    if not authorization_header.startswith("Bearer "):
        return AuthContext(
            authorization_header=authorization_header,
            workspace_id=None,
            organization_id=None,
        )

    client = ApiClient(base_url, skip_certificate_check, api_version)
    headers = {
        "Authorization": authorization_header,
        "Content-Type": "application/json",
    }

    # Get workspace ID from profile
    profile_endpoint = f"/api/v{api_version}/user/profile"
    try:
        profile_response = client.get(profile_endpoint, headers=headers)
        profile_data = extract_data(profile_response)

        if not profile_data:
            raise RuntimeError("Profile endpoint returned empty data.")

        workspace_id = profile_data.get("workspaceId") or profile_data.get("WorkspaceId")
        if not workspace_id:
            # Profile no longer always includes the workspace id; fall back
            # to /user/workspaces (same pattern used by provision_uat.py).
            workspaces_endpoint = f"/api/v{api_version}/user/workspaces"
            workspaces_response = client.get(workspaces_endpoint, headers=headers)
            workspaces_data = extract_data(workspaces_response) or []
            workspaces = (
                workspaces_data if isinstance(workspaces_data, list) else [workspaces_data]
            )
            if organization_key:
                match = next(
                    (
                        ws
                        for ws in workspaces
                        if (ws.get("key") or ws.get("Key")) == organization_key
                    ),
                    None,
                )
                if match:
                    workspace_id = match.get("id") or match.get("Id")
            if not workspace_id and workspaces:
                workspace_id = workspaces[0].get("id") or workspaces[0].get("Id")
            if not workspace_id:
                raise RuntimeError(
                    "Unable to resolve workspace ID from /user/profile or /user/workspaces."
                )

        # Add workspace to headers for org list call
        headers["Workspace"] = workspace_id

        # Get organization list and find matching org
        org_list_endpoint = f"/api/v{api_version}/organizations"
        org_list_response = client.get(org_list_endpoint, headers=headers)
        organizations_data = extract_data(org_list_response)

        if not organizations_data:
            raise RuntimeError("No organizations available for current login.")

        # Handle both single org and list of orgs
        organizations = (
            organizations_data
            if isinstance(organizations_data, list)
            else [organizations_data]
        )

        if not organizations:
            raise RuntimeError("Organizations list is empty.")

        # Find org by key or use first org
        organization = next(
            (org for org in organizations if org.get("key") == organization_key),
            organizations[0],
        )

        organization_id = organization.get("id")
        if not organization_id:
            raise RuntimeError("Organization ID not found in response.")

        return AuthContext(
            authorization_header=authorization_header,
            workspace_id=workspace_id,
            organization_id=organization_id,
        )

    except Exception as e:
        raise RuntimeError(f"Failed to resolve request context: {e}") from e
