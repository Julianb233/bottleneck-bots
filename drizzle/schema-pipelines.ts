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

/**
 * Multi-step workflow pipelines
 * Defines chains of workflows that execute sequentially with data passing
 */
export const pipelines = pgTable(
  "pipelines",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId")
      .references(() => users.id)
      .notNull(),
    name: text("name").notNull(),
    description: text("description"),

    /**
     * Pipeline steps - ordered list of tasks to execute.
     * Each step defines: type, config, inputMapping, outputMapping, condition, etc.
     * See PipelineStepDefinition type in server/types/index.ts
     */
    steps: jsonb("steps").notNull().$type<PipelineStepJson[]>(),

    /** Trigger type: manual, scheduled, webhook, event */
    trigger: varchar("trigger", { length: 20 }).default("manual").notNull(),

    isActive: boolean("isActive").default(true).notNull(),
    executionCount: integer("executionCount").default(0).notNull(),
    lastExecutedAt: timestamp("lastExecutedAt"),

    /** Max concurrent executions allowed (0 = unlimited) */
    maxConcurrency: integer("maxConcurrency").default(1).notNull(),

    /** Global timeout for entire pipeline in ms */
    timeoutMs: integer("timeoutMs").default(3600000), // 1 hour default

    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("pipelines_user_idx").on(table.userId),
    activeIdx: index("pipelines_active_idx").on(table.isActive),
  })
);

/**
 * Pipeline execution tracking
 * Records each pipeline run with step-by-step progress and shared context
 */
export const pipelineExecutions = pgTable(
  "pipeline_executions",
  {
    id: serial("id").primaryKey(),
    pipelineId: integer("pipelineId")
      .references(() => pipelines.id)
      .notNull(),
    userId: integer("userId")
      .references(() => users.id)
      .notNull(),

    status: varchar("status", { length: 20 }).default("pending").notNull(),

    /** Index of the step currently being executed */
    currentStepIndex: integer("currentStepIndex").default(0).notNull(),

    /** Shared context passed between steps - this is the data-passing mechanism */
    sharedContext: jsonb("sharedContext").$type<Record<string, unknown>>(),

    /** Initial input variables provided at pipeline start */
    input: jsonb("input").$type<Record<string, unknown>>(),

    /** Final output after all steps complete */
    output: jsonb("output"),

    /** Per-step execution results */
    stepResults: jsonb("stepResults").$type<PipelineStepResultJson[]>(),

    error: text("error"),
    startedAt: timestamp("startedAt"),
    completedAt: timestamp("completedAt"),

    /** Total duration in ms */
    duration: integer("duration"),

    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    pipelineIdx: index("pipeline_executions_pipeline_idx").on(table.pipelineId),
    userIdx: index("pipeline_executions_user_idx").on(table.userId),
    statusIdx: index("pipeline_executions_status_idx").on(table.status),
  })
);

// JSON types for schema (used by $type<>() above)
export interface PipelineStepJson {
  name: string;
  type: "workflow" | "apiCall" | "transform" | "condition" | "delay";
  order: number;
  config: Record<string, unknown>;
  inputMapping?: Record<string, string>;
  outputMapping?: Record<string, string>;
  condition?: string;
  continueOnError?: boolean;
  retryCount?: number;
  timeoutMs?: number;
}

export interface PipelineStepResultJson {
  stepIndex: number;
  stepName: string;
  type: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  startedAt: string;
  completedAt?: string;
  duration?: number;
  output?: unknown;
  error?: string;
}

export type Pipeline = typeof pipelines.$inferSelect;
export type InsertPipeline = typeof pipelines.$inferInsert;
export type PipelineExecution = typeof pipelineExecutions.$inferSelect;
export type InsertPipelineExecution = typeof pipelineExecutions.$inferInsert;
