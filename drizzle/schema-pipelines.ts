/**
 * Multi-Step Workflow Pipelines Schema
 * Database tables for chained workflow execution with data passing between steps
 *
 * A pipeline chains multiple workflows (or inline tasks) together,
 * passing output from each step as input to the next.
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
// PIPELINE DEFINITIONS
// ========================================

/**
 * Workflow pipeline definitions
 * A pipeline is a sequence of steps where each step either references
 * an existing workflow or defines an inline task (apiCall, notification, etc.)
 */
export const workflowPipelines = pgTable("workflow_pipelines", {
  id: serial("id").primaryKey(),
  userId: integer("userId").references(() => users.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),

  /**
   * Array of pipeline step definitions. Each step:
   * {
   *   stepId: string,           // Unique ID within pipeline (e.g. "scrape", "enrich")
   *   type: "workflow" | "inline", // Reference existing workflow or inline task
   *   workflowId?: number,      // For type=workflow: ID of automation_workflows row
   *   inlineConfig?: {...},     // For type=inline: step config (apiCall, notification, etc.)
   *   inputMapping?: Record<string, string>,  // Map previous step outputs to this step's variables
   *   condition?: string,       // Optional condition to skip this step
   *   continueOnError?: boolean,
   *   retryCount?: number,
   *   retryDelayMs?: number,
   * }
   */
  steps: jsonb("steps").notNull(),

  trigger: varchar("trigger", { length: 20 }).default("manual").notNull(), // manual, scheduled, webhook
  isActive: boolean("isActive").default(true).notNull(),
  executionCount: integer("executionCount").default(0).notNull(),
  lastExecutedAt: timestamp("lastExecutedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("workflow_pipelines_user_id_idx").on(table.userId),
  isActiveIdx: index("workflow_pipelines_is_active_idx").on(table.isActive),
}));

export type WorkflowPipeline = typeof workflowPipelines.$inferSelect;
export type InsertWorkflowPipeline = typeof workflowPipelines.$inferInsert;

// ========================================
// PIPELINE EXECUTION TRACKING
// ========================================

/**
 * Pipeline execution runs
 * Tracks the overall execution of a pipeline
 */
export const pipelineExecutions = pgTable("pipeline_executions", {
  id: serial("id").primaryKey(),
  pipelineId: integer("pipelineId").references(() => workflowPipelines.id).notNull(),
  userId: integer("userId").references(() => users.id).notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, running, completed, failed, cancelled
  input: jsonb("input"), // Initial input variables
  output: jsonb("output"), // Final aggregated output
  error: text("error"),
  currentStepIndex: integer("currentStepIndex").default(0).notNull(),
  totalSteps: integer("totalSteps").notNull(),
  stepResults: jsonb("stepResults"), // Array of per-step results
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  duration: integer("duration"), // Total duration in ms
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  pipelineIdIdx: index("pipeline_executions_pipeline_id_idx").on(table.pipelineId),
  userIdIdx: index("pipeline_executions_user_id_idx").on(table.userId),
  statusIdx: index("pipeline_executions_status_idx").on(table.status),
}));

export type PipelineExecution = typeof pipelineExecutions.$inferSelect;
export type InsertPipelineExecution = typeof pipelineExecutions.$inferInsert;
