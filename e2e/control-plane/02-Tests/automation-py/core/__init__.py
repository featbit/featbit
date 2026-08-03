"""Core automation infrastructure: API client, auth, models, assertions."""

from .api_client import ApiClient
from .auth import AuthContext, resolve_authorization_header, resolve_request_context
from .models import (
    AssertionResult,
    FlagState,
    ScenarioConfig,
    TimelineEvent,
)

__all__ = [
    "ApiClient",
    "AuthContext",
    "resolve_authorization_header",
    "resolve_request_context",
    "AssertionResult",
    "FlagState",
    "ScenarioConfig",
    "TimelineEvent",
]
