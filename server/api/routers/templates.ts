import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import { automationTemplates } from "../../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { seedTemplates } from "../../seeds/templates";

export const templatesRouter = router({
    getAll: publicProcedure
        .input(
            z.object({
                category: z.string().optional(),
            }).optional()
        )
        .query(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not initialized");

            let query = db
                .select()
                .from(automationTemplates)
                .where(eq(automationTemplates.isActive, true))
                .orderBy(desc(automationTemplates.usageCount));

            const results = await query;

            // Filter by category in JS if provided (simpler than dynamic where)
            if (input?.category && input.category !== "all") {
                return results.filter(t => t.category === input.category);
            }
            return results;
        }),

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
                throw new Error("Template not found");
            }
            return template;
        }),

    create: protectedProcedure
        .input(
            z.object({
                name: z.string().min(1),
                description: z.string().optional(),
                category: z.string().default("General"),
                platform: z.string().default("General"),
                steps: z.array(
                    z.object({
                        action: z.string(),
                        description: z.string(),
                    })
                ),
                estimatedMinutes: z.number().min(1).default(5),
                estimatedCredits: z.number().min(1).default(1),
                requiredSkills: z.array(z.string()).default([]),
                inputs: z.array(
                    z.object({
                        label: z.string(),
                        placeholder: z.string(),
                        required: z.boolean(),
                    })
                ).default([]),
                isPublic: z.boolean().default(false),
            })
        )
        .mutation(async ({ input, ctx }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not initialized");

            const [template] = await db
                .insert(automationTemplates)
                .values({
                    name: input.name,
                    description: input.description ?? null,
                    category: input.category,
                    platform: input.platform,
                    steps: input.steps,
                    estimatedMinutes: input.estimatedMinutes,
                    estimatedCredits: input.estimatedCredits,
                    requiredSkills: input.requiredSkills,
                    inputs: input.inputs,
                    isPublic: input.isPublic,
                    isSeedTemplate: false,
                    isActive: true,
                    authorId: ctx.user.id,
                })
                .returning();

            return template;
        }),

    execute: protectedProcedure
        .input(
            z.object({
                id: z.number(),
                inputValues: z.record(z.string(), z.string()).optional(),
            })
        )
        .mutation(async ({ input }) => {
            const db = await getDb();
            if (!db) throw new Error("Database not initialized");
            const [template] = await db
                .select()
                .from(automationTemplates)
                .where(eq(automationTemplates.id, input.id));

            if (!template) {
                throw new Error("Template not found");
            }

            // Increment usage count
            const currentCount = template.usageCount ?? 0;
            await db
                .update(automationTemplates)
                .set({ usageCount: currentCount + 1 })
                .where(eq(automationTemplates.id, input.id));

            // Here we would trigger the AI agent with the template steps + input values.
            // For now, we return success with metadata.
            return {
                success: true,
                message: `Executed template: ${template.name}`,
                templateId: template.id,
                inputValues: input.inputValues ?? {},
            };
        }),

    seed: protectedProcedure.mutation(async () => {
        const result = await seedTemplates();
        return result;
    }),

    getCategories: publicProcedure.query(async () => {
        const db = await getDb();
        if (!db) throw new Error("Database not initialized");

        const results = await db
            .select({ category: automationTemplates.category })
            .from(automationTemplates)
            .where(eq(automationTemplates.isActive, true))
            .groupBy(automationTemplates.category);

        return results
            .map(r => r.category)
            .filter((c): c is string => c !== null);
    }),
});
