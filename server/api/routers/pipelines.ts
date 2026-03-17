import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../../db";
import { eq, and, desc } from "drizzle-orm";
import {
  pipelines,
  pipelineExecutions,
} from "../../../drizzle/schema-pipelines";
import {
  executePipeline,
  getPipelineExecutionStatus,
  cancelPipelineExecution,
} from "../../services/multiStepWorkflow.service";

// ========================================
// ZOD SCHEMAS
// ========================================

const pipelineStepSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(["workflow", "apiCall", "transform", "condition", "delay"]),
  order: z.number().int().min(0),
  config: z.record(z.string(), z.any()),
  inputMapping: z.record(z.string(), z.string()).optional(),
  outputMapping: z.record(z.string(), z.string()).optional(),
  condition: z.string().optional(),
  continueOnError: z.boolean().default(false),
  retryCount: z.number().int().min(0).max(5).default(0),
  timeoutMs: z.number().int().min(1000).max(3600000).optional(),
});

const createPipelineSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  trigger: z.enum(["manual", "scheduled", "webhook", "event"]).default("manual"),
  steps: z.array(pipelineStepSchema).min(1).max(50),
  maxConcurrency: z.number().int().min(0).max(10).default(1),
  timeoutMs: z.number().int().min(1000).max(86400000).optional(), // Max 24h
});

const updatePipelineSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  trigger: z.enum(["manual", "scheduled", "webhook", "event"]).optional(),
  steps: z.array(pipelineStepSchema).min(1).max(50).optional(),
  isActive: z.boolean().optional(),
  maxConcurrency: z.number().int().min(0).max(10).optional(),
  timeoutMs: z.number().int().min(1000).max(86400000).optional(),
});

// ========================================
// ROUTER
// ========================================

export const pipelinesRouter = router({
  /**
   * Create a new multi-step pipeline
   */
  create: protectedProcedure
    .input(createPipelineSchema)
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not initialized",
        });
      }

      const [pipeline] = await db
        .insert(pipelines)
        .values({
          userId,
          name: input.name,
          description: input.description,
          trigger: input.trigger,
          steps: input.steps,
          maxConcurrency: input.maxConcurrency,
          timeoutMs: input.timeoutMs,
          isActive: true,
        })
        .returning();

      return pipeline;
    }),

  /**
   * List pipelines for the authenticated user
   */
  list: protectedProcedure
    .input(
      z
        .object({
          isActive: z.boolean().optional(),
          limit: z.number().int().min(1).max(100).default(50),
          offset: z.number().int().min(0).default(0),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not initialized",
        });
      }

      const params = input || { limit: 50, offset: 0 };
      const conditions = [eq(pipelines.userId, userId)];

      if (params.isActive !== undefined) {
        conditions.push(eq(pipelines.isActive, params.isActive));
      }

      const results = await db
        .select()
        .from(pipelines)
        .where(and(...conditions))
        .orderBy(desc(pipelines.createdAt))
        .limit(params.limit)
        .offset(params.offset);

      return results.map((p) => ({
        ...p,
        stepCount: Array.isArray(p.steps) ? p.steps.length : 0,
      }));
    }),

  /**
   * Get a single pipeline by ID
   */
  get: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not initialized",
        });
      }

      const [pipeline] = await db
        .select()
        .from(pipelines)
        .where(and(eq(pipelines.id, input.id), eq(pipelines.userId, userId)))
        .limit(1);

      if (!pipeline) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pipeline not found" });
      }

      return pipeline;
    }),

  /**
   * Update an existing pipeline
   */
  update: protectedProcedure
    .input(updatePipelineSchema)
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not initialized",
        });
      }

      const [existing] = await db
        .select()
        .from(pipelines)
        .where(and(eq(pipelines.id, input.id), eq(pipelines.userId, userId)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pipeline not found" });
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.trigger !== undefined) updateData.trigger = input.trigger;
      if (input.steps !== undefined) updateData.steps = input.steps;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;
      if (input.maxConcurrency !== undefined) updateData.maxConcurrency = input.maxConcurrency;
      if (input.timeoutMs !== undefined) updateData.timeoutMs = input.timeoutMs;

      const [updated] = await db
        .update(pipelines)
        .set(updateData)
        .where(eq(pipelines.id, input.id))
        .returning();

      return updated;
    }),

  /**
   * Delete (soft-delete) a pipeline
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not initialized",
        });
      }

      const [existing] = await db
        .select()
        .from(pipelines)
        .where(and(eq(pipelines.id, input.id), eq(pipelines.userId, userId)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pipeline not found" });
      }

      await db
        .update(pipelines)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(pipelines.id, input.id));

      return { success: true, id: input.id };
    }),

  /**
   * Execute a pipeline — runs all steps sequentially with data passing
   */
  execute: protectedProcedure
    .input(
      z.object({
        pipelineId: z.number().int().positive(),
        variables: z.record(z.string(), z.any()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      const result = await executePipeline({
        pipelineId: input.pipelineId,
        userId,
        variables: input.variables,
      });

      return {
        success: result.status === "completed",
        executionId: result.executionId,
        pipelineId: result.pipelineId,
        status: result.status,
        stepResults: result.stepResults,
        sharedContext: result.sharedContext,
        output: result.output,
        duration: result.duration,
        error: result.error,
      };
    }),

  /**
   * Get execution history for a pipeline
   */
  getExecutions: protectedProcedure
    .input(
      z.object({
        pipelineId: z.number().int().positive(),
        status: z
          .enum(["pending", "running", "completed", "failed", "cancelled"])
          .optional(),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Database not initialized",
        });
      }

      // Verify pipeline ownership
      const [pipeline] = await db
        .select()
        .from(pipelines)
        .where(and(eq(pipelines.id, input.pipelineId), eq(pipelines.userId, userId)))
        .limit(1);

      if (!pipeline) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pipeline not found" });
      }

      const conditions = [eq(pipelineExecutions.pipelineId, input.pipelineId)];
      if (input.status) {
        conditions.push(eq(pipelineExecutions.status, input.status));
      }

      return db
        .select()
        .from(pipelineExecutions)
        .where(and(...conditions))
        .orderBy(desc(pipelineExecutions.startedAt))
        .limit(input.limit)
        .offset(input.offset);
    }),

  /**
   * Get a single execution by ID
   */
  getExecution: protectedProcedure
    .input(z.object({ executionId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      const execution = await getPipelineExecutionStatus(
        input.executionId,
        userId
      );

      if (!execution) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pipeline execution not found",
        });
      }

      return execution;
    }),

  /**
   * Cancel a running pipeline execution
   */
  cancelExecution: protectedProcedure
    .input(z.object({ executionId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;

      await cancelPipelineExecution(input.executionId, userId);

      return { success: true, executionId: input.executionId };
    }),
});
