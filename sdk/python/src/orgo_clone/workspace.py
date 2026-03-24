from __future__ import annotations
from typing import Any, TYPE_CHECKING
from .client import OrgoClient

if TYPE_CHECKING:
    from .computer import Computer


class Workspace:
    """Represents a workspace containing computers."""

    def __init__(self, client: OrgoClient, data: dict[str, Any]) -> None:
        self._client = client
        self.id: str = data["id"]
        self.name: str = data.get("name", "")

    @classmethod
    async def create(cls, client: OrgoClient, name: str) -> "Workspace":
        data = await client.post("/workspaces", json={"name": name})
        return cls(client, data["workspace"])

    @classmethod
    async def list(cls, client: OrgoClient) -> list["Workspace"]:
        data = await client.get("/workspaces")
        return [cls(client, ws) for ws in data["workspaces"]]

    async def get(self) -> "Workspace":
        data = await self._client.get(f"/workspaces/{self.id}")
        self.name = data["workspace"]["name"]
        return self

    async def update(self, name: str) -> None:
        await self._client.patch(f"/workspaces/{self.id}", json={"name": name})
        self.name = name

    async def delete(self, force: bool = False) -> None:
        params = {"force": "true"} if force else {}
        await self._client.delete(f"/workspaces/{self.id}", params=params)

    async def computers(self) -> list["Computer"]:
        from .computer import Computer
        data = await self._client.get(f"/workspaces/{self.id}/computers")
        return [Computer(self._client, c) for c in data["computers"]]

    async def create_computer(self, **kwargs: Any) -> "Computer":
        from .computer import Computer
        data = await self._client.post(f"/workspaces/{self.id}/computers", json=kwargs)
        return Computer(self._client, data["computer"])
