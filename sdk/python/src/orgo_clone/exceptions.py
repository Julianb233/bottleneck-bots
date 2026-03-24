"""Typed exceptions mapped from API HTTP status codes."""

from __future__ import annotations

from typing import Any


class OrgoError(Exception):
    """Base exception for all Bottleneck Bots SDK errors."""

    def __init__(
        self,
        message: str,
        status_code: int = 0,
        error_code: str = "",
        raw_response: Any = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        self.raw_response = raw_response


class AuthenticationError(OrgoError):
    """Invalid or missing API key (HTTP 401)."""


class ValidationError(OrgoError):
    """Invalid request data (HTTP 400)."""


class NotFoundError(OrgoError):
    """Resource not found (HTTP 404)."""


class ConflictError(OrgoError):
    """Invalid state transition or duplicate resource (HTTP 409)."""


class RateLimitError(OrgoError):
    """Too many requests (HTTP 429).

    Attributes:
        retry_after: Seconds to wait before retrying.
    """

    def __init__(
        self,
        message: str,
        retry_after: int = 0,
        **kwargs: Any,
    ) -> None:
        super().__init__(message, **kwargs)
        self.retry_after = retry_after


class ServerError(OrgoError):
    """Internal server error (HTTP 500+)."""


_STATUS_MAP: dict[int, type[OrgoError]] = {
    400: ValidationError,
    401: AuthenticationError,
    404: NotFoundError,
    409: ConflictError,
    429: RateLimitError,
    500: ServerError,
}


def raise_for_status(response: Any) -> None:
    """Inspect an httpx response and raise a typed :class:`OrgoError` if needed."""
    if response.status_code < 400:
        return

    try:
        body = response.json()
    except Exception:
        body = {"error": "unknown", "message": response.text}

    message = body.get("message", f"HTTP {response.status_code}")
    error_code = body.get("error", "")

    error_cls = _STATUS_MAP.get(response.status_code, OrgoError)
    kwargs: dict[str, Any] = {
        "status_code": response.status_code,
        "error_code": error_code,
        "raw_response": body,
    }

    if error_cls is RateLimitError:
        kwargs["retry_after"] = int(
            body.get("retryAfter", body.get("retry_after", 0))
        )

    raise error_cls(message, **kwargs)
