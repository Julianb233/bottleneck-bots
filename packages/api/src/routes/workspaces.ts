import type { FastifyInstance } from 'fastify';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { workspaces, computers } from '../db/schema.js';
import { verifyWorkspaceOwnership } from '../middleware/ownership.js';
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  workspaceParamsSchema,
  deleteWorkspaceSchema,
} from '../schemas/workspace.js';

// ---------------------------------------------------------------------------
// Request body / param types
// ---------------------------------------------------------------------------

interface CreateBody {
  name: string;
}

interface UpdateBody {
  name: string;
}

interface IdParams {
  id: string;
}

interface DeleteQuery {
  force?: string;
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function workspaceRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /workspaces
   * Create a new workspace for the authenticated user.
   */
  app.post<{ Body: CreateBody }>(
    '/workspaces',
    { schema: createWorkspaceSchema },
    async (request, reply) => {
      const user = request.currentUser!;
      const { name } = request.body;

      const [workspace] = await db
        .insert(workspaces)
        .values({ userId: user.id, name })
        .returning({
          id: workspaces.id,
          name: workspaces.name,
          createdAt: workspaces.createdAt,
          updatedAt: workspaces.updatedAt,
        });

      return reply.status(201).send({ workspace });
    },
  );

  /**
   * GET /workspaces
   * List all workspaces belonging to the authenticated user, with computer counts.
   */
  app.get('/workspaces', async (request, reply) => {
    const user = request.currentUser!;

    const result = await db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        createdAt: workspaces.createdAt,
        updatedAt: workspaces.updatedAt,
        computerCount: sql<number>`(
          SELECT count(*)::int
          FROM computers
          WHERE computers.workspace_id = ${workspaces.id}
        )`.as('computer_count'),
      })
      .from(workspaces)
      .where(eq(workspaces.userId, user.id));

    return reply.send({ workspaces: result });
  });

  /**
   * GET /workspaces/:id
   * Get workspace details with its computers list.
   * Returns 404 if workspace is not owned by the user.
   */
  app.get<{ Params: IdParams }>(
    '/workspaces/:id',
    {
      schema: workspaceParamsSchema,
      preHandler: [verifyWorkspaceOwnership],
    },
    async (request, reply) => {
      const { id } = request.params;

      const [workspace] = await db
        .select({
          id: workspaces.id,
          name: workspaces.name,
          createdAt: workspaces.createdAt,
          updatedAt: workspaces.updatedAt,
        })
        .from(workspaces)
        .where(eq(workspaces.id, id));

      if (!workspace) {
        return reply.status(404).send({
          error: 'not_found',
          message: 'Workspace not found.',
        });
      }

      const wsComputers = await db
        .select({
          id: computers.id,
          name: computers.name,
          status: computers.status,
          specs: computers.specs,
          createdAt: computers.createdAt,
        })
        .from(computers)
        .where(eq(computers.workspaceId, id));

      return reply.send({ workspace, computers: wsComputers });
    },
  );

  /**
   * PATCH /workspaces/:id
   * Update workspace name.
   */
  app.patch<{ Params: IdParams; Body: UpdateBody }>(
    '/workspaces/:id',
    {
      schema: updateWorkspaceSchema,
      preHandler: [verifyWorkspaceOwnership],
    },
    async (request, reply) => {
      const { id } = request.params;
      const { name } = request.body;

      const [updated] = await db
        .update(workspaces)
        .set({ name, updatedAt: new Date() })
        .where(eq(workspaces.id, id))
        .returning({
          id: workspaces.id,
          name: workspaces.name,
          createdAt: workspaces.createdAt,
          updatedAt: workspaces.updatedAt,
        });

      return reply.send({ workspace: updated });
    },
  );

  /**
   * DELETE /workspaces/:id
   * Delete workspace. Must stop/destroy all computers first.
   * Returns 409 if running computers exist (unless ?force=true).
   */
  app.delete<{ Params: IdParams; Querystring: DeleteQuery }>(
    '/workspaces/:id',
    {
      schema: deleteWorkspaceSchema,
      preHandler: [verifyWorkspaceOwnership],
    },
    async (request, reply) => {
      const { id } = request.params;
      const force = request.query.force === 'true';

      // Check for running computers
      const wsComputers = await db
        .select({ id: computers.id, status: computers.status })
        .from(computers)
        .where(eq(computers.workspaceId, id));

      const hasRunning = wsComputers.some(
        (c) => c.status === 'running' || c.status === 'starting' || c.status === 'creating',
      );

      if (hasRunning && !force) {
        return reply.status(409).send({
          error: 'conflict',
          message:
            'Workspace has running computers. Stop them first or use ?force=true.',
        });
      }

      // Cascade delete handles computers via FK
      await db.delete(workspaces).where(eq(workspaces.id, id));

      return reply.status(200).send({ deleted: true });
    },
  );
}
