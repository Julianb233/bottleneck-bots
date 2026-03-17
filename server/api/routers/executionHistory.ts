import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../../db";
import { eq, and, desc, gte, lte, sql, count } from "drizzle-orm";
import { taskExecutions, agencyTasks } from "../../../drizzle/schema-webhooks";

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
  executionId: z.number().int().positive(),
});

// ========================================
// ROUTER
// ========================================

export const executionHistoryRouter = router({
  /**
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
    }),
});
