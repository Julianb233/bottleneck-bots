"""HTTP client with connection pooling, retries, and typed error mapping."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx

from .exceptions import ServerError, raise_for_status

logger = logging.getLogger("orgo_clone")

_DEFAULT_BASE_URL = "http://localhost:3000/api/v1"
_MAX_RETRIES = 3
_RETRY_BACKOFF_BASE = 0.5  # seconds
_RETRYABLE_STATUS_CODES = frozenset({500, 502, 503, 504})

_TIMEOUT = httpx.Timeout(connect=5.0, read=60.0, write=30.0, pool=10.0)
_POOL_LIMITS = httpx.Limits(max_connections=20, max_keepalive_connections=10)


def _build_headers(api_key: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": "bottleneck-bots-python/0.1.0",
    }


class OrgoClient:
    """Async HTTP client for the Bottleneck Bots API.

    Supports connection pooling, automatic retries with exponential backoff
    for 5xx errors, and typed exception mapping.

    Usage::

        async with OrgoClient(api_key="sk_live_...") as client:
            data = await client.get("/workspaces")
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = _DEFAULT_BASE_URL,
        *,
        timeout: httpx.Timeout | None = None,
        max_retries: int = _MAX_RETRIES,
    ) -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.max_retries = max_retries
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            headers=_build_headers(api_key),
            timeout=timeout or _TIMEOUT,
            limits=_POOL_LIMITS,
        )

    async def request(self, method: str, path: str, **kwargs: Any) -> Any:
        """Send an HTTP request with retry logic for transient server errors."""
        last_exc: Exception | None = None

        for attempt in range(self.max_retries + 1):
            try:
                response = await self._client.request(method, path, **kwargs)
            except httpx.TransportError as exc:
                last_exc = exc
                if attempt < self.max_retries:
                    delay = _RETRY_BACKOFF_BASE * (2**attempt)
                    logger.warning(
                        "Transport error on %s %s (attempt %d/%d), retrying in %.1fs: %s",
                        method, path, attempt + 1, self.max_retries + 1, delay, exc,
                    )
                    await asyncio.sleep(delay)
                    continue
                raise

            if response.status_code in _RETRYABLE_STATUS_CODES and attempt < self.max_retries:
                delay = _RETRY_BACKOFF_BASE * (2**attempt)
                logger.warning(
                    "Server error %d on %s %s (attempt %d/%d), retrying in %.1fs",
                    response.status_code, method, path,
                    attempt + 1, self.max_retries + 1, delay,
                )
                await asyncio.sleep(delay)
                last_exc = ServerError(
                    f"Server returned {response.status_code}",
                    status_code=response.status_code,
                )
                continue

            raise_for_status(response)

            content_type = response.headers.get("content-type", "")
            if content_type.startswith("application/json"):
                return response.json()
            return response.content

        # Should not reach here, but satisfy type checker
        if last_exc is not None:
            raise last_exc
        raise ServerError("Request failed after retries")  # pragma: no cover

    async def get(self, path: str, **kwargs: Any) -> Any:
        return await self.request("GET", path, **kwargs)

    async def post(self, path: str, **kwargs: Any) -> Any:
        return await self.request("POST", path, **kwargs)

    async def patch(self, path: str, **kwargs: Any) -> Any:
        return await self.request("PATCH", path, **kwargs)

    async def put(self, path: str, **kwargs: Any) -> Any:
        return await self.request("PUT", path, **kwargs)

    async def delete(self, path: str, **kwargs: Any) -> Any:
        return await self.request("DELETE", path, **kwargs)

    async def close(self) -> None:
        await self._client.aclose()

    async def __aenter__(self) -> OrgoClient:
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.close()


class SyncOrgoClient:
    """Synchronous HTTP client for the Bottleneck Bots API.

    Mirrors :class:`OrgoClient` but uses blocking I/O. Suitable for scripts
    and environments where ``asyncio`` is not available.

    Usage::

        with SyncOrgoClient(api_key="sk_live_...") as client:
            data = client.get("/workspaces")
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = _DEFAULT_BASE_URL,
        *,
        timeout: httpx.Timeout | None = None,
        max_retries: int = _MAX_RETRIES,
    ) -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.max_retries = max_retries
        self._client = httpx.Client(
            base_url=self.base_url,
            headers=_build_headers(api_key),
            timeout=timeout or _TIMEOUT,
            limits=_POOL_LIMITS,
        )

    def request(self, method: str, path: str, **kwargs: Any) -> Any:
        """Send an HTTP request with retry logic for transient server errors."""
        import time

        last_exc: Exception | None = None

        for attempt in range(self.max_retries + 1):
            try:
                response = self._client.request(method, path, **kwargs)
            except httpx.TransportError as exc:
                last_exc = exc
                if attempt < self.max_retries:
                    delay = _RETRY_BACKOFF_BASE * (2**attempt)
                    logger.warning(
                        "Transport error on %s %s (attempt %d/%d), retrying in %.1fs: %s",
                        method, path, attempt + 1, self.max_retries + 1, delay, exc,
                    )
                    time.sleep(delay)
                    continue
                raise

            if response.status_code in _RETRYABLE_STATUS_CODES and attempt < self.max_retries:
                delay = _RETRY_BACKOFF_BASE * (2**attempt)
                logger.warning(
                    "Server error %d on %s %s (attempt %d/%d), retrying in %.1fs",
                    response.status_code, method, path,
                    attempt + 1, self.max_retries + 1, delay,
                )
                time.sleep(delay)
                last_exc = ServerError(
                    f"Server returned {response.status_code}",
                    status_code=response.status_code,
                )
                continue

            raise_for_status(response)

            content_type = response.headers.get("content-type", "")
            if content_type.startswith("application/json"):
                return response.json()
            return response.content

        if last_exc is not None:
            raise last_exc
        raise ServerError("Request failed after retries")  # pragma: no cover

    def get(self, path: str, **kwargs: Any) -> Any:
        return self.request("GET", path, **kwargs)

    def post(self, path: str, **kwargs: Any) -> Any:
        return self.request("POST", path, **kwargs)

    def patch(self, path: str, **kwargs: Any) -> Any:
        return self.request("PATCH", path, **kwargs)

    def put(self, path: str, **kwargs: Any) -> Any:
        return self.request("PUT", path, **kwargs)

    def delete(self, path: str, **kwargs: Any) -> Any:
        return self.request("DELETE", path, **kwargs)

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> SyncOrgoClient:
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()
