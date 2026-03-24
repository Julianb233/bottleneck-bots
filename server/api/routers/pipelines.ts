/**
 * Pipelines Router - Multi-Step Workflow Pipeline Execution
 *
 * Placeholder router for pipeline management endpoints.
 * Will be fully implemented when pipeline execution features are built.
 */

import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";

export const pipelinesRouter = router({
  list: protectedProcedure.query(async () => {
    return { success: true, pipelines: [] };
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      return { success: true, pipeline: null };
    }),
});
