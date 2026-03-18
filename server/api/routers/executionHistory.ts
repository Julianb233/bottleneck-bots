import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";
import { TRPCError } from "@trpc/server";
<<<<<<< HEAD
import { getDb } from "../../db";
import { eq, and, desc, gte, lte, sql, count } from "drizzle-orm";
import { taskExecutions, agencyTasks } from "../../../drizzle/schema-webhooks";
import { getExecutionRetryService } from "../../services/executionRetry.service";
import { classifyError, getErrorMetadata, isErrorRetryable } from "../../lib/errorTypes";

/**
 * Execution History Router
 *
 * Provides comprehensive execution history queries, detail views,
 * and export capabilities for the Execution History page.
 */

// ========================================
// INPUT SCHEMAS
// ========================================

const listSchema = z.object({
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).default(0),
  status: z
    .enum(["started", "running", "success", "failed", "timeout", "cancelled", "needs_input"])
    .optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  taskType: z.string().optional(),
  search: z.string().optional(),
});

const detailSchema = z.object({
  executionId: z.number().int().positive(),
});

const exportSchema = z.object({
=======
import { eq, and, desc, asc, inArray, gte, lte, count, sql, like } from "drizzle-orm";
import {
  agencyTasks,
  taskExecutions,
} from "../../../drizzle/schema-webhooks";
import { requireDb, withTrpcErrorHandling } from "../../_core/dbHelper";

// ========================================
// VALIDATION SCHEMAS
// ========================================

const listExecutionsSchema = z.object({
  status: z.enum(["started", "running", "success", "failed", "timeout", "cancelled", "needs_input"]).optional(),
  statuses: z.array(z.enum(["started", "running", "success", "failed", "timeout", "cancelled", "needs_input"])).optional(),
  taskType: z.string().optional(),
  triggeredBy: z.enum(["automatic", "manual", "retry", "scheduled"]).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  search: z.string().optional(),
  sortBy: z.enum(["startedAt", "duration", "status"]).default("startedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

const getExecutionDetailSchema = z.object({
>>>>>>> worktree-agent-a1a2bb04
  executionId: z.number().int().positive(),
});

// ========================================
<<<<<<< HEAD
// ROUTER
=======
// EXECUTION HISTORY ROUTER
>>>>>>> worktree-agent-a1a2bb04
// ========================================

export const executionHistoryRouter = router({
  /**
<<<<<<< HEAD
   * List executions with filters, search, and pagination
   */
  list: protectedProcedure
    .input(listSchema)
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not initialized" });

      const conditions: any[] = [eq(taskExecutions.triggeredByUserId, userId)];

      if (input.status) {
        conditions.push(eq(taskExecutions.status, input.status));
      }

      if (input.dateFrom) {
        conditions.push(gte(taskExecutions.startedAt, new Date(input.dateFrom)));
      }

      if (input.dateTo) {
        conditions.push(lte(taskExecutions.startedAt, new Date(input.dateTo)));
      }

      if (input.taskType) {
        conditions.push(eq(agencyTasks.taskType, input.taskType));
      }

      // Count total matching
      const [totalResult] = await db
        .select({ count: count() })
        .from(taskExecutions)
        .leftJoin(agencyTasks, eq(taskExecutions.taskId, agencyTasks.id))
        .where(and(...conditions));

      const total = totalResult?.count ?? 0;

      // Fetch page
      const rows = await db
        .select({
          execution: taskExecutions,
          task: agencyTasks,
        })
        .from(taskExecutions)
        .leftJoin(agencyTasks, eq(taskExecutions.taskId, agencyTasks.id))
        .where(and(...conditions))
        .orderBy(desc(taskExecutions.startedAt))
        .limit(input.limit)
        .offset(input.offset);

      const items = rows.map(({ execution, task }) => ({
        id: execution.id,
        executionUuid: execution.executionUuid,
        taskId: execution.taskId,
        status: execution.status,
        stepsTotal: execution.stepsTotal,
        stepsCompleted: execution.stepsCompleted,
        currentStep: execution.currentStep,
        duration: execution.duration,
        attemptNumber: execution.attemptNumber,
        browserSessionId: execution.browserSessionId,
        recordingUrl: execution.recordingUrl,
        error: execution.error,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        task: task
          ? {
              id: task.id,
              title: task.title,
              description: task.description,
              category: task.category,
              taskType: task.taskType,
              priority: task.priority,
            }
          : null,
      }));

      return { items, total, limit: input.limit, offset: input.offset };
    }),

  /**
   * Get full execution detail for the timeline view
   */
  detail: protectedProcedure
    .input(detailSchema)
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not initialized" });

      const [row] = await db
        .select({
          execution: taskExecutions,
          task: agencyTasks,
        })
        .from(taskExecutions)
        .leftJoin(agencyTasks, eq(taskExecutions.taskId, agencyTasks.id))
        .where(
          and(
            eq(taskExecutions.id, input.executionId),
            eq(taskExecutions.triggeredByUserId, userId)
          )
        )
        .limit(1);

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Execution not found" });
      }

      const { execution, task } = row;

      // Parse step results into timeline entries
      const stepResults = (execution.stepResults as any[] | null) ?? [];
      const logs = (execution.logs as any[] | null) ?? [];
      const screenshots = (execution.screenshots as any[] | null) ?? [];

      return {
        id: execution.id,
        executionUuid: execution.executionUuid,
        taskId: execution.taskId,
        status: execution.status,
        stepsTotal: execution.stepsTotal,
        stepsCompleted: execution.stepsCompleted,
        currentStep: execution.currentStep,
        duration: execution.duration,
        attemptNumber: execution.attemptNumber,
        browserSessionId: execution.browserSessionId,
        debugUrl: execution.debugUrl,
        recordingUrl: execution.recordingUrl,
        output: execution.output,
        error: execution.error,
        errorCode: execution.errorCode,
        errorStack: execution.errorStack,
        resourceUsage: execution.resourceUsage,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        stepResults,
        logs,
        screenshots,
        task: task
          ? {
              id: task.id,
              title: task.title,
              description: task.description,
              category: task.category,
              taskType: task.taskType,
              priority: task.priority,
              executionConfig: task.executionConfig,
            }
          : null,
      };
    }),

  /**
   * Aggregate stats for the history page header
   */
  stats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not initialized" });

    const executions = await db
      .select()
      .from(taskExecutions)
      .where(eq(taskExecutions.triggeredByUserId, userId));

    let totalDuration = 0;
    let completedCount = 0;
    let successCount = 0;

    const byStatus: Record<string, number> = {};

    for (const ex of executions) {
      byStatus[ex.status] = (byStatus[ex.status] || 0) + 1;
      if (ex.duration) {
        totalDuration += ex.duration;
        completedCount++;
      }
      if (ex.status === "success") successCount++;
    }

    return {
      total: executions.length,
      byStatus,
      avgDuration: completedCount > 0 ? Math.round(totalDuration / completedCount) : 0,
      successRate: executions.length > 0 ? Math.round((successCount / executions.length) * 100) : 0,
    };
  }),

  /**
   * Get distinct task types for the filter dropdown
   */
  taskTypes: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not initialized" });

    const rows = await db
      .selectDistinct({ taskType: agencyTasks.taskType })
      .from(agencyTasks)
      .where(eq(agencyTasks.userId, userId));

    return rows.map((r) => r.taskType).filter(Boolean);
  }),

  /**
   * Export execution report as HTML (consumed by PDF service on client)
   * Returns structured data for the client to render a report
   */
  exportReport: protectedProcedure
    .input(exportSchema)
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not initialized" });

      const [row] = await db
        .select({
          execution: taskExecutions,
          task: agencyTasks,
        })
        .from(taskExecutions)
        .leftJoin(agencyTasks, eq(taskExecutions.taskId, agencyTasks.id))
        .where(
          and(
            eq(taskExecutions.id, input.executionId),
            eq(taskExecutions.triggeredByUserId, userId)
          )
        )
        .limit(1);

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Execution not found" });
      }

      const { execution, task } = row;
      const stepResults = (execution.stepResults as any[] | null) ?? [];
      const logs = (execution.logs as any[] | null) ?? [];

      return {
        title: task?.title ?? `Execution #${execution.id}`,
        executionId: execution.id,
        executionUuid: execution.executionUuid,
        status: execution.status,
        duration: execution.duration,
        stepsTotal: execution.stepsTotal,
        stepsCompleted: execution.stepsCompleted,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        error: execution.error,
        taskDescription: task?.description,
        taskType: task?.taskType,
        category: task?.category,
        priority: task?.priority,
        stepResults,
        logs,
        generatedAt: new Date().toISOString(),
      };
