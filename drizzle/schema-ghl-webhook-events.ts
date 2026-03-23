/**
 * GHL Webhook Processing Schema
 *
 * Tables for synced contacts, opportunities, webhook event dedup,
 * and dead letter queue for failed webhook processing.
 *
 * Linear: AI-3461
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
  uniqueIndex,
  numeric,
} from "drizzle-orm/pg-core";
import { users } from "./schema";

// ========================================
// GHL CONTACTS (synced from webhooks)
// ========================================

export const ghlContacts = pgTable("ghl_contacts", {
  id: serial("id").primaryKey(),
  userId: integer("userId").references(() => users.id).notNull(),
  ghlContactId: varchar("ghlContactId", { length: 128 }).notNull(),
  locationId: varchar("locationId", { length: 128 }).notNull(),
  firstName: text("firstName"),
  lastName: text("lastName"),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 30 }),
  tags: jsonb("tags").$type<string[]>(),
  source: varchar("source", { length: 128 }),
  customFields: jsonb("customFields").$type<Array<{ id: string; value: string }>>(),
  lastWebhookAt: timestamp("lastWebhookAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  ghlContactIdx: uniqueIndex("ghl_contacts_ghl_id_idx").on(table.ghlContactId, table.locationId),
  userIdx: index("ghl_contacts_user_idx").on(table.userId),
  locationIdx: index("ghl_contacts_location_idx").on(table.locationId),
  emailIdx: index("ghl_contacts_email_idx").on(table.email),
}));

export type GHLContactRow = typeof ghlContacts.$inferSelect;
export type InsertGHLContact = typeof ghlContacts.$inferInsert;

// ========================================
// GHL OPPORTUNITIES (synced from webhooks)
// ========================================

export const ghlOpportunities = pgTable("ghl_opportunities", {
  id: serial("id").primaryKey(),
  userId: integer("userId").references(() => users.id).notNull(),
  ghlOpportunityId: varchar("ghlOpportunityId", { length: 128 }).notNull(),
  locationId: varchar("locationId", { length: 128 }).notNull(),
  name: text("name"),
  pipelineId: varchar("pipelineId", { length: 128 }),
  pipelineStageId: varchar("pipelineStageId", { length: 128 }),
  status: varchar("status", { length: 64 }),
  monetaryValue: numeric("monetaryValue", { precision: 12, scale: 2 }),
  ghlContactId: varchar("ghlContactId", { length: 128 }),
  lastWebhookAt: timestamp("lastWebhookAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  ghlOppIdx: uniqueIndex("ghl_opportunities_ghl_id_idx").on(table.ghlOpportunityId, table.locationId),
  userIdx: index("ghl_opportunities_user_idx").on(table.userId),
  locationIdx: index("ghl_opportunities_location_idx").on(table.locationId),
  pipelineIdx: index("ghl_opportunities_pipeline_idx").on(table.pipelineId),
  statusIdx: index("ghl_opportunities_status_idx").on(table.status),
}));

export type GHLOpportunityRow = typeof ghlOpportunities.$inferSelect;
export type InsertGHLOpportunity = typeof ghlOpportunities.$inferInsert;

// ========================================
// WEBHOOK EVENT LOG (for dedup)
// ========================================

export const ghlWebhookEvents = pgTable("ghl_webhook_events", {
  id: serial("id").primaryKey(),
  eventId: varchar("eventId", { length: 256 }).notNull().unique(),
  eventType: varchar("eventType", { length: 128 }).notNull(),
  locationId: varchar("locationId", { length: 128 }),
  processedAt: timestamp("processedAt").defaultNow().notNull(),
  /** Whether processing completed successfully */
  success: boolean("success").notNull(),
}, (table) => ({
  eventIdIdx: uniqueIndex("ghl_webhook_events_event_id_idx").on(table.eventId),
  eventTypeIdx: index("ghl_webhook_events_type_idx").on(table.eventType),
  processedAtIdx: index("ghl_webhook_events_processed_at_idx").on(table.processedAt),
}));

export type GHLWebhookEventRow = typeof ghlWebhookEvents.$inferSelect;
export type InsertGHLWebhookEvent = typeof ghlWebhookEvents.$inferInsert;

// ========================================
// DEAD LETTER QUEUE (failed webhook events)
// ========================================

export const ghlWebhookDeadLetters = pgTable("ghl_webhook_dead_letters", {
  id: serial("id").primaryKey(),
  eventId: varchar("eventId", { length: 256 }),
  eventType: varchar("eventType", { length: 128 }).notNull(),
  locationId: varchar("locationId", { length: 128 }),
  payload: jsonb("payload").notNull(),
  error: text("error").notNull(),
  retryCount: integer("retryCount").default(0).notNull(),
  maxRetries: integer("maxRetries").default(3).notNull(),
  /** null = pending retry, timestamp = last retry attempt */
  lastRetriedAt: timestamp("lastRetriedAt"),
  /** Whether this DLQ entry has been resolved (retried successfully or manually dismissed) */
  resolved: boolean("resolved").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  resolvedIdx: index("ghl_webhook_dlq_resolved_idx").on(table.resolved),
  eventTypeIdx: index("ghl_webhook_dlq_type_idx").on(table.eventType),
  createdAtIdx: index("ghl_webhook_dlq_created_at_idx").on(table.createdAt),
}));

export type GHLWebhookDeadLetterRow = typeof ghlWebhookDeadLetters.$inferSelect;
export type InsertGHLWebhookDeadLetter = typeof ghlWebhookDeadLetters.$inferInsert;
