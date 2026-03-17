/**
 * Agent Training Router - tRPC API for Agent Training Configuration
 *
 * Provides endpoints for:
 * - Workflow Training: CRUD for workflow training configs stored as knowledge entries
 * - Skill Configuration: Per-user skill enable/disable and permission management
 * - Behavior Configuration: Personality, response style, verbosity, and escalation rules
 *
 * Storage strategy: All configs are persisted in the `knowledge_entries` table using
 * category-scoped rows ('workflow_training', 'skill_config', 'behavior_config').
 */

import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../../db";
import { eq, and } from "drizzle-orm";
import { knowledgeEntries } from "../../../drizzle/schema-agent";
import { getAgentSkillConfigService } from "../../services/agentSkillConfig.service";

// ========================================
// CONSTANTS — DEFAULT CONFIGURATIONS
// ========================================

const DEFAULT_SKILLS = [
  { id: "browser", name: "Browser Automation", enabled: true, permission: "read-write" as const },
  { id: "ghl_api", name: "GoHighLevel API", enabled: true, permission: "read-write" as const },
  { id: "email", name: "Email Sending", enabled: true, permission: "read-write" as const },
  { id: "sms", name: "SMS Messaging", enabled: false, permission: "read" as const },
  { id: "voice", name: "Voice Calling", enabled: false, permission: "read" as const },
  { id: "file_creation", name: "File Creation", enabled: true, permission: "read-write" as const },
  { id: "web_scraping", name: "Web Scraping", enabled: true, permission: "read" as const },
  { id: "calendar", name: "Calendar Management", enabled: true, permission: "read-write" as const },
  { id: "crm", name: "CRM Operations", enabled: true, permission: "read-write" as const },
  { id: "reporting", name: "Report Generation", enabled: true, permission: "read" as const },
];

const DEFAULT_BEHAVIOR = {
  personality: "You are a helpful, professional AI assistant for agency operations.",
  responseStyle: "professional" as const,
  verbosity: "balanced" as const,
  escalationRules: [
    {
      condition: "Payment or billing related actions",
      action: "Ask for human approval before proceeding",
    },
    {
      condition: "Deleting more than 10 records",
      action: "Confirm with user before bulk deletion",
    },
    {
      condition: "Sending messages to more than 50 contacts",
      action: "Request approval for bulk messaging",
    },
  ],
  customInstructions: "",
};

// ========================================
// ZOD SCHEMAS
// ========================================

const workflowStepSchema = z.object({
  order: z.number().int().nonnegative(),
  action: z.string().min(1),
  description: z.string().min(1),
  expectedInput: z.string().optional(),
  expectedOutput: z.string().optional(),
});

const workflowInputSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string(),
  platform: z.string().min(1),
  steps: z.array(workflowStepSchema),
});

const skillSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  enabled: z.boolean(),
  permission: z.enum(["read", "read-write"]),
  rateLimit: z.number().int().positive().optional(),
});

const escalationRuleSchema = z.object({
  condition: z.string().min(1),
  action: z.string().min(1),
});

// ========================================
// ROUTER DEFINITION
// ========================================

