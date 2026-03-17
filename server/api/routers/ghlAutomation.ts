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
  }),
});
