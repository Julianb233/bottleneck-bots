from __future__ import annotations
from typing import Any, Callable, Awaitable
from .computer import Computer


async def agent_loop(
    computer: Computer,
    model_callback: Callable[[bytes], Awaitable[list[dict[str, Any]]]],
    max_iterations: int = 100,
    screenshot_format: str = "png",
) -> None:
    """Run an agent loop: screenshot -> model -> actions -> repeat.

    Args:
        computer: The computer to control.
        model_callback: Async function that takes screenshot bytes and returns a list of actions.
            Each action is a dict like {"type": "click", "params": {"x": 100, "y": 200}}.
            Return empty list to stop.
        max_iterations: Maximum number of loops.
        screenshot_format: Image format for screenshots.
    """
    for _ in range(max_iterations):
        screenshot = await computer.screenshot(format=screenshot_format)
        actions = await model_callback(screenshot)
        if not actions:
            break
        for action in actions:
            action_type = action["type"]
            params = action.get("params", {})
            method = getattr(computer, action_type, None)
            if method is None:
                raise ValueError(f"Unknown action type: {action_type}")
            await method(**params)
