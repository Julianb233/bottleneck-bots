/**
 * GHL (GoHighLevel) Integration Schema
 * Database tables for GHL OAuth connections, webhook events, and sync logging
 */

import {
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { users } from "./schema";

/**
 * GHL OAuth Connections
 * Tracks connected GHL locations per user with credential references
 */
export const ghlConnections = pgTable("ghl_connections", {
  id: serial("id").primaryKey(),
  userId: integer("userId")
    .references(() => users.id)
    .notNull(),

  /** GHL Location ID */
  locationId: varchar("locationId", { length: 128 }).notNull(),

  /** GHL Company ID */
  companyId: varchar("companyId", { length: 128 }),

  /** Human-readable location name */
  locationName: text("locationName"),

  /** Connection status */
  status: varchar("status", { length: 32 }).default("connected").notNull(), // 'connected', 'disconnected', 'error', 'needs_reauth'

  /** OAuth scopes granted */
  scopes: text("scopes"), // Space-separated scope string

  /** Reference to credential vault entry */
  credentialId: integer("credentialId"),

  /** Connection timestamps */
  connectedAt: timestamp("connectedAt").defaultNow().notNull(),
  lastSyncAt: timestamp("lastSyncAt"),

  /** Last error message (null when healthy) */
  lastError: text("lastError"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type GhlConnection = typeof ghlConnections.$inferSelect;
export type InsertGhlConnection = typeof ghlConnections.$inferInsert;

/**
 * GHL Webhook Events
 * Stores incoming GHL webhook payloads with deduplication and processing status
 */
export const ghlWebhookEvents = pgTable("ghl_webhook_events", {
  id: serial("id").primaryKey(),

  /** GHL Location this event belongs to */
  locationId: varchar("locationId", { length: 128 }).notNull(),

  /** GHL event type (e.g., 'ContactCreate', 'OpportunityStatusUpdate') */
  eventType: varchar("eventType", { length: 128 }).notNull(),

  /** GHL event ID for deduplication */
  eventId: varchar("eventId", { length: 256 }),

  /** Raw event payload */
  payload: jsonb("payload").notNull(),

  /** Processing status */
  status: varchar("status", { length: 32 }).default("pending").notNull(), // 'pending', 'processed', 'failed', 'dead_letter'

  /** Processing metadata */
  processedAt: timestamp("processedAt"),
  error: text("error"),
  attempts: integer("attempts").default(0).notNull(),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GhlWebhookEvent = typeof ghlWebhookEvents.$inferSelect;
export type InsertGhlWebhookEvent = typeof ghlWebhookEvents.$inferInsert;

/**
 * GHL Sync Log
 * Audit trail for all data synchronization operations between the platform and GHL
 */
export const ghlSyncLog = pgTable("ghl_sync_log", {
  id: serial("id").primaryKey(),

  userId: integer("userId")
    .references(() => users.id)
    .notNull(),

  /** GHL Location ID */
  locationId: varchar("locationId", { length: 128 }).notNull(),

  /** Operation performed */
  operation: varchar("operation", { length: 64 }).notNull(), // 'create', 'read', 'update', 'delete', 'bulk_import', 'bulk_export'

  /** Entity type being synced */
  entityType: varchar("entityType", { length: 64 }).notNull(), // 'contact', 'opportunity', 'campaign', 'workflow', 'appointment'

  /** Entity ID in GHL */
  entityId: varchar("entityId", { length: 128 }),

  /** Sync direction */
  direction: varchar("direction", { length: 16 }).notNull(), // 'inbound', 'outbound'

  /** Operation status */
  status: varchar("status", { length: 32 }).default("success").notNull(), // 'success', 'error', 'partial'

  /** Error details if failed */
  error: text("error"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GhlSyncLog = typeof ghlSyncLog.$inferSelect;
export type InsertGhlSyncLog = typeof ghlSyncLog.$inferInsert;
