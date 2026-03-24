import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { redis } from '../lib/redis.js';

const startTime = Date.now();

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_request, reply) => {
    const checks: Record<string, 'ok' | 'error'> = {
      database: 'error',
      redis: 'error',
    };

    // Check database
    try {
      await db.execute(sql`SELECT 1`);
      checks.database = 'ok';
    } catch {
      // database unreachable
    }

    // Check Redis
    try {
      const pong = await redis.ping();
      if (pong === 'PONG') {
        checks.redis = 'ok';
      }
    } catch {
      // redis unreachable
    }

    const allHealthy = Object.values(checks).every((s) => s === 'ok');
    const statusCode = allHealthy ? 200 : 503;

    return reply.status(statusCode).send({
      status: allHealthy ? 'healthy' : 'degraded',
      version: process.env.npm_package_version ?? '0.1.0',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      checks,
    });
  });
}
