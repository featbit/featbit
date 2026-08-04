#!/usr/bin/python

# FeatBit native server-side SDK integration for the llm service.
#
# Design goals (see e2e/control-plane continuity/failover testing):
#   * Use FeatBit's NATIVE Python SDK (fb-python-sdk), not OpenFeature.
#   * One client for the process lifetime (FeatBit best practice).
#   * Graceful degradation: if FeatBit is unconfigured, the eval/streaming
#     server is unreachable, or a flag is not found, every evaluation returns a
#     SAFE DEFAULT and the service keeps working. This is what lets us kill the
#     eval-server / break flags and observe continuity.
#   * BUT a *misconfigured* flag value (an unknown experiment variant) is
#     returned faithfully to the caller. Surfacing how the application copes
#     with bad-but-present flag values is the whole point of the resiliency
#     exercise, so we do NOT sanitize those here.

import logging
import os
from typing import Optional

from fbclient.client import FBClient
from fbclient.config import Config

log = logging.getLogger("main")

# FeatBit evaluation context. The `key` must stably and uniquely identify the
# evaluation subject; for service-scoped operational/release/experiment flags
# the subject is the llm service itself.
_SERVICE_USER = {"key": "llm", "name": "llm"}

# Flag keys (kebab-case, intention-revealing, one concern each).
FLAG_AI_ASSISTANT_ENABLED = "operational-ai-assistant-enabled"  # ops/kill-switch (bool)
FLAG_STREAMING_RESPONSES = "release-streaming-responses"        # release gate    (bool)
FLAG_LLM_MODEL = "experiment-llm-model"                         # experiment      (string)

# Safe defaults — preserve the service's normal behavior when FeatBit can't be
# reached or a flag is absent.
DEFAULT_AI_ASSISTANT_ENABLED = True
DEFAULT_STREAMING_RESPONSES = False
DEFAULT_LLM_MODEL = "default"

_client: Optional[FBClient] = None


def init() -> Optional[FBClient]:
    """Initialize a single FeatBit client for the process lifetime.

    Returns None (and the service falls back to safe defaults) when FeatBit is
    not configured, so the llm service runs even with no flag backend.
    """
    global _client

    env_secret = os.environ.get("FEATBIT_ENV_SECRET")
    # Accept either FEATBIT_EVENT_URL or FEATBIT_EVAL_URL for the events endpoint.
    event_url = os.environ.get("FEATBIT_EVENT_URL") or os.environ.get("FEATBIT_EVAL_URL")
    streaming_url = os.environ.get("FEATBIT_STREAMING_URL")

    if not (env_secret and event_url and streaming_url):
        log.info(
            "FeatBit not configured (need FEATBIT_ENV_SECRET, "
            "FEATBIT_EVENT_URL/FEATBIT_EVAL_URL, FEATBIT_STREAMING_URL); "
            "llm flags will use safe defaults"
        )
        return None

    try:
        # start_wait kept short so a slow/unreachable eval-server never blocks
        # startup. The SDK keeps reconnecting in the background; until it is
        # connected, evaluations return their defaults (graceful failover).
        _client = FBClient(Config(env_secret, event_url, streaming_url), start_wait=5)
        if _client.initialize:
            log.info("FeatBit client initialized (event=%s streaming=%s)", event_url, streaming_url)
        else:
            log.warning(
                "FeatBit client not yet connected; evaluations use defaults "
                "until the eval-server is reachable"
            )
        return _client
    except Exception as e:  # never let flag wiring crash the service
        log.warning("FeatBit init failed (%s); llm flags will use safe defaults", e)
        _client = None
        return None


def stop() -> None:
    if _client is not None:
        try:
            _client.stop()
        except Exception:
            pass


def _variation(key: str, default):
    """Evaluate a flag, always returning a usable value.

    flag-not-found, client-not-ready, and eval-server-down all return `default`
    (non-breaking). A present-but-misconfigured value is returned as-is.
    """
    if _client is None:
        return default
    try:
        return _client.variation(key, _SERVICE_USER, default)
    except Exception as e:
        log.warning("FeatBit evaluation error for '%s' (%s); using default", key, e)
        return default


def ai_assistant_enabled() -> bool:
    return bool(_variation(FLAG_AI_ASSISTANT_ENABLED, DEFAULT_AI_ASSISTANT_ENABLED))


def streaming_responses_enabled() -> bool:
    return bool(_variation(FLAG_STREAMING_RESPONSES, DEFAULT_STREAMING_RESPONSES))


def llm_model() -> str:
    # Returned verbatim (string). Intentionally NOT validated against the set of
    # known variants: an operator misconfiguring this to an unknown model name
    # exercises the service's (missing) variant handling (see app.py).
    return _variation(FLAG_LLM_MODEL, DEFAULT_LLM_MODEL)
