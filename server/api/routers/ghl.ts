/**
 * GHL tRPC Router
 *
 * Provides typed RPC endpoints for GHL integration management:
 * - ghl.connect — initiate OAuth authorization flow
 * - ghl.status — connection health check per user
 * - ghl.listLocations — list all authorized GHL locations
 * - ghl.disconnect — revoke and clean up a location
 * - ghl.configStatus — check if GHL OAuth is configured
 *
 * Linear: AI-2877
 */

import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getGHLService } from "../../services/ghl.service";

export const ghlRouter = router({
  /**
   * Initiate GHL OAuth authorization flow.
   * Returns the authorization URL to redirect the user to.
   */
  connect: protectedProcedure
    .input(
      z.object({
        scopes: z.array(z.string()).optional(),
      }).optional()
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const service = getGHLService();
        const result = await service.initiateAuthorization(
          ctx.user.id,
          input?.scopes
        );
        return result;
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            err instanceof Error
              ? err.message
              : "Failed to initiate GHL OAuth",
        });
      }
    }),

  /**
   * Get connection status for the current user's GHL locations.
   */
  status: protectedProcedure.query(async ({ ctx }) => {
    try {
      const service = getGHLService();
      const connections = await service.getConnectionStatus(ctx.user.id);
      return {
        connected: connections.some((c) => c.status === "connected"),
        connections,
      };
    } catch (err) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          err instanceof Error ? err.message : "Failed to check GHL status",
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
   * Test a GHL connection by making a simple API call.
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
      configured: !!process.env.GHL_CLIENT_ID && !!process.env.GHL_CLIENT_SECRET,
      hasClientId: !!process.env.GHL_CLIENT_ID,
      hasClientSecret: !!process.env.GHL_CLIENT_SECRET,
    };
  }),
});
