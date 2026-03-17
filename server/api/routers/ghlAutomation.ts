/**
 * GHL Automation tRPC Router
 *
 * Provides endpoints for GoHighLevel browser automation functions.
 * Placeholder router — full implementation coming soon.
 */

import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";

export const ghlAutomationRouter = router({
  /** List available GHL automation actions */
  listActions: protectedProcedure.query(async ({ ctx }) => {
    return [] as Array<{
      id: string;
      name: string;
      description: string;
      category: string;
    }>;
  }),

  /** Get the status of a running automation */
  getStatus: protectedProcedure
    .input(z.object({ automationId: z.string() }))
    .query(async ({ ctx, input }) => {
      return null;
    }),
});
