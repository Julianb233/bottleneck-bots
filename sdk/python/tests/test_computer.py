import pytest
import httpx
import respx
from orgo_clone import Computer
from orgo_clone.client import OrgoClient


@pytest.mark.asyncio
async def test_computer_init():
    client = OrgoClient(api_key="sk_live_test")
    computer = Computer(client, {"id": "test-123", "name": "test", "status": "running"})
    assert computer.id == "test-123"
    assert computer.status == "running"
    await client.close()
