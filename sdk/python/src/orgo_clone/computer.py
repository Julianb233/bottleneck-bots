from __future__ import annotations
import base64
from typing import Any
from .client import OrgoClient
from .types import ExecResult, ComputerStatus


class Computer:
    """Represents a virtual desktop computer controlled by AI agents."""

    def __init__(self, client: OrgoClient, data: dict[str, Any]) -> None:
        self._client = client
        self.id: str = data["id"]
        self.name: str = data.get("name", "")
        self.status: ComputerStatus = data.get("status", "creating")
        self.specs: dict[str, Any] = data.get("specs", {})
        self._vnc_url: str | None = data.get("vncUrl") or data.get("vnc_url")
        self._novnc_url: str | None = data.get("novncUrl") or data.get("novnc_url")

    @classmethod
    async def create(
        cls,
        api_key: str,
        workspace_id: str | None = None,
        name: str | None = None,
        cpu: int = 2,
        ram: int = 4096,
        resolution: str = "1280x720x24",
        base_url: str = "http://localhost:3000",
    ) -> "Computer":
        client = OrgoClient(api_key=api_key, base_url=base_url)

        # Auto-create workspace if none specified
        if not workspace_id:
            ws = await client.post("/workspaces", json={"name": name or "default"})
            workspace_id = ws["workspace"]["id"]

        data = await client.post(
            f"/workspaces/{workspace_id}/computers",
            json={"name": name or "computer", "cpu": cpu, "ram": ram, "resolution": resolution},
        )
        return cls(client, data["computer"])

    async def screenshot(self, format: str = "png", quality: int = 70) -> bytes:
        """Take a screenshot and return raw image bytes."""
        data = await self._client.get(
            f"/computers/{self.id}/screenshot",
            params={"format": format, "quality": quality},
        )
        return base64.b64decode(data["image"])

    async def screenshot_base64(self, format: str = "png", quality: int = 70) -> str:
        """Take a screenshot and return base64 string."""
        data = await self._client.get(
            f"/computers/{self.id}/screenshot",
            params={"format": format, "quality": quality},
        )
        return data["image"]

    async def click(self, x: int, y: int) -> None:
        await self._client.post(f"/computers/{self.id}/click", json={"x": x, "y": y})

    async def right_click(self, x: int, y: int) -> None:
        await self._client.post(f"/computers/{self.id}/right-click", json={"x": x, "y": y})

    async def double_click(self, x: int, y: int) -> None:
        await self._client.post(f"/computers/{self.id}/double-click", json={"x": x, "y": y})

    async def scroll(self, x: int = 0, y: int = 0, direction: str = "down", amount: int = 3) -> None:
        await self._client.post(f"/computers/{self.id}/scroll", json={"x": x, "y": y, "direction": direction, "amount": amount})

    async def drag(self, start_x: int, start_y: int, end_x: int, end_y: int) -> None:
        await self._client.post(f"/computers/{self.id}/drag", json={"start_x": start_x, "start_y": start_y, "end_x": end_x, "end_y": end_y})

    async def move(self, x: int, y: int) -> None:
        await self._client.post(f"/computers/{self.id}/move", json={"x": x, "y": y})

    async def type(self, text: str) -> None:
        await self._client.post(f"/computers/{self.id}/type", json={"text": text})

    async def key(self, combo: str) -> None:
        await self._client.post(f"/computers/{self.id}/key", json={"key": combo})

    async def bash(self, command: str, timeout: int = 30) -> ExecResult:
        data = await self._client.post(f"/computers/{self.id}/bash", json={"command": command, "timeout": timeout})
        return data.get("data", data)

    async def exec(self, code: str, language: str = "python") -> ExecResult:
        data = await self._client.post(f"/computers/{self.id}/exec", json={"code": code, "language": language})
        return data.get("data", data)

    async def clipboard_read(self) -> str:
        data = await self._client.get(f"/computers/{self.id}/clipboard")
        return data.get("data", {}).get("text", "")

    async def clipboard_write(self, text: str) -> None:
        await self._client.post(f"/computers/{self.id}/clipboard", json={"text": text})

    async def actions(self, actions: list[dict[str, Any]]) -> list[dict[str, Any]]:
        data = await self._client.post(f"/computers/{self.id}/actions", json={"actions": actions})
        return data.get("results", [])

    async def refresh(self) -> None:
        data = await self._client.get(f"/computers/{self.id}")
        computer = data["computer"]
        self.status = computer.get("status", self.status)
        self.specs = computer.get("specs", self.specs)
        self._vnc_url = computer.get("vncUrl") or computer.get("vnc_url")
        self._novnc_url = computer.get("novncUrl") or computer.get("novnc_url")

    async def stop(self) -> None:
        await self._client.post(f"/computers/{self.id}/stop")
        self.status = "stopping"

    async def start(self) -> None:
        await self._client.post(f"/computers/{self.id}/start")
        self.status = "starting"

    async def destroy(self) -> None:
        await self._client.delete(f"/computers/{self.id}")

    @property
    def vnc_url(self) -> str | None:
        return self._vnc_url if self.status == "running" else None

    @property
    def novnc_url(self) -> str | None:
        return self._novnc_url if self.status == "running" else None
