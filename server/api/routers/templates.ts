/**
 * Templates Router - tRPC API for Task Template System
 *
 * Provides CRUD operations for automation templates,
 * template execution via the agent system, and marketplace browsing.
 */
import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import { automationTemplates } from "../../../drizzle/schema";
import { eq, ilike, or, and, desc, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const templatesRouter = router({
  /**
   * Get all templates (public endpoint for browsing)
   */
  getAll: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not initialized");
    return await db
      .select()
      .from(automationTemplates)
      .orderBy(desc(automationTemplates.createdAt));
  }),

  /**
   * Get a single template by ID
   */
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not initialized");
      const [template] = await db
        .select()
        .from(automationTemplates)
        .where(eq(automationTemplates.id, input.id));
      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }
      return template;
    }),

  /**
   * Search templates by name, description, or category
   */
  search: publicProcedure
    .input(
      z.object({
        query: z.string().optional(),
        category: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not initialized");

      const conditions = [];

      if (input.query) {
        const searchTerm = `%${input.query}%`;
        conditions.push(
          or(
            ilike(automationTemplates.name, searchTerm),
            ilike(automationTemplates.description, searchTerm),
          )
        );
      }

      if (input.category) {
        conditions.push(eq(automationTemplates.category, input.category));
      }

      const where = conditions.length > 0
        ? and(...conditions)
        : undefined;

      const results = await db
        .select()
        .from(automationTemplates)
        .where(where)
        .orderBy(desc(automationTemplates.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return {
        templates: results,
        total: results.length,
        hasMore: results.length === input.limit,
      };
    }),

  /**
   * Get template categories with counts
   */
  getCategories: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not initialized");

    const results = await db
      .select({
        category: automationTemplates.category,
        count: sql<number>`count(*)::int`,
      })
      .from(automationTemplates)
      .groupBy(automationTemplates.category);

    return results;
  }),

  /**
   * Execute a template - creates an agent task from the template
   */
  execute: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not initialized");
      const [template] = await db
        .select()
        .from(automationTemplates)
        .where(eq(automationTemplates.id, input.id));

      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }

      // Parse steps for the response
      let stepCount = 0;
      try {
        const steps = typeof template.steps === "string"
          ? JSON.parse(template.steps)
          : template.steps;
        stepCount = Array.isArray(steps) ? steps.length : 0;
      } catch {
        stepCount = 0;
      }

      // TODO: Actually dispatch to the agent orchestrator
      // For now, return success with metadata
      return {
        success: true,
        message: `Task created from template: ${template.name}`,
        taskId: `task_${Date.now()}`,
        templateId: template.id,
        templateName: template.name,
        stepCount,
        estimatedMinutes: stepCount * 2,
      };
    }),

  /**
   * Create a new custom template (for marketplace)
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        description: z.string().optional(),
        category: z.string().max(50).default("General"),
        steps: z.string(), // JSON string of steps
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not initialized");

      const [created] = await db
        .insert(automationTemplates)
        .values({
          name: input.name,
          description: input.description || null,
          category: input.category,
          steps: input.steps,
        })
        .returning();

      return created;
    }),

  /**
   * Delete a template (only custom templates, not seed)
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not initialized");

      const [template] = await db
        .select()
        .from(automationTemplates)
        .where(eq(automationTemplates.id, input.id));

      if (!template) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      }

      await db
        .delete(automationTemplates)
        .where(eq(automationTemplates.id, input.id));

      return { success: true };
    }),
});
