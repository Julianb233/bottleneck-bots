/**
 * GHL tRPC Router
 *
 * Provides typed RPC endpoints for GHL integration management:
 * - ghl.status — connection health check per location
 * - ghl.listLocations — list all authorized GHL locations
 * - ghl.disconnect — revoke and clean up
 * - ghl.configStatus — check OAuth configuration
 * - ghl.getActiveLocation — get user's currently selected location
 * - ghl.setActiveLocation — switch active location
 * - ghl.getLocationConfig — get per-location config
 * - ghl.updateLocationConfig — update per-location config
 * - ghl.updateLocationDetails — update location name/metadata
 *
 * Contacts: searchContacts, getContact, createContact, updateContact,
 *   addTags, removeTags, bulkImportContacts, bulkExportContacts,
 *   mergeContacts, getContactActivity, getCustomFields, listContactTags
 *
 * Pipelines/Opportunities: listPipelines, searchOpportunities,
 *   createOpportunity, updateOpportunity
 *
 * Campaigns: listCampaigns, addContactToCampaign, removeContactFromCampaign,
 *   getCampaignStats, createCampaign
 *
 * Workflows: listWorkflows, triggerWorkflow
 *
 * Communications: sendSMS, sendEmail, getMessageStatus, listTemplates
 *
 * Appointments: createAppointment, getAppointment, updateAppointment,
 *   deleteAppointment, getAvailability
 *
 * Linear: AI-2877, AI-2881, AI-3461
 */

import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";
import { TRPCError } from "@trpc/server";
import { GHLService, GHLError } from "../../services/ghl.service";
import { getDb } from "../../db";
import { ghlLocations, ghlActiveLocation } from "../../../drizzle/schema-ghl-locations";
import { eq, and } from "drizzle-orm";

// ========================================
// HELPERS
// ========================================

/**
 * Instantiate a GHLService for the given user, resolving the location from
 * either the explicit locationId input or the user's active location in DB.
 */
async function getServiceForUser(
  userId: number,
  locationId?: string
): Promise<GHLService> {
  if (locationId) {
    return new GHLService(locationId, userId);
  }

  // Fall back to the user's currently active location
  const db = await getDb();
  if (!db) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Database not available",
    });
  }

  const [active] = await db
    .select()
    .from(ghlActiveLocation)
    .where(eq(ghlActiveLocation.userId, userId))
    .limit(1);

  if (!active) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "No active GHL location — provide locationId or set an active location",
    });
  }

  return new GHLService(active.locationId, userId);
}

/**
 * Map a GHLError to a TRPCError code.
 */
function ghlErrorToTRPC(err: unknown): TRPCError {
  if (err instanceof GHLError) {
    const code =
      err.category === "auth"
        ? "UNAUTHORIZED"
        : err.category === "rate_limit"
          ? "TOO_MANY_REQUESTS"
          : err.category === "client"
            ? "BAD_REQUEST"
            : "INTERNAL_SERVER_ERROR";
    return new TRPCError({ code, message: err.message });
  }
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: err instanceof Error ? err.message : "Unknown GHL error",
  });
}

// ========================================
// SCHEMAS
// ========================================

const locationConfigSchema = z.object({
  automationsEnabled: z.boolean().optional(),
  contactSyncEnabled: z.boolean().optional(),
  pipelineSyncEnabled: z.boolean().optional(),
  calendarSyncEnabled: z.boolean().optional(),
  webhookUrl: z.string().url().optional().or(z.literal("")),
  defaultPipelineId: z.string().optional(),
  defaultCalendarId: z.string().optional(),
  brandVoice: z.string().max(2000).optional(),
  agentInstructions: z.string().max(5000).optional(),
  tags: z.array(z.string()).optional(),
});

// ========================================
// ROUTER
// ========================================

