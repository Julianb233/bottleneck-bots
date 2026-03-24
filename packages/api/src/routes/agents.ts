import type { FastifyInstance } from 'fastify';
import Docker from 'dockerode';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { computers } from '../db/schema.js';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

export async function agentRoutes(app: FastifyInstance): Promise<void> {
  // Get agent/computer logs
  app.get('/computers/:id/logs', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { tail = '100', since, until: _until } = request.query as Record<string, string>;

    const [computer] = await db.select().from(computers).where(eq(computers.id, id));
    if (!computer?.containerId) {
      return reply.status(404).send({ error: 'not_found' });
    }

    const container = docker.getContainer(computer.containerId);
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail: parseInt(tail, 10),
      timestamps: true,
      since: since ? Math.floor(new Date(since).getTime() / 1000) : undefined,
    });

    return reply.send({ logs: logs.toString() });
  });

  // Get computer resource usage
  app.get('/computers/:id/stats', async (request, reply) => {
    const { id } = request.params as { id: string };

    const [computer] = await db.select().from(computers).where(eq(computers.id, id));
    if (!computer?.containerId) {
      return reply.status(404).send({ error: 'not_found' });
    }

    const container = docker.getContainer(computer.containerId);
    const stats = await container.stats({ stream: false });

    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100 : 0;

    return reply.send({
      cpu: { percent: Math.round(cpuPercent * 100) / 100, cores: stats.cpu_stats.online_cpus },
      memory: {
        usage: stats.memory_stats.usage,
        limit: stats.memory_stats.limit,
        percent: Math.round((stats.memory_stats.usage / stats.memory_stats.limit) * 10000) / 100,
      },
      network: stats.networks,
      pids: stats.pids_stats?.current || 0,
    });
  });

  // Restart computer
  app.post('/computers/:id/restart', async (request, reply) => {
    const { id } = request.params as { id: string };

    const [computer] = await db.select().from(computers).where(eq(computers.id, id));
    if (!computer?.containerId) {
      return reply.status(404).send({ error: 'not_found' });
    }

    const container = docker.getContainer(computer.containerId);
    await container.restart({ t: 10 });

    await db.update(computers).set({ status: 'running', updatedAt: new Date() }).where(eq(computers.id, id));

    return reply.send({ status: 'restarting' });
  });
}
