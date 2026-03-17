/**
 * GHL Workflow Triggers Schema
 *
 * Supports bidirectional workflow triggers between GHL and Bottleneck Bots:
 * - ghl_workflow_triggers: Maps GHL events ↔ platform workflows
 * - ghl_webhook_events: Logs inbound GHL webhook events
 *
 * Linear: AI-2880
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
  uuid,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users, automationWorkflows } from "./schema";

// ========================================
// GHL WORKFLOW TRIGGERS
// ========================================

/**
 * Bidirectional trigger mappings between GHL and the platform.
 *
 * direction = 'ghl_to_platform':
 *   When a GHL event (e.g. contact.created) fires, execute a platform workflow.
 *
 * direction = 'platform_to_ghl':
 *   When a platform workflow completes (or a manual trigger fires),
 *   call the GHL Workflows API to execute a GHL workflow.
 */
export const ghlWorkflowTriggers = pgTable("ghl_workflow_triggers", {
  id: serial("id").primaryKey(),
  userId: integer("userId").references(() => users.id, { onDelete: "cascade" }).notNull(),

  // Trigger identity
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),

  // Direction: which way does the trigger fire?
  direction: varchar("direction", { length: 30 }).notNull(),
  // 'ghl_to_platform' | 'platform_to_ghl'

  // GHL side
  ghlLocationId: varchar("ghlLocationId", { length: 255 }).notNull(),
  ghlWorkflowId: varchar("ghlWorkflowId", { length: 255 }), // GHL workflow ID (for platform→GHL)
  ghlEventType: varchar("ghlEventType", { length: 100 }), // e.g. 'contact.created', 'opportunity.stageChanged' (for GHL→platform)

  // Platform side
  platformWorkflowId: integer("platformWorkflowId").references(() => automationWorkflows.id, { onDelete: "set null" }),

  // Data mapping: how to transform data between systems
  fieldMapping: jsonb("fieldMapping"),
  /**
   * {
   *   // For GHL→Platform: map GHL event fields to workflow variables
   *   // For Platform→GHL: map workflow output to GHL workflow variables
   *   mappings: [
   *     { source: 'contact.email', target: 'email' },
   *     { source: 'contact.firstName', target: 'firstName' },
   *   ],
   *   // Static variables to always pass
   *   staticVars: { key: 'value' }
   * }
   */

  // Filtering: only trigger on matching conditions
  filterConditions: jsonb("filterConditions"),
  /**
   * [
   *   { field: 'contact.tags', operator: 'contains', value: 'vip' },
   *   { field: 'opportunity.stage', operator: 'equals', value: 'qualified' }
   * ]
   */

  // Status
  isActive: boolean("isActive").default(true).notNull(),

  // Statistics
  triggerCount: integer("triggerCount").default(0).notNull(),
  lastTriggeredAt: timestamp("lastTriggeredAt"),
  lastError: text("lastError"),
  errorCount: integer("errorCount").default(0).notNull(),

  // Audit
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("ghl_triggers_user_id_idx").on(table.userId),
  directionIdx: index("ghl_triggers_direction_idx").on(table.direction),
  locationIdx: index("ghl_triggers_location_idx").on(table.ghlLocationId),
  eventTypeIdx: index("ghl_triggers_event_type_idx").on(table.ghlEventType),
  isActiveIdx: index("ghl_triggers_is_active_idx").on(table.isActive),
  userLocationIdx: index("ghl_triggers_user_location_idx").on(table.userId, table.ghlLocationId),
  // For quick lookup: "which triggers fire for this event type at this location?"
  eventLookupIdx: index("ghl_triggers_event_lookup_idx").on(table.ghlLocationId, table.ghlEventType, table.isActive),
}));

// ========================================
// GHL WEBHOOK EVENTS
// ========================================

/**
 * Inbound GHL webhook event log.
 * Every event received from GHL is stored here for audit, replay, and debugging.
 */
