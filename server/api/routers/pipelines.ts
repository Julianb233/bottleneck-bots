/**
 * GHL Pipelines, Campaigns, Workflows & Messaging tRPC Router
 *
 * Exposes typed RPC endpoints for:
 * - pipelines.list — list pipelines & stages
 * - opportunities.{create,get,update,delete,moveStage,assign}
 * - campaigns.{list,addContact,removeContact,getStats}
 * - workflows.{list,trigger}
 * - messages.{sendSMS,sendEmail}
 *
 * All endpoints require authentication and a valid GHL locationId.
 *
 * Linear: AI-2870
 */

import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";
import { TRPCError } from "@trpc/server";
import { GHLError } from "../../services/ghl.service";
import { createGHLPipelinesService } from "../../services/ghlPipelines.service";

// ========================================
// HELPERS
// ========================================

function mapGHLErrorToTRPC(err: unknown): never {
  if (err instanceof GHLError) {
    const code =
      err.category === "auth"
        ? ("UNAUTHORIZED" as const)
        : err.category === "rate_limit"
          ? ("TOO_MANY_REQUESTS" as const)
          : err.category === "client"
            ? ("BAD_REQUEST" as const)
            : ("INTERNAL_SERVER_ERROR" as const);
    throw new TRPCError({ code, message: err.message });
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: err instanceof Error ? err.message : "Unknown GHL error",
  });
}

// Common input for location-scoped calls
const locationInput = z.object({
  locationId: z.string().min(1, "locationId is required"),
});

// ========================================
// ROUTER
// ========================================

