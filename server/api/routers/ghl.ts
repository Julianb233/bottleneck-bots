/**
 * GHL tRPC Router
 *
 * Provides typed RPC endpoints for GHL integration management:
 * - ghl.status — connection health check per location
 * - ghl.listLocations — list all authorized GHL locations
 * - ghl.disconnect — revoke and clean up a location
 *
 * Linear: AI-2877
 */

import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getGHLService } from "../../services/ghl.service";

export const ghlRouter = router({
  /**
   * Get connection status for a specific user's GHL locations.
   */
  status: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const service = getGHLService();
        const status = await service.getConnectionStatus(ctx.user.id);
        return status;
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
        locationId: c.locationId,
        locationName: c.locationName,
        status: c.status,
        connectedAt: c.connectedAt,
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
   * Test a specific GHL location connection.
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
   */
  configStatus: protectedProcedure.query(async () => {
    return {
      configured: !!process.env.GHL_CLIENT_ID && !!process.env.GHL_CLIENT_SECRET,
      hasClientId: !!process.env.GHL_CLIENT_ID,
      hasClientSecret: !!process.env.GHL_CLIENT_SECRET,
    };
  }),

  /**
   * Get circuit breaker status for the GHL service.
   * Used by the UI to show warning banners when the API is unavailable.
   */
  circuitBreakerStatus: protectedProcedure.query(async () => {
    // The GHLService circuit breaker is per-instance and in-memory.
    // For now, return a default "closed" status. In production with
    // multiple instances, this would query Redis.
    // TODO: Expose actual circuit breaker state from GHLService singleton
    return {
      state: "closed" as "closed" | "open" | "half-open",
      failureCount: 0,
      lastFailure: null as number | null,
      nextRetryAt: null as number | null,
    };
  }),
});
