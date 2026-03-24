import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Docker from 'dockerode';
import { inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { computers } from '../db/schema.js';
import { getRedis } from '../lib/redis.js';
import { reaperCycle } from '../workers/container-reaper.js';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

/**
 * Admin auth guard — requires either:
 * 1. X-Admin-Key header matching ADMIN_API_KEY env var, or
 * 2. Authenticated user with 'team' plan (admin-level)
 */
async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const adminKey = process.env.ADMIN_API_KEY;
  const headerKey = request.headers['x-admin-key'] as string | undefined;
  if (adminKey && headerKey === adminKey) {
    return;
  }

  if (request.currentUser && request.currentUser.plan === 'team') {
    return;
  }

  return reply.status(403).send({
    error: 'forbidden',
    message: 'Admin access required.',
  });
}

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  // Apply admin auth to all routes in this plugin
  app.addHook('preHandler', requireAdmin);

  // GET /admin/containers — list all containers with reconciliation status
  app.get('/admin/containers', async (_request, reply) => {
    const dockerContainers = await docker.listContainers({
      all: true,
      filters: { label: ['orgo.managed=true'] },
    });

    const dbComputers = await db
      .select()
      .from(computers)
      .where(inArray(computers.status, ['running', 'creating', 'stopping', 'starting', 'stopped', 'error']));

    const dbContainerIds = new Set(dbComputers.filter(c => c.containerId).map(c => c.containerId!));
    const dockerIds = new Set(dockerContainers.map(c => c.Id));

    const result = dockerContainers.map(c => ({
      id: c.Id.slice(0, 12),
      fullId: c.Id,
      name: c.Names[0]?.replace(/^\//, ''),
      image: c.Image,
      state: c.State,
      status: c.Status,
      created: c.Created,
      matched: dbContainerIds.has(c.Id),
      orphaned: !dbContainerIds.has(c.Id),
    }));

    const ghosts = dbComputers
      .filter(c => c.containerId && !dockerIds.has(c.containerId))
      .map(c => ({
        computerId: c.id,
        containerId: c.containerId,
        status: c.status,
        name: c.name,
        updatedAt: c.updatedAt,
      }));

    return reply.send({
      containers: result,
      ghosts,
      summary: {
        dockerTotal: dockerContainers.length,
        dbTotal: dbComputers.length,
        matched: result.filter(r => r.matched).length,
        orphaned: result.filter(r => r.orphaned).length,
        ghosts: ghosts.length,
      },
    });
  });

  // POST /admin/reaper/run — trigger manual reaper cycle
  app.post('/admin/reaper/run', async (_request, reply) => {
    const start = Date.now();
    await reaperCycle();
    const elapsed = Date.now() - start;

    return reply.send({
      success: true,
      message: 'Reaper cycle completed',
      durationMs: elapsed,
    });
  });

  // GET /admin/metrics — host resource metrics from Redis
  app.get('/admin/metrics', async (_request, reply) => {
    const redis = getRedis();

    const [cpu, memory, disk, containers] = await Promise.all([
      redis.get('metrics:host:cpu'),
      redis.get('metrics:host:memory'),
      redis.get('metrics:host:disk'),
      redis.get('metrics:host:containers'),
    ]);

    // Collect per-container metrics
    const containerKeys = await redis.keys('metrics:container:*:cpu');
    const containerMetrics: Array<{ id: string; cpuPercent: number; memoryBytes: number }> = [];

    for (const key of containerKeys) {
      const id = key.split(':')[2];
      const [cCpu, cMem] = await Promise.all([
        redis.get(`metrics:container:${id}:cpu`),
        redis.get(`metrics:container:${id}:memory`),
      ]);
      containerMetrics.push({
        id: id!,
        cpuPercent: parseFloat(cCpu || '0'),
        memoryBytes: parseInt(cMem || '0', 10),
      });
    }

    const diskData = disk ? JSON.parse(disk) : { usedGb: 0, totalGb: 0, percent: 0 };

    return reply.send({
      host: {
        cpuPercent: parseFloat(cpu || '0'),
        memoryPercent: parseFloat(memory || '0'),
        disk: diskData,
        containerCount: parseInt(containers || '0', 10),
      },
      containers: containerMetrics,
    });
  });
}
