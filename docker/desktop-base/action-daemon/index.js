'use strict';

const net = require('node:net');
const fs = require('node:fs');
const { ActionQueue } = require('./lib/queue');

const SOCKET_PATH = '/tmp/orgo-action.sock';

// Action handlers
const { handleInput } = require('./actions/input');
const { screenshot } = require('./actions/screenshot');
const { bash, exec } = require('./actions/exec');
const { clipboard_read, clipboard_write } = require('./actions/clipboard');

// Serial queue for xdotool commands (not thread-safe)
const inputQueue = new ActionQueue();

// Input action names that route through handleInput
const INPUT_ACTIONS = new Set([
  'click', 'right_click', 'double_click',
  'type', 'key', 'scroll', 'drag', 'mouse_move',
]);

// Map action names to handlers and whether they need the serial queue
const ACTIONS = {
  // Input actions — must be serialized through the queue
  // These are dispatched via handleInput(actionName, params)
  click:        { handler: (p) => handleInput('click', p), queued: true },
  right_click:  { handler: (p) => handleInput('right_click', p), queued: true },
  double_click: { handler: (p) => handleInput('double_click', p), queued: true },
  type:         { handler: (p) => handleInput('type', p), queued: true },
  key:          { handler: (p) => handleInput('key', p), queued: true },
  scroll:       { handler: (p) => handleInput('scroll', p), queued: true },
  drag:         { handler: (p) => handleInput('drag', p), queued: true },
  mouse_move:   { handler: (p) => handleInput('mouse_move', p), queued: true },

  // Screenshot — can run in parallel
  screenshot:   { handler: screenshot, queued: false },

  // Exec — can run in parallel
  bash:         { handler: bash, queued: false },
  exec:         { handler: exec, queued: false },

  // Clipboard — serialized (uses X11 clipboard)
  clipboard_read:  { handler: () => clipboard_read(), queued: true },
  clipboard_write: { handler: clipboard_write, queued: true },
};

// Ensure DISPLAY is set
process.env.DISPLAY = process.env.DISPLAY || ':99';

// Clean up stale socket
if (fs.existsSync(SOCKET_PATH)) {
  fs.unlinkSync(SOCKET_PATH);
}

const server = net.createServer((conn) => {
  let buffer = '';

  conn.on('data', (chunk) => {
    buffer += chunk.toString();

    // Guard against memory exhaustion from malicious clients
    if (buffer.length > 1024 * 1024) {
      respond(conn, { success: false, error: 'Request too large (>1 MB)', duration_ms: 0 });
      buffer = '';
      return;
    }

    // Process newline-delimited JSON messages
    let newlineIdx;
    while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIdx).trim();
      buffer = buffer.slice(newlineIdx + 1);

      if (line.length === 0) continue;

      handleMessage(line, conn);
    }
  });

  conn.on('error', () => {
    // Client disconnected — ignore
  });
});

async function handleMessage(raw, conn) {
  const start = Date.now();
  let msg;

  try {
    msg = JSON.parse(raw);
  } catch {
    respond(conn, { success: false, error: 'Invalid JSON', duration_ms: Date.now() - start });
    return;
  }

  const { action, params = {} } = msg;

  if (!action || typeof action !== 'string') {
    respond(conn, { success: false, error: 'Missing or invalid "action" field', duration_ms: Date.now() - start });
    return;
  }

  const entry = ACTIONS[action];
  if (!entry) {
    respond(conn, { success: false, error: `Unknown action: ${action}`, duration_ms: Date.now() - start });
    return;
  }

  try {
    let data;
    if (entry.queued) {
      data = await inputQueue.enqueue(() => entry.handler(params));
    } else {
      data = await entry.handler(params);
    }
    respond(conn, { success: true, data, duration_ms: Date.now() - start });
  } catch (err) {
    respond(conn, { success: false, error: err.message, duration_ms: Date.now() - start });
  }
}

function respond(conn, obj) {
  try {
    conn.write(JSON.stringify(obj) + '\n');
  } catch {
    // Connection already closed
  }
}

server.listen(SOCKET_PATH, () => {
  fs.chmodSync(SOCKET_PATH, 0o777);
  console.log(`[action-daemon] Listening on ${SOCKET_PATH}`);
  console.log(`[action-daemon] Available actions: ${Object.keys(ACTIONS).join(', ')}`);
});

// Graceful shutdown
function shutdown() {
  console.log('[action-daemon] Shutting down...');
  server.close(() => {
    try { fs.unlinkSync(SOCKET_PATH); } catch {}
    process.exit(0);
  });
  // Force exit after 5s if connections don't drain
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Prevent unhandled rejections from crashing the daemon
process.on('unhandledRejection', (err) => {
  console.error('[action-daemon] Unhandled rejection:', err);
});
