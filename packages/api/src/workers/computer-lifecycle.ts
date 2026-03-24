import { Worker, type Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { computers } from '../db/schema.js';
import { DockerProvider } from '../lib/docker-provider.js';
import { transition } from '../lib/state-machine.js';
import { getRedis } from '../lib/redis.js';

const provider = new DockerProvider();

// ---------------------------------------------------------------------------
// Job data shape
// ---------------------------------------------------------------------------

interface LifecycleJob {
  computerId: string;
  action: 'create' | 'start' | 'stop' | 'destroy';
  spec?: {
    cpu?: number;
    ramMb?: number;
    diskGb?: number;
    gpu?: string;
    image?: string;
    resolution?: string;
  };
  containerId?: string;
}

// ---------------------------------------------------------------------------
// Job processor
// ---------------------------------------------------------------------------

async function processJob(job: Job<LifecycleJob>): Promise<void> {
  const { computerId, action, spec, containerId } = job.data;

  job.log(`Processing ${action} for computer ${computerId}`);

  try {
    switch (action) {
      case 'create': {
        const instance = await provider.create({
          cpu: spec?.cpu ?? 2,
          ramMb: spec?.ramMb ?? 4096,
          diskGb: spec?.diskGb ?? 10,
          gpu: spec?.gpu,
          image: spec?.image,
          env: spec?.resolution
            ? { RESOLUTION: spec.resolution }
            : undefined,
        });

        await db
          .update(computers)
          .set({
            containerId: instance.containerId,
            status: 'running',
            ipAddress: instance.ipAddress,
            vncPort: instance.vncPort,
            novncPort: instance.novncPort,
            updatedAt: new Date(),
            lastActivityAt: new Date(),
          })
          .where(eq(computers.id, computerId));

        job.log(
          `Computer ${computerId} created: container ${instance.containerId}`,
        );
        break;
      }

      case 'start': {
        if (!containerId) throw new Error('No container ID for start action');
        await provider.start(containerId);
        await transition(computerId, 'running');
        job.log(`Computer ${computerId} started`);
        break;
      }

      case 'stop': {
        if (!containerId) throw new Error('No container ID for stop action');
        await provider.stop(containerId);
        await transition(computerId, 'stopped');
        job.log(`Computer ${computerId} stopped`);
        break;
      }

      case 'destroy': {
        if (containerId) {
          await provider.destroy(containerId);
        }
        // Hard-delete the record
        await db.delete(computers).where(eq(computers.id, computerId));
        job.log(`Computer ${computerId} destroyed`);
        break;
      }

      default:
        throw new Error(`Unknown lifecycle action: ${action}`);
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown error';

    // Mark computer as error state with the failure message
    await db
      .update(computers)
      .set({
        status: 'error',
        updatedAt: new Date(),
      })
      .where(eq(computers.id, computerId));

    job.log(`Computer ${computerId} failed: ${message}`);

    // Re-throw so BullMQ handles retry with exponential backoff
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Worker factory
// ---------------------------------------------------------------------------

/**
 * Start the computer-lifecycle BullMQ worker.
 *
 * Retry policy: 3 attempts with exponential backoff (1s → 5s → 15s).
 */
export function startComputerLifecycleWorker(): Worker {
  const redis = getRedis();

  const worker = new Worker<LifecycleJob>('computer-lifecycle', processJob, {
    connection: redis,
    concurrency: 5,
  } as any);

  worker.on('completed', (job) => {
    console.log(
      `[lifecycle-worker] Job ${job.id} completed: ${job.data.action} ${job.data.computerId}`,
    );
  });

  worker.on('failed', (job, err) => {
    console.error(
      `[lifecycle-worker] Job ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts?.attempts ?? 3}): ${err.message}`,
    );
  });

  worker.on('error', (err) => {
    console.error('[lifecycle-worker] Worker error:', err.message);
  });

  return worker;
}
