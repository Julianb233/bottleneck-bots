import { Worker, Queue } from 'bullmq';
import Docker from 'dockerode';
import { execSync } from 'node:child_process';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { hosts } from '../db/schema.js';
import { getRedis } from '../lib/redis.js';
import { getContainerStats } from '../lib/docker-cleanup.js';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const METRICS_TTL = 120; // 2 minute TTL for metrics keys

/**
 * Collects host-level and per-container metrics, stores them in Redis,
 * and fires console warnings when thresholds are breached.
 *
 * Runs every 30 seconds via a BullMQ repeatable job.
 */
async function collectMetrics(): Promise<void> {
  const redis = getRedis();

  // ── Host-level metrics via Docker info ──
  const info = await docker.info();
  const totalMemoryBytes = info.MemTotal || 0;
  const containersRunning = info.ContainersRunning || 0;

  // ── Per-container stats ──
  const stats = await getContainerStats();

  const totalCpuPercent = stats.reduce((sum, s) => sum + s.cpu, 0);
  const totalMemoryUsed = stats.reduce((sum, s) => sum + s.memory, 0);
  const memPercent = totalMemoryBytes > 0
    ? (totalMemoryUsed / totalMemoryBytes) * 100
    : 0;

  // ── Disk usage (from host filesystem) ──
  let diskUsedGb = 0;
  let diskTotalGb = 0;
  let diskPercent = 0;
  try {
    // Use df on the root partition
    const dfOutput = execSync("df -BG / | tail -1 | awk '{print $2, $3, $5}'", {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();
    const parts = dfOutput.split(/\s+/);
    diskTotalGb = parseInt(parts[0] ?? '0', 10) || 0;
    diskUsedGb = parseInt(parts[1] ?? '0', 10) || 0;
    diskPercent = parseInt(parts[2] ?? '0', 10) || 0;
  } catch {
    // Non-fatal — disk metrics just won't be available
  }

  // ── Store host metrics in Redis ──
  const pipe = redis.pipeline();
  pipe.set('metrics:host:cpu', totalCpuPercent.toFixed(2), 'EX', METRICS_TTL);
  pipe.set('metrics:host:memory', memPercent.toFixed(2), 'EX', METRICS_TTL);
  pipe.set('metrics:host:containers', containersRunning.toString(), 'EX', METRICS_TTL);
  pipe.set('metrics:host:disk', JSON.stringify({
    usedGb: diskUsedGb,
    totalGb: diskTotalGb,
    percent: diskPercent,
  }), 'EX', METRICS_TTL);

  // ── Store per-container metrics ──
  for (const s of stats) {
    pipe.set(
      `metrics:container:${s.id}:cpu`,
      s.cpu.toFixed(2),
      'EX',
      METRICS_TTL,
    );
    pipe.set(
      `metrics:container:${s.id}:memory`,
      s.memory.toString(),
      'EX',
      METRICS_TTL,
    );
  }

  await pipe.exec();

  // ── Update hosts table ──
  try {
    const [host] = await db.select().from(hosts).limit(1);
    if (host) {
      const cpuCores = info.NCPU || 1;
      const usedCpuCores = Math.round((totalCpuPercent / 100) * cpuCores);
      const usedRamMb = Math.round(totalMemoryUsed / (1024 * 1024));

      await db.update(hosts).set({
        availableCpu: Math.max(0, host.totalCpu - usedCpuCores),
        availableRam: Math.max(0, host.totalRam - usedRamMb),
        lastHeartbeatAt: new Date(),
      }).where(eq(hosts.id, host.id));
    }
  } catch (err: any) {
    console.error(`[resource-monitor] Failed to update hosts table: ${err.message}`);
  }

  // ── Alert checks ──
  if (memPercent > 85) {
    console.warn(
      `[resource-monitor] ALERT: Host memory at ${memPercent.toFixed(1)}% — threshold 85%`,
    );
  }

  if (diskPercent > 70) {
    console.warn(
      `[resource-monitor] ALERT: Disk usage at ${diskPercent}% (${diskUsedGb}/${diskTotalGb} GB) — threshold 70%`,
    );
  }
}

let monitorQueue: Queue | null = null;

export function startResourceMonitorWorker(): Worker {
  const redis = getRedis();

  // Create repeatable job — runs every 30 seconds
  monitorQueue = new Queue('resource-monitor', { connection: redis as any });
  monitorQueue.add('collect', {}, {
    repeat: { every: 30_000 },
  });

  const worker = new Worker('resource-monitor', async () => {
    await collectMetrics();
  }, {
    connection: redis as any,
    concurrency: 1,
  });

  worker.on('failed', (_job, err) => {
    console.error(`[resource-monitor] Collection failed: ${err.message}`);
  });

  console.log('[resource-monitor] Worker started — collecting every 30s');
  return worker;
}

export async function stopResourceMonitorWorker(worker: Worker): Promise<void> {
  await worker.close();
  if (monitorQueue) {
    await monitorQueue.close();
    monitorQueue = null;
  }
  console.log('[resource-monitor] Worker stopped');
}
