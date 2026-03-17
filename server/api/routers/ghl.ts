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
import { GHLService, GHLError } from "../../services/ghl.service";

export const ghlRouter = router({
  /**
   * Get connection status for a specific GHL location.
   *
   * @example
   * ```ts
   * const status = await trpc.ghl.status.query({ locationId: "abc123" });
   * console.log(status.connected); // true
   * ```
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
   *
   * @example
   * ```ts
   * const locations = await trpc.ghl.listLocations.query();
   * locations.forEach(loc => console.log(loc.locationId, loc.connected));
   * ```
   */
  listLocations: protectedProcedure.query(async ({ ctx }) => {
    try {
      const locations = await GHLService.listLocations(ctx.user.id);
      return locations;
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
   *
   * @example
   * ```ts
   * await trpc.ghl.disconnect.mutate({ locationId: "abc123" });
   * ```
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
