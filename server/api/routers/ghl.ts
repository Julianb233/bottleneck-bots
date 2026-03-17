/**
 * GHL tRPC Router
 *
 * Provides typed RPC endpoints for GHL integration management:
 * - ghl.status — connection health check per location
 * - ghl.listLocations — list all authorized GHL locations
 * - ghl.disconnect — revoke and clean up
 * - ghl.configStatus — check OAuth config
 *
 * Workflow triggers (AI-2880):
 * - ghl.listWorkflows — list GHL workflows for a location
 * - ghl.triggerWorkflow — trigger a GHL workflow (platform → GHL)
 * - ghl.triggers.create — create a bidirectional trigger mapping
 * - ghl.triggers.list — list configured triggers
 * - ghl.triggers.update — update a trigger
 * - ghl.triggers.delete — delete a trigger
 * - ghl.triggers.toggle — enable/disable a trigger
 * - ghl.webhookEvents — list received GHL webhook events
 * - ghl.executions — list outbound GHL workflow executions
 *
 * Linear: AI-2877, AI-2880
 */

import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../../db";
import { eq, and, desc } from "drizzle-orm";
import { GHLService, GHLError } from "../../services/ghl.service";
import {
  listGHLWorkflows,
  triggerGHLWorkflow,
  GHL_EVENT_TYPES,
} from "../../services/ghlWorkflow.service";
import {
  ghlWorkflowTriggers,
  ghlWebhookEvents,
  ghlWorkflowExecutions,
} from "../../../drizzle/schema-ghl-triggers";

// ========================================
// VALIDATION SCHEMAS
// ========================================

const fieldMappingSchema = z.object({
  mappings: z.array(
    z.object({
      source: z.string().min(1),
      target: z.string().min(1),
    })
  ),
  staticVars: z.record(z.string(), z.unknown()).optional(),
});

const filterConditionSchema = z.array(
  z.object({
    field: z.string().min(1),
    operator: z.enum([
      "equals",
      "not_equals",
      "contains",
      "not_contains",
      "exists",
      "not_exists",
      "greater_than",
      "less_than",
    ]),
    value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  })
);

const createTriggerSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  direction: z.enum(["ghl_to_platform", "platform_to_ghl"]),
  ghlLocationId: z.string().min(1),
  ghlWorkflowId: z.string().optional(),
  ghlEventType: z.string().optional(),
  platformWorkflowId: z.number().int().positive().optional(),
  fieldMapping: fieldMappingSchema.optional(),
  filterConditions: filterConditionSchema.optional(),
});

const updateTriggerSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  ghlWorkflowId: z.string().optional(),
  ghlEventType: z.string().optional(),
  platformWorkflowId: z.number().int().positive().optional(),
  fieldMapping: fieldMappingSchema.optional(),
  filterConditions: filterConditionSchema.optional(),
});

// ========================================
// HELPER
// ========================================

function handleGHLError(err: unknown): never {
  if (err instanceof GHLError) {
    throw new TRPCError({
      code:
        err.category === "auth"
          ? "UNAUTHORIZED"
          : err.category === "rate_limit"
            ? "TOO_MANY_REQUESTS"
            : "INTERNAL_SERVER_ERROR",
      message: err.message,
    });
  }
  if (err instanceof TRPCError) throw err;
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: err instanceof Error ? err.message : "GHL operation failed",
  });
}

// ========================================
// TRIGGERS SUB-ROUTER
// ========================================

