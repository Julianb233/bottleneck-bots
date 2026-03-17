/**
 * Scheduled Task Worker
 * Processes scheduled browser automation tasks from BullMQ queue
 */

import { Worker, Job } from "bullmq";
import type { ScheduledTaskJobData } from "../_core/queue";
import { getDb } from "../db";
import { eq } from "drizzle-orm";
import { scheduledBrowserTasks, scheduledTaskExecutions } from "../../drizzle/schema-scheduled-tasks";

// Parse Redis connection
function getRedisConnection() {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const url = new URL(redisUrl);
    const isTls = url.protocol === "rediss:";
    return {
      host: url.hostname,
      port: parseInt(url.port) || 6379,
      password: url.password || undefined,
      username: url.username || undefined,
      tls: isTls ? {} : undefined,
    };
  }

  if (process.env.REDIS_HOST) {
    return {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD,
      username: process.env.REDIS_USERNAME,
      tls: process.env.REDIS_TLS === "true" ? {} : undefined,
    };
  }

  return null;
}

async function processScheduledTask(job: Job<ScheduledTaskJobData>): Promise<any> {
  const { taskId, executionId, automationType, automationConfig, timeout } = job.data;
  const startTime = new Date();

  console.log(`[ScheduledTaskWorker] Processing task ${taskId}, execution ${executionId}`);

  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Update execution status to running
  await db
    .update(scheduledTaskExecutions)
    .set({
      status: "running",
      startedAt: startTime,
    })
    .where(eq(scheduledTaskExecutions.id, executionId));

  try {
    // Execute based on automation type
    let result: { success: boolean; output?: any; error?: string };

    switch (automationType) {
      case "chat":
      case "observe":
      case "extract":
      case "workflow":
      case "custom": {
        // Use the scheduler runner service for browser automation
        const { schedulerRunnerService } = await import("../services/schedulerRunner.service");
        await schedulerRunnerService.executeTaskById(taskId, executionId);
        // The runner handles all status updates
        return { success: true };
      }

      default:
        result = {
          success: false,
          error: `Unsupported automation type: ${automationType}`,
        };
    }

    const duration = Date.now() - startTime.getTime();

    // Update execution record
    await db
      .update(scheduledTaskExecutions)
      .set({
        status: result.success ? "success" : "failed",
        output: result.output,
        error: result.error,
        duration,
        completedAt: new Date(),
      })
      .where(eq(scheduledTaskExecutions.id, executionId));

    // Update task statistics
    const [task] = await db
      .select()
      .from(scheduledBrowserTasks)
      .where(eq(scheduledBrowserTasks.id, taskId))
      .limit(1);

    if (task) {
      const newExecutionCount = task.executionCount + 1;
      const newSuccessCount = task.successCount + (result.success ? 1 : 0);
      const newFailureCount = task.failureCount + (result.success ? 0 : 1);
      const newAverageDuration = Math.round(
        (task.averageDuration * task.executionCount + duration) / newExecutionCount
      );

      await db
        .update(scheduledBrowserTasks)
        .set({
          lastRun: startTime,
          lastRunStatus: result.success ? "success" : "failed",
          lastRunError: result.error || null,
          lastRunDuration: duration,
          executionCount: newExecutionCount,
          successCount: newSuccessCount,
          failureCount: newFailureCount,
          averageDuration: newAverageDuration,
          updatedAt: new Date(),
        })
        .where(eq(scheduledBrowserTasks.id, taskId));
    }

    if (!result.success) {
      throw new Error(result.error || "Task execution failed");
    }

    return result;
  } catch (error) {
    const duration = Date.now() - startTime.getTime();
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Update execution record on failure
    await db
      .update(scheduledTaskExecutions)
      .set({
        status: "failed",
        error: errorMessage,
        duration,
        completedAt: new Date(),
      })
      .where(eq(scheduledTaskExecutions.id, executionId));

    // Update task record
    await db
      .update(scheduledBrowserTasks)
      .set({
        lastRun: startTime,
        lastRunStatus: "failed",
        lastRunError: errorMessage,
        lastRunDuration: duration,
        updatedAt: new Date(),
      })
      .where(eq(scheduledBrowserTasks.id, taskId));

    throw error;
  }
}

export function createScheduledTaskWorker() {
  const connection = getRedisConnection();
  if (!connection) {
    console.warn("[ScheduledTaskWorker] Redis not configured, worker not started");
    return null;
  }

  const worker = new Worker<ScheduledTaskJobData>(
    "scheduled-task",
    processScheduledTask,
    {
      connection,
      concurrency: 3,
      limiter: {
        max: 10,
        duration: 60000, // Max 10 jobs per minute
      },
    }
  );

  worker.on("completed", (job) => {
    console.log(`[ScheduledTaskWorker] Job ${job.id} completed for task ${job.data.taskId}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[ScheduledTaskWorker] Job ${job?.id} failed:`, err.message);
  });

  worker.on("error", (err) => {
    console.error("[ScheduledTaskWorker] Worker error:", err);
  });

  console.log("[ScheduledTaskWorker] Worker started");
  return worker;
}
