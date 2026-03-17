<<<<<<< HEAD
import { router, protectedProcedure } from "../../_core/trpc";

/**
 * Pipelines Router - Multi-step workflow pipelines
 * Stub: full implementation pending
 */
export const pipelinesRouter = router({
  list: protectedProcedure.query(() => {
    return [];
  }),
=======
/**
 * Pipelines Router
 *
 * Multi-step workflow pipelines for agent task orchestration.
 * Placeholder router — endpoints to be implemented.
 */

import { router, protectedProcedure } from "../../_core/trpc";
import { z } from "zod";

export const pipelinesRouter = router({
  /** List all pipelines for the current user */
  list: protectedProcedure.query(async ({ ctx }) => {
    return { pipelines: [], count: 0 };
  }),

  /** Get a single pipeline by ID */
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      return null;
    }),
>>>>>>> worktree-agent-adf56056
});
