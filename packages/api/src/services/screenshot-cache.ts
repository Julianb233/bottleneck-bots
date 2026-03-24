import { createHash } from 'node:crypto';

// ─── Types ──────────────────────────────────────────────────────────────────

interface CacheEntry {
  imageBuffer: Buffer;
  hash: string;
  timestamp: number;
}

interface ActivePoll {
  /** Currently subscribed client count */
  clients: number;
  /** Timer handle for the polling loop */
  timer: ReturnType<typeof setTimeout> | null;
  /** Callback list — notified on every new frame */
  listeners: Set<(entry: CacheEntry) => void>;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_CACHE_SIZE = 100;
const DEBOUNCE_MS = 50;

// ─── Cache State ────────────────────────────────────────────────────────────

const cache = new Map<string, CacheEntry>();
const lruOrder: string[] = [];
const activePolls = new Map<string, ActivePoll>();

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Fast hash using MD5 — sufficient for change-detection (not security).
 */
export function fastHash(buf: Buffer): string {
  return createHash('md5').update(buf).digest('hex');
}

function evictIfNeeded(): void {
  while (lruOrder.length > MAX_CACHE_SIZE) {
    const oldest = lruOrder.shift();
    if (oldest) {
      cache.delete(oldest);
    }
  }
}

function touchLru(computerId: string): void {
  const idx = lruOrder.indexOf(computerId);
  if (idx !== -1) {
    lruOrder.splice(idx, 1);
  }
  lruOrder.push(computerId);
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Get a cached screenshot for a computer.
 * Returns `null` if no cached entry exists.
 */
export function getCachedScreenshot(computerId: string): CacheEntry | null {
  const entry = cache.get(computerId);
  if (!entry) return null;
  touchLru(computerId);
  return entry;
}

/**
 * Get a cached screenshot only if it's fresher than `maxAgeMs`.
 * Default debounce threshold is 50ms.
 */
export function getDebounced(computerId: string, maxAgeMs: number = DEBOUNCE_MS): CacheEntry | null {
  const entry = cache.get(computerId);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > maxAgeMs) return null;
  touchLru(computerId);
  return entry;
}

/**
 * Store a new screenshot in the cache.
 * Returns `true` if the image changed compared to the previous frame.
 */
export function putScreenshot(computerId: string, imageBuffer: Buffer): boolean {
  const hash = fastHash(imageBuffer);
  const prev = cache.get(computerId);
  const changed = !prev || prev.hash !== hash;

  const entry: CacheEntry = { imageBuffer, hash, timestamp: Date.now() };
  cache.set(computerId, entry);
  touchLru(computerId);
  evictIfNeeded();

  // Notify listeners that are sharing this poll
  const poll = activePolls.get(computerId);
  if (poll) {
    for (const listener of poll.listeners) {
      try {
        listener(entry);
      } catch {
        // individual listener failure shouldn't break others
      }
    }
  }

  return changed;
}

/**
 * Register a listener that will be called on every new frame for a computer.
 * Returns an unsubscribe function.  When the last client unsubscribes the
 * poll entry is cleaned up (the actual polling timer is owned by the
 * desktop-stream handler).
 */
export function subscribe(
  computerId: string,
  listener: (entry: CacheEntry) => void,
): () => void {
  let poll = activePolls.get(computerId);
  if (!poll) {
    poll = { clients: 0, timer: null, listeners: new Set() };
    activePolls.set(computerId, poll);
  }
  poll.clients++;
  poll.listeners.add(listener);

  return () => {
    if (!poll) return;
    poll.clients--;
    poll.listeners.delete(listener);
    if (poll.clients <= 0) {
      if (poll.timer) {
        clearTimeout(poll.timer);
        poll.timer = null;
      }
      activePolls.delete(computerId);
    }
  };
}

/**
 * Get the active poll metadata for a computer (used by desktop-stream to
 * check if a shared poll already exists).
 */
export function getActivePoll(computerId: string): ActivePoll | undefined {
  return activePolls.get(computerId);
}

/**
 * Store the polling timer handle so it can be cleaned up later.
 */
export function setPollTimer(computerId: string, timer: ReturnType<typeof setTimeout>): void {
  const poll = activePolls.get(computerId);
  if (poll) {
    poll.timer = timer;
  }
}

/**
 * Clean up everything associated with a computer (call on computer stop/destroy).
 */
export function cleanupComputer(computerId: string): void {
  cache.delete(computerId);
  const idx = lruOrder.indexOf(computerId);
  if (idx !== -1) lruOrder.splice(idx, 1);

  const poll = activePolls.get(computerId);
  if (poll) {
    if (poll.timer) clearTimeout(poll.timer);
    activePolls.delete(computerId);
  }
}

/**
 * Get current cache stats (for /health or debugging).
 */
export function cacheStats(): { size: number; activePolls: number } {
  return {
    size: cache.size,
    activePolls: activePolls.size,
  };
}
