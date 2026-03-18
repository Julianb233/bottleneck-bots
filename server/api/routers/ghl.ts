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
 * Linear: AI-2877, AI-2881
 */

import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";
import { TRPCError } from "@trpc/server";
import { GHLService, GHLError } from "../../services/ghl.service";
import { getDb } from "../../db";
import { ghlLocations, ghlActiveLocation } from "../../../drizzle/schema-ghl-locations";
import { eq, and } from "drizzle-orm";

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

export const ghlRouter = router({
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
        const status = await service.getConnectionStatus();
        return status;
      } catch (err) {
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
          message:
            err instanceof Error ? err.message : "Failed to check GHL status",
        });
      }
    }),

  /**
   * List all authorized GHL locations for the current user.
   * Merges data from integrations table + ghl_locations table.
   */
  listLocations: protectedProcedure.query(async ({ ctx }) => {
    try {
      // Get OAuth-connected locations from integrations table
      const oauthLocations = await GHLService.listLocations(ctx.user.id);

      // Get enriched location data from ghl_locations table
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

      // Build lookup map of enriched data
      const enrichedMap = new Map(
        locationRows.map((row) => [row.locationId, row])
      );

      // Merge: OAuth data + enriched metadata
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
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          err instanceof Error
            ? err.message
            : "Failed to list GHL locations",
      });
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

        // Also deactivate in ghl_locations table
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

          // If this was the active location, clear it
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
        if (err instanceof GHLError) {
          throw new TRPCError({
            code:
              err.category === "auth"
                ? "UNAUTHORIZED"
                : "INTERNAL_SERVER_ERROR",
            message: err.message,
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            err instanceof Error
              ? err.message
              : "Failed to disconnect GHL location",
        });
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

    // Fetch enriched details
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

      // Verify this location exists and belongs to user
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

      // Upsert active location
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
    .input(
      z.object({
        locationId: z.string().min(1),
      })
    )
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

      // Get current config and merge
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

      // Filter out undefined values
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
});