export const ghlRouter = router({

  // ----------------------------------------
  // Connection management
  // ----------------------------------------

  /**
   * Get connection status for a specific GHL location.
   */
  status: protectedProcedure
    .input(
      z.object({
        locationId: z.string().min(1, "locationId is required"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const service = new GHLService(input.locationId, ctx.user.id);
        return await service.getConnectionStatus();
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw ghlErrorToTRPC(err);
      }
    }),

  /**
   * List all authorized GHL locations for the current user.
   * Merges data from integrations table + ghl_locations table.
   */
  listLocations: protectedProcedure.query(async ({ ctx }) => {
    try {
      const oauthLocations = await GHLService.listLocations(ctx.user.id);

      const db = await getDb();
      if (!db) return oauthLocations;

      const locationRows = await db
        .select()
        .from(ghlLocations)
        .where(
          and(
            eq(ghlLocations.userId, ctx.user.id),
            eq(ghlLocations.isActive, true)
          )
        );

      const enrichedMap = new Map(
        locationRows.map((row) => [row.locationId, row])
      );

      return oauthLocations.map((loc) => {
        const enriched = enrichedMap.get(loc.locationId);
        return {
          ...loc,
          name: enriched?.name || null,
          address: enriched?.address || null,
          city: enriched?.city || null,
          state: enriched?.state || null,
          phone: enriched?.phone || null,
          email: enriched?.email || null,
          timezone: enriched?.timezone || null,
          website: enriched?.website || null,
          logoUrl: enriched?.logoUrl || null,
          config: enriched?.config || null,
          lastSyncedAt: enriched?.lastSyncedAt || null,
        };
      });
    } catch (err) {
      if (err instanceof TRPCError) throw err;
      throw ghlErrorToTRPC(err);
    }
  }),

  /**
   * Disconnect a GHL location (revoke tokens and mark inactive).
   */
  disconnect: protectedProcedure
    .input(
      z.object({
        locationId: z.string().min(1, "locationId is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const service = new GHLService(input.locationId, ctx.user.id);
        await service.disconnect();

        const db = await getDb();
        if (db) {
          await db
            .update(ghlLocations)
            .set({ isActive: false, updatedAt: new Date() })
            .where(
              and(
                eq(ghlLocations.userId, ctx.user.id),
                eq(ghlLocations.locationId, input.locationId)
              )
            );

          const [active] = await db
            .select()
            .from(ghlActiveLocation)
            .where(eq(ghlActiveLocation.userId, ctx.user.id))
            .limit(1);

          if (active?.locationId === input.locationId) {
            await db
              .delete(ghlActiveLocation)
              .where(eq(ghlActiveLocation.userId, ctx.user.id));
          }
        }

        return {
          success: true,
          message: `Disconnected GHL location ${input.locationId}`,
        };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw ghlErrorToTRPC(err);
      }
    }),

  /**
   * Get the GHL OAuth configuration status (whether client ID/secret are set).
   */
  configStatus: protectedProcedure.query(async () => {
    return {
      configured: !!process.env.GHL_CLIENT_ID && !!process.env.GHL_CLIENT_SECRET,
      hasClientId: !!process.env.GHL_CLIENT_ID,
      hasClientSecret: !!process.env.GHL_CLIENT_SECRET,
    };
  }),

  /**
   * Get the user's currently active/selected GHL location.
   */
  getActiveLocation: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;

    const [active] = await db
      .select()
      .from(ghlActiveLocation)
      .where(eq(ghlActiveLocation.userId, ctx.user.id))
      .limit(1);

    if (!active) return null;

    const [location] = await db
      .select()
      .from(ghlLocations)
      .where(
        and(
          eq(ghlLocations.userId, ctx.user.id),
          eq(ghlLocations.locationId, active.locationId),
          eq(ghlLocations.isActive, true)
        )
      )
      .limit(1);

    return {
      locationId: active.locationId,
      selectedAt: active.selectedAt,
      name: location?.name || null,
      companyId: location?.companyId || null,
    };
  }),

  /**
   * Set the active/selected GHL location for the current user.
   */
  setActiveLocation: protectedProcedure
    .input(
      z.object({
        locationId: z.string().min(1, "locationId is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const [location] = await db
        .select()
        .from(ghlLocations)
        .where(
          and(
            eq(ghlLocations.userId, ctx.user.id),
            eq(ghlLocations.locationId, input.locationId),
            eq(ghlLocations.isActive, true)
          )
        )
        .limit(1);

      if (!location) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `GHL location ${input.locationId} not found or not connected`,
        });
      }

      const [existing] = await db
        .select()
        .from(ghlActiveLocation)
        .where(eq(ghlActiveLocation.userId, ctx.user.id))
        .limit(1);

      if (existing) {
        await db
          .update(ghlActiveLocation)
          .set({ locationId: input.locationId, selectedAt: new Date() })
          .where(eq(ghlActiveLocation.userId, ctx.user.id));
      } else {
        await db.insert(ghlActiveLocation).values({
          userId: ctx.user.id,
          locationId: input.locationId,
          selectedAt: new Date(),
        });
      }

      return {
        success: true,
        locationId: input.locationId,
        name: location.name,
      };
    }),

  /**
   * Get per-location configuration.
   */
  getLocationConfig: protectedProcedure
    .input(z.object({ locationId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;

      const [location] = await db
        .select()
        .from(ghlLocations)
        .where(
          and(
            eq(ghlLocations.userId, ctx.user.id),
            eq(ghlLocations.locationId, input.locationId)
          )
        )
        .limit(1);

      return location?.config || {
        automationsEnabled: true,
        contactSyncEnabled: true,
        pipelineSyncEnabled: true,
        calendarSyncEnabled: false,
      };
    }),

  /**
   * Update per-location configuration.
   */
  updateLocationConfig: protectedProcedure
    .input(
      z.object({
        locationId: z.string().min(1),
        config: locationConfigSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const [location] = await db
        .select()
        .from(ghlLocations)
        .where(
          and(
            eq(ghlLocations.userId, ctx.user.id),
            eq(ghlLocations.locationId, input.locationId)
          )
        )
        .limit(1);

      if (!location) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `GHL location ${input.locationId} not found`,
        });
      }

      const mergedConfig = { ...(location.config || {}), ...input.config };

      await db
        .update(ghlLocations)
        .set({ config: mergedConfig, updatedAt: new Date() })
        .where(
          and(
            eq(ghlLocations.userId, ctx.user.id),
            eq(ghlLocations.locationId, input.locationId)
          )
        );

      return { success: true, config: mergedConfig };
    }),

  /**
   * Update location display name and metadata.
   */
  updateLocationDetails: protectedProcedure
    .input(
      z.object({
        locationId: z.string().min(1),
        name: z.string().max(200).optional(),
        phone: z.string().max(30).optional(),
        email: z.string().email().optional().or(z.literal("")),
        website: z.string().url().optional().or(z.literal("")),
        timezone: z.string().max(64).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const { locationId, ...updates } = input;

      const setValues: Record<string, unknown> = { updatedAt: new Date() };
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          setValues[key] = value || null;
        }
      }

      await db
        .update(ghlLocations)
        .set(setValues)
        .where(
          and(
            eq(ghlLocations.userId, ctx.user.id),
            eq(ghlLocations.locationId, locationId)
          )
        );

      return { success: true };
    }),

  // ----------------------------------------
  // Contacts — CRUD
  // ----------------------------------------

  /**
   * Search contacts by query string.
   */
  searchContacts: protectedProcedure
    .input(
      z.object({
        locationId: z.string().optional(),
        query: z.string().min(1),
        limit: z.number().int().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const service = await getServiceForUser(ctx.user.id, input.locationId);
        return await service.searchContacts(input.query, input.limit);
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw ghlErrorToTRPC(err);
      }
    }),

  /**
   * Get a contact by ID.
   */
  getContact: protectedProcedure
    .input(
      z.object({
        locationId: z.string().optional(),
        contactId: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const service = await getServiceForUser(ctx.user.id, input.locationId);
        return await service.getContact(input.contactId);
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw ghlErrorToTRPC(err);
      }
    }),

  /**
   * Create a new contact.
   */
  createContact: protectedProcedure
    .input(
      z.object({
        locationId: z.string().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        companyName: z.string().optional(),
        tags: z.array(z.string()).optional(),
        additionalFields: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { locationId, additionalFields, ...contactData } = input;
        const service = await getServiceForUser(ctx.user.id, locationId);
        return await service.createContact({ ...contactData, ...additionalFields });
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw ghlErrorToTRPC(err);
      }
    }),

  /**
   * Update an existing contact.
   */
  updateContact: protectedProcedure
    .input(
      z.object({
        locationId: z.string().optional(),
        contactId: z.string().min(1),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        companyName: z.string().optional(),
        tags: z.array(z.string()).optional(),
        additionalFields: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { locationId, contactId, additionalFields, ...contactData } = input;
        const service = await getServiceForUser(ctx.user.id, locationId);
        return await service.updateContact(contactId, { ...contactData, ...additionalFields });
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw ghlErrorToTRPC(err);
      }
    }),

  /**
   * Add tags to a contact.
   */
  addTags: protectedProcedure
    .input(
      z.object({
        locationId: z.string().optional(),
        contactId: z.string().min(1),
        tags: z.array(z.string()).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const service = await getServiceForUser(ctx.user.id, input.locationId);
        return await service.addTags(input.contactId, input.tags);
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw ghlErrorToTRPC(err);
      }
    }),

  /**
   * Remove tags from a contact.
   */
  removeTags: protectedProcedure
    .input(
      z.object({
        locationId: z.string().optional(),
        contactId: z.string().min(1),
        tags: z.array(z.string()).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const service = await getServiceForUser(ctx.user.id, input.locationId);
        return await service.removeTags(input.contactId, input.tags);
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw ghlErrorToTRPC(err);
      }
    }),

  // ----------------------------------------
  // Contacts — Bulk operations
  // ----------------------------------------

  /**
   * Bulk import contacts into this location.
   */
  bulkImportContacts: protectedProcedure
    .input(
      z.object({
        locationId: z.string().optional(),
        contacts: z
          .array(
            z.object({
              firstName: z.string().optional(),
              lastName: z.string().optional(),
              email: z.string().email().optional(),
              phone: z.string().optional(),
              tags: z.array(z.string()).optional(),
            })
          )
          .min(1)
          .max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const service = await getServiceForUser(ctx.user.id, input.locationId);
        return await service.bulkImportContacts(input.contacts);
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw ghlErrorToTRPC(err);
      }
    }),

  /**
   * Export contacts with optional filters.
   */
  bulkExportContacts: protectedProcedure
    .input(
      z.object({
        locationId: z.string().optional(),
        filters: z.record(z.string(), z.string()).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const service = await getServiceForUser(ctx.user.id, input.locationId);
        return await service.bulkExportContacts(input.filters);
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw ghlErrorToTRPC(err);
      }
    }),

  /**
   * Merge duplicate contacts into a primary contact.
   */
  mergeContacts: protectedProcedure
    .input(
      z.object({
        locationId: z.string().optional(),
        primaryId: z.string().min(1),
        duplicateIds: z.array(z.string()).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const service = await getServiceForUser(ctx.user.id, input.locationId);
        return await service.mergeContacts(input.primaryId, input.duplicateIds);
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw ghlErrorToTRPC(err);
      }
    }),

  /**
   * Get activity/tasks for a contact.
   */
  getContactActivity: protectedProcedure
    .input(
      z.object({
        locationId: z.string().optional(),
        contactId: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const service = await getServiceForUser(ctx.user.id, input.locationId);
        return await service.getContactActivity(input.contactId);
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw ghlErrorToTRPC(err);
      }
    }),

  /**
   * List all custom fields for this location.
   */
  getCustomFields: protectedProcedure
    .input(z.object({ locationId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      try {
        const service = await getServiceForUser(ctx.user.id, input.locationId);
        return await service.getCustomFields();
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw ghlErrorToTRPC(err);
      }
    }),

  /**
   * List all contact tags for this location.
   */
  listContactTags: protectedProcedure
    .input(z.object({ locationId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      try {
        const service = await getServiceForUser(ctx.user.id, input.locationId);
        return await service.listContactTags();
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw ghlErrorToTRPC(err);
      }
    }),

  // ----------------------------------------
  // Pipelines / Opportunities
  // ----------------------------------------

  /**
   * List all pipelines for this location.
   */
  listPipelines: protectedProcedure
    .input(z.object({ locationId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      try {
        const service = await getServiceForUser(ctx.user.id, input.locationId);
        return await service.listPipelines();
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw ghlErrorToTRPC(err);
      }
    }),

  /**
   * Search opportunities, optionally filtered by pipeline.
   */
  searchOpportunities: protectedProcedure
    .input(
      z.object({
        locationId: z.string().optional(),
        query: z.string().min(1),
        pipelineId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const service = await getServiceForUser(ctx.user.id, input.locationId);
        return await service.searchOpportunities(input.query, input.pipelineId);
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw ghlErrorToTRPC(err);
      }
    }),

  /**
   * Create a new opportunity in a pipeline.
   */
  createOpportunity: protectedProcedure
    .input(
      z.object({
        locationId: z.string().optional(),
        name: z.string().min(1),
        status: z.string().optional(),
        pipelineId: z.string().min(1),
        pipelineStageId: z.string().optional(),
        contactId: z.string().optional(),
        monetaryValue: z.number().optional(),
        assignedTo: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { locationId, ...data } = input;
        const service = await getServiceForUser(ctx.user.id, locationId);
        return await service.createOpportunity(data);
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw ghlErrorToTRPC(err);
      }
    }),

  /**
   * Update an existing opportunity.
   */
  updateOpportunity: protectedProcedure
    .input(
      z.object({
        locationId: z.string().optional(),
        opportunityId: z.string().min(1),
        name: z.string().optional(),
        status: z.string().optional(),
        pipelineStageId: z.string().optional(),
        monetaryValue: z.number().optional(),
        assignedTo: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { locationId, opportunityId, ...data } = input;
        const service = await getServiceForUser(ctx.user.id, locationId);
        return await service.updateOpportunity(opportunityId, data);
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw ghlErrorToTRPC(err);
      }
    }),

  // ----------------------------------------
  // Campaigns
  // ----------------------------------------

  /**
   * List all campaigns for this location.
   */
  listCampaigns: protectedProcedure
    .input(z.object({ locationId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      try {
        const service = await getServiceForUser(ctx.user.id, input.locationId);
        return await service.listCampaigns();
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw ghlErrorToTRPC(err);
      }
    }),

  /**
   * Add a contact to a campaign.
   */
  addContactToCampaign: protectedProcedure
    .input(
      z.object({
        locationId: z.string().optional(),
        campaignId: z.string().min(1),
        contactId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const service = await getServiceForUser(ctx.user.id, input.locationId);
        return await service.addContactToCampaign(input.campaignId, input.contactId);
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw ghlErrorToTRPC(err);
      }
    }),

  /**
   * Remove a contact from a campaign.
   */
  removeContactFromCampaign: protectedProcedure
    .input(
      z.object({
        locationId: z.string().optional(),
        campaignId: z.string().min(1),
        contactId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const service = await getServiceForUser(ctx.user.id, input.locationId);
        return await service.removeContactFromCampaign(input.campaignId, input.contactId);
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw ghlErrorToTRPC(err);
      }
    }),

  /**
   * Get stats for a specific campaign.
   */
  getCampaignStats: protectedProcedure
    .input(
      z.object({
        locationId: z.string().optional(),
        campaignId: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const service = await getServiceForUser(ctx.user.id, input.locationId);
        return await service.getCampaignStats(input.campaignId);
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw ghlErrorToTRPC(err);
      }
    }),

  /**
   * Create a new campaign.
   */
  createCampaign: protectedProcedure
    .input(
      z.object({
        locationId: z.string().optional(),
        name: z.string().min(1).max(200),
        type: z.string().optional(),
        additionalFields: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { locationId, additionalFields, ...campaignData } = input;
        const service = await getServiceForUser(ctx.user.id, locationId);
        return await service.createCampaign({ ...campaignData, ...additionalFields });
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw ghlErrorToTRPC(err);
      }
    }),

  // ----------------------------------------
  // Workflows
  // ----------------------------------------

  /**
   * List all workflows for this location.
   */
  listWorkflows: protectedProcedure
    .input(z.object({ locationId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      try {
        const service = await getServiceForUser(ctx.user.id, input.locationId);
        return await service.listWorkflows();
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw ghlErrorToTRPC(err);
      }
    }),

  /**
   * Trigger a workflow for a specific contact.
   */
  triggerWorkflow: protectedProcedure
    .input(
      z.object({
        locationId: z.string().optional(),
        workflowId: z.string().min(1),
        contactId: z.string().min(1),
        additionalData: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { locationId, workflowId, contactId, additionalData } = input;
        const service = await getServiceForUser(ctx.user.id, locationId);
        return await service.triggerWorkflow(workflowId, {
          contactId,
          ...(additionalData ?? {}),
        });
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw ghlErrorToTRPC(err);
      }
    }),

  // ----------------------------------------
  // Communications
  // ----------------------------------------

  /**
   * Send an SMS to a contact.
   */
  sendSMS: protectedProcedure
    .input(
      z.object({
        locationId: z.string().optional(),
        contactId: z.string().min(1),
        message: z.string().min(1).max(1600),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const service = await getServiceForUser(ctx.user.id, input.locationId);
        return await service.sendSMS(input.contactId, input.message);
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw ghlErrorToTRPC(err);
      }
    }),

  /**
   * Send an email to a contact, optionally using a template.
   */
  sendEmail: protectedProcedure
    .input(
      z.object({
        locationId: z.string().optional(),
        contactId: z.string().min(1),
        subject: z.string().min(1).max(500),
        body: z.string().min(1),
        templateId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const service = await getServiceForUser(ctx.user.id, input.locationId);
        return await service.sendEmail(
          input.contactId,
          input.subject,
          input.body,
          input.templateId
        );
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw ghlErrorToTRPC(err);
      }
    }),

  /**
   * Get the delivery status of a message.
   */
  getMessageStatus: protectedProcedure
    .input(
      z.object({
        locationId: z.string().optional(),
        messageId: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const service = await getServiceForUser(ctx.user.id, input.locationId);
        return await service.getMessageStatus(input.messageId);
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw ghlErrorToTRPC(err);
      }
    }),

  /**
   * List message templates for this location.
   */
  listTemplates: protectedProcedure
    .input(
      z.object({
        locationId: z.string().optional(),
        type: z.enum(["sms", "email"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const service = await getServiceForUser(ctx.user.id, input.locationId);
        return await service.listTemplates(input.type);
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw ghlErrorToTRPC(err);
      }
    }),

  // ----------------------------------------
  // Appointments
  // ----------------------------------------

  /**
   * Create a new calendar appointment.
   */
  createAppointment: protectedProcedure
    .input(
      z.object({
        locationId: z.string().optional(),
        calendarId: z.string().min(1),
        contactId: z.string().min(1),
        startTime: z.string().min(1),
        endTime: z.string().min(1),
        title: z.string().max(500).optional(),
        notes: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { locationId, ...data } = input;
        const service = await getServiceForUser(ctx.user.id, locationId);
        return await service.createAppointment(data);
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw ghlErrorToTRPC(err);
      }
    }),

  /**
   * Get a calendar event by ID.
   */
  getAppointment: protectedProcedure
    .input(
      z.object({
        locationId: z.string().optional(),
        eventId: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const service = await getServiceForUser(ctx.user.id, input.locationId);
        return await service.getAppointment(input.eventId);
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw ghlErrorToTRPC(err);
      }
    }),

  /**
   * Update a calendar event.
   */
  updateAppointment: protectedProcedure
    .input(
      z.object({
        locationId: z.string().optional(),
        eventId: z.string().min(1),
        calendarId: z.string().optional(),
        contactId: z.string().optional(),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
        title: z.string().max(500).optional(),
        notes: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { locationId, eventId, ...data } = input;
        const service = await getServiceForUser(ctx.user.id, locationId);
        return await service.updateAppointment(eventId, data);
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw ghlErrorToTRPC(err);
      }
    }),

  /**
   * Delete a calendar event.
   */
  deleteAppointment: protectedProcedure
    .input(
      z.object({
        locationId: z.string().optional(),
        eventId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const service = await getServiceForUser(ctx.user.id, input.locationId);
        return await service.deleteAppointment(input.eventId);
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw ghlErrorToTRPC(err);
      }
    }),

  /**
   * Get available time slots for a calendar.
   */
  getAvailability: protectedProcedure
    .input(
      z.object({
        locationId: z.string().optional(),
        calendarId: z.string().min(1),
        startDate: z.string().min(1),
        endDate: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const service = await getServiceForUser(ctx.user.id, input.locationId);
        return await service.getAvailability(
          input.calendarId,
          input.startDate,
          input.endDate
        );
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw ghlErrorToTRPC(err);
      }
    }),
});
