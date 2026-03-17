/**
 * GHL Multi-Location Management Schema
 *
 * Stores location details, per-location config, and tracks active location per user.
 * Linear: AI-2881
 */

import { pgTable, serial, text, timestamp, varchar, integer, boolean, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./schema";

/**
 * GHL locations with metadata and per-location configuration
 */
export const ghlLocations = pgTable("ghl_locations", {
  id: serial("id").primaryKey(),
  userId: integer("userId").references(() => users.id).notNull(),
  locationId: varchar("locationId", { length: 128 }).notNull(), // GHL location ID
  companyId: varchar("companyId", { length: 128 }), // GHL company/agency ID
  name: text("name"), // Location display name (fetched from GHL API)
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  country: varchar("country", { length: 100 }),
  phone: varchar("phone", { length: 30 }),
  email: varchar("email", { length: 320 }),
  timezone: varchar("timezone", { length: 64 }),
  website: text("website"),
  logoUrl: text("logoUrl"),

  // Per-location configuration
  config: jsonb("config").$type<GHLLocationConfig>(),

  isActive: boolean("isActive").default(true).notNull(), // Whether this location connection is active
  lastSyncedAt: timestamp("lastSyncedAt"), // Last time we synced data from this location
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (table) => ({
  // One row per user+location combination
  userLocationIdx: uniqueIndex("ghl_locations_user_location_idx").on(table.userId, table.locationId),
  userIdx: index("ghl_locations_user_idx").on(table.userId),
}));

/**
 * Tracks which GHL location is currently active/selected per user.
 * Only one active location per user at a time.
 */
export const ghlActiveLocation = pgTable("ghl_active_location", {
  id: serial("id").primaryKey(),
  userId: integer("userId").references(() => users.id).notNull().unique(),
  locationId: varchar("locationId", { length: 128 }).notNull(),
  selectedAt: timestamp("selectedAt").defaultNow().notNull(),
}, (table) => ({
  userIdx: uniqueIndex("ghl_active_location_user_idx").on(table.userId),
}));

// Types
export interface GHLLocationConfig {
  /** Enable/disable automations for this location */
  automationsEnabled?: boolean;
  /** Enable/disable contact sync */
  contactSyncEnabled?: boolean;
  /** Enable/disable pipeline sync */
  pipelineSyncEnabled?: boolean;
  /** Enable/disable calendar sync */
  calendarSyncEnabled?: boolean;
  /** Custom webhook URL for this location */
  webhookUrl?: string;
  /** Default pipeline ID for new opportunities */
  defaultPipelineId?: string;
  /** Default calendar ID for bookings */
  defaultCalendarId?: string;
  /** Custom brand voice override for this location */
  brandVoice?: string;
  /** Custom agent instructions for this location */
  agentInstructions?: string;
  /** Tags for organization */
  tags?: string[];
}

export type GHLLocationRow = typeof ghlLocations.$inferSelect;
export type InsertGHLLocation = typeof ghlLocations.$inferInsert;
export type GHLActiveLocationRow = typeof ghlActiveLocation.$inferSelect;
export type InsertGHLActiveLocation = typeof ghlActiveLocation.$inferInsert;
