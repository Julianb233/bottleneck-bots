import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { computers } from '../db/schema.js';
import { redis } from '../lib/redis.js';

const FLUSH_INTERVAL = 30000; // 30 seconds
const REDIS_PREFIX = 'orgo:activity:';

/**
 * Track computer activity using Redis for debouncing,
 * flushing to the database every 30 seconds.
 */
export async function registerActivityTracker(app: FastifyInstance): Promise<void> {
  const pendingUpdates = new Set<string>();

  // Record activity in Redis
  app.addHook('onResponse', async (request) => {
    const computerId = (request.params as Record<string, string>).id;
    if (!computerId) return;

    // Only track action endpoints
    const url = request.routeOptions?.url || request.url;
    if (!url.includes('/computers/') || url.endsWith('/computers')) return;

    const key = `${REDIS_PREFIX}${computerId}`;
    await redis.set(key, Date.now().toString(), 'EX', 120);
    pendingUpdates.add(computerId);
  });

  // Flush to DB periodically
  const flushInterval = setInterval(async () => {
    if (pendingUpdates.size === 0) return;

    const ids = [...pendingUpdates];
    pendingUpdates.clear();

    for (const id of ids) {
      try {
        await db.update(computers)
          .set({ lastActivityAt: new Date() })
          .where(eq(computers.id, id));
      } catch {
        // Silently ignore flush errors
      }
    }
  }, FLUSH_INTERVAL);

  // Cleanup on shutdown
  app.addHook('onClose', () => {
    clearInterval(flushInterval);
  });
}