=======
   * List all executions across all tasks for the current user
   * with filtering, sorting, and pagination
   */
  list: protectedProcedure
    .input(listExecutionsSchema)
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const db = await requireDb();

      return withTrpcErrorHandling(async () => {
        // Build conditions - join taskExecutions with agencyTasks to filter by userId
        const conditions: any[] = [eq(agencyTasks.userId, userId)];

        // Status filters
        if (input.status) {
          conditions.push(eq(taskExecutions.status, input.status));
        } else if (input.statuses && input.statuses.length > 0) {
          conditions.push(inArray(taskExecutions.status, input.statuses));
        }

        // Triggered by filter
        if (input.triggeredBy) {
          conditions.push(eq(taskExecutions.triggeredBy, input.triggeredBy));
        }

        // Task type filter (from the parent task)
        if (input.taskType) {
          conditions.push(eq(agencyTasks.taskType, input.taskType));
        }

        // Date range filters
        if (input.dateFrom) {
          conditions.push(gte(taskExecutions.startedAt, new Date(input.dateFrom)));
        }
        if (input.dateTo) {
          conditions.push(lte(taskExecutions.startedAt, new Date(input.dateTo)));
        }

        // Sorting
        const sortColumnMap = {
          startedAt: taskExecutions.startedAt,
          duration: taskExecutions.duration,
          status: taskExecutions.status,
        } as const;
        const sortColumn = sortColumnMap[input.sortBy];
        const orderBy = input.sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

        // Query with join
        const executions = await db
          .select({
            id: taskExecutions.id,
            taskId: taskExecutions.taskId,
            executionUuid: taskExecutions.executionUuid,
            attemptNumber: taskExecutions.attemptNumber,
            status: taskExecutions.status,
            triggeredBy: taskExecutions.triggeredBy,
            browserSessionId: taskExecutions.browserSessionId,
            debugUrl: taskExecutions.debugUrl,
            recordingUrl: taskExecutions.recordingUrl,
            stepsTotal: taskExecutions.stepsTotal,
            stepsCompleted: taskExecutions.stepsCompleted,
            currentStep: taskExecutions.currentStep,
            error: taskExecutions.error,
            errorCode: taskExecutions.errorCode,
            duration: taskExecutions.duration,
            startedAt: taskExecutions.startedAt,
            completedAt: taskExecutions.completedAt,
            createdAt: taskExecutions.createdAt,
            // Task info
            taskTitle: agencyTasks.title,
            taskType: agencyTasks.taskType,
            taskCategory: agencyTasks.category,
            taskPriority: agencyTasks.priority,
          })
          .from(taskExecutions)
          .innerJoin(agencyTasks, eq(taskExecutions.taskId, agencyTasks.id))
          .where(and(...conditions))
          .orderBy(orderBy)
          .limit(input.limit)
          .offset(input.offset);

        // Get total count
        const [countResult] = await db
          .select({ count: count() })
          .from(taskExecutions)
          .innerJoin(agencyTasks, eq(taskExecutions.taskId, agencyTasks.id))
          .where(and(...conditions));

        // Get aggregate stats
        const [stats] = await db
          .select({
            totalExecutions: count(),
            successCount: sql<number>`count(*) filter (where ${taskExecutions.status} = 'success')`,
            failedCount: sql<number>`count(*) filter (where ${taskExecutions.status} = 'failed')`,
            cancelledCount: sql<number>`count(*) filter (where ${taskExecutions.status} = 'cancelled')`,
            runningCount: sql<number>`count(*) filter (where ${taskExecutions.status} in ('started', 'running'))`,
            avgDuration: sql<number>`avg(${taskExecutions.duration})`,
          })
          .from(taskExecutions)
          .innerJoin(agencyTasks, eq(taskExecutions.taskId, agencyTasks.id))
          .where(eq(agencyTasks.userId, userId));

        return {
          executions,
          total: countResult?.count || 0,
          limit: input.limit,
          offset: input.offset,
          stats: {
            total: Number(stats?.totalExecutions || 0),
            success: Number(stats?.successCount || 0),
            failed: Number(stats?.failedCount || 0),
            cancelled: Number(stats?.cancelledCount || 0),
            running: Number(stats?.runningCount || 0),
            avgDuration: Math.round(Number(stats?.avgDuration || 0)),
          },
        };
      }, "Failed to list executions");
    }),

  /**
   * Get detailed execution info including step results, logs, screenshots
   */
  getDetail: protectedProcedure
    .input(getExecutionDetailSchema)
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const db = await requireDb();

      return withTrpcErrorHandling(async () => {
        // Get execution with task info, verify ownership
        const results = await db
          .select({
            // All execution fields
            id: taskExecutions.id,
            taskId: taskExecutions.taskId,
            executionUuid: taskExecutions.executionUuid,
            attemptNumber: taskExecutions.attemptNumber,
            status: taskExecutions.status,
            triggeredBy: taskExecutions.triggeredBy,
            triggeredByUserId: taskExecutions.triggeredByUserId,
            browserSessionId: taskExecutions.browserSessionId,
            debugUrl: taskExecutions.debugUrl,
            recordingUrl: taskExecutions.recordingUrl,
            stepsTotal: taskExecutions.stepsTotal,
            stepsCompleted: taskExecutions.stepsCompleted,
            currentStep: taskExecutions.currentStep,
            stepResults: taskExecutions.stepResults,
            output: taskExecutions.output,
            logs: taskExecutions.logs,
            screenshots: taskExecutions.screenshots,
            error: taskExecutions.error,
            errorCode: taskExecutions.errorCode,
            errorStack: taskExecutions.errorStack,
            duration: taskExecutions.duration,
            resourceUsage: taskExecutions.resourceUsage,
            startedAt: taskExecutions.startedAt,
            completedAt: taskExecutions.completedAt,
            createdAt: taskExecutions.createdAt,
            // Task info
            taskTitle: agencyTasks.title,
            taskDescription: agencyTasks.description,
            taskType: agencyTasks.taskType,
            taskCategory: agencyTasks.category,
            taskPriority: agencyTasks.priority,
            taskStatus: agencyTasks.status,
          })
          .from(taskExecutions)
          .innerJoin(agencyTasks, eq(taskExecutions.taskId, agencyTasks.id))
          .where(
            and(
              eq(taskExecutions.id, input.executionId),
              eq(agencyTasks.userId, userId)
            )
          )
          .limit(1);

        if (results.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Execution not found",
          });
        }

        return results[0];
      }, "Failed to get execution detail");
    }),

  /**
   * Get distinct task types for filter dropdown
   */
  getTaskTypes: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.user.id;
      const db = await requireDb();

      return withTrpcErrorHandling(async () => {
        const types = await db
          .selectDistinct({ taskType: agencyTasks.taskType })
          .from(agencyTasks)
          .where(eq(agencyTasks.userId, userId));

        return types.map(t => t.taskType);
      }, "Failed to get task types");
>>>>>>> worktree-agent-a1a2bb04
    }),
});
