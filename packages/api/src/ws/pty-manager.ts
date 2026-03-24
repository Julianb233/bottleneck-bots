// ─── PTY Session Manager ─────────────────────────────────────────────────────
//
// Spawns and tracks pseudo-terminal sessions backed by `docker exec -it`
// running inside a computer's container. Uses the `node-pty` library so output
// is streamed character-by-character over WebSockets.

import * as pty from 'node-pty';
import crypto from 'node:crypto';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PtySession {
  id: string;
  computerId: string;
  pty: pty.IPty;
  createdAt: Date;
}

export interface SpawnOptions {
  cols?: number;
  rows?: number;
  shell?: string;
}

const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;
const DEFAULT_SHELL = '/bin/bash';
const MAX_SESSIONS_PER_COMPUTER = 5;

// ─── Session Store ───────────────────────────────────────────────────────────

/** computerId → Map<sessionId, PtySession> */
const sessions = new Map<string, Map<string, PtySession>>();

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Spawn a new PTY inside the given Docker container.
 *
 * Runs: docker exec -it <containerId> <shell>
 */
export function spawnTerminal(
  computerId: string,
  containerId: string,
  options: SpawnOptions = {},
): PtySession {
  const computerSessions = sessions.get(computerId);
  if (computerSessions && computerSessions.size >= MAX_SESSIONS_PER_COMPUTER) {
    throw new Error(
      `Maximum sessions (${MAX_SESSIONS_PER_COMPUTER}) reached for computer ${computerId}`,
    );
  }

  const cols = options.cols ?? DEFAULT_COLS;
  const rows = options.rows ?? DEFAULT_ROWS;
  const shell = options.shell ?? DEFAULT_SHELL;

  const term = pty.spawn('docker', ['exec', '-it', containerId, shell], {
    name: 'xterm-256color',
    cols,
    rows,
    env: {
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
    },
  });

  const sessionId = crypto.randomUUID();
  const session: PtySession = {
    id: sessionId,
    computerId,
    pty: term,
    createdAt: new Date(),
  };

  if (!sessions.has(computerId)) {
    sessions.set(computerId, new Map());
  }
  sessions.get(computerId)!.set(sessionId, session);

  return session;
}

/** Resize an active PTY. */
export function resizeTerminal(session: PtySession, cols: number, rows: number): void {
  session.pty.resize(cols, rows);
}

/** Destroy a single session and clean up tracking. */
export function destroySession(session: PtySession): void {
  try {
    session.pty.kill();
  } catch {
    // already dead — ignore
  }

  const computerSessions = sessions.get(session.computerId);
  if (computerSessions) {
    computerSessions.delete(session.id);
    if (computerSessions.size === 0) {
      sessions.delete(session.computerId);
    }
  }
}

/** Get number of active sessions for a computer. */
export function sessionCount(computerId: string): number {
  return sessions.get(computerId)?.size ?? 0;
}

/** Destroy all sessions for a given computer. */
export function destroyAllSessions(computerId: string): void {
  const computerSessions = sessions.get(computerId);
  if (!computerSessions) return;

  for (const session of computerSessions.values()) {
    try {
      session.pty.kill();
    } catch {
      // ignore
    }
  }
  sessions.delete(computerId);
}

/** Destroy every tracked session (used during shutdown). */
export function destroyAll(): void {
  for (const computerId of [...sessions.keys()]) {
    destroyAllSessions(computerId);
  }
}
