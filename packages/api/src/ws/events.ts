// ─── Desktop Event Stream WebSocket Handler ─────────────────────────────────
//
// Endpoint: /ws/computers/:id/events
//
// Lifecycle:
//   1. Connection opens -> state = awaiting_auth (10s timeout)
//   2. Client sends { type: "auth", api_key: "sk_live_..." }
//   3. Server validates key, verifies computer ownership + running status
//   4. Connects to container's event-monitor via docker exec relay
//   5. Forwards JSON events to WS client, respecting subscription filters
//
// Client filter messages:
//   { type: "subscribe", events: ["window_focus", "clipboard"] }
//   { type: "unsubscribe", events: ["process_start", "process_exit"] }
//
// Buffers up to 100 events if client is slow (backpressure).

import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import type { FastifyBaseLogger } from 'fastify';
import { spawn, type ChildProcess } from 'node:child_process';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { apiKeys, computers, workspaces } from '../db/schema.js';
import { parseApiKey, verifyApiKey } from '../lib/api-keys.js';
import {
  type DesktopEvent,
  pushEvent,
  MAX_CLIENT_BUFFER,
} from '../services/event-buffer.js';
import { WS_CLOSE, encode } from './protocol.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const AUTH_TIMEOUT_MS = 10_000;

const ALL_EVENT_TYPES = [
  'window_focus',
  'window_open',
  'window_close',
  'clipboard',
  'file_change',
  'process_start',
  'process_exit',
] as const;

// ─── Route Registration ─────────────────────────────────────────────────────

export async function eventStreamRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/ws/computers/:id/events',
    { websocket: true } as any,
    ((socket: WebSocket, req: import('fastify').FastifyRequest) => {
      const { id } = req.params as { id: string };
      handleEventConnection(socket, id, req.log);
    }) as any,
  );
}

// ─── Connection Handler ─────────────────────────────────────────────────────

