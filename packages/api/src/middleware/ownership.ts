import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { computers, workspaces } from '../db/schema.js';

/**
 * Fastify preHandler: verify the authenticated user owns the workspace
 * identified by :workspaceId or :id in params.
 *
 * Returns 404 (not 403) for resources belonging to other users — avoids
 * leaking the existence of other users' workspaces.
 */
export async function verifyWorkspaceOwnership(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const user = request.currentUser;
  if (!user) {
    return reply.status(401).send({
      error: 'unauthorized',
      message: 'Authentication required.',
    });
  }

  const params = request.params as Record<string, string>;
  const workspaceId = params.workspaceId || params.id;

  if (!workspaceId) return;

  const [ws] = await db
    .select({ id: workspaces.id, userId: workspaces.userId })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!ws || ws.userId !== user.id) {
    return reply.status(404).send({
      error: 'not_found',
      message: 'Workspace not found.',
    });
  }
}

/**
 * Fastify preHandler: verify the authenticated user owns the computer
 * via the workspace ownership chain (computer -> workspace -> user).
 *
 * Returns 404 (not 403) for resources belonging to other users.
 */
export async function verifyComputerOwnership(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const user = request.currentUser;
  if (!user) {
    return reply.status(401).send({
      error: 'unauthorized',
      message: 'Authentication required.',
    });
  }

  const params = request.params as Record<string, string>;
  const computerId = params.id || params.computerId;

  if (!computerId) return;

  const [computer] = await db
    .select({
      id: computers.id,
      workspaceId: computers.workspaceId,
    })
    .from(computers)
    .where(eq(computers.id, computerId))
    .limit(1);

  if (!computer) {
    return reply.status(404).send({
      error: 'not_found',
      message: 'Computer not found.',
    });
  }

  const [ws] = await db
    .select({ userId: workspaces.userId })
    .from(workspaces)
    .where(eq(workspaces.id, computer.workspaceId))
    .limit(1);

  if (!ws || ws.userId !== user.id) {
    return reply.status(404).send({
      error: 'not_found',
      message: 'Computer not found.',
    });
  }
}
