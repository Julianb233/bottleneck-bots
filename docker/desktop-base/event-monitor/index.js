'use strict';

const net = require('node:net');
const fs = require('node:fs');
const { execSync, spawn } = require('node:child_process');
const crypto = require('node:crypto');

// ─── Configuration ──────────────────────────────────────────────────────────

const SOCKET_PATH = '/tmp/orgo-events.sock';
const CLIPBOARD_MAX_BYTES = 1024;

const POLL_INTERVALS = {
  windowFocus: 500,
  windowList: 2000,
  clipboard: 1000,
  processes: 5000,
};

const FILE_WATCH_DEBOUNCE_MS = 500;
const HOME_DIR = '/home/orgo';
const WATCHED_DIRS = [
  '/home/orgo/Downloads',
  '/home/orgo/Desktop',
  '/home/orgo/Documents',
];

// ─── State ──────────────────────────────────────────────────────────────────

let activeWindowName = '';
let windowSet = new Set();
let clipboardHash = '';
let processSet = new Set();

// Connected clients
const clients = new Set();

// ─── Helpers ────────────────────────────────────────────────────────────────

function timestamp() {
  return new Date().toISOString();
}

function emit(type, data) {
  const event = JSON.stringify({ type, timestamp: timestamp(), data }) + '\n';
  for (const client of clients) {
    try {
      client.write(event);
    } catch {
      // Client disconnected — will be cleaned up
    }
  }
}

function safeExec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: 3000, env: { ...process.env, DISPLAY: ':99' } }).trim();
  } catch {
    return null;
  }
}

function hashString(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

// ─── Window Focus Monitor ───────────────────────────────────────────────────

function pollWindowFocus() {
  const name = safeExec('xdotool getactivewindow getwindowname 2>/dev/null');
  if (name !== null && name !== activeWindowName) {
    const previous = activeWindowName;
    activeWindowName = name;
    emit('window_focus', { window: name, previous });
  }
}

// ─── Window List Monitor ────────────────────────────────────────────────────

function pollWindowList() {
  const raw = safeExec('xdotool search --name "" 2>/dev/null');
  if (raw === null) return;

  const ids = new Set(raw.split('\n').filter(Boolean));

  // Detect opened windows
  for (const id of ids) {
    if (!windowSet.has(id)) {
      const name = safeExec(`xdotool getwindowname ${id} 2>/dev/null`) || '';
      emit('window_open', { windowId: id, name });
    }
  }

  // Detect closed windows
  for (const id of windowSet) {
    if (!ids.has(id)) {
      emit('window_close', { windowId: id });
    }
  }

  windowSet = ids;
}

// ─── Clipboard Monitor ─────────────────────────────────────────────────────

function pollClipboard() {
  const content = safeExec('xclip -selection clipboard -o 2>/dev/null');
  if (content === null) return;

  // Cap at 1KB
  const capped = content.slice(0, CLIPBOARD_MAX_BYTES);
  const hash = hashString(capped);

  if (hash !== clipboardHash) {
    clipboardHash = hash;
    emit('clipboard', {
      content: capped,
      truncated: content.length > CLIPBOARD_MAX_BYTES,
      length: content.length,
    });
  }
}

// ─── File Change Monitor ────────────────────────────────────────────────────

function startFileWatcher() {
  // Debounce map: path -> timeout
  const debounceTimers = new Map();

  // Only watch directories that exist
  const dirs = WATCHED_DIRS.filter((d) => {
    try { fs.accessSync(d, fs.constants.R_OK); return true; } catch { return false; }
  });
  if (dirs.length === 0) return;

  try {
    // Use inotifywait for recursive file monitoring
    const watcher = spawn('inotifywait', [
      '-m', '-r',
      '--format', '%e %w%f',
      '-e', 'create,modify,delete,move',
      ...dirs,
    ], {
      stdio: ['ignore', 'pipe', 'ignore'],
      env: { ...process.env },
    });

    watcher.stdout.on('data', (chunk) => {
      const lines = chunk.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        const spaceIdx = line.indexOf(' ');
        if (spaceIdx === -1) continue;

        const events = line.slice(0, spaceIdx);
        const filePath = line.slice(spaceIdx + 1);

        // Debounce per file path
        if (debounceTimers.has(filePath)) {
          clearTimeout(debounceTimers.get(filePath));
        }

        debounceTimers.set(filePath, setTimeout(() => {
          debounceTimers.delete(filePath);

          let changeType = 'modified';
          if (events.includes('CREATE')) changeType = 'created';
          else if (events.includes('DELETE')) changeType = 'deleted';
          else if (events.includes('MOVED_FROM')) changeType = 'moved_from';
          else if (events.includes('MOVED_TO')) changeType = 'moved_to';

          emit('file_change', { path: filePath, change: changeType });
        }, FILE_WATCH_DEBOUNCE_MS));
      }
    });

    watcher.on('error', (err) => {
      console.error('[event-monitor] inotifywait error:', err.message);
      // Fall back to fs.watch
      startFsWatch();
    });

    watcher.on('exit', (code) => {
      if (code !== 0) {
        console.warn('[event-monitor] inotifywait exited with code', code, '— falling back to fs.watch');
        startFsWatch();
      }
    });
  } catch {
    console.warn('[event-monitor] inotifywait not available, falling back to fs.watch');
    startFsWatch();
  }
}

