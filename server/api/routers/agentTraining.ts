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
import { eq, and, desc, sql } from "drizzle-orm";
import { knowledgeEntries } from "../../../drizzle/schema-agent";
import { taskExecutions } from "../../../drizzle/schema-webhooks";

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
  languagePreferences: {
    primaryLanguage: "en",
    supportedLanguages: ["en"],
    autoDetect: true,
  },
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
  rateLimit: z.number().int().min(1).max(10000).optional(),
});

const escalationRuleSchema = z.object({
  condition: z.string().min(1),
  action: z.string().min(1),
});

const escalationConfigSchema = z.object({
  confidenceThreshold: z.number().min(0).max(100).default(70),
  actionsRequiringApproval: z.array(z.string()).default([]),
  timeBasedEscalation: z.object({
    enabled: z.boolean().default(false),
    thresholdMinutes: z.number().min(1).max(1440).default(30),
    notifyMethod: z.enum(["email", "sms", "in_app", "all"]).default("in_app"),
  }).default({ enabled: false, thresholdMinutes: 30, notifyMethod: "in_app" }),
  errorThreshold: z.object({
    enabled: z.boolean().default(true),
    maxErrors: z.number().min(1).max(100).default(3),
    action: z.enum(["pause", "notify", "escalate"]).default("pause"),
  }).default({ enabled: true, maxErrors: 3, action: "pause" }),
  customRules: z.array(escalationRuleSchema).default([]),
});

const DEFAULT_ESCALATION_CONFIG = {
  confidenceThreshold: 70,
  actionsRequiringApproval: ["bulk_delete", "send_mass_email", "payment_action", "account_deletion"],
  timeBasedEscalation: {
    enabled: false,
    thresholdMinutes: 30,
    notifyMethod: "in_app" as const,
  },
  errorThreshold: {
    enabled: true,
    maxErrors: 3,
    action: "pause" as const,
  },
  customRules: [
    {
      condition: "Payment or billing related actions",
      action: "Ask for human approval before proceeding",
    },
    {
      condition: "Deleting more than 10 records",
      action: "Confirm with user before bulk deletion",
    },
  ],
};

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
  // SKILL USAGE ANALYTICS
  // ========================================

  /**
   * Get skill usage analytics for the authenticated user.
   * Aggregates tool calls from task executions, mapping tools to skill categories.
   */
  getSkillUsage: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not initialized" });
    }

    try {
      // Map of tool names to skill IDs
      const TOOL_TO_SKILL: Record<string, string> = {
        browser_navigate: "browser",
        browser_click: "browser",
        browser_type: "browser",
        browser_extract: "browser",
        browser_screenshot: "browser",
        browser_scroll: "browser",
        browser_select: "browser",
        browser_wait: "browser",
        browser_close: "browser",
        browser_create_session: "browser",
        http_request: "ghl_api",
        ghl_create_contact: "ghl_api",
        ghl_update_contact: "ghl_api",
        ghl_search_contacts: "ghl_api",
        ghl_create_opportunity: "ghl_api",
        ghl_send_email: "email",
        send_email: "email",
        send_sms: "sms",
        ghl_send_sms: "sms",
        voice_call: "voice",
        make_call: "voice",
        file_write: "file_creation",
        file_edit: "file_creation",
        file_read: "file_creation",
        file_list: "file_creation",
        file_search: "web_scraping",
        retrieve_data: "web_scraping",
        retrieve_documentation: "web_scraping",
        calendar_create: "calendar",
        calendar_update: "calendar",
        calendar_list: "calendar",
        store_data: "crm",
        update_plan: "reporting",
        advance_phase: "reporting",
      };

      // Fetch recent executions for this user
      const executions = await db
        .select({
          stepResults: taskExecutions.stepResults,
          status: taskExecutions.status,
          completedAt: taskExecutions.completedAt,
          duration: taskExecutions.duration,
        })
        .from(taskExecutions)
        .where(eq(taskExecutions.triggeredByUserId, ctx.user.id))
        .orderBy(desc(taskExecutions.startedAt))
        .limit(100);

      // Aggregate usage per skill
      const skillStats: Record<string, {
        totalCalls: number;
        successCount: number;
        failureCount: number;
        lastUsed: string | null;
        totalDurationMs: number;
      }> = {};

      // Initialize all skills
      for (const skill of DEFAULT_SKILLS) {
        skillStats[skill.id] = {
          totalCalls: 0,
          successCount: 0,
          failureCount: 0,
          lastUsed: null,
          totalDurationMs: 0,
        };
      }

      for (const execution of executions) {
        const steps = execution.stepResults as Array<{
          tool?: string;
          toolName?: string;
          success?: boolean;
          duration?: number;
          timestamp?: string;
        }> | null;

        if (!Array.isArray(steps)) continue;

        for (const step of steps) {
          const toolName = step.tool || step.toolName;
          if (!toolName) continue;

          const skillId = TOOL_TO_SKILL[toolName];
          if (!skillId || !skillStats[skillId]) continue;

          const stat = skillStats[skillId];
          stat.totalCalls++;
          if (step.success !== false) {
            stat.successCount++;
          } else {
            stat.failureCount++;
          }
          if (step.duration) {
            stat.totalDurationMs += step.duration;
          }
          // Track most recent usage
          const ts = step.timestamp || (execution.completedAt ? new Date(execution.completedAt).toISOString() : null);
          if (ts && (!stat.lastUsed || ts > stat.lastUsed)) {
            stat.lastUsed = ts;
          }
        }
      }

      // Build response
      const usage = Object.entries(skillStats).map(([skillId, stat]) => ({
        skillId,
        totalCalls: stat.totalCalls,
        successCount: stat.successCount,
        failureCount: stat.failureCount,
        successRate: stat.totalCalls > 0 ? (stat.successCount / stat.totalCalls) * 100 : 0,
        lastUsed: stat.lastUsed,
        avgDurationMs: stat.totalCalls > 0 ? Math.round(stat.totalDurationMs / stat.totalCalls) : 0,
      }));

      return { success: true, usage };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Failed to get skill usage analytics",
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
});
