/**
 * Orgo Compute Schema
 *
 * Database tables for the Orgo desktop VM infrastructure recreated in Bottleneck Bots.
 * Hierarchy: User → Workspace → Computer (VM)
 *
 * Linear: AI-5248
 */

import {
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
  integer,
  jsonb,
  index,
  boolean,
} from "drizzle-orm/pg-core";
import { users } from "./schema";

// ─── Orgo Workspaces ────────────────────────────────────────────────────────

export const orgoWorkspaces = pgTable(
  "orgo_workspaces",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("orgo_workspaces_user_id_idx").on(table.userId),
  })
);

export type OrgoWorkspace = typeof orgoWorkspaces.$inferSelect;
export type InsertOrgoWorkspace = typeof orgoWorkspaces.$inferInsert;

// ─── Computer Specs (JSONB shape) ───────────────────────────────────────────

export interface ComputerSpecs {
  cpu: number;
  ramMb: number;
  diskGb: number;
  gpu?: string;
}

// ─── Computer Status Values ─────────────────────────────────────────────────

export type ComputerStatus =
  | "creating"
  | "starting"
  | "running"
  | "stopping"
  | "stopped"
  | "restarting"
  | "error";

// ─── Orgo Computers ─────────────────────────────────────────────────────────

export const orgoComputers = pgTable(
  "orgo_computers",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspaceId")
      .notNull()
      .references(() => orgoWorkspaces.id, { onDelete: "cascade" }),
    containerId: varchar("containerId", { length: 128 }),
    name: varchar("name", { length: 255 }).notNull(),
    /** Status: creating | starting | running | stopping | stopped | restarting | error */
    status: varchar("status", { length: 20 }).notNull().default("creating"),
    /** Machine specs: { cpu, ramMb, diskGb, gpu? } */
    specs: jsonb("specs").$type<ComputerSpecs>().notNull(),
    /** Resolution string e.g. "1280x720x24" */
    resolution: varchar("resolution", { length: 20 }).default("1280x720x24"),
    ipAddress: varchar("ipAddress", { length: 45 }),
    vncPort: integer("vncPort"),
    novncPort: integer("novncPort"),
    /** Auto-stop after N idle minutes (0 = disabled, default 15) */
    autoStopMinutes: integer("autoStopMinutes").notNull().default(15),
    idleSince: timestamp("idleSince"),
    lastActivityAt: timestamp("lastActivityAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    stoppedAt: timestamp("stoppedAt"),
  },
  (table) => ({
    workspaceIdIdx: index("orgo_computers_workspace_id_idx").on(table.workspaceId),
    statusIdx: index("orgo_computers_status_idx").on(table.status),
  })
);

export type OrgoComputer = typeof orgoComputers.$inferSelect;
export type InsertOrgoComputer = typeof orgoComputers.$inferInsert;
