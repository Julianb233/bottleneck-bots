/**
 * GHL Automation Router - GoHighLevel browser automation functions
 * Stub router for GHL automation operations
 */

import { router, protectedProcedure } from "../../_core/trpc";

export const ghlAutomationRouter = router({
  list: protectedProcedure.query(async () => {
    return { success: true, automations: [] };
  }),
});