export const ghlWebhookEvents = pgTable("ghl_webhook_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: integer("userId").references(() => users.id, { onDelete: "cascade" }).notNull(),

  // Event identity
  ghlLocationId: varchar("ghlLocationId", { length: 255 }).notNull(),
  eventType: varchar("eventType", { length: 100 }).notNull(), // e.g. 'ContactCreate', 'OpportunityStageUpdate'
  eventId: varchar("eventId", { length: 255 }), // GHL's event ID if provided

  // Raw payload
  payload: jsonb("payload").notNull(),
  headers: jsonb("headers"),

  // Processing status
  status: varchar("status", { length: 30 }).default("received").notNull(),
  // 'received' | 'processing' | 'processed' | 'failed' | 'skipped'
  processingError: text("processingError"),

  // Which trigger(s) fired
  triggerId: integer("triggerId").references(() => ghlWorkflowTriggers.id, { onDelete: "set null" }),
  executionId: integer("executionId"), // platform workflow execution ID if triggered

  // Timestamps
  receivedAt: timestamp("receivedAt").defaultNow().notNull(),
  processedAt: timestamp("processedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("ghl_events_user_id_idx").on(table.userId),
  locationIdx: index("ghl_events_location_idx").on(table.ghlLocationId),
  eventTypeIdx: index("ghl_events_event_type_idx").on(table.eventType),
  statusIdx: index("ghl_events_status_idx").on(table.status),
  receivedAtIdx: index("ghl_events_received_at_idx").on(table.receivedAt),
  triggerIdx: index("ghl_events_trigger_idx").on(table.triggerId),
}));

// ========================================
// GHL WORKFLOW EXECUTION LOG
// ========================================

/**
 * Tracks outbound GHL workflow triggers (platform → GHL).
 * Separate from the platform's workflowExecutions table.
 */
export const ghlWorkflowExecutions = pgTable("ghl_workflow_executions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").references(() => users.id, { onDelete: "cascade" }).notNull(),
  triggerId: integer("triggerId").references(() => ghlWorkflowTriggers.id, { onDelete: "set null" }),

  // GHL details
  ghlLocationId: varchar("ghlLocationId", { length: 255 }).notNull(),
  ghlWorkflowId: varchar("ghlWorkflowId", { length: 255 }).notNull(),
  ghlContactId: varchar("ghlContactId", { length: 255 }),

  // What we sent
  inputData: jsonb("inputData"),

  // Result
  status: varchar("status", { length: 30 }).default("pending").notNull(),
  // 'pending' | 'sent' | 'confirmed' | 'failed'
  responseData: jsonb("responseData"),
  error: text("error"),

  // Source: what triggered this execution?
  sourceType: varchar("sourceType", { length: 50 }).notNull(),
  // 'trigger_rule' | 'manual' | 'workflow_step'
  sourceId: varchar("sourceId", { length: 255 }), // platform workflow execution ID, etc.

  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
}, (table) => ({
  userIdIdx: index("ghl_executions_user_id_idx").on(table.userId),
  triggerIdx: index("ghl_executions_trigger_idx").on(table.triggerId),
  locationIdx: index("ghl_executions_location_idx").on(table.ghlLocationId),
  statusIdx: index("ghl_executions_status_idx").on(table.status),
  createdAtIdx: index("ghl_executions_created_at_idx").on(table.createdAt),
}));

// ========================================
// TYPE EXPORTS
// ========================================

export type GhlWorkflowTrigger = typeof ghlWorkflowTriggers.$inferSelect;
export type InsertGhlWorkflowTrigger = typeof ghlWorkflowTriggers.$inferInsert;

export type GhlWebhookEvent = typeof ghlWebhookEvents.$inferSelect;
export type InsertGhlWebhookEvent = typeof ghlWebhookEvents.$inferInsert;

export type GhlWorkflowExecution = typeof ghlWorkflowExecutions.$inferSelect;
export type InsertGhlWorkflowExecution = typeof ghlWorkflowExecutions.$inferInsert;
