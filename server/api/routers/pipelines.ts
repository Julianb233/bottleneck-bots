/**
 * Pipelines Router (stub)
 *
 * Pipeline operations are primarily handled through the GHL router (ghl.ts)
 * which provides listPipelines, searchOpportunities, createOpportunity,
 * and updateOpportunity endpoints.
 *
 * This router provides a platform-agnostic pipeline view layer
 * that can aggregate data from GHL and other CRM sources.
 *
 * Linear: AI-3461
 */

import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";

export const pipelinesRouter = router({
  /**
   * List all pipelines across connected CRM integrations.
   * Currently delegates to GHL; future: aggregate from multiple sources.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    // TODO: aggregate from GHL + future CRM sources
    return { pipelines: [], source: "stub" };
  }),

  /**
   * Get pipeline summary stats (opportunity counts, total value per stage).
   */
  summary: protectedProcedure
    .input(z.object({ pipelineId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      return {
        pipelineId: input.pipelineId,
        stages: [],
        totalValue: 0,
        totalOpportunities: 0,
      };
    }),
});
