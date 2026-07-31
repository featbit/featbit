#!/usr/bin/python

# FeatBit native server-side SDK integration for the recommendation service.
#
# Design goals (see e2e/control-plane continuity/failover testing):
#   * Use FeatBit's NATIVE Python SDK (fb-python-sdk), not OpenFeature.
#   * One client for the process lifetime (FeatBit best practice).
#   * Graceful degradation: if FeatBit is unconfigured, the eval/streaming
#     server is unreachable, or a flag is not found, every evaluation returns a
#     SAFE DEFAULT and the service keeps working. This is what lets us kill the
#     eval-server / break flags and observe continuity.
#   * BUT a *misconfigured* flag value (an out-of-range number, an unknown
#     experiment variant) is returned faithfully to the caller. Surfacing how
#     the application copes with bad-but-present flag values is the whole point
#     of the resiliency exercise, so we do NOT sanitize those here.

import logging
import os
from typing import Optional

from fbclient.client import FBClient
from fbclient.config import Config

log = logging.getLogger("main")

# FeatBit evaluation context. The `key` must stably and uniquely identify the
# evaluation subject; for service-scoped operational/release flags the subject
# is the recommendation service itself.
_SERVICE_USER = {"key": "recommendation-service", "name": "recommendation-service"}

# Flag keys (kebab-case, intention-revealing, one concern each).
FLAG_CACHING_ENABLED = "recommendation-caching-enabled"      # ops/kill-switch (bool)
FLAG_LIST_MAX_RESULTS = "recommendation-list-max-results"    # config         (number)
FLAG_RANKING_STRATEGY = "recommendation-ranking-strategy"    # experiment     (string)

# Safe defaults — preserve the service's normal behavior when FeatBit can't be
# reached or a flag is absent.
DEFAULT_CACHING_ENABLED = True
DEFAULT_LIST_MAX_RESULTS = 5
DEFAULT_RANKING_STRATEGY = "popularity"

_client: Optional[FBClient] = None


def init() -> Optional[FBClient]:
    """Initialize a single FeatBit client for the process lifetime.

    Returns None (and the service falls back to safe defaults) when FeatBit is
    not configured, so the recommendation service runs even with no flag backend.
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
            "recommendation flags will use safe defaults"
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
        log.warning("FeatBit init failed (%s); recommendation flags will use safe defaults", e)
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


def caching_enabled() -> bool:
    return bool(_variation(FLAG_CACHING_ENABLED, DEFAULT_CACHING_ENABLED))


def list_max_results():
    # Returned verbatim (numeric). Intentionally NOT clamped to a sane range:
    # an operator misconfiguring this to 0 / a negative value exercises the
    # service's (missing) input validation.
    return _variation(FLAG_LIST_MAX_RESULTS, DEFAULT_LIST_MAX_RESULTS)


def ranking_strategy() -> str:
    return _variation(FLAG_RANKING_STRATEGY, DEFAULT_RANKING_STRATEGY)
