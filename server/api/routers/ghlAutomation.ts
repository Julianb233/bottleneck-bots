<<<<<<< HEAD
import { router, protectedProcedure } from "../../_core/trpc";

/**
 * GHL Automation Router - GoHighLevel browser automation functions
 * Stub: full implementation pending
 */
export const ghlAutomationRouter = router({
  list: protectedProcedure.query(() => {
    return [];
=======
/**
 * GHL Automation Router
 *
 * GoHighLevel browser automation functions for CRM operations.
 * Placeholder router — endpoints to be implemented.
 */

import { router, protectedProcedure } from "../../_core/trpc";
import { z } from "zod";

export const ghlAutomationRouter = router({
  /** List available GHL automation actions */
  listActions: protectedProcedure.query(async ({ ctx }) => {
    return { actions: [], count: 0 };
  }),

  /** Get status of GHL automation integration */
  status: protectedProcedure.query(async ({ ctx }) => {
    return { connected: false, locationCount: 0 };
>>>>>>> worktree-agent-adf56056
  }),
});
