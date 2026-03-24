import pytest
import httpx
import respx
from orgo_clone import OrgoClient


@pytest.mark.asyncio
async def test_client_get():
    with respx.mock:
        respx.get("http://test:3000/health").mock(
            return_value=httpx.Response(200, json={"status": "ok"})
        )
        async with OrgoClient(api_key="sk_live_test", base_url="http://test:3000") as client:
            data = await client.get("/health")
            assert data["status"] == "ok"


@pytest.mark.asyncio
async def test_client_auth_error():
    with respx.mock:
        respx.get("http://test:3000/workspaces").mock(
            return_value=httpx.Response(401, json={"error": "unauthorized", "message": "Bad key"})
        )
        async with OrgoClient(api_key="bad", base_url="http://test:3000") as client:
            with pytest.raises(Exception):
                await client.get("/workspaces")
