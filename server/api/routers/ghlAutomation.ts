/**
 * GHL Automation Router - GoHighLevel Browser Automation
 *
 * Stub router for GHL automation functions. Endpoints to be implemented.
 */

import { router, protectedProcedure } from "../../_core/trpc";

export const ghlAutomationRouter = router({
  list: protectedProcedure.query(async () => {
    return [];
  }),
});