function handleEventConnection(
  ws: WebSocket,
  computerId: string,
  log: FastifyBaseLogger,
): void {
  let state: 'awaiting_auth' | 'active' | 'closed' = 'awaiting_auth';
  let relay: ChildProcess | null = null;
  const subscribedEvents: Set<string> = new Set(ALL_EVENT_TYPES);
  let sendBuffer: string[] = [];
  let draining = false;

  // ── Auth timeout ─────────────────────────────────────────────────────────
  const authTimer = setTimeout(() => {
    if (state === 'awaiting_auth') {
      ws.close(WS_CLOSE.AUTH_FAILED, 'Authentication timeout');
      state = 'closed';
    }
  }, AUTH_TIMEOUT_MS);

  // ── Cleanup helper ───────────────────────────────────────────────────────
  function cleanup(): void {
    clearTimeout(authTimer);
    state = 'closed';
    if (relay) {
      try {
        relay.kill('SIGTERM');
      } catch {
        // already dead
      }
      relay = null;
    }
    sendBuffer = [];
  }

  ws.on('close', () => {
    log.debug({ computerId }, 'Event WS closed');
    cleanup();
  });

  ws.on('error', (err) => {
    log.error({ err, computerId }, 'Event WS error');
    cleanup();
  });

  // ── Buffered send (backpressure) ─────────────────────────────────────────
  function bufferedSend(data: string): void {
    if (state !== 'active' || ws.readyState !== ws.OPEN) return;

    if (draining) {
      sendBuffer.push(data);
      if (sendBuffer.length > MAX_CLIENT_BUFFER) {
        // Drop oldest events when buffer is full
        sendBuffer.shift();
      }
      return;
    }

    ws.send(data, (err) => {
      if (err) {
        log.debug({ err, computerId }, 'Event WS send error');
      }
    });

    // Check if we need to start buffering
    if (ws.bufferedAmount > 64 * 1024) {
      draining = true;
      const drainCheck = setInterval(() => {
        if (ws.readyState !== ws.OPEN || state !== 'active') {
          clearInterval(drainCheck);
          draining = false;
          return;
        }
        if (ws.bufferedAmount < 16 * 1024) {
          draining = false;
          clearInterval(drainCheck);
          // Flush buffered events
          while (sendBuffer.length > 0 && !draining) {
            const msg = sendBuffer.shift()!;
            ws.send(msg);
            if (ws.bufferedAmount > 64 * 1024) {
              draining = true;
              break;
            }
          }
        }
      }, 100);
    }
  }

  // ── Message handler ──────────────────────────────────────────────────────
  ws.on('message', (raw: Buffer | string) => {
    const text = typeof raw === 'string' ? raw : raw.toString('utf-8');

    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(text);
    } catch {
      ws.send(encode({ type: 'error', code: 400, message: 'Invalid JSON' }));
      return;
    }

    if (msg.type === 'ping') {
      ws.send(encode({ type: 'pong' }));
      return;
    }

    if (state === 'awaiting_auth') {
      if (msg.type !== 'auth' || typeof msg.api_key !== 'string') {
        ws.send(encode({ type: 'error', code: 400, message: 'Expected auth message' }));
        return;
      }
      void authenticate(msg.api_key as string);
      return;
    }

    if (state === 'active') {
      if (msg.type === 'subscribe' && Array.isArray(msg.events)) {
        for (const evt of msg.events) {
          if (typeof evt === 'string' && (ALL_EVENT_TYPES as readonly string[]).includes(evt)) {
            subscribedEvents.add(evt);
          }
        }
        ws.send(JSON.stringify({
          type: 'subscribed',
          events: Array.from(subscribedEvents),
        }));
        return;
      }

      if (msg.type === 'unsubscribe' && Array.isArray(msg.events)) {
        for (const evt of msg.events) {
          if (typeof evt === 'string') {
            subscribedEvents.delete(evt);
          }
        }
        ws.send(JSON.stringify({
          type: 'subscribed',
          events: Array.from(subscribedEvents),
        }));
        return;
      }

      ws.send(encode({ type: 'error', code: 400, message: 'Unknown message type' }));
    }
  });

  // ── Authentication flow ──────────────────────────────────────────────────
  async function authenticate(rawKey: string): Promise<void> {
    try {
      const parsed = parseApiKey(rawKey);
      if (!parsed) {
        ws.close(WS_CLOSE.AUTH_FAILED, 'Invalid API key format');
        cleanup();
        return;
      }

      const candidates = await db
        .select()
        .from(apiKeys)
        .where(and(eq(apiKeys.keyPrefix, parsed.prefix), isNull(apiKeys.revokedAt)));

      let matchedKey: (typeof candidates)[0] | null = null;
      for (const candidate of candidates) {
        if (await verifyApiKey(rawKey, candidate.keyHash)) {
          matchedKey = candidate;
          break;
        }
      }

      if (!matchedKey) {
        ws.close(WS_CLOSE.AUTH_FAILED, 'Invalid API key');
        cleanup();
        return;
      }

      const [computer] = await db
        .select({
          id: computers.id,
          containerId: computers.containerId,
          status: computers.status,
          workspaceUserId: workspaces.userId,
        })
        .from(computers)
        .innerJoin(workspaces, eq(computers.workspaceId, workspaces.id))
        .where(eq(computers.id, computerId))
        .limit(1);

      if (!computer) {
        ws.close(WS_CLOSE.NOT_FOUND, 'Computer not found');
        cleanup();
        return;
      }

      if (computer.workspaceUserId !== matchedKey.userId) {
        ws.close(WS_CLOSE.NOT_FOUND, 'Computer not found');
        cleanup();
        return;
      }

      if (computer.status !== 'running') {
        ws.close(WS_CLOSE.NOT_RUNNING, 'Computer is not running');
        cleanup();
        return;
      }

      if (!computer.containerId) {
        ws.close(WS_CLOSE.NOT_RUNNING, 'Computer has no container');
        cleanup();
        return;
      }

      // ── Start docker exec relay to event monitor socket ──────────────────
      clearTimeout(authTimer);

      try {
        relay = startEventRelay(computer.containerId, computerId, log);
      } catch (err) {
        log.error({ err, computerId }, 'Failed to start event relay');
        ws.close(WS_CLOSE.PTY_FAILED, 'Failed to connect to event monitor');
        cleanup();
        return;
      }

      state = 'active';
      ws.send(JSON.stringify({
        type: 'auth_ok',
        computerId,
        events: Array.from(subscribedEvents),
      }));
    } catch (err) {
      log.error({ err, computerId }, 'Event auth error');
      ws.close(WS_CLOSE.AUTH_FAILED, 'Authentication error');
      cleanup();
    }
  }

  // ── Docker exec relay ────────────────────────────────────────────────────
  function startEventRelay(
    containerId: string,
    compId: string,
    logger: FastifyBaseLogger,
  ): ChildProcess {
    // Connect to the event monitor's Unix socket inside the container
    // using socat to relay the socket stream to stdout
    const child = spawn('docker', [
      'exec', '-i', containerId,
      'socat', '-', 'UNIX-CONNECT:/tmp/orgo-events.sock',
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let lineBuf = '';

    child.stdout!.on('data', (chunk: Buffer) => {
      lineBuf += chunk.toString('utf-8');

      // Process complete lines (newline-delimited JSON)
      let nlIdx: number;
      while ((nlIdx = lineBuf.indexOf('\n')) !== -1) {
        const line = lineBuf.substring(0, nlIdx);
        lineBuf = lineBuf.substring(nlIdx + 1);

        if (!line) continue;

        try {
          const event: DesktopEvent = JSON.parse(line);

          // Store in ring buffer
          pushEvent(compId, event);

          // Filter by subscription
          if (!subscribedEvents.has(event.type)) continue;

          // Forward to client
          bufferedSend(JSON.stringify(event));
        } catch {
          logger.debug({ line }, 'Failed to parse event from monitor');
        }
      }
    });

    child.stderr!.on('data', (chunk: Buffer) => {
      logger.debug({ stderr: chunk.toString() }, 'Event relay stderr');
    });

    child.on('exit', (code) => {
      logger.debug({ code, compId }, 'Event relay exited');
      if (state === 'active' && ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'relay_disconnected', code }));
        ws.close(1000, 'Event monitor disconnected');
      }
      cleanup();
    });

    child.on('error', (err) => {
      logger.error({ err, compId }, 'Event relay error');
      cleanup();
    });

    return child;
  }
}
