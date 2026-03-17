/**
 * GHL tRPC Router
 *
 * Provides typed RPC endpoints for GHL integration management:
 * - ghl.status — connection health check per location
 * - ghl.listLocations — list all authorized GHL locations
 * - ghl.disconnect — revoke and clean up
 * - ghl.getLocationDetails — fetch location details from GHL API
 * - ghl.setActiveLocation — switch active location
 * - ghl.getActiveLocation — get current active location
 * - ghl.updateLocationConfig — update per-location settings
 * - ghl.getLocationConfig — get per-location settings
 *
 * Linear: AI-2877, AI-2881
 */

import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";
import { TRPCError } from "@trpc/server";
import { GHLService, GHLError } from "../../services/ghl.service";
import { getDb } from "../../db";
import { ghlLocationConfigs, integrations } from "../../../drizzle/schema";
import { eq, and } from "drizzle-orm";

const syncConfigSchema = z.object({
  autoSyncContacts: z.boolean().optional(),
  autoSyncOpportunities: z.boolean().optional(),
  syncInterval: z.number().min(5).max(1440).optional(),
  defaultTags: z.array(z.string()).optional(),
  contactImportEnabled: z.boolean().optional(),
  webhookEnabled: z.boolean().optional(),
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
   * List all authorized GHL locations for the current user,
   * enriched with cached location names and config from ghl_location_configs.
   */
  listLocations: protectedProcedure.query(async ({ ctx }) => {
    try {
      const locations = await GHLService.listLocations(ctx.user.id);

      // Enrich with cached configs
      const db = await getDb();
      if (!db) return locations.map((l) => ({ ...l, name: null, isActive: false, syncConfig: null }));

      const configs = await db
        .select()
        .from(ghlLocationConfigs)
        .where(eq(ghlLocationConfigs.userId, ctx.user.id));

      const configMap = new Map(configs.map((c) => [c.locationId, c]));

      return locations.map((loc) => {
        const config = configMap.get(loc.locationId);
        return {
          ...loc,
          name: config?.locationName || null,
          isActive: config?.isActive ?? false,
          syncConfig: config?.syncConfig || null,
          locationDetails: config?.locationDetails || null,
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

        // Also clean up the location config
        const db = await getDb();
        if (db) {
          await db
            .delete(ghlLocationConfigs)
            .where(
              and(
                eq(ghlLocationConfigs.userId, ctx.user.id),
                eq(ghlLocationConfigs.locationId, input.locationId)
              )
            );
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
   * Fetch location details from GHL API and cache them locally.
   */
  getLocationDetails: protectedProcedure
    .input(z.object({ locationId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      try {
        const service = new GHLService(input.locationId, ctx.user.id);
        const res = await service.request<{
          location: {
            id: string;
            name: string;
            companyId: string;
            address?: string;
            city?: string;
            state?: string;
            country?: string;
            phone?: string;
            email?: string;
            website?: string;
            timezone?: string;
          };
        }>({
          method: "GET",
          endpoint: `/locations/${input.locationId}`,
        });

        const loc = res.data.location;

        // Cache the location details
        const db = await getDb();
        if (db) {
          const [existing] = await db
            .select()
            .from(ghlLocationConfigs)
            .where(
              and(
                eq(ghlLocationConfigs.userId, ctx.user.id),
                eq(ghlLocationConfigs.locationId, input.locationId)
              )
            )
            .limit(1);

          const details = {
            address: loc.address,
            city: loc.city,
            state: loc.state,
            country: loc.country,
            phone: loc.phone,
            email: loc.email,
            website: loc.website,
            timezone: loc.timezone,
          };

          if (existing) {
            await db
              .update(ghlLocationConfigs)
              .set({
                locationName: loc.name,
                companyId: loc.companyId,
                locationDetails: details,
                updatedAt: new Date(),
              })
              .where(eq(ghlLocationConfigs.id, existing.id));
          } else {
            await db.insert(ghlLocationConfigs).values({
              userId: ctx.user.id,
              locationId: input.locationId,
              locationName: loc.name,
              companyId: loc.companyId,
              isActive: false,
              locationDetails: details,
              syncConfig: {
                autoSyncContacts: false,
                autoSyncOpportunities: false,
                syncInterval: 30,
                defaultTags: [],
                contactImportEnabled: false,
                webhookEnabled: false,
              },
            });
          }
        }

        return loc;
      } catch (err) {
        if (err instanceof GHLError) {
          throw new TRPCError({
            code: err.category === "auth" ? "UNAUTHORIZED" : "INTERNAL_SERVER_ERROR",
            message: err.message,
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : "Failed to get location details",
        });
      }
    }),

  /**
   * Set the active GHL location for the current user.
   * Deactivates all other locations for this user first.
   */
  setActiveLocation: protectedProcedure
    .input(z.object({ locationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Verify the location exists as a connected integration
      const [integration] = await db
        .select()
        .from(integrations)
        .where(
          and(
            eq(integrations.userId, ctx.user.id),
            eq(integrations.service, `ghl:${input.locationId}`),
            eq(integrations.isActive, "true")
          )
        )
        .limit(1);

      if (!integration) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `GHL location ${input.locationId} is not connected`,
        });
      }

      // Deactivate all locations for this user
      const allConfigs = await db
        .select()
        .from(ghlLocationConfigs)
        .where(eq(ghlLocationConfigs.userId, ctx.user.id));

      for (const config of allConfigs) {
        if (config.isActive) {
          await db
            .update(ghlLocationConfigs)
            .set({ isActive: false, updatedAt: new Date() })
            .where(eq(ghlLocationConfigs.id, config.id));
        }
      }

      // Activate the target location (upsert)
      const [existing] = await db
        .select()
        .from(ghlLocationConfigs)
        .where(
          and(
            eq(ghlLocationConfigs.userId, ctx.user.id),
            eq(ghlLocationConfigs.locationId, input.locationId)
          )
        )
        .limit(1);

      if (existing) {
        await db
          .update(ghlLocationConfigs)
          .set({ isActive: true, updatedAt: new Date() })
          .where(eq(ghlLocationConfigs.id, existing.id));
      } else {
        await db.insert(ghlLocationConfigs).values({
          userId: ctx.user.id,
          locationId: input.locationId,
          isActive: true,
          syncConfig: {
            autoSyncContacts: false,
            autoSyncOpportunities: false,
            syncInterval: 30,
            defaultTags: [],
            contactImportEnabled: false,
            webhookEnabled: false,
          },
        });
      }

      return { success: true, activeLocationId: input.locationId };
    }),

  /**
   * Get the current active GHL location for the user.
   */
  getActiveLocation: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;

    const [config] = await db
      .select()
      .from(ghlLocationConfigs)
      .where(
        and(
          eq(ghlLocationConfigs.userId, ctx.user.id),
          eq(ghlLocationConfigs.isActive, true)
        )
      )
      .limit(1);

    if (!config) return null;

    return {
      locationId: config.locationId,
      locationName: config.locationName,
      companyId: config.companyId,
      syncConfig: config.syncConfig,
      locationDetails: config.locationDetails,
    };
  }),

  /**
   * Update per-location configuration (sync settings, tags, etc.)
   */
  updateLocationConfig: protectedProcedure
    .input(
      z.object({
        locationId: z.string().min(1),
        locationName: z.string().optional(),
        syncConfig: syncConfigSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const [existing] = await db
        .select()
        .from(ghlLocationConfigs)
        .where(
          and(
            eq(ghlLocationConfigs.userId, ctx.user.id),
            eq(ghlLocationConfigs.locationId, input.locationId)
          )
        )
        .limit(1);

      if (existing) {
        const updates: Record<string, unknown> = { updatedAt: new Date() };
        if (input.locationName !== undefined) updates.locationName = input.locationName;
        if (input.syncConfig !== undefined) {
          updates.syncConfig = { ...((existing.syncConfig as object) || {}), ...input.syncConfig };
        }
        await db
          .update(ghlLocationConfigs)
          .set(updates)
          .where(eq(ghlLocationConfigs.id, existing.id));

        return { success: true, locationId: input.locationId };
      } else {
        await db.insert(ghlLocationConfigs).values({
          userId: ctx.user.id,
          locationId: input.locationId,
          locationName: input.locationName || null,
          isActive: false,
          syncConfig: input.syncConfig || {
            autoSyncContacts: false,
            autoSyncOpportunities: false,
            syncInterval: 30,
            defaultTags: [],
            contactImportEnabled: false,
            webhookEnabled: false,
          },
        });
        return { success: true, locationId: input.locationId };
      }
    }),

  /**
   * Get per-location configuration.
   */
  getLocationConfig: protectedProcedure
    .input(z.object({ locationId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;

      const [config] = await db
        .select()
        .from(ghlLocationConfigs)
        .where(
          and(
            eq(ghlLocationConfigs.userId, ctx.user.id),
            eq(ghlLocationConfigs.locationId, input.locationId)
          )
        )
        .limit(1);

      return config || null;
    }),
});
