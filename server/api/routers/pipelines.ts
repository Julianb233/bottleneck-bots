import { router, protectedProcedure } from "../../_core/trpc";

/**
 * Pipelines Router - Multi-step workflow pipelines
 * Stub: full implementation pending
 */
export const pipelinesRouter = router({
  list: protectedProcedure.query(() => {
    return [];
  }),
});
