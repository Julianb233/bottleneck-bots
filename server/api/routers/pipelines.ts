/**
 * Pipelines Router - Multi-step workflow pipeline management
 * Stub router for pipeline CRUD operations
 */

import { router, protectedProcedure } from "../../_core/trpc";

export const pipelinesRouter = router({
  list: protectedProcedure.query(async () => {
    return { success: true, pipelines: [] };
  }),
});
