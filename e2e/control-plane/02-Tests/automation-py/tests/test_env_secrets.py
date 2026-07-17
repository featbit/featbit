from unittest.mock import Mock

import pytest

from core.api_client import EnvSecrets, get_env_secrets, resolve_project_id_for_env


def _mock_api_client(response):
    client = Mock()
    client.api_version = "1"
    client.get.return_value = response
    return client


def test_get_env_secrets_returns_server_and_client_values():
    secrets = [
        {"Id": "server-1", "Name": "Server", "Type": "server", "Value": "server-secret"},
        {"Id": "client-1", "Name": "Client", "Type": "client", "Value": "client-secret"},
    ]
    client = _mock_api_client({"Data": {"Id": "env-1", "Secrets": secrets}})

    result = get_env_secrets(
        client,
        workspace_id="workspace-1",
        project_id="project-1",
        env_id="env-1",
        authorization_header="Bearer token",
    )

    assert result == EnvSecrets(
        server="server-secret",
        client="client-secret",
        raw=secrets,
    )
    client.get.assert_called_once_with(
        "/api/v1/projects/project-1/envs/env-1",
        headers={
            "Authorization": "Bearer token",
            "Content-Type": "application/json",
            "Workspace": "workspace-1",
        },
    )


def test_get_env_secrets_includes_organization_when_provided():
    client = _mock_api_client(
        {
            "data": {
                "id": "env-1",
                "secrets": [
                    {"id": "server-1", "type": "server", "value": "server-secret"},
                    {"id": "client-1", "type": "client", "value": "client-secret"},
                ],
            }
        }
    )

    get_env_secrets(
        client,
        workspace_id="workspace-1",
        project_id="project-1",
        env_id="env-1",
        authorization_header="Bearer token",
        organization_id="organization-1",
    )

    assert client.get.call_args.kwargs["headers"]["Organization"] == "organization-1"


def test_get_env_secrets_raises_when_server_secret_missing():
    client = _mock_api_client(
        {
            "data": {
                "id": "env-1",
                "secrets": [
                    {"id": "client-1", "type": "client", "value": "client-secret"},
                ],
            }
        }
    )

    with pytest.raises(ValueError, match="server"):
        get_env_secrets(
            client,
            workspace_id="workspace-1",
            project_id="project-1",
            env_id="env-1",
            authorization_header="Bearer token",
        )


def test_get_env_secrets_raises_when_client_secret_missing():
    client = _mock_api_client(
        {
            "data": {
                "id": "env-1",
                "secrets": [
                    {"id": "server-1", "type": "server", "value": "server-secret"},
                ],
            }
        }
    )

    with pytest.raises(ValueError, match="client"):
        get_env_secrets(
            client,
            workspace_id="workspace-1",
            project_id="project-1",
            env_id="env-1",
            authorization_header="Bearer token",
        )


def test_get_env_secrets_uses_first_server_secret_when_multiple_exist():
    client = _mock_api_client(
        {
            "data": {
                "id": "env-1",
                "secrets": [
                    {"id": "server-1", "type": "server", "value": "first-server"},
                    {"id": "server-2", "type": "server", "value": "second-server"},
                    {"id": "client-1", "type": "client", "value": "client-secret"},
                ],
            }
        }
    )

    result = get_env_secrets(
        client,
        workspace_id="workspace-1",
        project_id="project-1",
        env_id="env-1",
        authorization_header="Bearer token",
    )

    assert result.server == "first-server"


def test_get_env_secrets_preserves_raw_secret_list():
    secrets = [
        {"id": "server-1", "type": "server", "value": "server-secret", "extra": "kept"},
        {"id": "client-1", "type": "client", "value": "client-secret"},
    ]
    client = _mock_api_client({"data": {"id": "env-1", "secrets": secrets}})

    result = get_env_secrets(
        client,
        workspace_id="workspace-1",
        project_id="project-1",
        env_id="env-1",
        authorization_header="Bearer token",
    )

    assert result.raw is secrets


def test_resolve_project_id_for_env_returns_project_containing_env():
    client = _mock_api_client(
        {
            "data": [
                {
                    "id": "project-1",
                    "environments": [{"id": "other-env"}],
                },
                {
                    "id": "project-2",
                    "environments": [{"id": "env-1"}],
                },
            ]
        }
    )

    project_id = resolve_project_id_for_env(
        client,
        workspace_id="workspace-1",
        env_id="env-1",
        authorization_header="Bearer token",
    )

    assert project_id == "project-2"
    client.get.assert_called_once_with(
        "/api/v1/projects",
        headers={
            "Authorization": "Bearer token",
            "Content-Type": "application/json",
            "Workspace": "workspace-1",
        },
    )


def test_resolve_project_id_for_env_includes_organization_when_provided():
    client = _mock_api_client(
        {
            "data": [
                {
                    "id": "project-1",
                    "environments": [{"id": "env-1"}],
                }
            ]
        }
    )

    project_id = resolve_project_id_for_env(
        client,
        workspace_id="workspace-1",
        env_id="env-1",
        authorization_header="Bearer token",
        organization_id="organization-1",
    )

    assert project_id == "project-1"
    assert client.get.call_args.kwargs["headers"]["Organization"] == "organization-1"


def test_resolve_project_id_for_env_raises_when_env_not_found():
    client = _mock_api_client(
        {
            "data": [
                {
                    "id": "project-1",
                    "environments": [{"id": "other-env"}],
                }
            ]
        }
    )

    with pytest.raises(ValueError, match="env-1"):
        resolve_project_id_for_env(
            client,
            workspace_id="workspace-1",
            env_id="env-1",
            authorization_header="Bearer token",
        )
