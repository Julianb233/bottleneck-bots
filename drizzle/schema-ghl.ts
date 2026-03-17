/**
 * GoHighLevel Integration Schema
 * Database tables for GHL OAuth connections and sync logging.
 */

import { pgTable, serial, text, timestamp, varchar, integer, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { users } from "./schema";

/**
 * GHL OAuth connections
 * Tracks connected GHL locations per user with credential references.
 */
export const ghlConnections = pgTable("ghl_connections", {
  id: serial("id").primaryKey(),

  /** User who owns this connection */
  userId: integer("userId").references(() => users.id).notNull(),

  /** GHL location identifier */
  locationId: varchar("locationId", { length: 128 }).notNull(),

  /** GHL company/agency identifier */
  companyId: varchar("companyId", { length: 128 }),

  /** Human-readable location name (fetched from GHL API) */
  locationName: text("locationName"),

  /** Connection status */
  status: varchar("status", { length: 32 }).default("connected").notNull(), // 'connected', 'disconnected', 'needs_reauth', 'error'

  /** OAuth scopes granted */
  scopes: text("scopes"),

  /** Reference to encrypted credential in credential vault */
  credentialId: integer("credentialId"),

  /** Timestamps */
  connectedAt: timestamp("connectedAt").defaultNow().notNull(),
  lastSyncAt: timestamp("lastSyncAt"),
  lastError: text("lastError"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("ghl_connections_user_id_idx").on(table.userId),
  locationIdIdx: index("ghl_connections_location_id_idx").on(table.locationId),
  userLocationIdx: index("ghl_connections_user_location_idx").on(table.userId, table.locationId),
}));

export type GhlConnection = typeof ghlConnections.$inferSelect;
export type InsertGhlConnection = typeof ghlConnections.$inferInsert;

/**
 * GHL sync log
 * Tracks sync operations between our system and GHL.
 */
export const ghlSyncLog = pgTable("ghl_sync_log", {
  id: serial("id").primaryKey(),

  /** Connection this sync belongs to */
  connectionId: integer("connectionId").references(() => ghlConnections.id),

  /** User who owns this sync */
  userId: integer("userId").references(() => users.id).notNull(),

  /** Location being synced */
  locationId: varchar("locationId", { length: 128 }).notNull(),

  /** Type of sync operation */
  syncType: varchar("syncType", { length: 64 }).notNull(), // 'contacts', 'opportunities', 'campaigns', 'full'

  /** Sync direction */
  direction: varchar("direction", { length: 16 }).default("pull").notNull(), // 'pull', 'push', 'bidirectional'

  /** Sync status */
  status: varchar("status", { length: 32 }).default("pending").notNull(), // 'pending', 'running', 'completed', 'failed'

  /** Record counts */
  recordsProcessed: integer("recordsProcessed").default(0),
  recordsCreated: integer("recordsCreated").default(0),
  recordsUpdated: integer("recordsUpdated").default(0),
  recordsFailed: integer("recordsFailed").default(0),

  /** Error details if failed */
  errorMessage: text("errorMessage"),
  errorDetails: jsonb("errorDetails"),

  /** Timing */
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("ghl_sync_log_user_id_idx").on(table.userId),
  locationIdIdx: index("ghl_sync_log_location_id_idx").on(table.locationId),
  statusIdx: index("ghl_sync_log_status_idx").on(table.status),
}));

export type GhlSyncLog = typeof ghlSyncLog.$inferSelect;
export type InsertGhlSyncLog = typeof ghlSyncLog.$inferInsert;
