import type { WebSocket } from 'ws';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { computers } from '../db/schema.js';
import { parseApiKey } from '../lib/api-keys.js';
import Docker from 'dockerode';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const AUTH_TIMEOUT = 10000;

export function handleTerminal(ws: WebSocket, computerId: string): void {
  let authenticated = false;
  let execStream: NodeJS.ReadWriteStream | null = null;

  const authTimer = setTimeout(() => {
    if (!authenticated) {
      ws.send(JSON.stringify({ type: 'error', message: 'Authentication timeout' }));
      ws.close(4001, 'Auth timeout');
    }
  }, AUTH_TIMEOUT);

  ws.on('message', async (data) => {
    const message = data.toString();

    if (!authenticated) {
      try {
        const msg = JSON.parse(message);
        if (msg.type !== 'auth' || !msg.api_key) {
          ws.send(JSON.stringify({ type: 'error', message: 'First message must be { type: "auth", api_key: "..." }' }));
          ws.close(4001);
          return;
        }

        // Validate API key
        const parsed = parseApiKey(msg.api_key);
        if (!parsed) {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid API key' }));
          ws.close(4001);
          return;
        }

        // Look up computer
        const [computer] = await db.select().from(computers).where(eq(computers.id, computerId));
        if (!computer || !computer.containerId) {
          ws.send(JSON.stringify({ type: 'error', message: 'Computer not found' }));
          ws.close(4004);
          return;
        }

        if (computer.status !== 'running') {
          ws.send(JSON.stringify({ type: 'error', message: 'Computer is not running' }));
          ws.close(4009);
          return;
        }

        clearTimeout(authTimer);
        authenticated = true;

        // Spawn exec session
        const container = docker.getContainer(computer.containerId);
        const exec = await container.exec({
          Cmd: ['/bin/bash'],
          AttachStdin: true,
          AttachStdout: true,
          AttachStderr: true,
          Tty: true,
          Env: ['TERM=xterm-256color', 'DISPLAY=:99'],
        });

        execStream = await exec.start({ hijack: true, stdin: true });

        execStream.on('data', (chunk: Buffer) => {
          if (ws.readyState === ws.OPEN) {
            ws.send(chunk);
          }
        });

        execStream.on('end', () => {
          ws.close(1000, 'Terminal session ended');
        });

        ws.send(JSON.stringify({ type: 'connected', computerId }));

      } catch (err: any) {
        ws.send(JSON.stringify({ type: 'error', message: err.message }));
        ws.close(4500);
      }
      return;
    }

    // Authenticated — forward to PTY
    try {
      const msg = JSON.parse(message);
      if (msg.type === 'resize' && msg.cols && msg.rows) {
        // Resize not directly supported via docker exec stream
        // Would need node-pty for proper resize
        return;
      }
    } catch {
      // Not JSON — treat as raw terminal input
    }

    if (execStream) {
      execStream.write(Buffer.isBuffer(data) ? data : Buffer.from(data.toString()));
    }
  });

  ws.on('close', () => {
    clearTimeout(authTimer);
    if (execStream) {
      try { (execStream as any).destroy(); } catch {}
    }
  });
}
