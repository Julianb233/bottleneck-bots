/**
 * GHL (GoHighLevel) Schema
 * Database tables for GHL OAuth connections and sync logs
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
} from "drizzle-orm/pg-core";
import { users } from "./schema";

// ========================================
// GHL CONNECTION TABLES
// ========================================

export const ghlConnections = pgTable("ghl_connections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  locationId: varchar("location_id", { length: 255 }).notNull(),
  locationName: varchar("location_name", { length: 255 }),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  tokenType: varchar("token_type", { length: 50 }).default("Bearer"),
  scope: text("scope"),
  isActive: boolean("is_active").default(true),
  lastSyncAt: timestamp("last_sync_at"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const ghlSyncLog = pgTable("ghl_sync_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  locationId: varchar("location_id", { length: 255 }).notNull(),
  syncType: varchar("sync_type", { length: 100 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  recordsProcessed: integer("records_processed").default(0),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ========================================
// TYPE EXPORTS
// ========================================

export type InsertGhlConnection = typeof ghlConnections.$inferInsert;
export type SelectGhlConnection = typeof ghlConnections.$inferSelect;
export type InsertGhlSyncLog = typeof ghlSyncLog.$inferInsert;
export type SelectGhlSyncLog = typeof ghlSyncLog.$inferSelect;
