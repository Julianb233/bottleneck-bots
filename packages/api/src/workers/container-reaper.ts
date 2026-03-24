import { Worker, Queue } from 'bullmq';
import Docker from 'dockerode';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { computers } from '../db/schema.js';
import { getRedis } from '../lib/redis.js';
import { forceRemoveContainer, pruneStoppedContainers, pruneImages, pruneNetworks } from '../lib/docker-cleanup.js';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const ORPHAN_GRACE_PERIOD_MS = 5 * 60 * 1000; // 5 minutes
const STALE_CREATING_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const STALE_STOPPING_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes
const STOPPED_CLEANUP_AGE_MS = 60 * 60 * 1000; // 1 hour
const IMAGE_PRUNE_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

/**
 * Full reconciliation cycle between Docker containers and the database.
 *
 * Steps:
 * 1. List Docker containers with label orgo.managed=true
 * 2. Query DB for computers with active statuses
 * 3. Reconcile: orphaned containers, ghost records, stale creating, stale stopping
 * 4. Cleanup: prune stopped containers > 1hr, prune dangling images weekly
 */
async function reaperCycle(): Promise<void> {
  const redis = getRedis();

  // ── Step 1: List all managed Docker containers ──
  const dockerContainers = await docker.listContainers({
    all: true,
    filters: { label: ['orgo.managed=true'] },
  });
  const dockerIds = new Set(dockerContainers.map((c) => c.Id));

  // ── Step 2: Get all active DB records ──
  const dbComputers = await db
    .select()
    .from(computers)
    .where(inArray(computers.status, ['running', 'creating', 'stopping', 'starting']));

  const dbContainerIds = new Set(
    dbComputers.filter((c) => c.containerId).map((c) => c.containerId!),
  );

  let orphaned = 0;
  let ghosts = 0;
  let stale = 0;
  let cleaned = 0;
  const now = Date.now();

  // ── Step 3a: Orphaned containers (in Docker, not in DB) ──
  // Uses Redis to track first-seen time for grace period
  for (const containerId of dockerIds) {
    if (!dbContainerIds.has(containerId)) {
      const key = `reaper:orphan:${containerId}`;
      const firstSeen = await redis.get(key);

      if (!firstSeen) {
        // First time seeing this orphan — start grace period
        await redis.set(key, now.toString(), 'EX', 600);
        orphaned++;
      } else if (now - parseInt(firstSeen, 10) > ORPHAN_GRACE_PERIOD_MS) {
        // Grace period exceeded — force remove
        console.log(`[reaper] Removing orphaned container ${containerId.slice(0, 12)}`);
        await forceRemoveContainer(containerId);
        await redis.del(key);
        cleaned++;
      } else {
        orphaned++;
      }
    }
  }

  // ── Step 3b: Ghost records (in DB, container missing from Docker) ──
  for (const computer of dbComputers) {
    if (computer.containerId && !dockerIds.has(computer.containerId)) {
      console.log(
        `[reaper] Ghost record: computer ${computer.id} — container ${computer.containerId.slice(0, 12)} missing`,
      );
      await db.update(computers).set({
        status: 'error',
        updatedAt: new Date(),
      }).where(eq(computers.id, computer.id));
      ghosts++;
    }

    // ── Step 3c: Stale creating (>5 minutes) ──
    if (
      computer.status === 'creating' &&
      now - computer.createdAt.getTime() > STALE_CREATING_THRESHOLD_MS
    ) {
      console.log(`[reaper] Stale creating: computer ${computer.id}`);
      if (computer.containerId) {
        await forceRemoveContainer(computer.containerId);
      }
      await db.update(computers).set({
        status: 'error',
        updatedAt: new Date(),
      }).where(eq(computers.id, computer.id));
      stale++;
    }

    // ── Step 3d: Stale stopping (>2 minutes) → force remove ──
    if (
      computer.status === 'stopping' &&
      now - computer.updatedAt.getTime() > STALE_STOPPING_THRESHOLD_MS
    ) {
      console.log(`[reaper] Stale stopping: computer ${computer.id}`);
      if (computer.containerId) {
        await forceRemoveContainer(computer.containerId);
      }
      await db.update(computers).set({
        status: 'stopped',
        stoppedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(computers.id, computer.id));
      stale++;
    }
  }

  // ── Step 4a: Cleanup stopped containers older than 1 hour ──
  const removedStopped = await pruneStoppedContainers(STOPPED_CLEANUP_AGE_MS);
  cleaned += removedStopped.length;

  // ── Step 4b: Prune dangling images weekly ──
  const lastPruneKey = 'reaper:last-image-prune';
  const lastPrune = await redis.get(lastPruneKey);
  if (!lastPrune || now - parseInt(lastPrune, 10) > IMAGE_PRUNE_INTERVAL_MS) {
    console.log('[reaper] Running weekly image and network prune');
    await pruneImages();
    await pruneNetworks();
    await redis.set(lastPruneKey, now.toString());
  }

  const running = dockerContainers.filter((c) => c.State === 'running').length;
  console.log(
    `Reaper cycle: ${running} running, ${orphaned} orphaned, ${cleaned} cleaned`,
  );
}

let reaperQueue: Queue | null = null;

export function startContainerReaperWorker(): Worker {
  const redis = getRedis();

  // Create repeatable job — runs every 60 seconds
  reaperQueue = new Queue('container-reaper', { connection: redis as any });
  reaperQueue.add('reap', {}, {
    repeat: { every: 60_000 },
  });

  const worker = new Worker('container-reaper', async () => {
    await reaperCycle();
  }, {
    connection: redis as any,
    concurrency: 1,
  });

  worker.on('failed', (_job, err) => {
    console.error(`[reaper] Cycle failed: ${err.message}`);
  });

  console.log('[container-reaper] Worker started — reconciling every 60s');
  return worker;
}

export async function stopContainerReaperWorker(worker: Worker): Promise<void> {
  await worker.close();
  if (reaperQueue) {
    await reaperQueue.close();
    reaperQueue = null;
  }
  console.log('[container-reaper] Worker stopped');
}

export { reaperCycle };
