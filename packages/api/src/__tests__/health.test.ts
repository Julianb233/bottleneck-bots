import { describe, it, expect, vi, beforeAll } from 'vitest';
import Fastify from 'fastify';

// Mock database and redis before importing the health routes
vi.mock('../db/index.js', () => ({
  db: {
    execute: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
  },
}));

vi.mock('../lib/redis.js', () => ({
  redis: {
    ping: vi.fn().mockResolvedValue('PONG'),
  },
}));

import { healthRoutes } from '../routes/health.js';

describe('Health endpoint', () => {
  const app = Fastify();

  beforeAll(async () => {
    await app.register(healthRoutes);
    await app.ready();
  });

  it('GET /health returns 200 when all checks pass', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.body);
    expect(body.status).toBe('healthy');
    expect(body.checks.database).toBe('ok');
    expect(body.checks.redis).toBe('ok');
    expect(typeof body.uptime).toBe('number');
    expect(body.version).toBeDefined();
  });

  it('GET /health returns 503 when database is down', async () => {
    // Make the database check fail
    const { db } = await import('../db/index.js');
    vi.mocked(db.execute).mockRejectedValueOnce(new Error('connection refused'));

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(503);

    const body = JSON.parse(response.body);
    expect(body.status).toBe('degraded');
    expect(body.checks.database).toBe('error');
  });

  it('GET /health returns 503 when redis is down', async () => {
    const { redis } = await import('../lib/redis.js');
    vi.mocked(redis.ping).mockRejectedValueOnce(new Error('connection refused'));

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(503);

    const body = JSON.parse(response.body);
    expect(body.status).toBe('degraded');
    expect(body.checks.redis).toBe('error');
  });
});
