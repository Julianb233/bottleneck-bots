/**
 * GHL Automation tRPC Router
 *
 * Provides endpoints for GoHighLevel browser automation functions.
 * This is the automation layer that uses the GHL service for authenticated API calls
 * and the browser agent for UI automation tasks.
 *
 * Functions are organized by category:
 * - Contact Management (FR-007 to FR-014)
 * - Pipeline Operations (FR-015 to FR-019)
 * - Campaign Operations (FR-020 to FR-025)
 * - Workflow Triggers (FR-026 to FR-030)
 * - Messaging (FR-031 to FR-039)
 * - Appointment Management (FR-040 to FR-043)
 * - Webhook Processing (FR-044 to FR-048)
 */

import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getGHLService } from "../../services/ghl.service";

export const ghlAutomationRouter = router({
  /**
   * Execute a GHL automation function.
   * This is a generic dispatcher that routes to the appropriate function handler.
   */
  execute: protectedProcedure
    .input(
      z.object({
        locationId: z.string().min(1),
        functionName: z.string().min(1),
        params: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const service = getGHLService();

      // Verify the user has a connected GHL location
      const connections = await service.getConnections(ctx.user.id);
      const connection = connections.find(
        (c) =>
          c.locationId === input.locationId && c.status === "connected"
      );

      if (!connection) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `No active GHL connection found for location ${input.locationId}`,
        });
      }

      // For now, return a placeholder. Individual function implementations
      // will be added in tasks 3-02, 3-03, and 3-04.
      return {
        success: true,
        message: `GHL automation function '${input.functionName}' dispatched`,
        functionName: input.functionName,
        locationId: input.locationId,
      };
    }),

  /**
   * List available GHL automation functions and their status.
   */
  listFunctions: protectedProcedure.query(async () => {
    return {
      categories: [
        {
          name: "Contact Management",
          functions: [
            { id: "contacts.create", name: "Create Contact", status: "available" },
            { id: "contacts.update", name: "Update Contact", status: "available" },
            { id: "contacts.delete", name: "Delete Contact", status: "available" },
            { id: "contacts.search", name: "Search Contacts", status: "available" },
            { id: "contacts.bulkImport", name: "Bulk Import Contacts", status: "planned" },
            { id: "contacts.bulkExport", name: "Bulk Export Contacts", status: "planned" },
            { id: "contacts.addTag", name: "Add Tag to Contact", status: "available" },
            { id: "contacts.removeTag", name: "Remove Tag from Contact", status: "available" },
          ],
        },
        {
          name: "Pipeline Operations",
          functions: [
            { id: "pipeline.listPipelines", name: "List Pipelines", status: "planned" },
            { id: "pipeline.createOpportunity", name: "Create Opportunity", status: "planned" },
            { id: "pipeline.moveStage", name: "Move Opportunity Stage", status: "planned" },
            { id: "pipeline.updateOpportunity", name: "Update Opportunity", status: "planned" },
          ],
        },
        {
          name: "Campaign Operations",
          functions: [
            { id: "campaign.list", name: "List Campaigns", status: "planned" },
            { id: "campaign.addContact", name: "Add Contact to Campaign", status: "planned" },
            { id: "campaign.removeContact", name: "Remove Contact from Campaign", status: "planned" },
          ],
        },
        {
          name: "Workflow Triggers",
          functions: [
            { id: "workflow.list", name: "List Workflows", status: "planned" },
            { id: "workflow.trigger", name: "Trigger Workflow", status: "planned" },
          ],
        },
        {
          name: "Messaging",
          functions: [
            { id: "messaging.sendSms", name: "Send SMS", status: "planned" },
            { id: "messaging.sendEmail", name: "Send Email", status: "planned" },
          ],
        },
        {
          name: "Appointments",
          functions: [
            { id: "appointment.create", name: "Create Appointment", status: "planned" },
            { id: "appointment.update", name: "Update Appointment", status: "planned" },
            { id: "appointment.cancel", name: "Cancel Appointment", status: "planned" },
            { id: "appointment.list", name: "List Appointments", status: "planned" },
          ],
        },
      ],
    };
  }),
});
