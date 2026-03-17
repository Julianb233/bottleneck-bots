/**
 * Agent Skill Configuration tRPC Router
 * Endpoints for managing agent skill toggles, permissions, rate limits, and analytics
 */

import { router, protectedProcedure } from "../../_core/trpc";
import { z } from "zod";
import { getAgentSkillConfigService as getSkillConfigService } from "../../services/agentSkillConfig.service";
import { TRPCError } from "@trpc/server";

// ========================================
// VALIDATION SCHEMAS
// ========================================

const updateSkillSchema = z.object({
  skillId: z.string().min(1),
  enabled: z.boolean().optional(),
  permission: z.enum(["read-only", "read-write"]).optional(),
  rateLimit: z.number().int().min(1).max(1000).optional(),
});

const analyticsSchema = z.object({
  periodDays: z.number().int().min(1).max(365).default(30),
});

// ========================================
// ROUTER
// ========================================

export const agentSkillConfigRouter = router({
  /**
   * List all skill configurations for current user
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      const service = getSkillConfigService();
      const skills = await service.getUserSkillConfig(ctx.user.id);
      return { success: true, skills };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Failed to list skills",
      });
    }
  }),

  /**
   * Update a skill's configuration (toggle, permission, rate limit)
   */
  update: protectedProcedure
    .input(updateSkillSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const service = getSkillConfigService();
        const updated = await service.updateSkillConfig(ctx.user.id, input.skillId, {
          enabled: input.enabled,
          permission: input.permission,
          rateLimit: input.rateLimit,
        });
        return { success: true, skill: updated };
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Failed to update skill",
        });
      }
    }),

  /**
   * Check permission for a specific skill
   */
  checkPermission: protectedProcedure
    .input(z.object({ skillId: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      try {
        const service = getSkillConfigService();
        const result = await service.checkSkillPermission(ctx.user.id, input.skillId);
        return { success: true, ...result };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to check permission",
        });
      }
    }),

  /**
   * Get usage analytics for all skills
   */
  analytics: protectedProcedure
    .input(analyticsSchema)
    .query(async ({ input, ctx }) => {
      try {
        const service = getSkillConfigService();
        const analytics = await service.getSkillUsageAnalytics(ctx.user.id, input.periodDays);
        return { success: true, analytics };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to get analytics",
        });
      }
    }),
});
