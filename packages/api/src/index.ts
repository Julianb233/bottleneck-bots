import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { config } from './config.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { workspaceRoutes } from './routes/workspaces.js';
import { computerRoutes } from './routes/computers.js';
import { actionRoutes } from './routes/actions.js';
import { adminRoutes } from './routes/admin.js';
import { inviteRoutes } from './routes/invites.js';
import { memberRoutes } from './routes/members.js';
import { chatCompletionsRoutes } from './routes/v1/chat-completions.js';
import { modelsRoutes } from './routes/v1/models.js';
import { docsRoutes } from './routes/docs.js';
import { registerJwt } from './lib/jwt.js';
import { authMiddleware } from './middleware/auth.js';
import { registerRateLimit } from './middleware/rate-limit.js';
import { errorHandler } from './middleware/error-handler.js';
import { disconnectRedis } from './lib/redis.js';
import { startAutoStopWorker } from './workers/auto-stop.js';
import { startContainerReaperWorker } from './workers/container-reaper.js';
import { startResourceMonitorWorker } from './workers/resource-monitor.js';
import { startComputerLifecycleWorker } from './workers/computer-lifecycle.js';
import { closeQueues } from './lib/queue.js';
import { queryClient } from './db/index.js';
import { setupWebSocket } from './ws/index.js';

const app = Fastify({
  logger: {
    transport:
      config.nodeEnv === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    level: config.nodeEnv === 'production' ? 'info' : 'debug',
  },
});

// ─── Global Error Handler ───────────────────────────────────────────────────

app.setErrorHandler(errorHandler);

// ─── Plugins ─────────────────────────────────────────────────────────────────

await app.register(cors, {
  origin: config.isProduction ? false : true,
  credentials: true,
});

await app.register(helmet, {
  contentSecurityPolicy: config.isProduction ? undefined : false,
});

// JWT (must be registered before auth middleware and routes that use jwtVerify)
await registerJwt(app);

// Rate limiting (Redis-backed)
await registerRateLimit(app);

// API key authentication hook (skips public routes automatically)
await authMiddleware(app);

// ─── Routes ──────────────────────────────────────────────────────────────────

await app.register(healthRoutes);
await app.register(authRoutes, { prefix: '/api/v1/auth' });
await app.register(actionRoutes, { prefix: '/api/v1' });
await app.register(adminRoutes);

await app.register(workspaceRoutes, { prefix: '/api/v1' });
await app.register(computerRoutes, { prefix: '/api/v1' });
await app.register(inviteRoutes, { prefix: '/api/v1' });
await app.register(memberRoutes, { prefix: '/api/v1' });

// OpenAI-compatible proxy endpoints
await app.register(chatCompletionsRoutes, { prefix: '/v1' });
await app.register(modelsRoutes, { prefix: '/v1' });

// Documentation routes (OpenAPI spec + Swagger UI)
await app.register(docsRoutes);

// ─── WebSocket Server ────────────────────────────────────────────────────────

setupWebSocket(app.server);

// ─── Start ───────────────────────────────────────────────────────────────────

// ─── Background Workers ─────────────────────────────────────────────────────

interface WorkerHandle {
  close(): Promise<void>;
}

const workers: Array<{ name: string; worker: WorkerHandle }> = [];

async function startWorkers(): Promise<void> {
  try {
    const autoStop = startAutoStopWorker();
    workers.push({ name: 'auto-stop', worker: autoStop });
    app.log.info('Auto-stop worker started');
  } catch (err: unknown) {
    app.log.error({ err }, 'Failed to start auto-stop worker');
  }

  try {
    const reaper = startContainerReaperWorker();
    workers.push({ name: 'container-reaper', worker: reaper });
    app.log.info('Container reaper worker started');
  } catch (err: unknown) {
    app.log.error({ err }, 'Failed to start container reaper worker');
  }

  try {
    const monitor = startResourceMonitorWorker();
    workers.push({ name: 'resource-monitor', worker: monitor });
    app.log.info('Resource monitor worker started');
  } catch (err: unknown) {
    app.log.error({ err }, 'Failed to start resource monitor worker');
  }

  try {
    const lifecycle = startComputerLifecycleWorker();
    workers.push({ name: 'computer-lifecycle', worker: lifecycle });
    app.log.info('Computer lifecycle worker started');
  } catch (err: unknown) {
    app.log.error({ err }, 'Failed to start computer lifecycle worker');
  }
}

async function stopWorkers(): Promise<void> {
  for (const { name, worker } of workers) {
    try {
      await worker.close();
      app.log.info(`Worker ${name} stopped`);
    } catch (err: unknown) {
      app.log.error({ err }, `Failed to stop worker ${name}`);
    }
  }
}

async function start(): Promise<void> {
  try {
    await startWorkers();
    await app.listen({ port: config.port, host: config.host });
    app.log.info(`Server listening on ${config.host}:${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// ─── Graceful Shutdown ───────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  app.log.info(`Received ${signal}, shutting down gracefully...`);

  // Stop background workers
  await stopWorkers();

  // Stop accepting new connections
  await app.close();

  // Close BullMQ queues
  await closeQueues();

  // Disconnect Redis
  await disconnectRedis();

  // Close database connection pool
  await queryClient.end();

  app.log.info('Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
