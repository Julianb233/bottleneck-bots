import type { WebSocket } from 'ws';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { computers } from '../db/schema.js';
import { parseApiKey } from '../lib/api-keys.js';
import { sendAction } from '../lib/action-proxy.js';
import crypto from 'node:crypto';

const AUTH_TIMEOUT = 10000;

export function handleDesktopStream(ws: WebSocket, computerId: string): void {
  let authenticated = false;
  let streaming = false;
  let quality = 60;
  let maxFps = 10;
  let paused = false;
  let lastHash = '';
  let unchangedCount = 0;
  let streamTimer: ReturnType<typeof setTimeout> | null = null;

  const authTimer = setTimeout(() => {
    if (!authenticated) {
      ws.send(JSON.stringify({ type: 'error', message: 'Auth timeout' }));
      ws.close(4001);
    }
  }, AUTH_TIMEOUT);

  async function streamLoop() {
    if (!streaming || paused || ws.readyState !== ws.OPEN) return;

    try {
      const result = await sendAction(computerId, 'screenshot', { format: 'jpeg', quality });
      if (!result.success || !result.data) {
        scheduleNext(1000);
        return;
      }

      const imageData = (result.data as { image: string }).image;
      const hash = crypto.createHash('md5').update(imageData.slice(0, 1000)).digest('hex');

      if (hash === lastHash) {
        unchangedCount++;
      } else {
        unchangedCount = 0;
        lastHash = hash;
      }

      // Send frame as binary
      const buf = Buffer.from(imageData, 'base64');
      ws.send(buf, { binary: true });

      // Adaptive interval
      let interval: number;
      if (unchangedCount >= 10) interval = 2000;
      else if (unchangedCount >= 3) interval = 500;
      else interval = Math.max(1000 / maxFps, 66);

      scheduleNext(interval);
    } catch {
      scheduleNext(1000);
    }
  }

  function scheduleNext(ms: number) {
    if (streamTimer) clearTimeout(streamTimer);
    streamTimer = setTimeout(streamLoop, ms);
  }

  ws.on('message', async (data) => {
    const message = data.toString();

    if (!authenticated) {
      try {
        const msg = JSON.parse(message);
        if (msg.type !== 'auth' || !msg.api_key) {
          ws.close(4001);
          return;
        }

        const parsed = parseApiKey(msg.api_key);
        if (!parsed) { ws.close(4001); return; }

        const [computer] = await db.select().from(computers).where(eq(computers.id, computerId));
        if (!computer || computer.status !== 'running') { ws.close(4009); return; }

        clearTimeout(authTimer);
        authenticated = true;
        streaming = true;

        ws.send(JSON.stringify({ type: 'connected', computerId }));
        streamLoop();
      } catch {
        ws.close(4500);
      }
      return;
    }

    // Handle control messages
    try {
      const msg = JSON.parse(message);
      if (msg.type === 'quality') quality = Math.max(30, Math.min(95, msg.value));
      else if (msg.type === 'fps') maxFps = Math.max(1, Math.min(15, msg.value));
      else if (msg.type === 'pause') paused = true;
      else if (msg.type === 'resume') { paused = false; streamLoop(); }
    } catch {}
  });

  ws.on('close', () => {
    clearTimeout(authTimer);
    streaming = false;
    if (streamTimer) clearTimeout(streamTimer);
  });
}
