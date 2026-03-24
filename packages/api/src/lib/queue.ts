import { Queue } from 'bullmq';
import { createBullMQConnection } from './redis.js';

const connection = createBullMQConnection();

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 1000,
  },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 },
};

/**
 * Handles computer creation, start, stop, and destroy operations.
 */
export const computerLifecycleQueue = new Queue('computer-lifecycle', {
  connection: connection as any,
  defaultJobOptions,
});

/**
 * Periodically checks for idle computers and stops them
 * after their auto_stop_minutes threshold is exceeded.
 */
export const computerReaperQueue = new Queue('computer-reaper', {
  connection: connection as any,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 1,
  },
});

/**
 * Returns the computer-lifecycle queue instance.
 * Convenience accessor used by route handlers and workers.
 */
export function getComputerLifecycleQueue(): Queue {
  return computerLifecycleQueue;
}

export async function closeQueues(): Promise<void> {
  await Promise.all([
    computerLifecycleQueue.close(),
    computerReaperQueue.close(),
  ]);
  connection.disconnect();
}