function startFsWatch() {
  const debounceTimers = new Map();

  try {
    fs.watch(HOME_DIR, { recursive: true }, (eventType, filename) => {
      if (!filename) return;
      const filePath = `${HOME_DIR}/${filename}`;

      if (debounceTimers.has(filePath)) {
        clearTimeout(debounceTimers.get(filePath));
      }

      debounceTimers.set(filePath, setTimeout(() => {
        debounceTimers.delete(filePath);
        emit('file_change', { path: filePath, change: eventType });
      }, FILE_WATCH_DEBOUNCE_MS));
    });
  } catch (err) {
    console.error('[event-monitor] fs.watch failed:', err.message);
  }
}

// ─── Process Monitor ────────────────────────────────────────────────────────

function pollProcesses() {
  const raw = safeExec('ps aux --no-headers 2>/dev/null');
  if (raw === null) return;

  const currentProcs = new Map();
  for (const line of raw.split('\n').filter(Boolean)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 11) continue;
    const pid = parts[1];
    const command = parts.slice(10).join(' ');
    currentProcs.set(pid, command);
  }

  const currentPids = new Set(currentProcs.keys());

  // Detect new processes
  for (const pid of currentPids) {
    if (!processSet.has(pid)) {
      emit('process_start', { pid, command: currentProcs.get(pid) });
    }
  }

  // Detect exited processes
  for (const pid of processSet) {
    if (!currentPids.has(pid)) {
      emit('process_exit', { pid });
    }
  }

  processSet = currentPids;
}

// ─── Socket Server ──────────────────────────────────────────────────────────

// Clean up stale socket
if (fs.existsSync(SOCKET_PATH)) {
  fs.unlinkSync(SOCKET_PATH);
}

const server = net.createServer((conn) => {
  clients.add(conn);
  console.log(`[event-monitor] Client connected (${clients.size} total)`);

  conn.on('close', () => {
    clients.delete(conn);
    console.log(`[event-monitor] Client disconnected (${clients.size} total)`);
  });

  conn.on('error', () => {
    clients.delete(conn);
  });
});

server.listen(SOCKET_PATH, () => {
  fs.chmodSync(SOCKET_PATH, 0o777);
  console.log(`[event-monitor] Listening on ${SOCKET_PATH}`);

  // ── Start all monitors ──
  setInterval(pollWindowFocus, POLL_INTERVALS.windowFocus);
  setInterval(pollWindowList, POLL_INTERVALS.windowList);
  setInterval(pollClipboard, POLL_INTERVALS.clipboard);
  setInterval(pollProcesses, POLL_INTERVALS.processes);
  startFileWatcher();

  // Initial state capture
  pollWindowList();
  pollProcesses();

  console.log('[event-monitor] All monitors active');
});

// ─── Graceful Shutdown ──────────────────────────────────────────────────────

function shutdown() {
  console.log('[event-monitor] Shutting down...');
  for (const client of clients) {
    try { client.destroy(); } catch {}
  }
  server.close(() => {
    try { fs.unlinkSync(SOCKET_PATH); } catch {}
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

process.on('unhandledRejection', (err) => {
  console.error('[event-monitor] Unhandled rejection:', err);
});
