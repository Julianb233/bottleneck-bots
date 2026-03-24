import type { FastifyRequest, FastifyReply } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { workspaceMembers } from '../db/teams.js';
import { ForbiddenError } from './error-handler.js';

export type WorkspaceRole = 'owner' | 'admin' | 'member';

// Extend Fastify request to include workspace membership
declare module 'fastify' {
  interface FastifyRequest {
    membership?: {
      id: string;
      workspaceId: string;
      userId: string;
      role: WorkspaceRole;
      joinedAt: Date | null;
    };
  }
}

/**
 * RBAC middleware factory.
 *
 * Checks that the authenticated user is a member of the workspace
 * identified by :workspaceId or :id in params, and that their role
 * is included in the allowed roles list.
 *
 * Usage:
 *   preHandler: [requireRole('owner', 'admin')]
 *
 * Attaches the membership record to `request.membership`.
 */
export function requireRole(...roles: WorkspaceRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = request.currentUser;
    if (!user) {
      return reply.status(401).send({
        error: 'unauthorized',
        message: 'Authentication required.',
      });
    }

    const params = request.params as Record<string, string>;
    const workspaceId = params.workspaceId || params.id;

    if (!workspaceId) {
      throw new ForbiddenError('Workspace ID is required.');
    }

    const [membership] = await db
      .select({
        id: workspaceMembers.id,
        workspaceId: workspaceMembers.workspaceId,
        userId: workspaceMembers.userId,
        role: workspaceMembers.role,
        joinedAt: workspaceMembers.joinedAt,
      })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, user.id),
        ),
      )
      .limit(1);

    if (!membership) {
      // Return 404 instead of 403 to avoid leaking workspace existence
      return reply.status(404).send({
        error: 'not_found',
        message: 'Workspace not found.',
      });
    }

    if (!roles.includes(membership.role as WorkspaceRole)) {
      throw new ForbiddenError('You do not have permission to perform this action.');
    }

    request.membership = membership as {
      id: string;
      workspaceId: string;
      userId: string;
      role: WorkspaceRole;
      joinedAt: Date | null;
    };
  };
}

/**
 * Convenience: require any workspace membership (owner, admin, or member).
 */
export function requireMember() {
  return requireRole('owner', 'admin', 'member');
}
