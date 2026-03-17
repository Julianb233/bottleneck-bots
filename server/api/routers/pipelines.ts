/**
 * Pipelines Router - tRPC API for Multi-Step Workflow Pipelines
 *
 * Provides endpoints for managing multi-step workflow pipelines
 * that chain browser automation tasks together.
 *
 * TODO: Implement full CRUD operations for pipeline management
 */

import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";

export const pipelinesRouter = router({
  /**
   * List all pipelines for the current user
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    // Stub: return empty list until pipeline schema is deployed
    return [] as Array<{
      id: string;
      name: string;
      description: string;
      steps: number;
      status: "draft" | "active" | "paused";
      createdAt: string;
    }>;
  }),

  /**
   * Get a single pipeline by ID
   */
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return null;
    }),
});
