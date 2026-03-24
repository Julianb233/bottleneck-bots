import { Redis } from 'ioredis';
import { config } from '../config.js';

export const redis = new Redis(config.redis.url, {
  maxRetriesPerRequest: null,
  retryStrategy(times: number) {
    const delay = Math.min(times * 200, 5000);
    return delay;
  },
  lazyConnect: false,
  enableReadyCheck: true,
});

redis.on('error', (err: Error) => {
  console.error('Redis connection error:', err.message);
});

redis.on('connect', () => {
  console.log('Redis connected');
});

/**
 * Separate connection for BullMQ workers.
 * BullMQ requires its own dedicated connection that does not share
 * subscriptions with application-level Redis usage.
 */
export function createBullMQConnection(): Redis {
  return new Redis(config.redis.url, {
    maxRetriesPerRequest: null,
    retryStrategy(times: number) {
      const delay = Math.min(times * 200, 5000);
      return delay;
    },
    enableReadyCheck: true,
  });
}

/**
 * Shared BullMQ connection instance used by workers and queues.
 * Avoids creating a new connection per worker while keeping it
 * separate from the application-level `redis` instance.
 */
export const bullRedis = createBullMQConnection();

/**
 * Returns the shared BullMQ Redis connection.
 * Used by workers that need a dedicated connection for BullMQ.
 */
export function getRedis(): Redis {
  return bullRedis;
}

export async function disconnectRedis(): Promise<void> {
  await Promise.all([redis.quit(), bullRedis.quit()]);
}
