/**
 * Schema for Multi-Step Workflow Pipelines
 * Supports chaining multiple workflows/tasks with data passing between steps
 */

import {
  pgTable,
  serial,
  integer,
  text,
  varchar,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { users } from "./schema";

/**
 * Workflow pipeline definitions
 * A pipeline chains multiple steps (workflows, API calls, transforms) into a sequential execution
 */
export const workflowPipelines = pgTable("workflow_pipelines", {
  id: serial("id").primaryKey(),
  userId: integer("userId")
    .references(() => users.id)
    .notNull(),
  name: text("name").notNull(),
  description: text("description"),
  /** Ordered array of pipeline step definitions */
  steps: jsonb("steps").notNull().$type<PipelineStepDefinition[]>(),
  /** Global variables available to all steps */
  globalVariables: jsonb("globalVariables").$type<Record<string, unknown>>(),
  isActive: boolean("isActive").default(true).notNull(),
  /** Max total execution time in ms (default: 10 minutes) */
  maxExecutionTime: integer("maxExecutionTime").default(600000),
  /** Whether to continue pipeline on step failure */
  continueOnStepFailure: boolean("continueOnStepFailure")
    .default(false)
    .notNull(),
  executionCount: integer("executionCount").default(0).notNull(),
  lastExecutedAt: timestamp("lastExecutedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type WorkflowPipeline = typeof workflowPipelines.$inferSelect;
export type InsertWorkflowPipeline = typeof workflowPipelines.$inferInsert;

/**
 * Pipeline execution tracking
 * Records each pipeline run with per-step results and data flow
 */
export const pipelineExecutions = pgTable("pipeline_executions", {
  id: serial("id").primaryKey(),
  pipelineId: integer("pipelineId")
    .references(() => workflowPipelines.id)
    .notNull(),
  userId: integer("userId")
    .references(() => users.id)
    .notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  /** Input variables provided at execution start */
  input: jsonb("input").$type<Record<string, unknown>>(),
  /** Final accumulated output after all steps */
  output: jsonb("output").$type<Record<string, unknown>>(),
  /** Per-step execution results */
  stepResults: jsonb("stepResults").$type<PipelineStepResult[]>(),
  /** Current step index (0-based) */
  currentStep: integer("currentStep").default(0),
  totalSteps: integer("totalSteps").notNull(),
  error: text("error"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  /** Total execution time in ms */
  duration: integer("duration"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type PipelineExecution = typeof pipelineExecutions.$inferSelect;
export type InsertPipelineExecution = typeof pipelineExecutions.$inferInsert;

// ========================================
// PIPELINE STEP TYPES
// ========================================

export type PipelineStepType =
  | "workflow" // Execute an existing automation workflow
  | "api_call" // Make an HTTP request
  | "transform" // Transform/map data between steps
  | "condition" // Conditional branching
  | "delay" // Wait between steps
  | "notification"; // Send notification

export interface PipelineStepDefinition {
  /** Unique step identifier within the pipeline */
  id: string;
  /** Display name */
  name: string;
  /** Step type */
  type: PipelineStepType;
  /** Step-specific configuration */
  config: PipelineStepConfig;
  /** Variable name to store this step's output (accessible by subsequent steps as {{stepId.field}}) */
  outputKey?: string;
  /** Whether to continue the pipeline if this step fails */
  continueOnError?: boolean;
  /** Timeout for this specific step in ms */
  timeout?: number;
  /** Optional condition expression -- step is skipped if this evaluates to false */
  runIf?: string;
  /** Input mappings: map pipeline variables to step-specific inputs */
  inputMappings?: Record<string, string>;
}

export type PipelineStepConfig =
  | WorkflowStepPipelineConfig
  | ApiCallPipelineConfig
  | TransformPipelineConfig
  | ConditionPipelineConfig
  | DelayPipelineConfig
  | NotificationPipelineConfig;

export interface WorkflowStepPipelineConfig {
  type: "workflow";
  /** ID of the automation workflow to execute */
  workflowId: number;
  /** Variables to pass to the workflow -- supports {{variable}} references */
  variables?: Record<string, unknown>;
  /** Geolocation for browser sessions */
  geolocation?: {
    city?: string;
    state?: string;
    country?: string;
  };
}

export interface ApiCallPipelineConfig {
  type: "api_call";
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: unknown;
}

export interface TransformPipelineConfig {
  type: "transform";
  /** Mapping of output field names to expressions referencing pipeline variables */
  mappings: Record<string, string>;
}

export interface ConditionPipelineConfig {
  type: "condition";
  /** Expression to evaluate */
  expression: string;
  /** Step ID to jump to if condition is true (default: next step) */
  onTrue?: string;
  /** Step ID to jump to if condition is false (default: next step) */
  onFalse?: string;
}

export interface DelayPipelineConfig {
  type: "delay";
  /** Delay in milliseconds */
  delayMs: number;
}

export interface NotificationPipelineConfig {
  type: "notification";
  /** Notification message -- supports {{variable}} references */
  message: string;
  /** Notification channel */
  channel?: "log" | "webhook";
  /** Webhook URL for webhook channel */
  webhookUrl?: string;
}

// ========================================
// EXECUTION RESULT TYPES
// ========================================

export interface PipelineStepResult {
  stepId: string;
  stepName: string;
  stepType: PipelineStepType;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  /** Data output from this step */
  output?: Record<string, unknown>;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  /** Execution time in ms */
  duration?: number;
  /** Whether the step was skipped due to a runIf condition */
  skipped?: boolean;
}

export interface PipelineExecutionStatus {
  executionId: number;
  pipelineId: number;
  status: string;
  currentStep: number;
  totalSteps: number;
  stepResults: PipelineStepResult[];
  output?: Record<string, unknown>;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
}
