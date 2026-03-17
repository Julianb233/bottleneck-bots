/**
 * Pipelines Router - Multi-Step Workflow Pipelines
 *
 * Stub router for pipeline management. Endpoints to be implemented.
 */

import { router, protectedProcedure } from "../../_core/trpc";

export const pipelinesRouter = router({
  list: protectedProcedure.query(async () => {
    return [];
  }),
});
