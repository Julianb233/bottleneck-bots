/**
 * GHL tRPC Router
 *
 * Provides typed RPC endpoints for GHL integration management:
 * - Connection management (status, list, disconnect, config)
 * - Contact/lead management (search, create, update, tag)
 * - Pipeline/opportunity management (list, search, create, update)
 * - Campaign/drip management (list, add/remove contacts)
 * - Workflow listing
 *
 * - Messaging (send SMS, send email, delivery status, templates)
 *
 * Linear: AI-2877, AI-2881, AI-3461, AI-5149
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

function ghlErrorToTRPC(err: unknown): never {
  if (err instanceof GHLError) {
    throw new TRPCError({
      code:
        err.category === "auth"
          ? "UNAUTHORIZED"
          : err.category === "rate_limit"
            ? "TOO_MANY_REQUESTS"
            : "INTERNAL_SERVER_ERROR",
      message: err.message,
    });
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: err instanceof Error ? err.message : "GHL operation failed",
  });
}

/** Get a GHL service for the user's active location, or a specified one. */
async function getServiceForUser(
  userId: number,
  locationId?: string
): Promise<GHLService> {
  if (locationId) {
    return new GHLService(locationId, userId);
  }

  // Fall back to active location
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

  const [active] = await db
    .select()
    .from(ghlActiveLocation)
    .where(eq(ghlActiveLocation.userId, userId))
    .limit(1);

  if (!active) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "No active GHL location. Connect and select a location first.",
    });
  }

  return new GHLService(active.locationId, userId);
}

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
  // Connection Management (existing)
  // ----------------------------------------

  status: protectedProcedure
    .input(z.object({ locationId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      try {
        const service = new GHLService(input.locationId, ctx.user.id);
        return await service.getConnectionStatus();
      } catch (err) {
        ghlErrorToTRPC(err);
      }
    }),

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
      ghlErrorToTRPC(err);
    }
  }),

  disconnect: protectedProcedure
    .input(z.object({ locationId: z.string().min(1) }))
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

        return { success: true, message: `Disconnected GHL location ${input.locationId}` };
      } catch (err) {
        ghlErrorToTRPC(err);
      }
    }),

  configStatus: protectedProcedure.query(async () => {
    return {
      configured: !!process.env.GHL_CLIENT_ID && !!process.env.GHL_CLIENT_SECRET,
      hasClientId: !!process.env.GHL_CLIENT_ID,
      hasClientSecret: !!process.env.GHL_CLIENT_SECRET,
    };
  }),

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

  setActiveLocation: protectedProcedure
    .input(z.object({ locationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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
        throw new TRPCError({ code: "NOT_FOUND", message: `GHL location ${input.locationId} not found` });
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

      return { success: true, locationId: input.locationId, name: location.name };
    }),

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

  updateLocationConfig: protectedProcedure
    .input(z.object({ locationId: z.string().min(1), config: locationConfigSchema }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

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

      if (!location) throw new TRPCError({ code: "NOT_FOUND", message: `Location not found` });

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
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const { locationId, ...updates } = input;
      const setValues: Record<string, unknown> = { updatedAt: new Date() };
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) setValues[key] = value || null;
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
  // Contact / Lead Management (AI-3461)
  // ----------------------------------------

  searchContacts: protectedProcedure
    .input(
      z.object({
        locationId: z.string().optional(),
        query: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const service = await getServiceForUser(ctx.user.id, input.locationId);
        const result = await service.searchContacts({
          query: input.query,
          limit: input.limit,
          offset: input.offset,
        });
        return result.data;
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        ghlErrorToTRPC(err);
      }
    }),

  getContact: protectedProcedure
    .input(z.object({ contactId: z.string().min(1), locationId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      try {
        const service = await getServiceForUser(ctx.user.id, input.locationId);
        const result = await service.getContact(input.contactId);
        return result.data;
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        ghlErrorToTRPC(err);
      }
    }),

  createContact: protectedProcedure
    .input(
      z.object({
        locationId: z.string().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        tags: z.array(z.string()).optional(),
        source: z.string().optional(),
        customFields: z.array(z.object({ id: z.string(), value: z.string() })).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { locationId, ...contactData } = input;
        const service = await getServiceForUser(ctx.user.id, locationId);
        const result = await service.createContact(contactData);
        return result.data;
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        ghlErrorToTRPC(err);
      }
    }),

  updateContact: protectedProcedure
    .input(
      z.object({
        contactId: z.string().min(1),
        locationId: z.string().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        tags: z.array(z.string()).optional(),
        customFields: z.array(z.object({ id: z.string(), value: z.string() })).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { contactId, locationId, ...updateData } = input;
        const service = await getServiceForUser(ctx.user.id, locationId);
        const result = await service.updateContact(contactId, updateData);
        return result.data;
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        ghlErrorToTRPC(err);
      }
    }),

  addContactTags: protectedProcedure
    .input(
      z.object({
        contactId: z.string().min(1),
        tags: z.array(z.string().min(1)).min(1),
        locationId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const service = await getServiceForUser(ctx.user.id, input.locationId);
        const result = await service.addContactTags(input.contactId, input.tags);
        return result.data;
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        ghlErrorToTRPC(err);
      }
    }),

  removeContactTags: protectedProcedure
    .input(
      z.object({
        contactId: z.string().min(1),
        tags: z.array(z.string().min(1)).min(1),
        locationId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const service = await getServiceForUser(ctx.user.id, input.locationId);
        await service.removeContactTags(input.contactId, input.tags);
        return { success: true };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        ghlErrorToTRPC(err);
      }
    }),

  // ----------------------------------------
  // Pipeline / Opportunity Management (AI-3461)
  // ----------------------------------------

  listPipelines: protectedProcedure
    .input(z.object({ locationId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      try {
        const service = await getServiceForUser(ctx.user.id, input?.locationId);
        const result = await service.listPipelines();
        return result.data;
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        ghlErrorToTRPC(err);
      }
    }),

  searchOpportunities: protectedProcedure
    .input(
      z.object({
        locationId: z.string().optional(),
        pipelineId: z.string().optional(),
        stageId: z.string().optional(),
        status: z.enum(["open", "won", "lost", "abandoned", "all"]).default("open"),
        query: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const { locationId, ...params } = input;
        const service = await getServiceForUser(ctx.user.id, locationId);
        const result = await service.searchOpportunities(params);
        return result.data;
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        ghlErrorToTRPC(err);
      }
    }),

  createOpportunity: protectedProcedure
    .input(
      z.object({
        locationId: z.string().optional(),
        pipelineId: z.string().min(1),
        stageId: z.string().min(1),
        contactId: z.string().min(1),
        name: z.string().min(1),
        monetaryValue: z.number().optional(),
        status: z.enum(["open", "won", "lost", "abandoned"]).default("open"),
        customFields: z.array(z.object({ id: z.string(), value: z.string() })).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { locationId, ...data } = input;
        const service = await getServiceForUser(ctx.user.id, locationId);
        const result = await service.createOpportunity(data);
        return result.data;
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        ghlErrorToTRPC(err);
      }
    }),

  updateOpportunity: protectedProcedure
    .input(
      z.object({
        opportunityId: z.string().min(1),
        locationId: z.string().optional(),
        stageId: z.string().optional(),
        status: z.enum(["open", "won", "lost", "abandoned"]).optional(),
        monetaryValue: z.number().optional(),
        name: z.string().optional(),
        customFields: z.array(z.object({ id: z.string(), value: z.string() })).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { opportunityId, locationId, ...data } = input;
        const service = await getServiceForUser(ctx.user.id, locationId);
        const result = await service.updateOpportunity(opportunityId, data);
        return result.data;
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        ghlErrorToTRPC(err);
      }
    }),

  // ----------------------------------------
  // Campaign / Drip Management (AI-3461)
  // ----------------------------------------

  listCampaigns: protectedProcedure
    .input(z.object({ locationId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      try {
        const service = await getServiceForUser(ctx.user.id, input?.locationId);
        const result = await service.listCampaigns();
        return result.data;
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        ghlErrorToTRPC(err);
      }
    }),

  addContactToCampaign: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().min(1),
        contactId: z.string().min(1),
        locationId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const service = await getServiceForUser(ctx.user.id, input.locationId);
        await service.addContactToCampaign(input.campaignId, input.contactId);
        return { success: true };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        ghlErrorToTRPC(err);
      }
    }),

  removeContactFromCampaign: protectedProcedure
    .input(
      z.object({
        campaignId: z.string().min(1),
        contactId: z.string().min(1),
        locationId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const service = await getServiceForUser(ctx.user.id, input.locationId);
        await service.removeContactFromCampaign(input.campaignId, input.contactId);
        return { success: true };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        ghlErrorToTRPC(err);
      }
    }),

  // ----------------------------------------
  // Workflows (AI-3461)
  // ----------------------------------------

  listWorkflows: protectedProcedure
    .input(z.object({ locationId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      try {
        const service = await getServiceForUser(ctx.user.id, input?.locationId);
        const result = await service.listWorkflows();
        return result.data;
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        ghlErrorToTRPC(err);
      }
    }),

  // ----------------------------------------
  // Messaging / Communication (AI-5149)
  // ----------------------------------------

  sendSMS: protectedProcedure
    .input(
      z.object({
        contactId: z.string().min(1),
        message: z.string().min(1).max(1600),
        locationId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const service = await getServiceForUser(ctx.user.id, input.locationId);
        const result = await service.sendSMS(input.contactId, input.message);
        return result.data;
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        ghlErrorToTRPC(err);
      }
    }),

  sendEmail: protectedProcedure
    .input(
      z.object({
        contactId: z.string().min(1),
        subject: z.string().min(1).max(998),
        html: z.string().min(1),
        emailFrom: z.string().email().optional(),
        emailTo: z.string().email().optional(),
        emailReplyTo: z.string().email().optional(),
        templateId: z.string().optional(),
        attachments: z
          .array(
            z.object({
              url: z.string().url(),
              name: z.string().optional(),
            })
          )
          .optional(),
        locationId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { contactId, locationId, ...emailData } = input;
        const service = await getServiceForUser(ctx.user.id, locationId);
        const result = await service.sendEmail(contactId, emailData);
        return result.data;
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        ghlErrorToTRPC(err);
      }
    }),

  getMessageStatus: protectedProcedure
    .input(
      z.object({
        messageId: z.string().min(1),
        locationId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const service = await getServiceForUser(ctx.user.id, input.locationId);
        const result = await service.getMessageStatus(input.messageId);
        return result.data;
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        ghlErrorToTRPC(err);
      }
    }),

  listTemplates: protectedProcedure
    .input(
      z
        .object({
          locationId: z.string().optional(),
          type: z.enum(["sms", "email", "whatsapp"]).optional(),
          limit: z.number().int().min(1).max(100).default(20),
          offset: z.number().int().min(0).default(0),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      try {
        const service = await getServiceForUser(ctx.user.id, input?.locationId);
        const result = await service.listTemplates({
          type: input?.type,
          limit: input?.limit,
          offset: input?.offset,
        });
        return result.data;
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        ghlErrorToTRPC(err);
      }
    }),
});
