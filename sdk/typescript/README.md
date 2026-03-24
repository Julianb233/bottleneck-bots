# bottleneck-bots

TypeScript SDK for Bottleneck Bots — cloud computer orchestration.

## Installation

```bash
npm install bottleneck-bots
```

Requires Node.js >= 22.

## Quick Start

```typescript
import { OrgoClient, Workspace, Computer } from "orgo-clone";

const client = new OrgoClient({
  apiKey: process.env.ORGO_API_KEY!,
});

// Create a workspace
const workspace = await Workspace.create(client, {
  name: "my-workspace",
});

// Create a computer
const computer = await workspace.createComputer({
  name: "dev-box",
  cpu: 4,
  memoryMb: 8192,
  diskGb: 50,
});

// Take a screenshot
const screenshot = await computer.screenshotBase64();

// Interact with the computer
await computer.click(500, 300);
await computer.type("Hello, world!");
await computer.key("Enter");

// Run commands
const result = await computer.bash("ls -la /home");
console.log(result.stdout);

// Batch actions
const results = await computer.actions([
  { type: "click", x: 100, y: 200 },
  { type: "type", text: "search query" },
  { type: "key", key: "Enter" },
  { type: "screenshot" },
]);

// Clean up
await computer.destroy();
await workspace.delete();
```

## API Reference

### OrgoClient

The HTTP client that handles authentication, retries, and error mapping.

```typescript
const client = new OrgoClient({
  apiKey: "your-api-key",
  baseUrl: "https://api.orgo.ai", // optional
  maxRetries: 3, // optional, default 3
  timeout: 30000, // optional, ms
});
```

### Workspace

```typescript
// Create
const ws = await Workspace.create(client, { name: "my-ws" });

// List all
const workspaces = await Workspace.list(client);

// Update
await ws.update({ name: "renamed" });

// List computers in workspace
const computers = await ws.computers();

// Create computer in workspace
const computer = await ws.createComputer({ name: "box-1" });

// Delete
await ws.delete();
```

### Computer

```typescript
// Interaction
await computer.click(x, y);
await computer.rightClick(x, y);
await computer.doubleClick(x, y);
await computer.scroll({ x, y, deltaY: -3 });
await computer.drag(fromX, fromY, toX, toY);
await computer.move(x, y);
await computer.type("text");
await computer.key("Enter");

// Commands
const result = await computer.bash("echo hello");
const result2 = await computer.exec("node", ["script.js"]);

// Screenshots
const meta = await computer.screenshot({ format: "png" });
const base64 = await computer.screenshotBase64();

// Clipboard
const content = await computer.clipboardRead();
await computer.clipboardWrite("copy this");

// Lifecycle
await computer.start();
await computer.stop();
await computer.refresh(); // refresh spec from API
await computer.destroy();

// Properties
computer.vncUrl;
computer.novncUrl;
computer.spec;
```

### WebSocket Terminal

For real-time terminal access:

```typescript
import { ComputerTerminal } from "orgo-clone";

const terminal = new ComputerTerminal({
  url: "wss://api.orgo.ai/v1/ws/terminal/comp-123",
  token: "your-api-key",
  reconnect: true, // auto-reconnect, default true
  maxReconnectAttempts: 5,
  reconnectIntervalMs: 2000,
});

terminal.onData((data) => {
  process.stdout.write(data);
});

terminal.onClose((code, reason) => {
  console.log(`Closed: ${code} ${reason}`);
});

terminal.connect();
terminal.write("ls -la\n");

// When done
terminal.close();
```

### Error Handling

All API errors are mapped to typed error classes:

```typescript
import {
  OrgoError,
  AuthenticationError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  ServerError,
} from "orgo-clone";

try {
  await computer.bash("command");
} catch (err) {
  if (err instanceof RateLimitError) {
    console.log(`Retry after ${err.retryAfter} seconds`);
  } else if (err instanceof AuthenticationError) {
    console.log("Check your API key");
  } else if (err instanceof NotFoundError) {
    console.log("Computer not found");
  }
}
```

| Status | Error Class |
|--------|------------|
| 401 | `AuthenticationError` |
| 404 | `NotFoundError` |
| 409 | `ConflictError` |
| 422 | `ValidationError` |
| 429 | `RateLimitError` |
| 5xx | `ServerError` |

## License

MIT
