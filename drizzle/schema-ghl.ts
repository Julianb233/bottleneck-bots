/**
 * GoHighLevel Integration Schema
 *
 * Tables for GHL OAuth connections and sync logging.
 */

import { pgTable, serial, integer, varchar, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { users } from "./schema";

// ========================================
// GHL CONNECTIONS
// ========================================

export const ghlConnections = pgTable("ghl_connections", {
  id: serial("id").primaryKey(),
  userId: integer("userId").references(() => users.id).notNull(),
  locationId: varchar("locationId", { length: 128 }).notNull(),
  companyId: varchar("companyId", { length: 128 }),
  locationName: text("locationName"),
  status: varchar("status", { length: 32 }).default("pending").notNull(), // pending, connected, disconnected, needs_reauth
  scopes: text("scopes"),
  credentialId: integer("credentialId"),
  lastError: text("lastError"),
  lastSyncAt: timestamp("lastSyncAt"),
  connectedAt: timestamp("connectedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type GhlConnection = typeof ghlConnections.$inferSelect;
export type InsertGhlConnection = typeof ghlConnections.$inferInsert;

// ========================================
// GHL SYNC LOG
// ========================================

export const ghlSyncLog = pgTable("ghl_sync_log", {
  id: serial("id").primaryKey(),
  userId: integer("userId").references(() => users.id).notNull(),
  locationId: varchar("locationId", { length: 128 }).notNull(),
  operation: varchar("operation", { length: 64 }).notNull(), // e.g. "contacts.list", "pipeline.update"
  status: varchar("status", { length: 32 }).default("pending").notNull(), // pending, success, failed
  recordsAffected: integer("recordsAffected").default(0),
  errorMessage: text("errorMessage"),
  metadata: jsonb("metadata"),
  durationMs: integer("durationMs"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GhlSyncLog = typeof ghlSyncLog.$inferSelect;
export type InsertGhlSyncLog = typeof ghlSyncLog.$inferInsert;
