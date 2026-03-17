import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";
import { TRPCError } from "@trpc/server";
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
  executionId: z.number().int().positive(),
});

// ========================================
// EXECUTION HISTORY ROUTER
// ========================================

export const executionHistoryRouter = router({
  /**
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
    }),
});
