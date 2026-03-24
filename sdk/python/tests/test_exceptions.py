from orgo_clone.exceptions import (
    OrgoError, AuthenticationError, RateLimitError, _STATUS_MAP,
)


def test_base_error():
    err = OrgoError("test", status_code=500, error_code="test_error")
    assert str(err) == "test"
    assert err.status_code == 500
    assert err.error_code == "test_error"


def test_rate_limit_error():
    err = RateLimitError("slow down", retry_after=30, status_code=429)
    assert err.retry_after == 30
    assert err.status_code == 429


def test_status_map():
    assert _STATUS_MAP[401] is AuthenticationError
    assert _STATUS_MAP[429] is RateLimitError
