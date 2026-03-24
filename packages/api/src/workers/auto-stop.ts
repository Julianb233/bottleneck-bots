import { Worker, Queue } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { computers } from '../db/schema.js';
import { getRedis } from '../lib/redis.js';
import { getComputerLifecycleQueue } from '../lib/queue.js';

const DEFAULT_IDLE_MINUTES = 30;

/**
 * Checks all running computers for inactivity and enqueues stop jobs
 * for those that have exceeded their auto_stop_minutes threshold.
 */
async function checkIdleComputers(): Promise<void> {
  const lifecycleQueue = getComputerLifecycleQueue();

  // Find all running computers
  const running = await db
    .select()
    .from(computers)
    .where(eq(computers.status, 'running'));

  const now = Date.now();
  let stoppedCount = 0;

  for (const computer of running) {
    // Use the DB column auto_stop_minutes; default 30 if not set
    const autoStopMinutes = computer.autoStopMinutes ?? DEFAULT_IDLE_MINUTES;

    // Skip if auto-stop is disabled (0 = disabled)
    if (autoStopMinutes === 0) continue;

    // Use lastActivityAt if available, otherwise fall back to createdAt
    const lastActivity = computer.lastActivityAt?.getTime() || computer.createdAt.getTime();
    const idleMs = now - lastActivity;
    const idleMinutes = idleMs / 60000;

    if (idleMinutes >= autoStopMinutes) {
      console.log(
        `Auto-stopping computer ${computer.id} after ${Math.round(idleMinutes)}m of inactivity`,
      );

      // Transition to stopping state
      await db.update(computers).set({
        status: 'stopping',
        updatedAt: new Date(),
      }).where(eq(computers.id, computer.id));

      // Enqueue lifecycle stop job
      await lifecycleQueue.add('stop', {
        computerId: computer.id,
        action: 'stop',
        containerId: computer.containerId,
        reason: 'auto-stop-idle',
      });

      stoppedCount++;
    }
  }

  if (stoppedCount > 0) {
    console.log(`[auto-stop] Cycle complete: ${stoppedCount} computer(s) stopped`);
  }
}

let autoStopQueue: Queue | null = null;

export function startAutoStopWorker(): Worker {
  const redis = getRedis();

  // Create repeatable job queue — runs every 60 seconds
  autoStopQueue = new Queue('auto-stop', { connection: redis as any });
  autoStopQueue.add('check-idle', {}, {
    repeat: { every: 60_000 },
  });

  const worker = new Worker('auto-stop', async () => {
    await checkIdleComputers();
  }, {
    connection: redis as any,
    concurrency: 1,
  });

  worker.on('failed', (_job, err) => {
    console.error(`[auto-stop] Check failed: ${err.message}`);
  });

  console.log('[auto-stop] Worker started — checking every 60s');
  return worker;
}

export async function stopAutoStopWorker(worker: Worker): Promise<void> {
  await worker.close();
  if (autoStopQueue) {
    await autoStopQueue.close();
    autoStopQueue = null;
  }
  console.log('[auto-stop] Worker stopped');
}
