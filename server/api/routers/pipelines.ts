/**
 * Pipelines tRPC Router
 *
 * Multi-step workflow pipeline management endpoints.
 * Placeholder router — full implementation coming soon.
 */

import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";

export const pipelinesRouter = router({
  /** List all pipelines for the current agency */
  list: protectedProcedure.query(async ({ ctx }) => {
    return [] as Array<{
      id: string;
      name: string;
      description: string;
      steps: number;
      status: "active" | "draft" | "archived";
      createdAt: string;
    }>;
  }),

  /** Get a single pipeline by ID */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return null;
    }),
});