export const pipelinesRouter = router({
  // ----------------------------------------
  // Pipelines
  // ----------------------------------------

  /** List all pipelines and their stages for a location. */
  list: protectedProcedure
    .input(locationInput)
    .query(async ({ ctx, input }) => {
      try {
        const svc = createGHLPipelinesService(input.locationId, ctx.user.id);
        return await svc.listPipelines(input.locationId);
      } catch (err) {
        mapGHLErrorToTRPC(err);
      }
    }),

  // ----------------------------------------
  // Opportunities
  // ----------------------------------------

  /** Create an opportunity. */
  createOpportunity: protectedProcedure
    .input(
      locationInput.extend({
        pipelineId: z.string().min(1),
        pipelineStageId: z.string().min(1),
        contactId: z.string().min(1),
        name: z.string().min(1),
        status: z.string().optional(),
        monetaryValue: z.number().optional(),
        assignedTo: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { locationId, ...data } = input;
        const svc = createGHLPipelinesService(locationId, ctx.user.id);
        return await svc.createOpportunity(locationId, data);
      } catch (err) {
        mapGHLErrorToTRPC(err);
      }
    }),

  /** Get a single opportunity. */
  getOpportunity: protectedProcedure
    .input(
      locationInput.extend({
        opportunityId: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const svc = createGHLPipelinesService(input.locationId, ctx.user.id);
        return await svc.getOpportunity(input.locationId, input.opportunityId);
      } catch (err) {
        mapGHLErrorToTRPC(err);
      }
    }),

  /** Update an opportunity. */
  updateOpportunity: protectedProcedure
    .input(
      locationInput.extend({
        opportunityId: z.string().min(1),
        name: z.string().optional(),
        pipelineStageId: z.string().optional(),
        status: z.string().optional(),
        monetaryValue: z.number().optional(),
        assignedTo: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { locationId, opportunityId, ...data } = input;
        const svc = createGHLPipelinesService(locationId, ctx.user.id);
        return await svc.updateOpportunity(locationId, opportunityId, data);
      } catch (err) {
        mapGHLErrorToTRPC(err);
      }
    }),

  /** Delete an opportunity. */
  deleteOpportunity: protectedProcedure
    .input(
      locationInput.extend({
        opportunityId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const svc = createGHLPipelinesService(input.locationId, ctx.user.id);
        return await svc.deleteOpportunity(input.locationId, input.opportunityId);
      } catch (err) {
        mapGHLErrorToTRPC(err);
      }
    }),

  /** Move an opportunity to a different stage. */
  moveStage: protectedProcedure
    .input(
      locationInput.extend({
        opportunityId: z.string().min(1),
        stageId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const svc = createGHLPipelinesService(input.locationId, ctx.user.id);
        return await svc.moveOpportunityStage(
          input.locationId,
          input.opportunityId,
          input.stageId
        );
      } catch (err) {
        mapGHLErrorToTRPC(err);
      }
    }),

  /** Assign an opportunity to a user. */
  assignOpportunity: protectedProcedure
    .input(
      locationInput.extend({
        opportunityId: z.string().min(1),
        userId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const svc = createGHLPipelinesService(input.locationId, ctx.user.id);
        return await svc.assignOpportunity(
          input.locationId,
          input.opportunityId,
          input.userId
        );
      } catch (err) {
        mapGHLErrorToTRPC(err);
      }
    }),

  // ----------------------------------------
  // Campaigns
  // ----------------------------------------

  /** List all campaigns for a location. */
  listCampaigns: protectedProcedure
    .input(locationInput)
    .query(async ({ ctx, input }) => {
      try {
        const svc = createGHLPipelinesService(input.locationId, ctx.user.id);
        return await svc.listCampaigns(input.locationId);
      } catch (err) {
        mapGHLErrorToTRPC(err);
      }
    }),

  /** Add a contact to a campaign. */
  addContactToCampaign: protectedProcedure
    .input(
      locationInput.extend({
        campaignId: z.string().min(1),
        contactId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const svc = createGHLPipelinesService(input.locationId, ctx.user.id);
        return await svc.addContactToCampaign(
          input.locationId,
          input.campaignId,
          input.contactId
        );
      } catch (err) {
        mapGHLErrorToTRPC(err);
      }
    }),

  /** Remove a contact from a campaign. */
  removeContactFromCampaign: protectedProcedure
    .input(
      locationInput.extend({
        campaignId: z.string().min(1),
        contactId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const svc = createGHLPipelinesService(input.locationId, ctx.user.id);
        return await svc.removeContactFromCampaign(
          input.locationId,
          input.campaignId,
          input.contactId
        );
      } catch (err) {
        mapGHLErrorToTRPC(err);
      }
    }),

  /** Get campaign statistics. */
  getCampaignStats: protectedProcedure
    .input(
      locationInput.extend({
        campaignId: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const svc = createGHLPipelinesService(input.locationId, ctx.user.id);
        return await svc.getCampaignStats(input.locationId, input.campaignId);
      } catch (err) {
        mapGHLErrorToTRPC(err);
      }
    }),

  // ----------------------------------------
  // Workflows
  // ----------------------------------------

  /** List all workflows for a location. */
  listWorkflows: protectedProcedure
    .input(locationInput)
    .query(async ({ ctx, input }) => {
      try {
        const svc = createGHLPipelinesService(input.locationId, ctx.user.id);
        return await svc.listWorkflows(input.locationId);
      } catch (err) {
        mapGHLErrorToTRPC(err);
      }
    }),

  /** Trigger a workflow for a contact. */
  triggerWorkflow: protectedProcedure
    .input(
      locationInput.extend({
        workflowId: z.string().min(1),
        contactId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { locationId, workflowId, contactId } = input;
        const svc = createGHLPipelinesService(locationId, ctx.user.id);
        return await svc.triggerWorkflow(locationId, workflowId, { contactId });
      } catch (err) {
        mapGHLErrorToTRPC(err);
      }
    }),

  // ----------------------------------------
  // Messaging
  // ----------------------------------------

  /** Send an SMS to a contact. */
  sendSMS: protectedProcedure
    .input(
      locationInput.extend({
        contactId: z.string().min(1),
        message: z.string().min(1).max(1600),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const svc = createGHLPipelinesService(input.locationId, ctx.user.id);
        return await svc.sendSMS(input.locationId, input.contactId, input.message);
      } catch (err) {
        mapGHLErrorToTRPC(err);
      }
    }),

  /** Send an email to a contact. */
  sendEmail: protectedProcedure
    .input(
      locationInput.extend({
        contactId: z.string().min(1),
        templateId: z.string().min(1),
        subject: z.string().optional(),
        htmlBody: z.string().optional(),
        altText: z.string().optional(),
        replyTo: z.string().email().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { locationId, contactId, templateId, ...emailData } = input;
        const svc = createGHLPipelinesService(locationId, ctx.user.id);
        return await svc.sendEmail(locationId, contactId, templateId, emailData);
      } catch (err) {
        mapGHLErrorToTRPC(err);
      }
    }),
});
