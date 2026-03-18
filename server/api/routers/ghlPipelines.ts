/**
 * GHL Pipelines, Campaigns, Workflows & Messaging tRPC Router
 * (FR-015 through FR-039)
 */

import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getGhlPipelinesService } from "../../services/ghlPipelines.service";

// ========================================
// GHL PIPELINES ROUTER
// ========================================

export const ghlPipelinesRouter = router({
  // ---- Pipelines ----

  /** List all pipelines for a location */
  listPipelines: protectedProcedure
    .input(z.object({ locationId: z.string() }))
    .query(async ({ ctx, input }) => {
      const svc = getGhlPipelinesService();
      const result = await svc.listPipelines(ctx.user.id, input.locationId);
      return result.data;
    }),

  /** Get a single pipeline with stages */
  getPipeline: protectedProcedure
    .input(z.object({ locationId: z.string(), pipelineId: z.string() }))
    .query(async ({ ctx, input }) => {
      const svc = getGhlPipelinesService();
      const result = await svc.getPipeline(ctx.user.id, input.locationId, input.pipelineId);
      return result.data;
    }),

  // ---- Opportunities ----

  /** Create an opportunity */
  createOpportunity: protectedProcedure
    .input(
      z.object({
        locationId: z.string(),
        name: z.string(),
        pipelineId: z.string(),
        pipelineStageId: z.string(),
        contactId: z.string(),
        status: z.string().optional(),
        monetaryValue: z.number().optional(),
        assignedTo: z.string().optional(),
        source: z.string().optional(),
        tags: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const svc = getGhlPipelinesService();
      const { locationId, ...data } = input;
      const result = await svc.createOpportunity(ctx.user.id, locationId, data);
      return result.data;
    }),

  /** Get an opportunity */
  getOpportunity: protectedProcedure
    .input(z.object({ locationId: z.string(), opportunityId: z.string() }))
    .query(async ({ ctx, input }) => {
      const svc = getGhlPipelinesService();
      const result = await svc.getOpportunity(ctx.user.id, input.locationId, input.opportunityId);
      return result.data;
    }),

  /** Update an opportunity */
  updateOpportunity: protectedProcedure
    .input(
      z.object({
        locationId: z.string(),
        opportunityId: z.string(),
        name: z.string().optional(),
        pipelineStageId: z.string().optional(),
        status: z.string().optional(),
        monetaryValue: z.number().optional(),
        assignedTo: z.string().optional(),
        source: z.string().optional(),
        tags: z.array(z.string()).optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const svc = getGhlPipelinesService();
      const { locationId, opportunityId, ...data } = input;
      const result = await svc.updateOpportunity(ctx.user.id, locationId, opportunityId, data);
      return result.data;
    }),

  /** Delete an opportunity */
  deleteOpportunity: protectedProcedure
    .input(z.object({ locationId: z.string(), opportunityId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const svc = getGhlPipelinesService();
      await svc.deleteOpportunity(ctx.user.id, input.locationId, input.opportunityId);
      return { success: true };
    }),

  /** Move an opportunity to a different pipeline stage */
  moveOpportunityStage: protectedProcedure
    .input(
      z.object({
        locationId: z.string(),
        opportunityId: z.string(),
        stageId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const svc = getGhlPipelinesService();
      const result = await svc.moveOpportunityStage(
        ctx.user.id,
        input.locationId,
        input.opportunityId,
        input.stageId
      );
      return result.data;
    }),

  /** Assign an opportunity to a user */
  assignOpportunity: protectedProcedure
    .input(
      z.object({
        locationId: z.string(),
        opportunityId: z.string(),
        assignedUserId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const svc = getGhlPipelinesService();
      const result = await svc.assignOpportunity(
        ctx.user.id,
        input.locationId,
        input.opportunityId,
        input.assignedUserId
      );
      return result.data;
    }),

  /** Search opportunities */
  searchOpportunities: protectedProcedure
    .input(
      z.object({
        locationId: z.string(),
        pipelineId: z.string().optional(),
        pipelineStageId: z.string().optional(),
        status: z.string().optional(),
        assignedTo: z.string().optional(),
        contactId: z.string().optional(),
        q: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
        startAfterId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const svc = getGhlPipelinesService();
      const { locationId, ...searchParams } = input;
      const result = await svc.searchOpportunities(ctx.user.id, locationId, searchParams);
      return result.data;
    }),

  // ---- Campaigns ----

  /** List campaigns for a location */
  listCampaigns: protectedProcedure
    .input(z.object({ locationId: z.string() }))
    .query(async ({ ctx, input }) => {
      const svc = getGhlPipelinesService();
      const result = await svc.listCampaigns(ctx.user.id, input.locationId);
      return result.data;
    }),

  /** Add a contact to a campaign */
  addContactToCampaign: protectedProcedure
    .input(
      z.object({
        locationId: z.string(),
        campaignId: z.string(),
        contactId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const svc = getGhlPipelinesService();
      await svc.addContactToCampaign(
        ctx.user.id,
        input.locationId,
        input.campaignId,
        input.contactId
      );
      return { success: true };
    }),

  /** Remove a contact from a campaign */
  removeContactFromCampaign: protectedProcedure
    .input(
      z.object({
        locationId: z.string(),
        campaignId: z.string(),
        contactId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const svc = getGhlPipelinesService();
      await svc.removeContactFromCampaign(
        ctx.user.id,
        input.locationId,
        input.campaignId,
        input.contactId
      );
      return { success: true };
    }),

  /** Get campaign details */
  getCampaign: protectedProcedure
    .input(z.object({ locationId: z.string(), campaignId: z.string() }))
    .query(async ({ ctx, input }) => {
      const svc = getGhlPipelinesService();
      const result = await svc.getCampaign(ctx.user.id, input.locationId, input.campaignId);
      return result.data;
    }),

  // ---- Workflows ----

  /** List workflows for a location */
  listWorkflows: protectedProcedure
    .input(z.object({ locationId: z.string() }))
    .query(async ({ ctx, input }) => {
      const svc = getGhlPipelinesService();
      const result = await svc.listWorkflows(ctx.user.id, input.locationId);
      return result.data;
    }),

  /** Trigger a workflow for a contact */
  triggerWorkflow: protectedProcedure
    .input(
      z.object({
        locationId: z.string(),
        workflowId: z.string(),
        contactId: z.string(),
        eventData: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const svc = getGhlPipelinesService();
      await svc.triggerWorkflow(
        ctx.user.id,
        input.locationId,
        input.workflowId,
        input.contactId,
        input.eventData
      );
      return { success: true };
    }),

  /** Remove a contact from a workflow */
  removeFromWorkflow: protectedProcedure
    .input(
      z.object({
        locationId: z.string(),
        workflowId: z.string(),
        contactId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const svc = getGhlPipelinesService();
      await svc.removeFromWorkflow(
        ctx.user.id,
        input.locationId,
        input.workflowId,
        input.contactId
      );
      return { success: true };
    }),

  // ---- Messaging ----

  /** Send an SMS message */
  sendSms: protectedProcedure
    .input(
      z.object({
        locationId: z.string(),
        contactId: z.string(),
        message: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const svc = getGhlPipelinesService();
      const result = await svc.sendSms(
        ctx.user.id,
        input.locationId,
        input.contactId,
        input.message
      );
      return result.data;
    }),

  /** Send an email */
  sendEmail: protectedProcedure
    .input(
      z.object({
        locationId: z.string(),
        contactId: z.string(),
        subject: z.string().optional(),
        html: z.string().optional(),
        message: z.string().optional(),
        emailFrom: z.string().optional(),
        templateId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const svc = getGhlPipelinesService();
      const { locationId, contactId, ...options } = input;
      const result = await svc.sendEmail(ctx.user.id, locationId, contactId, options);
      return result.data;
    }),

  /** Get message delivery status */
  getMessageStatus: protectedProcedure
    .input(z.object({ locationId: z.string(), messageId: z.string() }))
    .query(async ({ ctx, input }) => {
      const svc = getGhlPipelinesService();
      const result = await svc.getMessageStatus(ctx.user.id, input.locationId, input.messageId);
      return result.data;
    }),

  /** Get conversation messages for a contact */
  getConversationMessages: protectedProcedure
    .input(z.object({ locationId: z.string(), contactId: z.string() }))
    .query(async ({ ctx, input }) => {
      const svc = getGhlPipelinesService();
      const result = await svc.getConversationMessages(
        ctx.user.id,
        input.locationId,
        input.contactId
      );
      return result.data;
    }),

  // ---- Templates ----

  /** List email/SMS templates */
  listTemplates: protectedProcedure
    .input(
      z.object({
        locationId: z.string(),
        type: z.enum(["sms", "email"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const svc = getGhlPipelinesService();
      const result = await svc.listTemplates(ctx.user.id, input.locationId, input.type);
      return result.data;
    }),

  /** Get a specific template */
  getTemplate: protectedProcedure
    .input(z.object({ locationId: z.string(), templateId: z.string() }))
    .query(async ({ ctx, input }) => {
      const svc = getGhlPipelinesService();
      const result = await svc.getTemplate(ctx.user.id, input.locationId, input.templateId);
      return result.data;
    }),
});
