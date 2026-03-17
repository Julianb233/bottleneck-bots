/**
 * GHL tRPC Router
 *
 * Provides typed RPC endpoints for GHL integration management:
 * - ghl.connect — initiate OAuth flow
 * - ghl.disconnect — revoke tokens and disconnect a location
 * - ghl.status — connection health check for all locations
 * - ghl.listLocations — list all authorized GHL locations
 * - ghl.testConnection — verify a location's API access works
 * - ghl.configStatus — check if GHL env vars are configured
 *
 * Linear: AI-2877
 */

import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getGHLService } from "../../services/ghl.service";

export const ghlRouter = router({
  /**
   * Initiate GHL OAuth flow — returns the authorization URL
   */
  connect: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      const service = getGHLService();
      const result = await service.initiateAuthorization(ctx.user.id);
      return result;
    } catch (err) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          err instanceof Error ? err.message : "Failed to initiate GHL OAuth",
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
        const service = getGHLService();
        await service.revokeAccess(ctx.user.id, input.locationId);
        return {
          success: true,
          message: `Disconnected GHL location ${input.locationId}`,
        };
      } catch (err) {
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
   * Get connection status for all GHL locations.
   */
  status: protectedProcedure.query(async ({ ctx }) => {
    try {
      const service = getGHLService();
      const connections = await service.getConnectionStatus(ctx.user.id);
      return {
        connected: connections.some((c) => c.status === "connected"),
        locations: connections,
      };
    } catch (err) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          err instanceof Error
            ? err.message
            : "Failed to check GHL status",
      });
    }
  }),

  /**
   * List all authorized GHL locations for the current user.
   */
  listLocations: protectedProcedure.query(async ({ ctx }) => {
    try {
      const service = getGHLService();
      const connections = await service.getConnections(ctx.user.id);
      return connections.map((c) => ({
        id: c.id,
        locationId: c.locationId,
        locationName: c.locationName,
        companyId: c.companyId,
        status: c.status,
        scopes: c.scopes,
        connectedAt: c.connectedAt,
        lastSyncAt: c.lastSyncAt,
        lastError: c.lastError,
      }));
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
   * Test a specific GHL location connection by making a lightweight API call.
   */
  testConnection: protectedProcedure
    .input(
      z.object({
        locationId: z.string().min(1, "locationId is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const service = getGHLService();
        return await service.testConnection(ctx.user.id, input.locationId);
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            err instanceof Error
              ? err.message
              : "Failed to test GHL connection",
        });
      }
    }),

  /**
   * Get the GHL OAuth configuration status (whether client ID/secret are set).
   * Used by the UI to know if the "Connect" button should be enabled.
   */
  configStatus: protectedProcedure.query(async () => {
    return {
      configured:
        !!process.env.GHL_CLIENT_ID && !!process.env.GHL_CLIENT_SECRET,
      hasClientId: !!process.env.GHL_CLIENT_ID,
      hasClientSecret: !!process.env.GHL_CLIENT_SECRET,
    };
  }),
});
