import type { FastifyInstance } from 'fastify';
import { createConnection, type Socket as NetSocket } from 'node:net';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { apiKeys, computers, workspaces } from '../db/schema.js';
import { parseApiKey, verifyApiKey } from '../lib/api-keys.js';

// ─── Auth helpers (shared pattern with desktop-stream) ──────────────────────

async function authenticateApiKey(
  token: string,
): Promise<{ userId: string } | null> {
  const parsed = parseApiKey(token);
  if (!parsed) return null;

  const candidates = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyPrefix, parsed.prefix), isNull(apiKeys.revokedAt)));

  for (const candidate of candidates) {
    const valid = await verifyApiKey(token, candidate.keyHash);
    if (valid) return { userId: candidate.userId };
  }
  return null;
}

async function verifyComputerAccess(
  computerId: string,
  userId: string,
): Promise<{ ipAddress: string; vncPort: number } | null> {
  const [computer] = await db
    .select({
      ipAddress: computers.ipAddress,
      vncPort: computers.vncPort,
      workspaceUserId: workspaces.userId,
      status: computers.status,
    })
    .from(computers)
    .innerJoin(workspaces, eq(computers.workspaceId, workspaces.id))
    .where(eq(computers.id, computerId))
    .limit(1);

  if (!computer || computer.workspaceUserId !== userId) return null;
  if (computer.status !== 'running') return null;
  if (!computer.ipAddress) return null;

  // VNC default port 5900 if not explicitly set
  const vncPort = computer.vncPort ?? 5900;
  return { ipAddress: computer.ipAddress, vncPort };
}

// ─── Route registration ─────────────────────────────────────────────────────

export async function novncProxyRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/ws/computers/:id/vnc',
    { websocket: true } as any,
    (async (socket: import('ws').WebSocket, request: import('fastify').FastifyRequest) => {
      const computerId = (request.params as { id: string }).id;
      let authenticated = false;
      let tcpSocket: NetSocket | null = null;
      let closed = false;

      // Auth timeout
      const authTimeout = setTimeout(() => {
        if (!authenticated) {
          socket.send(JSON.stringify({ type: 'error', message: 'Authentication timeout' }));
          socket.close(4001, 'Authentication timeout');
        }
      }, 5000);

      function cleanup(): void {
        if (closed) return;
        closed = true;
        clearTimeout(authTimeout);

        if (tcpSocket) {
          tcpSocket.destroy();
          tcpSocket = null;
        }
        if (socket.readyState <= 1) {
          socket.close();
        }
      }

      socket.on('close', cleanup);
      socket.on('error', cleanup);

      socket.on('message', async (raw: Buffer | string) => {
        // ── First message: API key authentication ──
        if (!authenticated) {
          clearTimeout(authTimeout);
          const token = raw.toString().trim();
          const auth = await authenticateApiKey(token);
          if (!auth) {
            socket.send(JSON.stringify({ type: 'error', message: 'Invalid API key' }));
            socket.close(4002, 'Invalid API key');
            return;
          }

          const access = await verifyComputerAccess(computerId, auth.userId);
          if (!access) {
            socket.send(JSON.stringify({ type: 'error', message: 'Computer not found or access denied' }));
            socket.close(4003, 'Access denied');
            return;
          }

          authenticated = true;
          socket.send(JSON.stringify({ type: 'authenticated' }));

          // Establish TCP connection to VNC server
          connectToVnc(access.ipAddress, access.vncPort);
          return;
        }

        // ── After auth: proxy bytes to VNC ──
        if (tcpSocket && !tcpSocket.destroyed) {
          const data = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
          const canWrite = tcpSocket.write(data);

          // Backpressure: if TCP buffer is full, pause WebSocket
          if (!canWrite) {
            socket.pause?.();
            tcpSocket.once('drain', () => {
              socket.resume?.();
            });
          }
        }
      });

      function connectToVnc(host: string, port: number): void {
        tcpSocket = createConnection({ host, port }, () => {
          request.log.info(`VNC TCP connection established to ${host}:${port}`);
        });

        // Proxy VNC data back to WebSocket
        tcpSocket.on('data', (data: Buffer) => {
          if (socket.readyState === 1 /* OPEN */) {
            // Check WebSocket backpressure via bufferedAmount
            socket.send(data, { binary: true }, (err: Error | undefined) => {
              if (err && tcpSocket && !tcpSocket.destroyed) {
                // Backpressure: pause TCP reading if WS can't keep up
                tcpSocket.pause();
                // Resume on next drain-like event (approximated by next successful send)
                setTimeout(() => {
                  if (tcpSocket && !tcpSocket.destroyed) {
                    tcpSocket.resume();
                  }
                }, 50);
              }
            });
          }
        });

        // TCP close → close WebSocket
        tcpSocket.on('close', () => {
          request.log.info('VNC TCP connection closed');
          if (!closed) {
            socket.close(1000, 'VNC connection closed');
          }
          cleanup();
        });

        tcpSocket.on('error', (err) => {
          request.log.error(err, 'VNC TCP connection error');
          if (!closed) {
            socket.send(JSON.stringify({ type: 'error', message: 'VNC connection failed' }));
            socket.close(4004, 'VNC connection error');
          }
          cleanup();
        });

        // Handle connection timeout
        tcpSocket.setTimeout(10000, () => {
          request.log.warn('VNC TCP connection timeout');
          if (!closed) {
            socket.send(JSON.stringify({ type: 'error', message: 'VNC connection timeout' }));
            socket.close(4005, 'VNC connection timeout');
          }
          cleanup();
        });
      }
    }) as any,
  );
}
