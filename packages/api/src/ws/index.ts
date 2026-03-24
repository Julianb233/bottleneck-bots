import { WebSocketServer } from 'ws';
import type { IncomingMessage, Server } from 'node:http';
import { handleTerminal } from './terminal.js';
import { handleDesktopStream } from './desktop-stream.js';

const HEARTBEAT_INTERVAL = 30000;

export function setupWebSocket(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request: IncomingMessage, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const path = url.pathname;

    // Route WebSocket connections
    const terminalMatch = path.match(/^\/ws\/computers\/([^/]+)\/terminal$/);
    const desktopMatch = path.match(/^\/ws\/computers\/([^/]+)\/desktop$/);
    const eventsMatch = path.match(/^\/ws\/computers\/([^/]+)\/events$/);
    const vncMatch = path.match(/^\/ws\/computers\/([^/]+)\/vnc$/);

    if (terminalMatch || desktopMatch || eventsMatch || vncMatch) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        const computerId = (terminalMatch || desktopMatch || eventsMatch || vncMatch)![1]!;

        if (terminalMatch) {
          handleTerminal(ws, computerId);
        } else if (desktopMatch) {
          handleDesktopStream(ws, computerId);
        } else if (eventsMatch) {
          // Events are handled by eventStreamRoutes registered on the Fastify instance
        }
      });
    } else {
      socket.destroy();
    }
  });

  // Heartbeat
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if ((ws as any)._isAlive === false) {
        ws.terminate();
        return;
      }
      (ws as any)._isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL);

  wss.on('connection', (ws) => {
    (ws as any)._isAlive = true;
    ws.on('pong', () => { (ws as any)._isAlive = true; });
  });

  wss.on('close', () => clearInterval(interval));
}
