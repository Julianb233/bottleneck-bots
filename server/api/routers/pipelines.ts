/**
 * Pipelines Router (stub)
 * Multi-step workflow pipeline management.
 * TODO: Implement pipeline CRUD and execution endpoints.
 */

import { router, protectedProcedure } from "../../_core/trpc";

export const pipelinesRouter = router({
  /** List all pipelines for the current user */
  list: protectedProcedure.query(async () => {
    return { pipelines: [] };
  }),
});
