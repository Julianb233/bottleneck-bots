/**
 * GoHighLevel Integration Schema
 * Database tables for GHL OAuth connections and sync logging
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
 * Tracks authorized GHL locations per user with credential references
 */
export const ghlConnections = pgTable("ghl_connections", {
  id: serial("id").primaryKey(),

  /** User who owns this connection */
  userId: integer("userId")
    .references(() => users.id)
    .notNull(),

  /** GHL location ID */
  locationId: varchar("locationId", { length: 255 }).notNull(),

  /** GHL company/agency ID */
  companyId: varchar("companyId", { length: 255 }),

  /** Human-readable location name (fetched from GHL API) */
  locationName: text("locationName"),

  /** Connection status */
  status: varchar("status", { length: 50 }).notNull().default("connected"),
  // 'connected' | 'disconnected' | 'needs_reauth' | 'error'

  /** Granted OAuth scopes */
  scopes: text("scopes"),

  /** Reference to encrypted credential in the vault */
  credentialId: integer("credentialId"),

  /** When the OAuth connection was established */
  connectedAt: timestamp("connectedAt").defaultNow().notNull(),

  /** Last successful data sync */
  lastSyncAt: timestamp("lastSyncAt"),

  /** Last error message (null when healthy) */
  lastError: text("lastError"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type GhlConnection = typeof ghlConnections.$inferSelect;
export type InsertGhlConnection = typeof ghlConnections.$inferInsert;

/**
 * GHL Sync Log
 * Audit trail for data synchronization operations
 */
export const ghlSyncLog = pgTable("ghl_sync_log", {
  id: serial("id").primaryKey(),

  /** Reference to the connection */
  connectionId: integer("connectionId")
    .references(() => ghlConnections.id)
    .notNull(),

  /** User who owns this connection */
  userId: integer("userId")
    .references(() => users.id)
    .notNull(),

  /** Type of sync operation */
  syncType: varchar("syncType", { length: 100 }).notNull(),
  // e.g. 'contacts', 'opportunities', 'campaigns', 'workflows'

  /** Sync direction */
  direction: varchar("direction", { length: 20 }).notNull().default("pull"),
  // 'pull' | 'push' | 'bidirectional'

  /** Outcome of the sync */
  status: varchar("status", { length: 50 }).notNull(),
  // 'success' | 'partial' | 'failed'

  /** Number of records processed */
  recordsProcessed: integer("recordsProcessed").default(0),

  /** Number of records that errored */
  recordsErrored: integer("recordsErrored").default(0),

  /** Additional sync metadata */
  metadata: jsonb("metadata"),

  /** Error details if failed */
  errorMessage: text("errorMessage"),

  /** Duration in milliseconds */
  durationMs: integer("durationMs"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GhlSyncLog = typeof ghlSyncLog.$inferSelect;
export type InsertGhlSyncLog = typeof ghlSyncLog.$inferInsert;
