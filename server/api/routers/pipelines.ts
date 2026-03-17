/**
 * Pipelines Router - tRPC API for GHL Pipeline & Opportunity Management
 *
 * Endpoints:
 *   pipelines.listPipelines       — List all pipelines for a GHL location
 *   pipelines.getPipeline         — Get a single pipeline with stages
 *   pipelines.searchOpportunities — Search/filter opportunities
 *   pipelines.getOpportunity      — Get a single opportunity by ID
 *   pipelines.createOpportunity   — Create a new opportunity
 *   pipelines.updateOpportunity   — Update opportunity fields
 *   pipelines.deleteOpportunity   — Delete an opportunity
 *   pipelines.updateStage         — Move opportunity to a different stage
 *   pipelines.bulkUpdateStatus    — Bulk update status for multiple opportunities
 *
 * Linear: AI-2878
 */

import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";
import { TRPCError } from "@trpc/server";
import { createPipelinesService } from "../../services/pipelines.service";
import { GHLError } from "../../services/ghl.service";

// ========================================
// SHARED HELPERS
// ========================================

const locationInput = z.object({
  locationId: z.string().min(1, "locationId is required"),
});

const opportunityStatus = z.enum(["open", "won", "lost", "abandoned"]);

function mapGHLError(err: unknown): TRPCError {
  if (err instanceof GHLError) {
    const code =
      err.category === "auth"
        ? "UNAUTHORIZED" as const
        : err.category === "rate_limit"
          ? "TOO_MANY_REQUESTS" as const
          : err.category === "client"
            ? "BAD_REQUEST" as const
            : "INTERNAL_SERVER_ERROR" as const;
    return new TRPCError({ code, message: err.message });
  }
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: err instanceof Error ? err.message : "Unknown error",
  });
}

// ========================================
// ROUTER
// ========================================

export const pipelinesRouter = router({
  // ----------------------------------------
  // Pipeline queries
  // ----------------------------------------

  listPipelines: protectedProcedure
    .input(locationInput)
    .query(async ({ ctx, input }) => {
      try {
        const svc = createPipelinesService(input.locationId, ctx.user.id);
        return await svc.listPipelines();
      } catch (err) {
        throw mapGHLError(err);
      }
    }),

  getPipeline: protectedProcedure
    .input(
      locationInput.extend({
        pipelineId: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const svc = createPipelinesService(input.locationId, ctx.user.id);
        const pipeline = await svc.getPipeline(input.pipelineId);
        if (!pipeline) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Pipeline ${input.pipelineId} not found`,
          });
        }
        return pipeline;
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw mapGHLError(err);
      }
    }),

  // ----------------------------------------
  // Opportunity queries
  // ----------------------------------------

  searchOpportunities: protectedProcedure
    .input(
      locationInput.extend({
        pipelineId: z.string().optional(),
        pipelineStageId: z.string().optional(),
        contactId: z.string().optional(),
        status: opportunityStatus.optional(),
        assignedTo: z.string().optional(),
        q: z.string().optional(),
        limit: z.number().min(1).max(100).optional(),
        startAfter: z.string().optional(),
        startAfterId: z.string().optional(),
        order: z
          .enum(["added_asc", "added_desc", "updated_asc", "updated_desc"])
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const { locationId, ...searchParams } = input;
        const svc = createPipelinesService(locationId, ctx.user.id);
        return await svc.searchOpportunities(searchParams);
      } catch (err) {
        throw mapGHLError(err);
      }
    }),

  getOpportunity: protectedProcedure
    .input(
      locationInput.extend({
        opportunityId: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const svc = createPipelinesService(input.locationId, ctx.user.id);
        return await svc.getOpportunity(input.opportunityId);
      } catch (err) {
        throw mapGHLError(err);
      }
    }),

  // ----------------------------------------
  // Opportunity mutations
  // ----------------------------------------

  createOpportunity: protectedProcedure
    .input(
      locationInput.extend({
        pipelineId: z.string().min(1),
        pipelineStageId: z.string().min(1),
        name: z.string().min(1),
        contactId: z.string().min(1),
        status: opportunityStatus.optional(),
        monetaryValue: z.number().optional(),
        assignedTo: z.string().optional(),
        source: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { locationId, ...createInput } = input;
        const svc = createPipelinesService(locationId, ctx.user.id);
        return await svc.createOpportunity(createInput);
      } catch (err) {
        throw mapGHLError(err);
      }
    }),

  updateOpportunity: protectedProcedure
    .input(
      locationInput.extend({
        opportunityId: z.string().min(1),
        name: z.string().optional(),
        pipelineId: z.string().optional(),
        pipelineStageId: z.string().optional(),
        status: opportunityStatus.optional(),
        monetaryValue: z.number().optional(),
        assignedTo: z.string().optional(),
        source: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { locationId, opportunityId, ...updateInput } = input;
        const svc = createPipelinesService(locationId, ctx.user.id);
        return await svc.updateOpportunity(opportunityId, updateInput);
      } catch (err) {
        throw mapGHLError(err);
      }
    }),

  deleteOpportunity: protectedProcedure
    .input(
      locationInput.extend({
        opportunityId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const svc = createPipelinesService(input.locationId, ctx.user.id);
        await svc.deleteOpportunity(input.opportunityId);
        return { success: true, message: `Opportunity ${input.opportunityId} deleted` };
      } catch (err) {
        throw mapGHLError(err);
      }
    }),

  // ----------------------------------------
  // Stage transitions
  // ----------------------------------------

  updateStage: protectedProcedure
    .input(
      locationInput.extend({
        opportunityId: z.string().min(1),
        stageId: z.string().min(1),
        status: opportunityStatus.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const svc = createPipelinesService(input.locationId, ctx.user.id);
        return await svc.updateStage(
          input.opportunityId,
          input.stageId,
          input.status
        );
      } catch (err) {
        throw mapGHLError(err);
      }
    }),

  bulkUpdateStatus: protectedProcedure
    .input(
      locationInput.extend({
        opportunityIds: z.array(z.string().min(1)).min(1).max(50),
        status: opportunityStatus,
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const svc = createPipelinesService(input.locationId, ctx.user.id);
        return await svc.bulkUpdateStatus(input.opportunityIds, input.status);
      } catch (err) {
        throw mapGHLError(err);
      }
    }),
});
