import { pgTable, text, timestamp, uuid, pgEnum, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum('workspace_role', ['owner', 'admin', 'member']);
export const inviteStatusEnum = pgEnum('invite_status', ['pending', 'accepted', 'expired', 'revoked']);

// ─── Tables ──────────────────────────────────────────────────────────────────

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id').notNull(),
    userId: uuid('user_id').notNull(),
    role: roleEnum('role').notNull().default('member'),
    invitedBy: uuid('invited_by'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex('workspace_members_ws_user_idx').on(table.workspaceId, table.userId),
    index('workspace_members_workspace_id_idx').on(table.workspaceId),
    index('workspace_members_user_id_idx').on(table.userId),
  ],
);

export const workspaceInvites = pgTable(
  'workspace_invites',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id').notNull(),
    email: text('email').notNull(),
    role: roleEnum('role').notNull().default('member'),
    token: text('token').notNull().unique(),
    invitedBy: uuid('invited_by').notNull(),
    status: inviteStatusEnum('status').notNull().default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('workspace_invites_token_idx').on(table.token),
    index('workspace_invites_workspace_id_idx').on(table.workspaceId),
    uniqueIndex('workspace_invites_ws_email_pending_idx').on(table.workspaceId, table.email),
  ],
);

// ─── Relations ───────────────────────────────────────────────────────────────

export const workspaceMembersRelations = relations(workspaceMembers, ({ one: _one }) => ({
  // Relations reference the main schema tables by name — these will be
  // resolved at runtime when the full schema is merged in db/index.ts.
}));

export const workspaceInvitesRelations = relations(workspaceInvites, ({ one: _one }) => ({
  // Same pattern — relations to users/workspaces resolved via full schema merge.
}));

// ─── Types ───────────────────────────────────────────────────────────────────

export type WorkspaceRole = 'owner' | 'admin' | 'member';
export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type WorkspaceInvite = typeof workspaceInvites.$inferSelect;
export type NewWorkspaceMember = typeof workspaceMembers.$inferInsert;
export type NewWorkspaceInvite = typeof workspaceInvites.$inferInsert;
