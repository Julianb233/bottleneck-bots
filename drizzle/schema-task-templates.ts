/**
 * Task Templates Schema
 * Pre-built templates for common agency workflows:
 * marketing campaigns, outreach sequences, sales pipelines, GHL automations
 */

import {
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
  integer,
  boolean,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./schema";

// ========================================
// TASK TEMPLATE CATEGORIES
// ========================================

export const taskTemplateCategories = pgTable("task_template_categories", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 50 }), // Lucide icon name
  color: varchar("color", { length: 30 }), // Tailwind color class
  sortOrder: integer("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TaskTemplateCategory = typeof taskTemplateCategories.$inferSelect;
export type InsertTaskTemplateCategory = typeof taskTemplateCategories.$inferInsert;

// ========================================
// TASK TEMPLATES
// ========================================

export const taskTemplates = pgTable("task_templates", {
  id: serial("id").primaryKey(),

  // Ownership: null = system template, userId = user-created
  userId: integer("userId").references(() => users.id),
  categorySlug: varchar("categorySlug", { length: 50 }).notNull(),

  // Display
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 50 }),
  color: varchar("color", { length: 30 }),

  // Pre-filled task fields (applied when user creates task from template)
  taskType: varchar("taskType", { length: 50 }).default("custom").notNull(),
  priority: varchar("priority", { length: 20 }).default("medium").notNull(),
  urgency: varchar("urgency", { length: 20 }).default("normal").notNull(),
  assignedToBot: boolean("assignedToBot").default(true).notNull(),
  requiresHumanReview: boolean("requiresHumanReview").default(false).notNull(),
  executionType: varchar("executionType", { length: 30 }).default("automatic").notNull(),

  // Template steps: array of { title, description, actionType, config }
  steps: jsonb("steps").default("[]").notNull(),

  // Execution config preset
  executionConfig: jsonb("executionConfig"),

  // Tags applied to created tasks
  defaultTags: jsonb("defaultTags").default("[]"),

  // Template metadata
  estimatedDuration: integer("estimatedDuration"), // minutes
  difficulty: varchar("difficulty", { length: 20 }).default("beginner"), // beginner, intermediate, advanced
  isSystem: boolean("isSystem").default(false).notNull(), // true = built-in, cannot be deleted by users
  isPublished: boolean("isPublished").default(true).notNull(),

  // Usage tracking
  usageCount: integer("usageCount").default(0).notNull(),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  categoryIdx: index("task_templates_category_idx").on(table.categorySlug),
  userIdx: index("task_templates_user_idx").on(table.userId),
  systemIdx: index("task_templates_system_idx").on(table.isSystem),
}));

export type TaskTemplate = typeof taskTemplates.$inferSelect;
export type InsertTaskTemplate = typeof taskTemplates.$inferInsert;
