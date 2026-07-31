"""ApiClient must not retry non-idempotent POSTs (#113 follow-up).

urllib3 retried POST on 5xx: cp06's env create hit a real API 500 AFTER
the Mongo write, the retry re-POSTed, and the second attempt's
"KeyHasBeenUsed" masked the actual product error. Idempotent methods
(GET/HEAD/OPTIONS/PUT) may retry; POST must surface the first response.
"""

from core.api_client import ApiClient


def _allowed_methods(client: ApiClient):
    adapter = client.session.get_adapter("http://example.invalid")
    return set(adapter.max_retries.allowed_methods)


def test_post_is_not_retried():
    allowed = _allowed_methods(ApiClient("http://example.invalid"))
    assert "POST" not in allowed


def test_idempotent_methods_still_retry():
    allowed = _allowed_methods(ApiClient("http://example.invalid"))
    assert {"GET", "HEAD", "OPTIONS", "PUT"} <= allowed
