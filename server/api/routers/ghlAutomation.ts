/**
 * GHL Automation Router (stub)
 * GoHighLevel browser automation functions.
 * TODO: Implement the 48 GHL browser automation functions.
 */

import { router, protectedProcedure } from "../../_core/trpc";

export const ghlAutomationRouter = router({
  /** List available GHL automation actions */
  listActions: protectedProcedure.query(async () => {
    return { actions: [] };
  }),
});
