import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { workspaceMembers } from '../db/teams.js';
import { requireRole, type WorkspaceRole } from '../middleware/rbac.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../middleware/error-handler.js';

// ─── Request types ──────────────────────────────────────────────────────────

interface WorkspaceParams {
  id: string;
}

interface MemberParams {
  id: string;
  userId: string;
}

interface UpdateRoleBody {
  role: 'admin' | 'member';
}

// ─── Route plugin ───────────────────────────────────────────────────────────

export async function memberRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /workspaces/:id/members
   * List all members of a workspace.
   * Requires: any workspace member.
   */
  app.get<{ Params: WorkspaceParams }>(
    '/workspaces/:id/members',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
      },
      preHandler: [requireRole('owner', 'admin', 'member')],
    },
    async (request, reply) => {
      const { id: workspaceId } = request.params;

      const members = await db
        .select({
          id: workspaceMembers.id,
          userId: workspaceMembers.userId,
          role: workspaceMembers.role,
          joinedAt: workspaceMembers.joinedAt,
          userName: users.name,
          userEmail: users.email,
        })
        .from(workspaceMembers)
        .innerJoin(users, eq(workspaceMembers.userId, users.id))
        .where(eq(workspaceMembers.workspaceId, workspaceId));

      return reply.send({
        members: members.map((m) => ({
          id: m.id,
          userId: m.userId,
          name: m.userName,
          email: m.userEmail,
          role: m.role,
          joinedAt: m.joinedAt,
        })),
      });
    },
  );

  /**
   * PATCH /workspaces/:id/members/:userId
   * Update a member's role.
   * Requires: owner role.
   */
  app.patch<{ Params: MemberParams; Body: UpdateRoleBody }>(
    '/workspaces/:id/members/:userId',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id', 'userId'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['role'],
          properties: {
            role: { type: 'string', enum: ['admin', 'member'] },
          },
        },
      },
      preHandler: [requireRole('owner')],
    },
    async (request, reply) => {
      const { id: workspaceId, userId } = request.params;
      const { role } = request.body;
      const currentUser = request.currentUser!;

      // Cannot change own role
      if (userId === currentUser.id) {
        throw new ValidationError('You cannot change your own role.');
      }

      // Find the target member
      const [targetMember] = await db
        .select({
          id: workspaceMembers.id,
          role: workspaceMembers.role,
        })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, workspaceId),
            eq(workspaceMembers.userId, userId),
          ),
        )
        .limit(1);

      if (!targetMember) {
        throw new NotFoundError('Member');
      }

      // Cannot change the role of another owner
      if (targetMember.role === 'owner') {
        throw new ValidationError('Cannot change the role of a workspace owner.');
      }

      // Update the role
      const [updated] = await db
        .update(workspaceMembers)
        .set({ role: role as WorkspaceRole })
        .where(eq(workspaceMembers.id, targetMember.id))
        .returning({
          id: workspaceMembers.id,
          userId: workspaceMembers.userId,
          role: workspaceMembers.role,
          joinedAt: workspaceMembers.joinedAt,
        });

      return reply.send({ member: updated });
    },
  );

  /**
   * DELETE /workspaces/:id/members/:userId
   * Remove a member from the workspace.
   * Requires: owner or admin role.
   */
  app.delete<{ Params: MemberParams }>(
    '/workspaces/:id/members/:userId',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id', 'userId'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
          },
        },
      },
      preHandler: [requireRole('owner', 'admin')],
    },
    async (request, reply) => {
      const { id: workspaceId, userId } = request.params;
      const currentUser = request.currentUser!;
      const membership = request.membership!;

      // Cannot remove self — use "leave" endpoint
      if (userId === currentUser.id) {
        throw new ValidationError('Cannot remove yourself. Use the "leave workspace" endpoint instead.');
      }

      // Find the target member
      const [targetMember] = await db
        .select({
          id: workspaceMembers.id,
          role: workspaceMembers.role,
          userId: workspaceMembers.userId,
        })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, workspaceId),
            eq(workspaceMembers.userId, userId),
          ),
        )
        .limit(1);

      if (!targetMember) {
        throw new NotFoundError('Member');
      }

      // Cannot remove the workspace owner
      if (targetMember.role === 'owner') {
        throw new ForbiddenError('Cannot remove the workspace owner.');
      }

      // Admins cannot remove other admins
      if (membership.role === 'admin' && targetMember.role === 'admin') {
        throw new ForbiddenError('Admins cannot remove other admins.');
      }

      await db
        .delete(workspaceMembers)
        .where(eq(workspaceMembers.id, targetMember.id));

      return reply.status(200).send({ removed: true });
    },
  );

  /**
   * POST /workspaces/:id/leave
   * Leave a workspace. Owner cannot leave — must transfer ownership or delete.
   * Requires: any member except owner.
   */
  app.post<{ Params: WorkspaceParams }>(
    '/workspaces/:id/leave',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
      },
      preHandler: [requireRole('owner', 'admin', 'member')],
    },
    async (request, reply) => {
      const { id: workspaceId } = request.params;
      const currentUser = request.currentUser!;
      const membership = request.membership!;

      // Owner cannot leave
      if (membership.role === 'owner') {
        throw new ValidationError(
          'Workspace owners cannot leave. Transfer ownership first or delete the workspace.',
        );
      }

      await db
        .delete(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, workspaceId),
            eq(workspaceMembers.userId, currentUser.id),
          ),
        );

      return reply.status(200).send({ left: true });
    },
  );
}
