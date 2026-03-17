/**
 * Campaign Operations Schema
 * Tables for managing campaign contacts and engagement tracking
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
} from "drizzle-orm/pg-core";
import { users } from "./schema";
import { ai_call_campaigns, leads } from "./schema-lead-enrichment";

// ========================================
// CAMPAIGN CONTACTS (JUNCTION TABLE)
// ========================================

/**
 * Links individual contacts/leads to campaigns.
 * A lead can be in multiple campaigns; a campaign can have many leads.
 */
export const campaignContacts = pgTable("campaign_contacts", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaignId")
    .references(() => ai_call_campaigns.id, { onDelete: "cascade" })
    .notNull(),
  leadId: integer("leadId")
    .references(() => leads.id, { onDelete: "cascade" })
    .notNull(),
  userId: integer("userId")
    .references(() => users.id)
    .notNull(),
  status: varchar("status", { length: 30 })
    .default("pending")
    .notNull(), // pending, contacted, completed, skipped, failed, opted_out
  priority: integer("priority").default(0).notNull(), // Higher = called sooner
  notes: text("notes"),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
  lastContactedAt: timestamp("lastContactedAt"),
  completedAt: timestamp("completedAt"),
}, (table) => ({
  campaignLeadIdx: uniqueIndex("campaign_contacts_campaign_lead_idx")
    .on(table.campaignId, table.leadId),
  campaignStatusIdx: index("campaign_contacts_campaign_status_idx")
    .on(table.campaignId, table.status),
  userIdx: index("campaign_contacts_user_idx").on(table.userId),
}));

export type CampaignContact = typeof campaignContacts.$inferSelect;
export type InsertCampaignContact = typeof campaignContacts.$inferInsert;

// ========================================
// CAMPAIGN EVENTS (ENGAGEMENT TRACKING)
// ========================================

/**
 * Tracks all engagement events for campaign contacts.
 * Records calls, responses, opt-outs, callbacks, etc.
 */
export const campaignEvents = pgTable("campaign_events", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaignId")
    .references(() => ai_call_campaigns.id, { onDelete: "cascade" })
    .notNull(),
  contactId: integer("contactId")
    .references(() => campaignContacts.id, { onDelete: "cascade" }),
  leadId: integer("leadId")
    .references(() => leads.id, { onDelete: "set null" }),
  userId: integer("userId")
    .references(() => users.id)
    .notNull(),
  eventType: varchar("eventType", { length: 50 }).notNull(),
  // Event types: contact_added, contact_removed, call_initiated, call_completed,
  // call_failed, callback_scheduled, opted_out, response_positive, response_negative,
  // campaign_started, campaign_paused, campaign_completed
  metadata: jsonb("metadata"), // Flexible data per event type
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  campaignIdx: index("campaign_events_campaign_idx").on(table.campaignId),
  eventTypeIdx: index("campaign_events_type_idx").on(table.campaignId, table.eventType),
  createdAtIdx: index("campaign_events_created_idx").on(table.campaignId, table.createdAt),
}));

export type CampaignEvent = typeof campaignEvents.$inferSelect;
export type InsertCampaignEvent = typeof campaignEvents.$inferInsert;