export const agentTrainingRouter = router({
  // ========================================
  // WORKFLOW TRAINING
  // ========================================

  /**
   * List all workflow training configs for the authenticated user.
   * Fetches active knowledge entries with category='workflow_training'.
   */
  listWorkflows: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not initialized" });
    }

    try {
      const rows = await db
        .select()
        .from(knowledgeEntries)
        .where(
          and(
            eq(knowledgeEntries.userId, ctx.user.id),
            eq(knowledgeEntries.category, "workflow_training"),
            eq(knowledgeEntries.isActive, true)
          )
        );

      const workflows = rows.map((row) => {
        let config: Record<string, unknown> = {};
        try {
          config = JSON.parse(row.content) as Record<string, unknown>;
        } catch {
          // content is not JSON — return a minimal shape
          config = { name: row.context, description: "", platform: "", steps: [] };
        }
        return {
          id: row.id,
          name: row.context,
          createdAt: row.createdAt,
          ...config,
        };
      });

      return { success: true, workflows };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Failed to list workflow training configs",
      });
    }
  }),

  /**
   * Create a new workflow training config.
   * Stores as a knowledge entry with category='workflow_training'.
   */
  createWorkflow: protectedProcedure
    .input(workflowInputSchema)
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not initialized" });
      }

      try {
        const [created] = await db
          .insert(knowledgeEntries)
          .values({
            userId: ctx.user.id,
            category: "workflow_training",
            context: input.name,
            content: JSON.stringify(input),
            isActive: true,
          })
          .returning();

        return { success: true, workflow: created };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to create workflow training config",
        });
      }
    }),

  /**
   * Update an existing workflow training config by id.
   * Verifies ownership via userId before updating.
   */
  updateWorkflow: protectedProcedure
    .input(workflowInputSchema.extend({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not initialized" });
      }

      try {
        const existing = await db
          .select({ id: knowledgeEntries.id })
          .from(knowledgeEntries)
          .where(
            and(
              eq(knowledgeEntries.id, input.id),
              eq(knowledgeEntries.userId, ctx.user.id),
              eq(knowledgeEntries.category, "workflow_training")
            )
          )
          .limit(1);

        if (existing.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Workflow training config not found",
          });
        }

        const { id, ...config } = input;
        const [updated] = await db
          .update(knowledgeEntries)
          .set({
            context: config.name,
            content: JSON.stringify(config),
          })
          .where(
            and(
              eq(knowledgeEntries.id, id),
              eq(knowledgeEntries.userId, ctx.user.id)
            )
          )
          .returning();

        return { success: true, workflow: updated };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to update workflow training config",
        });
      }
    }),

  /**
   * Soft-delete a workflow training config by setting isActive=false.
   */
  deleteWorkflow: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not initialized" });
      }

      try {
        const existing = await db
          .select({ id: knowledgeEntries.id })
          .from(knowledgeEntries)
          .where(
            and(
              eq(knowledgeEntries.id, input.id),
              eq(knowledgeEntries.userId, ctx.user.id),
              eq(knowledgeEntries.category, "workflow_training")
            )
          )
          .limit(1);

        if (existing.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Workflow training config not found",
          });
        }

        await db
          .update(knowledgeEntries)
          .set({ isActive: false })
          .where(
            and(
              eq(knowledgeEntries.id, input.id),
              eq(knowledgeEntries.userId, ctx.user.id)
            )
          );

        return { success: true, message: "Workflow training config deleted" };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to delete workflow training config",
        });
      }
    }),

  // ========================================
  // SKILL CONFIGURATION
  // ========================================

  /**
   * Get the user's skill configuration.
   * Falls back to DEFAULT_SKILLS if no config has been saved yet.
   */
  getSkillConfig: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not initialized" });
    }

    try {
      const rows = await db
        .select()
        .from(knowledgeEntries)
        .where(
          and(
            eq(knowledgeEntries.userId, ctx.user.id),
            eq(knowledgeEntries.category, "skill_config"),
            eq(knowledgeEntries.isActive, true)
          )
        )
        .limit(1);

      if (rows.length === 0) {
        return { success: true, skills: DEFAULT_SKILLS, isDefault: true };
      }

      let skills: typeof DEFAULT_SKILLS = DEFAULT_SKILLS;
      try {
        const parsed = JSON.parse(rows[0].content) as { skills: typeof DEFAULT_SKILLS };
        skills = parsed.skills;
      } catch {
        // Corrupt content — return defaults
        return { success: true, skills: DEFAULT_SKILLS, isDefault: true };
      }

      return { success: true, skills, isDefault: false };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Failed to get skill configuration",
      });
    }
  }),

  /**
   * Save the user's skill configuration.
   * Upserts: deactivates any existing 'skill_config' row then inserts a fresh one.
   */
  updateSkillConfig: protectedProcedure
    .input(
      z.object({
        skills: z.array(skillSchema),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not initialized" });
      }

      try {
        // Deactivate existing config rows for this user
        await db
          .update(knowledgeEntries)
          .set({ isActive: false })
          .where(
            and(
              eq(knowledgeEntries.userId, ctx.user.id),
              eq(knowledgeEntries.category, "skill_config")
            )
          );

        const [created] = await db
          .insert(knowledgeEntries)
          .values({
            userId: ctx.user.id,
            category: "skill_config",
            context: "skill_configuration",
            content: JSON.stringify(input),
            isActive: true,
          })
          .returning();

        return { success: true, config: created };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to update skill configuration",
        });
      }
    }),

  // ========================================
  // BEHAVIOR CONFIGURATION
  // ========================================

  /**
   * Get the user's behavior configuration.
   * Falls back to DEFAULT_BEHAVIOR if no config has been saved yet.
   */
  getBehaviorConfig: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not initialized" });
    }

    try {
      const rows = await db
        .select()
        .from(knowledgeEntries)
        .where(
          and(
            eq(knowledgeEntries.userId, ctx.user.id),
            eq(knowledgeEntries.category, "behavior_config"),
            eq(knowledgeEntries.isActive, true)
          )
        )
        .limit(1);

      if (rows.length === 0) {
        return { success: true, behavior: DEFAULT_BEHAVIOR, isDefault: true };
      }

      let behavior: typeof DEFAULT_BEHAVIOR = DEFAULT_BEHAVIOR;
      try {
        behavior = JSON.parse(rows[0].content) as typeof DEFAULT_BEHAVIOR;
      } catch {
        // Corrupt content — return defaults
        return { success: true, behavior: DEFAULT_BEHAVIOR, isDefault: true };
      }

      return { success: true, behavior, isDefault: false };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Failed to get behavior configuration",
      });
    }
  }),

  /**
   * Save the user's behavior configuration.
   * Upserts: deactivates any existing 'behavior_config' row then inserts a fresh one.
   */
  updateBehaviorConfig: protectedProcedure
    .input(
      z.object({
        personality: z.string().min(1),
        responseStyle: z.enum(["professional", "casual", "technical"]),
        verbosity: z.enum(["concise", "detailed", "balanced"]),
        escalationRules: z.array(escalationRuleSchema),
        customInstructions: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not initialized" });
      }

      try {
        // Deactivate existing config rows for this user
        await db
          .update(knowledgeEntries)
          .set({ isActive: false })
          .where(
            and(
              eq(knowledgeEntries.userId, ctx.user.id),
              eq(knowledgeEntries.category, "behavior_config")
            )
          );

        const [created] = await db
          .insert(knowledgeEntries)
          .values({
            userId: ctx.user.id,
            category: "behavior_config",
            context: "behavior_configuration",
            content: JSON.stringify(input),
            isActive: true,
          })
          .returning();

        return { success: true, config: created };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to update behavior configuration",
        });
      }
    }),

  // ========================================
  // SKILL ANALYTICS
  // ========================================

  /**
   * Get skill usage analytics for the authenticated user.
   * Returns per-skill metrics including total executions, success rate,
   * average duration, and top tools used per skill.
   */
  getSkillAnalytics: protectedProcedure.query(async ({ ctx }) => {
    try {
      const service = getAgentSkillConfigService();
      const analytics = await service.getSkillAnalytics(ctx.user.id);
      return { success: true, analytics };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Failed to get skill analytics",
      });
    }
  }),

  /**
   * Check if a specific tool is allowed by the user's skill config.
   * Useful for UI previews and debugging.
   */
  checkSkillPermission: protectedProcedure
    .input(z.object({ toolName: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      try {
        const service = getAgentSkillConfigService();
        const result = await service.checkSkillPermission(ctx.user.id, input.toolName);
        return { success: true, ...result };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to check skill permission",
        });
      }
    }),
});