const triggersRouter = router({
  /**
   * Create a new workflow trigger mapping.
   */
  create: protectedProcedure
    .input(createTriggerSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // Validate direction-specific requirements
      if (input.direction === "ghl_to_platform" && !input.ghlEventType) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "ghlEventType is required for ghl_to_platform triggers",
        });
      }
      if (input.direction === "platform_to_ghl" && !input.ghlWorkflowId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "ghlWorkflowId is required for platform_to_ghl triggers",
        });
      }

      try {
        const [trigger] = await db
          .insert(ghlWorkflowTriggers)
          .values({
            userId: ctx.user.id,
            name: input.name,
            description: input.description,
            direction: input.direction,
            ghlLocationId: input.ghlLocationId,
            ghlWorkflowId: input.ghlWorkflowId || null,
            ghlEventType: input.ghlEventType || null,
            platformWorkflowId: input.platformWorkflowId || null,
            fieldMapping: input.fieldMapping || null,
            filterConditions: input.filterConditions || null,
            isActive: true,
          })
          .returning();

        return trigger;
      } catch (err) {
        handleGHLError(err);
      }
    }),

  /**
   * List all triggers for the current user, optionally filtered.
   */
  list: protectedProcedure
    .input(
      z.object({
        locationId: z.string().optional(),
        direction: z.enum(["ghl_to_platform", "platform_to_ghl"]).optional(),
        activeOnly: z.boolean().default(true),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const params = input || { activeOnly: true, limit: 50, offset: 0 };

      try {
        const conditions = [eq(ghlWorkflowTriggers.userId, ctx.user.id)];
        if (params.locationId) {
          conditions.push(eq(ghlWorkflowTriggers.ghlLocationId, params.locationId));
        }
        if (params.direction) {
          conditions.push(eq(ghlWorkflowTriggers.direction, params.direction));
        }
        if (params.activeOnly) {
          conditions.push(eq(ghlWorkflowTriggers.isActive, true));
        }

        const triggers = await db
          .select()
          .from(ghlWorkflowTriggers)
          .where(and(...conditions))
          .orderBy(desc(ghlWorkflowTriggers.createdAt))
          .limit(params.limit)
          .offset(params.offset);

        return triggers;
      } catch (err) {
        handleGHLError(err);
      }
    }),

  /**
   * Update a trigger's configuration.
   */
  update: protectedProcedure
    .input(updateTriggerSchema)
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      try {
        // Verify ownership
        const [existing] = await db
          .select()
          .from(ghlWorkflowTriggers)
          .where(
            and(
              eq(ghlWorkflowTriggers.id, input.id),
              eq(ghlWorkflowTriggers.userId, ctx.user.id)
            )
          )
          .limit(1);

        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Trigger not found" });
        }

        const updateData: Record<string, unknown> = { updatedAt: new Date() };
        if (input.name !== undefined) updateData.name = input.name;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.ghlWorkflowId !== undefined) updateData.ghlWorkflowId = input.ghlWorkflowId;
        if (input.ghlEventType !== undefined) updateData.ghlEventType = input.ghlEventType;
        if (input.platformWorkflowId !== undefined) updateData.platformWorkflowId = input.platformWorkflowId;
        if (input.fieldMapping !== undefined) updateData.fieldMapping = input.fieldMapping;
        if (input.filterConditions !== undefined) updateData.filterConditions = input.filterConditions;

        const [updated] = await db
          .update(ghlWorkflowTriggers)
          .set(updateData)
          .where(eq(ghlWorkflowTriggers.id, input.id))
          .returning();

        return updated;
      } catch (err) {
        handleGHLError(err);
      }
    }),

  /**
   * Toggle a trigger's active status.
   */
  toggle: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      try {
        const [existing] = await db
          .select()
          .from(ghlWorkflowTriggers)
          .where(
            and(
              eq(ghlWorkflowTriggers.id, input.id),
              eq(ghlWorkflowTriggers.userId, ctx.user.id)
            )
          )
          .limit(1);

        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Trigger not found" });
        }

        const [updated] = await db
          .update(ghlWorkflowTriggers)
          .set({
            isActive: !existing.isActive,
            updatedAt: new Date(),
          })
          .where(eq(ghlWorkflowTriggers.id, input.id))
          .returning();

        return updated;
      } catch (err) {
        handleGHLError(err);
      }
    }),

  /**
   * Delete a trigger.
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      try {
        const [existing] = await db
          .select()
          .from(ghlWorkflowTriggers)
          .where(
            and(
              eq(ghlWorkflowTriggers.id, input.id),
              eq(ghlWorkflowTriggers.userId, ctx.user.id)
            )
          )
          .limit(1);

        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Trigger not found" });
        }

        await db
          .delete(ghlWorkflowTriggers)
          .where(eq(ghlWorkflowTriggers.id, input.id));

        return { success: true, id: input.id };
      } catch (err) {
        handleGHLError(err);
      }
    }),
});

// ========================================
// MAIN GHL ROUTER
// ========================================

export const ghlRouter = router({
  /**
   * Get connection status for a specific GHL location.
   */
  status: protectedProcedure
    .input(
      z.object({
        locationId: z.string().min(1, "locationId is required"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const service = new GHLService(input.locationId, ctx.user.id);
        const status = await service.getConnectionStatus();
        return status;
      } catch (err) {
        handleGHLError(err);
      }
    }),

  /**
   * List all authorized GHL locations for the current user.
   */
  listLocations: protectedProcedure.query(async ({ ctx }) => {
    try {
      const locations = await GHLService.listLocations(ctx.user.id);
      return locations;
    } catch (err) {
      handleGHLError(err);
    }
  }),

  /**
   * Disconnect a GHL location (revoke tokens and mark inactive).
   */
  disconnect: protectedProcedure
    .input(
      z.object({
        locationId: z.string().min(1, "locationId is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const service = new GHLService(input.locationId, ctx.user.id);
        await service.disconnect();
        return {
          success: true,
          message: `Disconnected GHL location ${input.locationId}`,
        };
      } catch (err) {
        handleGHLError(err);
      }
    }),

  /**
   * Get the GHL OAuth configuration status.
   */
  configStatus: protectedProcedure.query(async () => {
    return {
      configured: !!process.env.GHL_CLIENT_ID && !!process.env.GHL_CLIENT_SECRET,
      hasClientId: !!process.env.GHL_CLIENT_ID,
      hasClientSecret: !!process.env.GHL_CLIENT_SECRET,
    };
  }),

  // ----------------------------------------
  // Workflow operations (AI-2880)
  // ----------------------------------------

  /**
   * List available GHL workflows for a location.
   */
  listWorkflows: protectedProcedure
    .input(
      z.object({
        locationId: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        return await listGHLWorkflows(ctx.user.id, input.locationId);
      } catch (err) {
        handleGHLError(err);
      }
    }),

  /**
   * Trigger a GHL workflow for a specific contact (platform → GHL).
   */
  triggerWorkflow: protectedProcedure
    .input(
      z.object({
        locationId: z.string().min(1),
        ghlWorkflowId: z.string().min(1),
        contactId: z.string().min(1),
        eventData: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await triggerGHLWorkflow({
          userId: ctx.user.id,
          locationId: input.locationId,
          ghlWorkflowId: input.ghlWorkflowId,
          contactId: input.contactId,
          eventData: input.eventData,
          sourceType: "manual",
        });
      } catch (err) {
        handleGHLError(err);
      }
    }),

  /**
   * Get supported GHL event types for trigger configuration.
   */
  eventTypes: protectedProcedure.query(async () => {
    return GHL_EVENT_TYPES.map((type) => ({
      value: type,
      label: type.replace(/([A-Z])/g, " $1").trim(),
      category: categorizeEventType(type),
    }));
  }),

  /**
   * List received GHL webhook events (for audit/debugging).
   */
  webhookEvents: protectedProcedure
    .input(
      z.object({
        locationId: z.string().optional(),
        eventType: z.string().optional(),
        status: z.enum(["received", "processing", "processed", "failed", "skipped"]).optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const params = input || { limit: 50, offset: 0 };

      try {
        const conditions = [eq(ghlWebhookEvents.userId, ctx.user.id)];
        if (params.locationId) {
          conditions.push(eq(ghlWebhookEvents.ghlLocationId, params.locationId));
        }
        if (params.eventType) {
          conditions.push(eq(ghlWebhookEvents.eventType, params.eventType));
        }
        if (params.status) {
          conditions.push(eq(ghlWebhookEvents.status, params.status));
        }

        const events = await db
          .select()
          .from(ghlWebhookEvents)
          .where(and(...conditions))
          .orderBy(desc(ghlWebhookEvents.receivedAt))
          .limit(params.limit)
          .offset(params.offset);

        return events;
      } catch (err) {
        handleGHLError(err);
      }
    }),

  /**
   * List outbound GHL workflow executions (platform → GHL history).
   */
  executions: protectedProcedure
    .input(
      z.object({
        locationId: z.string().optional(),
        status: z.enum(["pending", "sent", "confirmed", "failed"]).optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const params = input || { limit: 50, offset: 0 };

      try {
        const conditions = [eq(ghlWorkflowExecutions.userId, ctx.user.id)];
        if (params.locationId) {
          conditions.push(eq(ghlWorkflowExecutions.ghlLocationId, params.locationId));
        }
        if (params.status) {
          conditions.push(eq(ghlWorkflowExecutions.status, params.status));
        }

        const execs = await db
          .select()
          .from(ghlWorkflowExecutions)
          .where(and(...conditions))
          .orderBy(desc(ghlWorkflowExecutions.createdAt))
          .limit(params.limit)
          .offset(params.offset);

        return execs;
      } catch (err) {
        handleGHLError(err);
      }
    }),

  /**
   * Get the webhook URL for a GHL location.
   * Users configure this URL in their GHL account's webhook settings.
   */
  webhookUrl: protectedProcedure
    .input(z.object({ locationId: z.string().min(1) }))
    .query(async ({ input }) => {
      const baseUrl = process.env.VITE_API_URL || process.env.API_URL || "";
      return {
        url: `${baseUrl}/api/webhooks/ghl/${input.locationId}`,
        locationId: input.locationId,
      };
    }),

  // Nested triggers router
  triggers: triggersRouter,
});

// ========================================
// HELPERS
// ========================================

function categorizeEventType(type: string): string {
  if (type.startsWith("Contact")) return "Contacts";
  if (type.startsWith("Opportunity")) return "Pipeline";
  if (type.startsWith("Appointment")) return "Calendar";
  if (type.startsWith("Task")) return "Tasks";
  if (type.startsWith("Form")) return "Forms";
  if (type.startsWith("Note")) return "Notes";
  if (type.includes("Message") || type.includes("Conversation")) return "Communication";
  if (type.startsWith("Campaign")) return "Campaigns";
  if (type.startsWith("Invoice")) return "Invoices";
  return "Other";
}
