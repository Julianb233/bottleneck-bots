import { router, protectedProcedure } from "../../_core/trpc";

/**
 * GHL Automation Router - GoHighLevel browser automation functions
 * Stub: full implementation pending
 */
export const ghlAutomationRouter = router({
  list: protectedProcedure.query(() => {
    return [];
  }),
});
