import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import crypto from 'node:crypto';
import { db } from '../db/index.js';
import { workspaces, users } from '../db/schema.js';
import { workspaceInvites, workspaceMembers } from '../db/teams.js';
import { requireRole } from '../middleware/rbac.js';
import { sendInviteEmail } from '../services/email.js';
import { NotFoundError, ValidationError } from '../middleware/error-handler.js';

// ─── Request types ──────────────────────────────────────────────────────────

interface WorkspaceParams {
  id: string;
}

interface InviteParams {
  id: string;
  inviteId: string;
}

interface TokenParams {
  token: string;
}

interface SendInviteBody {
  email: string;
  role: 'admin' | 'member';
}

// ─── Route plugin ───────────────────────────────────────────────────────────

export async function inviteRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /workspaces/:id/invites
   * Send an invite to join a workspace.
   * Requires: owner or admin role.
   */
  app.post<{ Params: WorkspaceParams; Body: SendInviteBody }>(
    '/workspaces/:id/invites',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        body: {
          type: 'object',
          required: ['email', 'role'],
          properties: {
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['admin', 'member'] },
          },
        },
      },
      preHandler: [requireRole('owner', 'admin')],
    },
    async (request, reply) => {
      const { id: workspaceId } = request.params;
      const { email, role } = request.body;
      const user = request.currentUser!;

      // Check if user is already a member
      const [existingUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      if (existingUser) {
        const [existingMember] = await db
          .select({ id: workspaceMembers.id })
          .from(workspaceMembers)
          .where(
            and(
              eq(workspaceMembers.workspaceId, workspaceId),
              eq(workspaceMembers.userId, existingUser.id),
            ),
          )
          .limit(1);

        if (existingMember) {
          throw new ValidationError('This user is already a member of this workspace.');
        }
      }

      // Check for existing pending invite
      const [existingInvite] = await db
        .select({ id: workspaceInvites.id })
        .from(workspaceInvites)
        .where(
          and(
            eq(workspaceInvites.workspaceId, workspaceId),
            eq(workspaceInvites.email, email.toLowerCase()),
            eq(workspaceInvites.status, 'pending'),
          ),
        )
        .limit(1);

      if (existingInvite) {
        throw new ValidationError('A pending invite already exists for this email.');
      }

      // Generate secure token
      const token = crypto.randomBytes(32).toString('hex');

      // Set expiry to 7 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Create invite record
      const [invite] = await db
        .insert(workspaceInvites)
        .values({
          workspaceId,
          email: email.toLowerCase(),
          role,
          token,
          invitedBy: user.id,
          status: 'pending',
          expiresAt,
        })
        .returning();

      // Get workspace name for email
      const [workspace] = await db
        .select({ name: workspaces.name })
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .limit(1);

      // Send invite email
      await sendInviteEmail({
        recipientEmail: email.toLowerCase(),
        workspaceName: workspace?.name || 'Unknown Workspace',
        inviterName: user.name,
        role,
        token,
      });

      return reply.status(201).send({
        invite: {
          id: invite!.id,
          email: invite!.email,
          role: invite!.role,
          status: invite!.status,
          expiresAt: invite!.expiresAt,
          createdAt: invite!.createdAt,
        },
      });
    },
  );

  /**
   * GET /workspaces/:id/invites
   * List pending invites for a workspace.
   * Requires: owner or admin role.
   */
  app.get<{ Params: WorkspaceParams }>(
    '/workspaces/:id/invites',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
      },
      preHandler: [requireRole('owner', 'admin')],
    },
    async (request, reply) => {
      const { id: workspaceId } = request.params;

      const invites = await db
        .select({
          id: workspaceInvites.id,
          email: workspaceInvites.email,
          role: workspaceInvites.role,
          status: workspaceInvites.status,
          expiresAt: workspaceInvites.expiresAt,
          createdAt: workspaceInvites.createdAt,
        })
        .from(workspaceInvites)
        .where(
          and(
            eq(workspaceInvites.workspaceId, workspaceId),
            eq(workspaceInvites.status, 'pending'),
          ),
        );

      return reply.send({ invites });
    },
  );

  /**
   * DELETE /workspaces/:id/invites/:inviteId
   * Revoke a pending invite.
   * Requires: owner or admin role.
   */
  app.delete<{ Params: InviteParams }>(
    '/workspaces/:id/invites/:inviteId',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id', 'inviteId'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            inviteId: { type: 'string', format: 'uuid' },
          },
        },
      },
      preHandler: [requireRole('owner', 'admin')],
    },
    async (request, reply) => {
      const { inviteId } = request.params;

      const [invite] = await db
        .select({ id: workspaceInvites.id, status: workspaceInvites.status })
        .from(workspaceInvites)
        .where(eq(workspaceInvites.id, inviteId))
        .limit(1);

      if (!invite) {
        throw new NotFoundError('Invite');
      }

      if (invite.status !== 'pending') {
        throw new ValidationError('Only pending invites can be revoked.');
      }

      await db
        .update(workspaceInvites)
        .set({ status: 'revoked' })
        .where(eq(workspaceInvites.id, inviteId));

      return reply.status(200).send({ revoked: true });
    },
  );

  /**
   * POST /invites/:token/accept
   * Accept a workspace invite.
   * This is a public endpoint — the token itself serves as authentication.
   */
  app.post<{ Params: TokenParams }>(
    '/invites/:token/accept',
    {
      schema: {
        params: {
          type: 'object',
          required: ['token'],
          properties: { token: { type: 'string', minLength: 1 } },
        },
      },
    },
    async (request, reply) => {
      const { token } = request.params;

      // Look up the invite
      const [invite] = await db
        .select()
        .from(workspaceInvites)
        .where(eq(workspaceInvites.token, token))
        .limit(1);

      if (!invite) {
        throw new NotFoundError('Invite');
      }

      if (invite.status === 'revoked') {
        throw new ValidationError('This invite has been revoked.');
      }

      if (invite.status === 'accepted') {
        throw new ValidationError('This invite has already been accepted.');
      }

      if (invite.status === 'expired' || new Date() > invite.expiresAt) {
        // Mark as expired if not already
        if (invite.status !== 'expired') {
          await db
            .update(workspaceInvites)
            .set({ status: 'expired' })
            .where(eq(workspaceInvites.id, invite.id));
        }
        throw new ValidationError('This invite has expired.');
      }

      // Find user by email
      const [invitedUser] = await db
        .select({ id: users.id, email: users.email, name: users.name })
        .from(users)
        .where(eq(users.email, invite.email))
        .limit(1);

      if (!invitedUser) {
        // User needs to sign up first — return info for redirect
        const [workspace] = await db
          .select({ name: workspaces.name })
          .from(workspaces)
          .where(eq(workspaces.id, invite.workspaceId))
          .limit(1);

        return reply.send({
          action: 'signup_required',
          workspace: workspace?.name || 'Unknown',
          email: invite.email,
          role: invite.role,
          token,
        });
      }

      // Check if already a member
      const [existingMember] = await db
        .select({ id: workspaceMembers.id })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, invite.workspaceId),
            eq(workspaceMembers.userId, invitedUser.id),
          ),
        )
        .limit(1);

      if (existingMember) {
        // Already a member — mark invite as accepted
        await db
          .update(workspaceInvites)
          .set({ status: 'accepted' })
          .where(eq(workspaceInvites.id, invite.id));

        throw new ValidationError('You are already a member of this workspace.');
      }

      // Add user to workspace
      await db.insert(workspaceMembers).values({
        workspaceId: invite.workspaceId,
        userId: invitedUser.id,
        role: invite.role,
        invitedBy: invite.invitedBy,
      });

      // Mark invite as accepted
      await db
        .update(workspaceInvites)
        .set({ status: 'accepted' })
        .where(eq(workspaceInvites.id, invite.id));

      // Get workspace details
      const [workspace] = await db
        .select({ id: workspaces.id, name: workspaces.name })
        .from(workspaces)
        .where(eq(workspaces.id, invite.workspaceId))
        .limit(1);

      return reply.send({
        action: 'joined',
        workspace: {
          id: workspace?.id,
          name: workspace?.name,
        },
        role: invite.role,
      });
    },
  );
}
