import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../../db";
import {
  scheduledBrowserTasks,
  scheduledTaskExecutions,
  type ScheduledBrowserTask,
  type InsertScheduledBrowserTask,
} from "../../../drizzle/schema";
import { eq, and, desc, asc, gte, lte, count } from "drizzle-orm";
import { cronSchedulerService } from "../../services/cronScheduler.service";

/**
 * Calculate next run time for a cron expression
 * Uses cronSchedulerService which implements cron-parser
 */
function calculateNextRun(cronExpression: string, timezone: string): Date | null {
  return cronSchedulerService.getNextRunTime(cronExpression, timezone);
}

/**
 * Automation configuration schema for validation
 */
const automationConfigSchema = z.object({
  url: z.string().url(),
  instruction: z.string().optional(),
  actions: z.array(
    z.object({
      type: z.enum(["act", "observe", "extract"]),
      instruction: z.string(),
      selector: z.string().optional(),
    })
  ).optional(),
  browserConfig: z.object({
    headless: z.boolean().optional(),
    timeout: z.number().optional(),
    viewport: z.object({
      width: z.number(),
      height: z.number(),
    }).optional(),
  }).optional(),
  extractionSchema: z.record(z.string(), z.unknown()).optional(),
  successCriteria: z.string().optional(),
});

/**
 * Notification channel schema
 */
const notificationChannelSchema = z.object({
  type: z.enum(["email", "slack", "webhook"]),
  config: z.record(z.string(), z.unknown()),
});

/**
 * Scheduled Browser Automation Tasks Router
 * Provides complete CRUD operations for scheduled browser automation tasks
 */
