/**
 * GHL (GoHighLevel) Integration Schema
 *
 * Database tables for:
 * - GHL webhook events (inbound from GHL)
 * - Dead letter queue for failed event processing
 * - Event deduplication
 *
 * Linear: AI-2870
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
import { users } from "./schema";

// ========================================
// GHL WEBHOOK EVENTS
// ========================================

/**
 * Incoming GHL webhook events
 * Stores every event received from GHL for processing and audit
 */
export const ghlWebhookEvents = pgTable("ghl_webhook_events", {
  id: serial("id").primaryKey(),
  userId: integer("userId").references(() => users.id, { onDelete: "cascade" }).notNull(),

  // Event identity (for deduplication)
  eventId: varchar("eventId", { length: 255 }).notNull(),
  eventType: varchar("eventType", { length: 100 }).notNull(),
  // e.g. contact.created, contact.updated, opportunity.created, opportunity.updated,
  //      appointment.booked, appointment.cancelled, etc.

  // Location context
  locationId: varchar("locationId", { length: 255 }).notNull(),

  // Event payload
  payload: jsonb("payload").notNull(),
  rawHeaders: jsonb("rawHeaders"),

  // Processing state
  status: varchar("status", { length: 50 }).default("received").notNull(),
  // received, processing, processed, failed, dead_letter
  processedAt: timestamp("processedAt"),
  processingError: text("processingError"),
  retryCount: integer("retryCount").default(0).notNull(),
  maxRetries: integer("maxRetries").default(3).notNull(),
  nextRetryAt: timestamp("nextRetryAt"),

  // Result of event handling
  handlerResult: jsonb("handlerResult"),

  // Timestamps
  receivedAt: timestamp("receivedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  eventIdIdx: uniqueIndex("ghl_webhook_events_event_id_idx").on(table.eventId),
  eventTypeIdx: index("ghl_webhook_events_event_type_idx").on(table.eventType),
  locationIdIdx: index("ghl_webhook_events_location_id_idx").on(table.locationId),
  statusIdx: index("ghl_webhook_events_status_idx").on(table.status),
  userIdIdx: index("ghl_webhook_events_user_id_idx").on(table.userId),
  receivedAtIdx: index("ghl_webhook_events_received_at_idx").on(table.receivedAt),
  // For DLQ queries
  statusRetryIdx: index("ghl_webhook_events_status_retry_idx").on(table.status, table.nextRetryAt),
  // For dedup lookups
  userEventIdx: index("ghl_webhook_events_user_event_idx").on(table.userId, table.eventId),
}));

// ========================================
// TYPE EXPORTS
// ========================================

export type GhlWebhookEvent = typeof ghlWebhookEvents.$inferSelect;
export type InsertGhlWebhookEvent = typeof ghlWebhookEvents.$inferInsert;
