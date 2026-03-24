import {
  pgTable,
  uuid,
  varchar,
  // text,
  timestamp,
  integer,
  jsonb,
  pgEnum,
  index,
  // uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const planEnum = pgEnum('plan', ['free', 'pro', 'team']);

export const computerStatusEnum = pgEnum('computer_status', [
  'creating',
  'starting',
  'running',
  'stopping',
  'stopped',
  'error',
]);

export const hostStatusEnum = pgEnum('host_status', [
  'online',
  'offline',
  'draining',
]);

// ─── Tables ──────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  passwordHash: varchar('password_hash', { length: 256 }).notNull(),
  plan: planEnum('plan').notNull().default('free'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    keyPrefix: varchar('key_prefix', { length: 12 }).notNull(),
    keyHash: varchar('key_hash', { length: 256 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    index('api_keys_key_prefix_idx').on(table.keyPrefix),
    index('api_keys_user_id_idx').on(table.userId),
  ],
);

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const hosts = pgTable('hosts', {
  id: uuid('id').primaryKey().defaultRandom(),
  address: varchar('address', { length: 255 }).notNull(),
  totalCpu: integer('total_cpu').notNull(),
  totalRam: integer('total_ram').notNull(),
  availableCpu: integer('available_cpu').notNull(),
  availableRam: integer('available_ram').notNull(),
  gpus: jsonb('gpus').$type<Array<{ model: string; vram: number }>>().default([]),
  status: hostStatusEnum('status').notNull().default('online'),
  lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const computers = pgTable(
  'computers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    hostId: uuid('host_id').references(() => hosts.id, { onDelete: 'set null' }),
    containerId: varchar('container_id', { length: 128 }),
    name: varchar('name', { length: 255 }).notNull(),
    status: computerStatusEnum('status').notNull().default('creating'),
    specs: jsonb('specs').$type<{
      cpu: number;
      ramMb: number;
      diskGb: number;
      gpu?: string;
    }>().notNull(),
    ipAddress: varchar('ip_address', { length: 45 }),
    vncPort: integer('vnc_port'),
    novncPort: integer('novnc_port'),
    autoStopMinutes: integer('auto_stop_minutes').notNull().default(30),
    idleSince: timestamp('idle_since', { withTimezone: true }),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    stoppedAt: timestamp('stopped_at', { withTimezone: true }),
  },
  (table) => [
    index('computers_workspace_id_idx').on(table.workspaceId),
    index('computers_host_id_idx').on(table.hostId),
    index('computers_status_idx').on(table.status),
  ],
);

// ─── Relations ───────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  apiKeys: many(apiKeys),
  workspaces: many(workspaces),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, { fields: [apiKeys.userId], references: [users.id] }),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  user: one(users, { fields: [workspaces.userId], references: [users.id] }),
  computers: many(computers),
}));

export const hostsRelations = relations(hosts, ({ many }) => ({
  computers: many(computers),
}));

export const computersRelations = relations(computers, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [computers.workspaceId],
    references: [workspaces.id],
  }),
  host: one(hosts, { fields: [computers.hostId], references: [hosts.id] }),
}));
