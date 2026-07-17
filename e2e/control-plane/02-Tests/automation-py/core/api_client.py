"""HTTP API client wrapper with error handling, cert skip, and retry logic."""

import json
from dataclasses import dataclass
from typing import Any, Dict, Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry as UrllibRetry


class ApiClient:
    """Wrapper around requests.Session with retry logic and error handling."""

    def __init__(
        self,
        base_url: str,
        skip_certificate_check: bool = True,
        api_version: str = "1",
        timeout_seconds: int = 30,
    ):
        """Initialize API client.

        Args:
            base_url: Base URL for API (e.g., https://featbit-api.west.local)
            skip_certificate_check: Whether to skip TLS certificate verification
            api_version: API version (default "1")
            timeout_seconds: Request timeout in seconds
        """
        self.base_url = base_url.rstrip("/")
        self.api_version = api_version
        self.timeout_seconds = timeout_seconds

        self.session = requests.Session()

        # Configure retry strategy: 3 retries with exponential backoff.
        # POST is deliberately NOT retried: creates are non-idempotent, and a
        # retried POST after a real 5xx duplicates the resource and masks the
        # first error (#113: cp06's env-create 500 became "KeyHasBeenUsed").
        retry_strategy = UrllibRetry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["HEAD", "GET", "OPTIONS", "PUT"],
        )

        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)

        if skip_certificate_check:
            self.session.verify = False
            import urllib3

            urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    def request(
        self,
        method: str,
        endpoint: str,
        headers: Optional[Dict[str, str]] = None,
        body: Optional[Any] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """Make HTTP request to API.

        Args:
            method: HTTP method (GET, POST, PUT, etc.)
            endpoint: API endpoint (e.g., /api/v1/user/profile)
            headers: Optional headers dict
            body: Optional request body (object or string)
            **kwargs: Additional arguments passed to requests

        Returns:
            Parsed JSON response

        Raises:
            requests.RequestException: On HTTP errors
        """
        url = f"{self.base_url}{endpoint}"

        request_headers = headers or {}
        request_headers.setdefault("Content-Type", "application/json")

        request_body = None
        if body is not None:
            if isinstance(body, str):
                request_body = body
            else:
                request_body = json.dumps(body, default=str)

        try:
            response = self.session.request(
                method=method,
                url=url,
                headers=request_headers,
                data=request_body,
                timeout=self.timeout_seconds,
                **kwargs,
            )
            response.raise_for_status()
            return response.json() if response.text else {}

        except requests.exceptions.RequestException as e:
            status_code = None
            response_text = None

            response = getattr(e, "response", None)
            if response is not None:
                status_code = response.status_code
                response_text = (response.text or "").strip()
                if len(response_text) > 500:
                    response_text = response_text[:500] + "..."

            details = f"API request failed: {method} {endpoint}"
            if status_code is not None:
                details += f" status={status_code}"
            if response_text:
                details += f" body={response_text}"

            raise ApiClientError(details) from e

    def get(
        self,
        endpoint: str,
        headers: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """GET request."""
        return self.request("GET", endpoint, headers, **kwargs)

    def post(
        self,
        endpoint: str,
        body: Optional[Any] = None,
        headers: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """POST request."""
        return self.request("POST", endpoint, headers, body, **kwargs)

    def put(
        self,
        endpoint: str,
        body: Optional[Any] = None,
        headers: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """PUT request."""
        return self.request("PUT", endpoint, headers, body, **kwargs)


class ApiClientError(Exception):
    """Raised when API client encounters an error."""

    pass


@dataclass(frozen=True)
class EnvSecrets:
    """Server and client SDK secrets for an environment."""

    server: str
    client: str
    raw: list[dict]


def extract_data(response: Dict[str, Any]) -> Any:
    """Extract 'data' field from API response, handling case variations.

    Args:
        response: Response dict from API

    Returns:
        Value of 'data' or 'Data' field, or the response itself if no data field
    """
    if not response:
        return None
    if isinstance(response, dict):
        if "data" in response:
            return response["data"]
        if "Data" in response:
            return response["Data"]
    return response


def get_env_secrets(
    api_client: "ApiClient",
    *,
    workspace_id: str,
    project_id: str,
    env_id: str,
    authorization_header: str,
    organization_id: Optional[str] = None,
) -> EnvSecrets:
    """Fetch an environment and extract its server and client SDK secret values.

    Raises:
        ValueError: If either the server or client secret is missing.
    """
    endpoint = f"/api/v{api_client.api_version}/projects/{project_id}/envs/{env_id}"
    response = api_client.get(
        endpoint,
        headers=_workspace_headers(
            workspace_id=workspace_id,
            authorization_header=authorization_header,
            organization_id=organization_id,
        ),
    )
    env = extract_data(response) or {}
    secrets = _case_insensitive_get(env, "secrets") or []

    if not isinstance(secrets, list):
        raise ValueError(f"Environment {env_id} response did not contain a Secrets list.")

    server_secret = _first_secret_value(secrets, "server")
    client_secret = _first_secret_value(secrets, "client")

    missing = []
    if server_secret is None:
        missing.append("server")
    if client_secret is None:
        missing.append("client")
    if missing:
        raise ValueError(
            f"Environment {env_id} is missing {', '.join(missing)} SDK secret(s)."
        )

    return EnvSecrets(server=server_secret, client=client_secret, raw=secrets)


def resolve_project_id_for_env(
    api_client: "ApiClient",
    *,
    workspace_id: str,
    env_id: str,
    authorization_header: str,
    organization_id: Optional[str] = None,
) -> str:
    """Find the project that contains the given env in the current workspace."""
    endpoint = f"/api/v{api_client.api_version}/projects"
    response = api_client.get(
        endpoint,
        headers=_workspace_headers(
            workspace_id=workspace_id,
            authorization_header=authorization_header,
            organization_id=organization_id,
        ),
    )
    projects = extract_data(response) or []
    if isinstance(projects, dict):
        projects = [projects]

    for project in projects:
        if not isinstance(project, dict):
            continue

        environments = _case_insensitive_get(project, "environments") or []
        if not isinstance(environments, list):
            continue

        for env in environments:
            if not isinstance(env, dict):
                continue
            if str(_case_insensitive_get(env, "id")) == env_id:
                project_id = _case_insensitive_get(project, "id")
                if project_id:
                    return str(project_id)

    raise ValueError(f"Could not find project containing environment {env_id}.")


def _workspace_headers(
    *,
    workspace_id: str,
    authorization_header: str,
    organization_id: Optional[str] = None,
) -> Dict[str, str]:
    headers = {
        "Authorization": authorization_header,
        "Content-Type": "application/json",
        "Workspace": workspace_id,
    }
    if organization_id:
        headers["Organization"] = organization_id

    return headers


def _first_secret_value(secrets: list[dict], secret_type: str) -> Optional[str]:
    for secret in secrets:
        if not isinstance(secret, dict):
            continue
        current_type = _case_insensitive_get(secret, "type")
        if isinstance(current_type, str) and current_type.lower() == secret_type:
            value = _case_insensitive_get(secret, "value")
            return str(value) if value is not None else None

    return None


def _case_insensitive_get(data: Dict[str, Any], key: str) -> Any:
    if not isinstance(data, dict):
        return None
    if key in data:
        return data[key]

    wanted = key.lower()
    for current_key, value in data.items():
        if isinstance(current_key, str) and current_key.lower() == wanted:
            return value

    return None
