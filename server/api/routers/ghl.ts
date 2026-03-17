/**
 * GHL tRPC Router
 *
 * Provides typed RPC endpoints for GHL OAuth integration management:
 * - ghl.connect — initiate OAuth authorization flow
 * - ghl.status — list connection statuses for user
 * - ghl.testConnection — verify a connection works
 * - ghl.disconnect — revoke and clean up a location
 * - ghl.configStatus — check if GHL OAuth is configured
 */

import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getGHLService } from "../../services/ghl.service";

export const ghlRouter = router({
  /**
   * Initiate GHL OAuth authorization flow.
   * Returns an authorization URL for the user to visit.
   */
  connect: protectedProcedure
    .input(
      z
        .object({
          scopes: z.array(z.string()).optional(),
        })
        .optional()
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const service = getGHLService();
        const result = await service.initiateAuthorization(
          ctx.user.id,
          input?.scopes
        );
        return result;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to initiate GHL authorization",
        });
      }
    }),

  /**
   * Get connection status for all GHL locations for the current user.
   */
  status: protectedProcedure.query(async ({ ctx }) => {
    try {
      const service = getGHLService();
      const connections = await service.getConnectionStatus(ctx.user.id);
      return { connections };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Failed to get GHL connection status",
      });
    }
  }),

  /**
   * List all connected GHL locations for the current user.
   */
  listLocations: protectedProcedure.query(async ({ ctx }) => {
    try {
      const service = getGHLService();
      const connections = await service.getConnections(ctx.user.id);
      return {
        locations: connections.map((c) => ({
          id: c.id,
          locationId: c.locationId,
          locationName: c.locationName,
          companyId: c.companyId,
          status: c.status,
          scopes: c.scopes,
          connectedAt: c.connectedAt,
          lastSyncAt: c.lastSyncAt,
          lastError: c.lastError,
        })),
      };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Failed to list GHL locations",
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
        const result = await service.testConnection(
          ctx.user.id,
          input.locationId
        );
        return result;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to test GHL connection",
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
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to disconnect GHL location",
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
