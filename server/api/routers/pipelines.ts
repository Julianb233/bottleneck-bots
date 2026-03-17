<<<<<<< HEAD
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
=======
/**
 * Pipelines Router (stub)
 * Multi-step workflow pipeline management
 */
import { router } from "../../_core/trpc";

export const pipelinesRouter = router({});
>>>>>>> worktree-agent-a3dc1bfd
