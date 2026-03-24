// ─── Per-Computer Event Ring Buffer ──────────────────────────────────────────
//
// Stores the last 200 desktop events per computer in memory.
// Used by the event WebSocket handler to provide a recent-history snapshot
// when a new client connects and to buffer events for slow consumers.

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DesktopEvent {
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
}

interface RingBuffer {
  events: DesktopEvent[];
  maxSize: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_EVENTS_PER_COMPUTER = 200;
const CLIENT_SEND_BUFFER = 100;

// ─── State ───────────────────────────────────────────────────────────────────

const buffers = new Map<string, RingBuffer>();

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Push an event into the ring buffer for a computer.
 * Oldest events are dropped when the buffer exceeds MAX_EVENTS_PER_COMPUTER.
 */
export function pushEvent(computerId: string, event: DesktopEvent): void {
  let buf = buffers.get(computerId);
  if (!buf) {
    buf = { events: [], maxSize: MAX_EVENTS_PER_COMPUTER };
    buffers.set(computerId, buf);
  }

  buf.events.push(event);

  // Trim to max size
  if (buf.events.length > buf.maxSize) {
    buf.events.splice(0, buf.events.length - buf.maxSize);
  }
}

/**
 * Get the most recent events for a computer.
 * Returns up to `limit` events (default: CLIENT_SEND_BUFFER).
 */
export function getRecentEvents(
  computerId: string,
  limit: number = CLIENT_SEND_BUFFER,
): DesktopEvent[] {
  const buf = buffers.get(computerId);
  if (!buf || buf.events.length === 0) return [];
  return buf.events.slice(-limit);
}

/**
 * Get the count of buffered events for a computer.
 */
export function getEventCount(computerId: string): number {
  const buf = buffers.get(computerId);
  return buf ? buf.events.length : 0;
}

/**
 * Clean up the buffer for a computer (call when computer stops).
 */
export function cleanupEventBuffer(computerId: string): void {
  buffers.delete(computerId);
}

/**
 * Clean up all buffers. Useful for testing or shutdown.
 */
export function cleanupAllEventBuffers(): void {
  buffers.clear();
}

/**
 * Get stats for debugging / health checks.
 */
export function eventBufferStats(): { computers: number; totalEvents: number } {
  let totalEvents = 0;
  for (const buf of buffers.values()) {
    totalEvents += buf.events.length;
  }
  return { computers: buffers.size, totalEvents };
}

/**
 * Maximum number of events to buffer for a slow WS client before dropping.
 */
export const MAX_CLIENT_BUFFER = CLIENT_SEND_BUFFER;
