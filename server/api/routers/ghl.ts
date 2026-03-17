/**
 * GHL (GoHighLevel) tRPC Router
 *
 * Provides typed RPC endpoints for GHL integration management:
 * - ghl.connect — initiate OAuth flow
 * - ghl.status — connection health check
 * - ghl.listLocations — list all authorized GHL locations
 * - ghl.disconnect — revoke and clean up a location
 * - ghl.configStatus — check if GHL OAuth is configured
 * - ghl.testConnection — verify a location connection works
 *
 * Linear: AI-2877
 */

import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getGHLService } from "../../services/ghl.service";

export const ghlRouter = router({
  /**
   * Initiate GHL OAuth connection.
   * Returns the authorization URL for the client to redirect to.
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
          message: err instanceof Error ? err.message : "Failed to initiate GHL OAuth",
        });
      }
    }),

  /**
   * Get connection status for all GHL locations of the current user.
   */
  status: protectedProcedure.query(async ({ ctx }) => {
    try {
      const service = getGHLService();
      const connections = await service.getConnectionStatus(ctx.user.id);
      return {
        connected: connections.some((c) => c.status === "connected"),
        connections,
      };
    } catch {
      return { connected: false, connections: [] };
    }
  }),

  /**
   * List all authorized GHL locations for the current user.
   * Returns connection details including locationId, status, scopes, etc.
   */
  listLocations: protectedProcedure.query(async ({ ctx }) => {
    try {
      const service = getGHLService();
      const connections = await service.getConnections(ctx.user.id);

      return connections
        .filter((c) => c.status !== "disconnected")
        .map((c) => ({
          locationId: c.locationId,
          locationName: c.locationName,
          companyId: c.companyId,
          status: c.status,
          scopes: c.scopes ? c.scopes.split(" ") : [],
          connectedAt: c.connectedAt,
          lastSyncAt: c.lastSyncAt,
          expiresAt: null as number | null,
        }));
    } catch (err) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: err instanceof Error ? err.message : "Failed to list GHL locations",
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
          message: err instanceof Error ? err.message : "Failed to disconnect GHL location",
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

  /**
   * Test a connection to a GHL location by making a simple API call.
   */
  testConnection: protectedProcedure
    .input(
      z.object({
        locationId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const service = getGHLService();
        return await service.testConnection(ctx.user.id, input.locationId);
      } catch {
        return {
          success: false,
          error: "Connection test failed",
        };
      }
    }),
});
