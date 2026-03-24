# Bottleneck Bots Python SDK

Python SDK for Bottleneck Bots — cloud desktop environments for AI agents.

## Installation

```bash
pip install bottleneck-bots
```

With image support (Pillow):

```bash
pip install bottleneck-bots[image]
```

## Quickstart

### Async

```python
import asyncio
from orgo_clone import OrgoClient, Computer

async def main():
    async with OrgoClient(api_key="sk-...") as client:
        # Create a computer
        computer = await Computer.create(client, os="linux", cpu=2, memory=4096)

        # Take a screenshot
        image_bytes, meta = await computer.screenshot()

        # Click, type, interact
        await computer.click(100, 200)
        await computer.type("Hello, world!")
        await computer.key("Enter")

        # Run commands
        result = await computer.bash("ls -la")
        print(result["stdout"])

        # Clean up
        await computer.destroy()

asyncio.run(main())
```

### Sync

```python
from orgo_clone import SyncOrgoClient
from orgo_clone.computer import SyncComputer

with SyncOrgoClient(api_key="sk-...") as client:
    computer = SyncComputer.create(client, os="linux")
    computer.click(100, 200)
    computer.type("Hello!")
    computer.destroy()
```

## Workspaces

```python
from orgo_clone import OrgoClient, Workspace

async with OrgoClient(api_key="sk-...") as client:
    # Create a workspace
    ws = await Workspace.create(client, "my-project")

    # Create a computer in the workspace
    computer = await ws.create_computer(os="linux")

    # List computers
    computers = await ws.computers()

    # Clean up
    await ws.delete()
```

## Agent Loop

Use the built-in agent loop for LLM-driven computer control:

```python
from orgo_clone import OrgoClient, Computer
from orgo_clone.agent import agent_loop, claude_callback

async with OrgoClient(api_key="sk-...") as client:
    computer = await Computer.create(client, os="linux")

    callback = await claude_callback(
        model="claude-sonnet-4-20250514",
        system_prompt="You are a helpful computer assistant.",
        api_key="sk-ant-...",
    )

    history = await agent_loop(
        computer,
        callback=callback,
        initial_prompt="Open the browser and search for 'hello world'",
        max_steps=20,
    )
```

## API Reference

### OrgoClient / SyncOrgoClient

| Method | Description |
|--------|-------------|
| `OrgoClient(api_key, base_url)` | Create async client |
| `SyncOrgoClient(api_key, base_url)` | Create sync client |
| `.get(path, **kwargs)` | GET request |
| `.post(path, **kwargs)` | POST request |
| `.patch(path, **kwargs)` | PATCH request |
| `.delete(path, **kwargs)` | DELETE request |
| `.close()` | Close connection |

### Computer / SyncComputer

| Method | Description |
|--------|-------------|
| `.create(client, **spec)` | Provision new computer |
| `.screenshot()` | Capture screen (bytes + meta) |
| `.screenshot_base64()` | Capture screen (base64 string) |
| `.click(x, y, button)` | Click at coordinates |
| `.right_click(x, y)` | Right-click |
| `.double_click(x, y)` | Double-click |
| `.scroll(x, y, delta_x, delta_y)` | Scroll |
| `.drag(start_x, start_y, end_x, end_y)` | Drag |
| `.move(x, y)` | Move cursor |
| `.type(text)` | Type text |
| `.key(key)` | Press key combo |
| `.bash(command)` | Run bash command |
| `.exec(command)` | Run command (argv list) |
| `.clipboard_read()` | Read clipboard |
| `.clipboard_write(text)` | Write clipboard |
| `.actions(actions)` | Batch actions |
| `.refresh()` | Refresh status |
| `.start()` / `.stop()` | Start/stop computer |
| `.destroy()` | Delete computer |
| `.vnc_url` / `.novnc_url` | Connection URLs |

### Workspace

| Method | Description |
|--------|-------------|
| `.create(client, name)` | Create workspace |
| `.list(client)` | List all workspaces |
| `.get()` | Refresh workspace data |
| `.update(name)` | Rename workspace |
| `.delete(force)` | Delete workspace |
| `.computers()` | List computers |
| `.create_computer(**spec)` | Add computer |

### Exceptions

| Exception | HTTP Status |
|-----------|-------------|
| `OrgoError` | Base class |
| `AuthenticationError` | 401 |
| `ValidationError` | 400 |
| `NotFoundError` | 404 |
| `ConflictError` | 409 |
| `RateLimitError` | 429 (has `.retry_after`) |
| `ServerError` | 500 |

## Development

```bash
pip install -e ".[dev]"
pytest
ruff check .
mypy src/
```
