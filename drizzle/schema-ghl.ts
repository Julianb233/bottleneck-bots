/**
 * GoHighLevel Integration Schema
 * Database tables for GHL OAuth connections, webhook events, and sync logging.
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
// GHL CONNECTIONS
// ========================================

/**
 * Tracks GHL OAuth connections per user per location.
 * Each user can connect multiple GHL locations.
 */
export const ghlConnections = pgTable(
  "ghl_connections",
  {
    id: serial("id").primaryKey(),

    /** User who owns this connection */
    userId: integer("userId")
      .references(() => users.id)
      .notNull(),

    /** GHL Location ID (sub-account) */
    locationId: varchar("locationId", { length: 128 }).notNull(),

    /** GHL Company ID (agency) */
    companyId: varchar("companyId", { length: 128 }),

    /** Human-readable location name (fetched from GHL API) */
    locationName: text("locationName"),

    /** Connection status */
    status: varchar("status", { length: 30 })
      .default("connected")
      .notNull(), // 'connected', 'disconnected', 'needs_reauth', 'error'

    /** Granted OAuth scopes */
    scopes: text("scopes"),

    /** Reference to encrypted credential in credential vault */
    credentialId: integer("credentialId"),

    /** When the connection was established */
    connectedAt: timestamp("connectedAt").defaultNow().notNull(),

    /** Last successful API sync */
    lastSyncAt: timestamp("lastSyncAt"),

    /** Last error message */
    lastError: text("lastError"),

    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => [
    index("ghl_connections_user_idx").on(table.userId),
    index("ghl_connections_location_idx").on(table.userId, table.locationId),
  ]
);

export type GhlConnection = typeof ghlConnections.$inferSelect;
export type InsertGhlConnection = typeof ghlConnections.$inferInsert;

// ========================================
// GHL WEBHOOK EVENTS
// ========================================

/**
 * Stores inbound GHL webhook events for processing.
 * Supports deduplication via eventId and dead-letter queue via status.
 */
export const ghlWebhookEvents = pgTable(
  "ghl_webhook_events",
  {
    id: serial("id").primaryKey(),

    /** GHL Location this event belongs to */
    locationId: varchar("locationId", { length: 128 }).notNull(),

    /** Event type (e.g., 'ContactCreate', 'OpportunityStageUpdate') */
    eventType: varchar("eventType", { length: 100 }).notNull(),

    /** GHL event ID for deduplication */
    eventId: varchar("eventId", { length: 256 }),

    /** Full event payload */
    payload: jsonb("payload").notNull(),

    /** Processing status */
    status: varchar("status", { length: 30 })
      .default("pending")
      .notNull(), // 'pending', 'processed', 'failed', 'dead_letter'

    /** When the event was processed */
    processedAt: timestamp("processedAt"),

    /** Error message if processing failed */
    error: text("error"),

    /** Number of processing attempts */
    attempts: integer("attempts").default(0).notNull(),

    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    index("ghl_webhook_events_location_idx").on(table.locationId),
    index("ghl_webhook_events_status_idx").on(table.status),
    index("ghl_webhook_events_event_id_idx").on(table.eventId),
  ]
);

export type GhlWebhookEvent = typeof ghlWebhookEvents.$inferSelect;
export type InsertGhlWebhookEvent = typeof ghlWebhookEvents.$inferInsert;

// ========================================
// GHL SYNC LOG
// ========================================

/**
 * Audit log for all GHL data sync operations.
 * Tracks both inbound (webhook) and outbound (API call) operations.
 */
export const ghlSyncLog = pgTable(
  "ghl_sync_log",
  {
    id: serial("id").primaryKey(),

    /** User who triggered the sync (if applicable) */
    userId: integer("userId").references(() => users.id),

    /** GHL Location ID */
    locationId: varchar("locationId", { length: 128 }).notNull(),

    /** Operation performed (e.g., 'create_contact', 'update_opportunity') */
    operation: varchar("operation", { length: 100 }).notNull(),

    /** Entity type (e.g., 'contact', 'opportunity', 'pipeline') */
    entityType: varchar("entityType", { length: 50 }).notNull(),

    /** Entity ID in GHL */
    entityId: varchar("entityId", { length: 256 }),

    /** Sync direction */
    direction: varchar("direction", { length: 20 }).notNull(), // 'inbound', 'outbound'

    /** Sync status */
    status: varchar("status", { length: 30 }).notNull(), // 'success', 'failed', 'partial'

    /** Error message if failed */
    error: text("error"),

    /** Additional metadata */
    metadata: jsonb("metadata"),

    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [
    index("ghl_sync_log_user_idx").on(table.userId),
    index("ghl_sync_log_location_idx").on(table.locationId),
  ]
);

export type GhlSyncLog = typeof ghlSyncLog.$inferSelect;
export type InsertGhlSyncLog = typeof ghlSyncLog.$inferInsert;