export const scheduledTasksRouter = router({
  /**
   * List all scheduled tasks for the current user
   * Supports pagination, filtering by status, and sorting
   */
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
        status: z.enum(["active", "paused", "failed", "completed", "archived"]).optional(),
        sortBy: z.enum(["nextRun", "createdAt", "lastRun", "name"]).default("nextRun"),
        sortOrder: z.enum(["asc", "desc"]).default("asc"),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database connection not available",
        });
      }

      const offset = (input.page - 1) * input.pageSize;

      // Build where conditions
      const whereConditions = [
        eq(scheduledBrowserTasks.userId, ctx.user.id),
      ];

      if (input.status) {
        whereConditions.push(eq(scheduledBrowserTasks.status, input.status));
      }

      // Query tasks
      const sortColumn = {
        nextRun: scheduledBrowserTasks.nextRun,
        createdAt: scheduledBrowserTasks.createdAt,
        lastRun: scheduledBrowserTasks.lastRun,
        name: scheduledBrowserTasks.name,
      }[input.sortBy];

      const orderBy = input.sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

      const tasks = await db
        .select()
        .from(scheduledBrowserTasks)
        .where(and(...whereConditions))
        .orderBy(orderBy)
        .limit(input.pageSize)
        .offset(offset);

      // Get total count for pagination
      const [totalCountResult] = await db
        .select({ count: count(scheduledBrowserTasks.id) })
        .from(scheduledBrowserTasks)
        .where(and(...whereConditions));

      const totalCount = totalCountResult?.count || 0;
      const totalPages = Math.ceil(totalCount / input.pageSize);

      return {
        tasks,
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          totalCount,
          totalPages,
          hasNextPage: input.page < totalPages,
          hasPreviousPage: input.page > 1,
        },
      };
    }),

  /**
   * Get a single scheduled task by ID
   * Ensures user can only access their own tasks
   */
  getById: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database connection not available",
        });
      }

      const task = await db
        .select()
        .from(scheduledBrowserTasks)
        .where(
          and(
            eq(scheduledBrowserTasks.id, input.id),
            eq(scheduledBrowserTasks.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!task || task.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Task not found",
        });
      }

      return task[0];
    }),

  /**
   * Create a new scheduled task
   * Calculates initial nextRun time based on cron expression
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        automationType: z.enum(["chat", "observe", "extract", "workflow", "custom"]),
        automationConfig: automationConfigSchema,
        scheduleType: z.enum(["daily", "weekly", "monthly", "cron", "once"]),
        cronExpression: z.string().min(1),
        timezone: z.string().default("UTC"),
        retryOnFailure: z.boolean().default(true),
        maxRetries: z.number().int().min(0).max(10).default(3),
        retryDelay: z.number().int().min(1).default(60),
        timeout: z.number().int().min(10).max(3600).default(300),
        notifyOnSuccess: z.boolean().default(false),
        notifyOnFailure: z.boolean().default(true),
        notificationChannels: z.array(notificationChannelSchema).optional(),
        keepExecutionHistory: z.boolean().default(true),
        maxHistoryRecords: z.number().int().positive().optional().default(100),
        tags: z.array(z.string()).optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database connection not available",
        });
      }

      // Calculate initial nextRun time
      const nextRun = calculateNextRun(input.cronExpression, input.timezone);

      const newTask: InsertScheduledBrowserTask = {
        userId: ctx.user.id,
        name: input.name,
        description: input.description,
        automationType: input.automationType,
        automationConfig: input.automationConfig,
        scheduleType: input.scheduleType,
        cronExpression: input.cronExpression,
        timezone: input.timezone,
        status: "active",
        nextRun,
        executionCount: 0,
        successCount: 0,
        failureCount: 0,
        averageDuration: 0,
        retryOnFailure: input.retryOnFailure,
        maxRetries: input.maxRetries,
        retryDelay: input.retryDelay,
        timeout: input.timeout,
        notifyOnSuccess: input.notifyOnSuccess,
        notifyOnFailure: input.notifyOnFailure,
        notificationChannels: input.notificationChannels || null,
        keepExecutionHistory: input.keepExecutionHistory,
        maxHistoryRecords: input.maxHistoryRecords,
        tags: input.tags || null,
        metadata: input.metadata || null,
        isActive: true,
        createdBy: ctx.user.id,
        lastModifiedBy: ctx.user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await db
        .insert(scheduledBrowserTasks)
        .values(newTask)
        .returning();

      return {
        success: true,
        task: result[0],
        message: `Task "${input.name}" created successfully`,
      };
    }),

  /**
   * Update an existing scheduled task
   * Recalculates nextRun if cron expression or timezone changes
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        automationType: z.enum(["chat", "observe", "extract", "workflow", "custom"]).optional(),
        automationConfig: automationConfigSchema.optional(),
        scheduleType: z.enum(["daily", "weekly", "monthly", "cron", "once"]).optional(),
        cronExpression: z.string().min(1).optional(),
        timezone: z.string().optional(),
        retryOnFailure: z.boolean().optional(),
        maxRetries: z.number().int().min(0).max(10).optional(),
        retryDelay: z.number().int().min(1).optional(),
        timeout: z.number().int().min(10).max(3600).optional(),
        notifyOnSuccess: z.boolean().optional(),
        notifyOnFailure: z.boolean().optional(),
        notificationChannels: z.array(notificationChannelSchema).optional(),
        keepExecutionHistory: z.boolean().optional(),
        maxHistoryRecords: z.number().int().positive().optional(),
        tags: z.array(z.string()).optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database connection not available",
        });
      }

      // Verify task exists and belongs to user
      const existingTask = await db
        .select()
        .from(scheduledBrowserTasks)
        .where(
          and(
            eq(scheduledBrowserTasks.id, input.id),
            eq(scheduledBrowserTasks.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existingTask || existingTask.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Task not found",
        });
      }

      const task = existingTask[0];

      // Build update object
      const updateData: Partial<InsertScheduledBrowserTask> = {
        updatedAt: new Date(),
        lastModifiedBy: ctx.user.id,
      };

      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.automationType !== undefined) updateData.automationType = input.automationType;
      if (input.automationConfig !== undefined) updateData.automationConfig = input.automationConfig;
      if (input.scheduleType !== undefined) updateData.scheduleType = input.scheduleType;
      if (input.cronExpression !== undefined) updateData.cronExpression = input.cronExpression;
      if (input.timezone !== undefined) updateData.timezone = input.timezone;
      if (input.retryOnFailure !== undefined) updateData.retryOnFailure = input.retryOnFailure;
      if (input.maxRetries !== undefined) updateData.maxRetries = input.maxRetries;
      if (input.retryDelay !== undefined) updateData.retryDelay = input.retryDelay;
      if (input.timeout !== undefined) updateData.timeout = input.timeout;
      if (input.notifyOnSuccess !== undefined) updateData.notifyOnSuccess = input.notifyOnSuccess;
      if (input.notifyOnFailure !== undefined) updateData.notifyOnFailure = input.notifyOnFailure;
      if (input.notificationChannels !== undefined) updateData.notificationChannels = input.notificationChannels;
      if (input.keepExecutionHistory !== undefined) updateData.keepExecutionHistory = input.keepExecutionHistory;
      if (input.maxHistoryRecords !== undefined) updateData.maxHistoryRecords = input.maxHistoryRecords;
      if (input.tags !== undefined) updateData.tags = input.tags;
      if (input.metadata !== undefined) updateData.metadata = input.metadata;

      // Recalculate nextRun if cron expression or timezone changed
      if (input.cronExpression || input.timezone) {
        const cronExpression = input.cronExpression || task.cronExpression;
        const timezone = input.timezone || task.timezone;
        updateData.nextRun = calculateNextRun(cronExpression, timezone);
      }

      const result = await db
        .update(scheduledBrowserTasks)
        .set(updateData)
        .where(eq(scheduledBrowserTasks.id, input.id))
        .returning();

      return {
        success: true,
        task: result[0],
        message: "Task updated successfully",
      };
    }),

  /**
   * Delete a task (soft delete by setting status to archived)
   */
  delete: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database connection not available",
        });
      }

      // Verify task exists and belongs to user
      const existingTask = await db
        .select()
        .from(scheduledBrowserTasks)
        .where(
          and(
            eq(scheduledBrowserTasks.id, input.id),
            eq(scheduledBrowserTasks.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existingTask || existingTask.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Task not found",
        });
      }

      await db
        .update(scheduledBrowserTasks)
        .set({
          status: "archived",
          isActive: false,
          updatedAt: new Date(),
          lastModifiedBy: ctx.user.id,
        })
        .where(eq(scheduledBrowserTasks.id, input.id));

      return {
        success: true,
        message: "Task archived successfully",
      };
    }),

  /**
   * Pause a task
   * Prevents task from being executed until resumed
   */
  pause: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database connection not available",
        });
      }

      // Verify task exists and belongs to user
      const existingTask = await db
        .select()
        .from(scheduledBrowserTasks)
        .where(
          and(
            eq(scheduledBrowserTasks.id, input.id),
            eq(scheduledBrowserTasks.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existingTask || existingTask.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Task not found",
        });
      }

      if (existingTask[0].status === "paused") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Task is already paused",
        });
      }

      const result = await db
        .update(scheduledBrowserTasks)
        .set({
          status: "paused",
          updatedAt: new Date(),
          lastModifiedBy: ctx.user.id,
        })
        .where(eq(scheduledBrowserTasks.id, input.id))
        .returning();

      return {
        success: true,
        task: result[0],
        message: "Task paused successfully",
      };
    }),

  /**
   * Resume a paused task
   * Recalculates nextRun time to resume scheduled execution
   */
  resume: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database connection not available",
        });
      }

      // Verify task exists and belongs to user
      const existingTask = await db
        .select()
        .from(scheduledBrowserTasks)
        .where(
          and(
            eq(scheduledBrowserTasks.id, input.id),
            eq(scheduledBrowserTasks.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existingTask || existingTask.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Task not found",
        });
      }

      if (existingTask[0].status !== "paused") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Task is not paused",
        });
      }

      const task = existingTask[0];
      const nextRun = calculateNextRun(task.cronExpression, task.timezone);

      const result = await db
        .update(scheduledBrowserTasks)
        .set({
          status: "active",
          nextRun,
          updatedAt: new Date(),
          lastModifiedBy: ctx.user.id,
        })
        .where(eq(scheduledBrowserTasks.id, input.id))
        .returning();

      return {
        success: true,
        task: result[0],
        message: "Task resumed successfully",
      };
    }),

  /**
   * Manually trigger task execution immediately
   * Creates a manual execution entry in the execution history
   */
  executeNow: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database connection not available",
        });
      }

      // Verify task exists and belongs to user
      const existingTask = await db
        .select()
        .from(scheduledBrowserTasks)
        .where(
          and(
            eq(scheduledBrowserTasks.id, input.id),
            eq(scheduledBrowserTasks.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existingTask || existingTask.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Task not found",
        });
      }

      const task = existingTask[0];

      // Create execution record with queued status
      const execution = await db
        .insert(scheduledTaskExecutions)
        .values({
          taskId: task.id,
          status: "queued",
          triggerType: "manual",
          attemptNumber: 1,
          startedAt: new Date(),
          logs: [],
        })
        .returning();

      // Queue the task for execution via BullMQ (falls back to direct execution)
      try {
        const { addScheduledTaskJob, REDIS_AVAILABLE } = await import("../../_core/queue");

        if (REDIS_AVAILABLE) {
          await addScheduledTaskJob({
            userId: ctx.user.id,
            taskId: task.id,
            executionId: execution[0].id,
            automationType: task.automationType,
            automationConfig: task.automationConfig as Record<string, any>,
            timeout: task.timeout,
            attemptNumber: 1,
          });
        } else {
          // Direct execution fallback when Redis is not available
          const { schedulerRunnerService } = await import("../../services/schedulerRunner.service");
          // Fire and forget - the runner handles status updates
          schedulerRunnerService.executeTaskById(task.id, execution[0].id);
        }
      } catch (queueError) {
        console.error("Failed to queue scheduled task:", queueError);
        // Still return success - execution record was created
      }

      return {
        success: true,
        execution: execution[0],
        message: "Task execution queued successfully",
      };
    }),

  /**
   * Get execution history for a task
   * Returns paginated list of all execution attempts
   */
  getExecutionHistory: protectedProcedure
    .input(
      z.object({
        taskId: z.number().int().positive(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
        status: z.enum(["queued", "running", "success", "failed", "timeout", "cancelled"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database connection not available",
        });
      }

      // Verify task belongs to user
      const task = await db
        .select()
        .from(scheduledBrowserTasks)
        .where(
          and(
            eq(scheduledBrowserTasks.id, input.taskId),
            eq(scheduledBrowserTasks.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!task || task.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Task not found",
        });
      }

      const offset = (input.page - 1) * input.pageSize;

      // Build where conditions
      const whereConditions = [
        eq(scheduledTaskExecutions.taskId, input.taskId),
      ];

      if (input.status) {
        whereConditions.push(eq(scheduledTaskExecutions.status, input.status));
      }

      // Query executions
      const executions = await db
        .select()
        .from(scheduledTaskExecutions)
        .where(and(...whereConditions))
        .orderBy(desc(scheduledTaskExecutions.startedAt))
        .limit(input.pageSize)
        .offset(offset);

      // Get total count
      const [totalCountResult] = await db
        .select({ count: count(scheduledTaskExecutions.id) })
        .from(scheduledTaskExecutions)
        .where(and(...whereConditions));

      const totalCount = totalCountResult?.count || 0;
      const totalPages = Math.ceil(totalCount / input.pageSize);

      return {
        executions,
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          totalCount,
          totalPages,
          hasNextPage: input.page < totalPages,
          hasPreviousPage: input.page > 1,
        },
      };
    }),

  /**
   * Get upcoming scheduled executions
   * Returns tasks scheduled to run within a specified time window
   */
  getUpcoming: protectedProcedure
    .input(
      z.object({
        hours: z.number().min(1).max(168).default(24), // Max 7 days
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database connection not available",
        });
      }

      const now = new Date();
      const futureTime = new Date(now.getTime() + input.hours * 60 * 60 * 1000);

      const upcomingTasks = await db
        .select()
        .from(scheduledBrowserTasks)
        .where(
          and(
            eq(scheduledBrowserTasks.userId, ctx.user.id),
            eq(scheduledBrowserTasks.status, "active"),
            gte(scheduledBrowserTasks.nextRun, now),
            lte(scheduledBrowserTasks.nextRun, futureTime)
          )
        )
        .orderBy(asc(scheduledBrowserTasks.nextRun));

      return {
        tasks: upcomingTasks,
        timeWindow: {
          start: now,
          end: futureTime,
          hours: input.hours,
        },
      };
    }),

  /**
   * Get task statistics
   * Returns execution statistics for a specific task
   */
  getStatistics: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database connection not available",
        });
      }

      // Verify task exists and belongs to user
      const task = await db
        .select()
        .from(scheduledBrowserTasks)
        .where(
          and(
            eq(scheduledBrowserTasks.id, input.id),
            eq(scheduledBrowserTasks.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!task || task.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Task not found",
        });
      }

      return {
        executionCount: task[0].executionCount,
        successCount: task[0].successCount,
        failureCount: task[0].failureCount,
        successRate: task[0].executionCount > 0
          ? (task[0].successCount / task[0].executionCount) * 100
          : 0,
        averageDuration: task[0].averageDuration,
        lastRun: task[0].lastRun,
        lastRunStatus: task[0].lastRunStatus,
        lastRunError: task[0].lastRunError,
        lastRunDuration: task[0].lastRunDuration,
        nextRun: task[0].nextRun,
      };
    }),

  /**
   * Validate a cron expression and return human-readable description
   */
  validateCron: protectedProcedure
    .input(z.object({
      cronExpression: z.string().min(1),
      timezone: z.string().default("UTC"),
    }))
    .query(({ input }) => {
      const validation = cronSchedulerService.validateCronExpression(input.cronExpression);
      if (!validation.valid) {
        return {
          valid: false,
          error: validation.error,
          description: null,
          nextRuns: [] as Date[],
        };
      }

      const description = cronSchedulerService.describeCronExpression(input.cronExpression);
      const nextRuns = cronSchedulerService.getNextNRunTimes(input.cronExpression, 5, input.timezone);

      return {
        valid: true,
        error: undefined as string | undefined,
        description,
        nextRuns,
      };
    }),

  /**
   * Convert schedule type + config to cron expression
   */
  buildCronExpression: protectedProcedure
    .input(z.object({
      scheduleType: z.enum(["daily", "weekly", "monthly", "custom"]),
      hour: z.number().min(0).max(23).default(0),
      minute: z.number().min(0).max(59).default(0),
      dayOfWeek: z.number().min(0).max(6).optional(),
      dayOfMonth: z.number().min(1).max(31).optional(),
    }))
    .query(({ input }) => {
      const cronExpression = cronSchedulerService.scheduleTypeToCron(input.scheduleType, {
        hour: input.hour,
        minute: input.minute,
        dayOfWeek: input.dayOfWeek,
        dayOfMonth: input.dayOfMonth,
      });

      const description = cronSchedulerService.describeCronExpression(cronExpression);
      const nextRuns = cronSchedulerService.getNextNRunTimes(cronExpression, 5, "UTC");

      return {
        cronExpression,
        description,
        nextRuns,
      };
    }),

  /**
   * Get scheduler status and statistics
   */
  getSchedulerStatus: protectedProcedure
    .query(async () => {
      // Import dynamically to avoid circular deps
      const { schedulerRunnerService } = await import("../../services/schedulerRunner.service");
      const stats = schedulerRunnerService.getStats();
      const isRunning = schedulerRunnerService.isSchedulerRunning();

      return {
        isRunning,
        ...stats,
      };
    }),

  /**
   * Duplicate an existing scheduled task
   */
  duplicate: protectedProcedure
    .input(z.object({
      taskId: z.number().int(),
      newName: z.string().min(1).max(200).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Get original task
      const [original] = await db
        .select()
        .from(scheduledBrowserTasks)
        .where(and(
          eq(scheduledBrowserTasks.id, input.taskId),
          eq(scheduledBrowserTasks.userId, ctx.user.id)
        ))
        .limit(1);

      if (!original) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      const nextRun = calculateNextRun(original.cronExpression, original.timezone);

      const [duplicate] = await db
        .insert(scheduledBrowserTasks)
        .values({
          userId: ctx.user.id,
          name: input.newName || `${original.name} (copy)`,
          description: original.description,
          cronExpression: original.cronExpression,
          timezone: original.timezone,
          scheduleType: original.scheduleType,
          automationConfig: original.automationConfig,
          isActive: false, // Start inactive so user can review before enabling
          status: "paused",
          nextRun,
          retryOnFailure: original.retryOnFailure,
          maxRetries: original.maxRetries,
          retryDelay: original.retryDelay,
          timeout: original.timeout,
          tags: original.tags,
          priority: original.priority,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return duplicate;
    }),

  /**
   * Get next N run times for a scheduled task
   */
  getNextRuns: protectedProcedure
    .input(z.object({
      taskId: z.number().int(),
      count: z.number().int().min(1).max(20).default(5),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const [task] = await db
        .select()
        .from(scheduledBrowserTasks)
        .where(and(
          eq(scheduledBrowserTasks.id, input.taskId),
          eq(scheduledBrowserTasks.userId, ctx.user.id)
        ))
        .limit(1);

      if (!task) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      const runs = cronSchedulerService.getNextNRunTimes(
        task.cronExpression,
        input.count,
        task.timezone
      );

      return {
        taskId: task.id,
        cronExpression: task.cronExpression,
        timezone: task.timezone,
        description: cronSchedulerService.describeCronExpression(task.cronExpression),
        nextRuns: runs.map(r => r.toISOString()),
      };
    }),

  /**
   * Bulk toggle (enable/disable) multiple scheduled tasks
   */
  bulkToggle: protectedProcedure
    .input(z.object({
      taskIds: z.array(z.number().int()).min(1).max(50),
      isActive: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      let updated = 0;
      for (const taskId of input.taskIds) {
        const [task] = await db
          .select()
          .from(scheduledBrowserTasks)
          .where(and(
            eq(scheduledBrowserTasks.id, taskId),
            eq(scheduledBrowserTasks.userId, ctx.user.id)
          ))
          .limit(1);

        if (!task) continue;

        const nextRun = input.isActive
          ? calculateNextRun(task.cronExpression, task.timezone)
          : null;

        await db
          .update(scheduledBrowserTasks)
          .set({
            isActive: input.isActive,
            status: input.isActive ? "active" : "paused",
            nextRun,
            updatedAt: new Date(),
          })
          .where(eq(scheduledBrowserTasks.id, taskId));

        updated++;
      }

      return {
        success: true,
        updated,
        message: `${updated} task(s) ${input.isActive ? 'enabled' : 'disabled'}`,
      };
    }),

  /**
   * Get failure report for a scheduled task
   * Analyzes recent failures and provides summary
   */
  getFailureReport: protectedProcedure
    .input(z.object({
      taskId: z.number().int(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Verify ownership
      const [task] = await db
        .select()
        .from(scheduledBrowserTasks)
        .where(and(
          eq(scheduledBrowserTasks.id, input.taskId),
          eq(scheduledBrowserTasks.userId, ctx.user.id)
        ))
        .limit(1);

      if (!task) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      // Get recent executions (last 30)
      const executions = await db
        .select()
        .from(scheduledTaskExecutions)
        .where(eq(scheduledTaskExecutions.taskId, input.taskId))
        .orderBy(desc(scheduledTaskExecutions.startedAt))
        .limit(30);

      const totalRuns = executions.length;
      const failures = executions.filter(e => e.status === "failed");
      const successes = executions.filter(e => e.status === "completed");

      // Collect failure reasons
      const failureReasons: Record<string, number> = {};
      for (const failure of failures) {
        const reason = (failure.error as string) || "Unknown error";
        // Truncate to first 100 chars for grouping
        const key = reason.substring(0, 100);
        failureReasons[key] = (failureReasons[key] || 0) + 1;
      }

      // Calculate average duration for successful runs
      const durations = successes
        .filter(e => e.startedAt && e.completedAt)
        .map(e => new Date(e.completedAt!).getTime() - new Date(e.startedAt).getTime());
      const avgDuration = durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 1000)
        : 0;

      // Recent failure streak
      let failureStreak = 0;
      for (const exec of executions) {
        if (exec.status === "failed") failureStreak++;
        else break;
      }

      return {
        taskId: input.taskId,
        taskName: task.name,
        totalRuns,
        totalFailures: failures.length,
        totalSuccesses: successes.length,
        successRate: totalRuns > 0 ? Math.round((successes.length / totalRuns) * 100) : 0,
        averageDurationSeconds: avgDuration,
        currentFailureStreak: failureStreak,
        topFailureReasons: Object.entries(failureReasons)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([reason, count]) => ({ reason, count })),
        lastSuccess: successes[0]?.completedAt || null,
        lastFailure: failures[0]?.startedAt || null,
      };
    }),
});
