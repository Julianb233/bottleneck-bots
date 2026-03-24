import type { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { redis } from '../lib/redis.js';

/** Per-plan multipliers for rate limits. */
const PLAN_MULTIPLIERS: Record<string, number> = {
  free: 1,
  pro: 2,
  team: 2,
};

export async function registerRateLimit(app: FastifyInstance): Promise<void> {
  await app.register(rateLimit, {
    max: (request, _key) => {
      const plan = request.currentUser?.plan ?? 'free';
      const multiplier = PLAN_MULTIPLIERS[plan] ?? 1;
      return 100 * multiplier;
    },
    timeWindow: '1 minute',
    redis,
    keyGenerator: (request) => {
      // Use API key prefix if available, otherwise IP
      return request.apiKey?.prefix ?? request.ip;
    },
    errorResponseBuilder: (_request, context) => ({
      error: 'rate_limit_exceeded',
      message: `Too many requests. You can retry in ${Math.ceil(context.ttl / 1000)} seconds.`,
      retry_after: Math.ceil(context.ttl / 1000),
    }),
  });
}

// Route-specific rate limit configs
export const RATE_LIMITS = {
  /** Screenshots: 60/min (120 for pro) */
  screenshot: { max: 60, timeWindow: '1 minute' },
  /** Computer creation: 10/min */
  computerCreate: { max: 10, timeWindow: '1 minute' },
  /** Auth endpoints: 5/min per IP */
  auth: { max: 5, timeWindow: '1 minute' },
} as const;
