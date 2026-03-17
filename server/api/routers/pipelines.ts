/**
 * Pipelines Router - tRPC API for Multi-Step Workflow Pipelines
 *
 * Supports chained workflows where each step can reference an existing workflow
 * or define an inline task, with data passing between steps via inputMapping.
 */

import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../../db";
import { eq, and, desc } from "drizzle-orm";
import {
  workflowPipelines,
  pipelineExecutions,
} from "../../../drizzle/schema-pipelines";
import {
  executePipeline,
  getPipelineExecutionStatus,
  cancelPipelineExecution,
} from "../../services/pipelineExecution.service";

// ========================================
// Validation Schemas
// ========================================

const inlineConfigSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("apiCall"),
    url: z.string().min(1),
    method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).optional(),
    headers: z.record(z.string(), z.string()).optional(),
    body: z.any().optional(),
  }),
  z.object({
    type: z.literal("notification"),
    message: z.string().min(1),
    notificationType: z.string().optional(),
  }),
  z.object({
    type: z.literal("transform"),
    expression: z.string().min(1),
  }),
]);

const pipelineStepSchema = z.object({
  stepId: z.string().min(1).max(64),
  type: z.enum(["workflow", "inline"]),
  workflowId: z.number().int().positive().optional(),
  inlineConfig: inlineConfigSchema.optional(),
  inputMapping: z.record(z.string(), z.string()).optional(),
  condition: z.string().optional(),
  continueOnError: z.boolean().default(false),
  retryCount: z.number().int().min(0).max(5).default(0),
  retryDelayMs: z.number().int().min(0).max(60000).default(1000),
}).refine(
  (step) => {
    if (step.type === "workflow") return step.workflowId != null;
    if (step.type === "inline") return step.inlineConfig != null;
    return false;
  },
  { message: "Workflow steps require workflowId; inline steps require inlineConfig" }
);

const createPipelineSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  trigger: z.enum(["manual", "scheduled", "webhook"]).default("manual"),
  steps: z.array(pipelineStepSchema).min(1).max(20),
});

const updatePipelineSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  trigger: z.enum(["manual", "scheduled", "webhook"]).optional(),
  isActive: z.boolean().optional(),
  steps: z.array(pipelineStepSchema).min(1).max(20).optional(),
});

// ========================================
// Router
// ========================================

export const pipelinesRouter = router({
  /**
   * Create a new pipeline
   */
  create: protectedProcedure
    .input(createPipelineSchema)
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not initialized" });
      }

      // Validate that all referenced workflow IDs exist and belong to this user
      const workflowSteps = input.steps.filter((s) => s.type === "workflow" && s.workflowId);
      if (workflowSteps.length > 0) {
        const { automationWorkflows } = await import("../../../drizzle/schema");
        for (const step of workflowSteps) {
          const [wf] = await db
            .select({ id: automationWorkflows.id })
            .from(automationWorkflows)
            .where(and(eq(automationWorkflows.id, step.workflowId!), eq(automationWorkflows.userId, userId)))
            .limit(1);
          if (!wf) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Workflow ${step.workflowId} not found for step "${step.stepId}"`,
            });
          }
        }
      }

      // Validate unique stepIds
      const stepIds = input.steps.map((s) => s.stepId);
      if (new Set(stepIds).size !== stepIds.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Step IDs must be unique within a pipeline" });
      }

      const [pipeline] = await db
        .insert(workflowPipelines)
        .values({
          userId,
          name: input.name,
          description: input.description,
          trigger: input.trigger,
          steps: input.steps,
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
      z.object({
        isActive: z.boolean().optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      }).optional()
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not initialized" });
      }

      const params = input || { limit: 50, offset: 0 };
      const conditions = [eq(workflowPipelines.userId, userId)];
      if (params.isActive !== undefined) {
        conditions.push(eq(workflowPipelines.isActive, params.isActive));
      }

      const pipelines = await db
        .select()
        .from(workflowPipelines)
        .where(and(...conditions))
        .orderBy(desc(workflowPipelines.createdAt))
        .limit(params.limit)
        .offset(params.offset);

      return pipelines.map((p) => ({
        ...p,
        stepCount: Array.isArray(p.steps) ? (p.steps as unknown[]).length : 0,
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
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not initialized" });
      }

      const [pipeline] = await db
        .select()
        .from(workflowPipelines)
        .where(and(eq(workflowPipelines.id, input.id), eq(workflowPipelines.userId, userId)))
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
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not initialized" });
      }

      const [existing] = await db
        .select()
        .from(workflowPipelines)
        .where(and(eq(workflowPipelines.id, input.id), eq(workflowPipelines.userId, userId)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pipeline not found" });
      }

      const updateData: Partial<typeof workflowPipelines.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.trigger !== undefined) updateData.trigger = input.trigger;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;
      if (input.steps !== undefined) updateData.steps = input.steps;

      const [updated] = await db
        .update(workflowPipelines)
        .set(updateData)
        .where(eq(workflowPipelines.id, input.id))
        .returning();

      return updated;
    }),

  /**
   * Delete (soft) a pipeline
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not initialized" });
      }

      const [existing] = await db
        .select()
        .from(workflowPipelines)
        .where(and(eq(workflowPipelines.id, input.id), eq(workflowPipelines.userId, userId)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pipeline not found" });
      }

      await db
        .update(workflowPipelines)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(workflowPipelines.id, input.id));

      return { success: true, id: input.id };
    }),

  /**
   * Execute a pipeline
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

      try {
        const result = await executePipeline({
          pipelineId: input.pipelineId,
          userId,
          variables: input.variables,
        });

        return {
          success: true,
          executionId: result.executionId,
          pipelineId: result.pipelineId,
          status: result.status,
          stepResults: result.stepResults,
          output: result.output,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Pipeline execution failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),

  /**
   * Get execution history for a pipeline
   */
  getExecutions: protectedProcedure
    .input(
      z.object({
        pipelineId: z.number().int().positive(),
        status: z.enum(["pending", "running", "completed", "failed", "cancelled"]).optional(),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not initialized" });
      }

      // Verify pipeline ownership
      const [pipeline] = await db
        .select()
        .from(workflowPipelines)
        .where(and(eq(workflowPipelines.id, input.pipelineId), eq(workflowPipelines.userId, userId)))
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
   * Get a single pipeline execution status
   */
  getExecution: protectedProcedure
    .input(z.object({ executionId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not initialized" });
      }

      // Verify ownership
      const [execution] = await db
        .select()
        .from(pipelineExecutions)
        .where(and(
          eq(pipelineExecutions.id, input.executionId),
          eq(pipelineExecutions.userId, userId)
        ))
        .limit(1);

      if (!execution) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pipeline execution not found" });
      }

      return getPipelineExecutionStatus(input.executionId);
    }),

  /**
   * Cancel a running pipeline execution
   */
  cancelExecution: protectedProcedure
    .input(z.object({ executionId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not initialized" });
      }

      // Verify ownership
      const [execution] = await db
        .select()
        .from(pipelineExecutions)
        .where(and(
          eq(pipelineExecutions.id, input.executionId),
          eq(pipelineExecutions.userId, userId)
        ))
        .limit(1);

      if (!execution) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pipeline execution not found" });
      }

      await cancelPipelineExecution(input.executionId);
      return { success: true, executionId: input.executionId };
    }),
});
