import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { computers } from '../db/schema.js';
import {
  verifyWorkspaceOwnership,
  verifyComputerOwnership,
} from '../middleware/ownership.js';
import { validateTransition } from '../lib/state-machine.js';
import { getComputerLifecycleQueue } from '../lib/queue.js';
import {
  createComputerSchema,
  computerParamsSchema,
  listComputersSchema,
} from '../schemas/computer.js';

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

interface CreateBody {
  name: string;
  cpu?: number;
  ram?: number;
  gpu?: string;
  resolution?: string;
  template?: string;
}

interface WorkspaceParams {
  workspaceId: string;
}

interface ComputerParams {
  id: string;
}

interface ListQuery {
  status?: string;
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function computerRoutes(app: FastifyInstance): Promise<void> {
  const lifecycleQueue = getComputerLifecycleQueue();

  /**
   * POST /workspaces/:workspaceId/computers
   * Create a new computer in the workspace.
   * Defaults: cpu=2, ram=4096, resolution="1280x720x24"
   * Validates workspace ownership, inserts with status "creating",
   * enqueues BullMQ lifecycle job, returns 202.
   */
  app.post<{ Params: WorkspaceParams; Body: CreateBody }>(
    '/workspaces/:workspaceId/computers',
    {
      schema: createComputerSchema,
      preHandler: [verifyWorkspaceOwnership],
    },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const body = request.body;

      const specs = {
        cpu: body.cpu ?? 2,
        ramMb: body.ram ?? 4096,
        diskGb: 10,
        gpu: body.gpu,
      };

      const resolution = body.resolution ?? '1280x720x24';

      const [computer] = await db
        .insert(computers)
        .values({
          workspaceId,
          name: body.name,
          status: 'creating',
          specs,
        })
        .returning({
          id: computers.id,
          name: computers.name,
          status: computers.status,
          specs: computers.specs,
          createdAt: computers.createdAt,
        });

      // Enqueue lifecycle create job
      await lifecycleQueue.add(
        'create',
        {
          computerId: computer!.id,
          action: 'create' as const,
          spec: {
            ...specs,
            image: body.template,
            resolution,
          },
        },
        {
          attempts: 3,
          backoff: { type: 'exponential' as const, delay: 1000 },
        },
      );

      return reply.status(202).send({
        computer: {
          id: computer!.id,
          name: computer!.name,
          status: computer!.status,
          specs,
        },
      });
    },
  );

  /**
   * GET /workspaces/:workspaceId/computers
   * List computers in a workspace. Optional ?status= filter.
   */
  app.get<{ Params: WorkspaceParams; Querystring: ListQuery }>(
    '/workspaces/:workspaceId/computers',
    {
      schema: listComputersSchema,
      preHandler: [verifyWorkspaceOwnership],
    },
    async (request, reply) => {
      const { workspaceId } = request.params;
      const { status } = request.query;

      let conditions = eq(computers.workspaceId, workspaceId);

      const result = await db
        .select({
          id: computers.id,
          name: computers.name,
          status: computers.status,
          specs: computers.specs,
          ipAddress: computers.ipAddress,
          vncPort: computers.vncPort,
          novncPort: computers.novncPort,
          createdAt: computers.createdAt,
          updatedAt: computers.updatedAt,
        })
        .from(computers)
        .where(conditions);

      const filtered = status
        ? result.filter((c) => c.status === status)
        : result;

      return reply.send({ computers: filtered });
    },
  );

  /**
   * GET /computers/:id
   * Get computer details with VNC URLs when running.
   * Verifies ownership via computer -> workspace -> user chain.
   */
  app.get<{ Params: ComputerParams }>(
    '/computers/:id',
    {
      schema: computerParamsSchema,
      preHandler: [verifyComputerOwnership],
    },
    async (request, reply) => {
      const { id } = request.params;

      const [computer] = await db
        .select()
        .from(computers)
        .where(eq(computers.id, id))
        .limit(1);

      if (!computer) {
        return reply.status(404).send({
          error: 'not_found',
          message: 'Computer not found.',
        });
      }

      const response: Record<string, unknown> = { ...computer };

      // Include connection URLs only when running
      if (computer.status === 'running' && computer.novncPort) {
        response.novncUrl = `http://localhost:${computer.novncPort}/vnc.html`;
        response.vncUrl = `vnc://localhost:${computer.vncPort}`;
      }

      return reply.send({ computer: response });
    },
  );

  /**
   * POST /computers/:id/start
   * Start a stopped computer. Only valid from "stopped" state.
   * Enqueues lifecycle job, returns 202.
   */
  app.post<{ Params: ComputerParams }>(
    '/computers/:id/start',
    {
      schema: computerParamsSchema,
      preHandler: [verifyComputerOwnership],
    },
    async (request, reply) => {
      const { id } = request.params;

      const [computer] = await db
        .select({
          id: computers.id,
          status: computers.status,
          containerId: computers.containerId,
        })
        .from(computers)
        .where(eq(computers.id, id))
        .limit(1);

      if (!computer) {
        return reply.status(404).send({
          error: 'not_found',
          message: 'Computer not found.',
        });
      }

      if (!validateTransition(computer.status as any, 'starting')) {
        return reply.status(409).send({
          error: 'invalid_state',
          message: `Cannot start a computer in "${computer.status}" state.`,
        });
      }

      // Transition to starting
      await db
        .update(computers)
        .set({ status: 'starting', updatedAt: new Date() })
        .where(eq(computers.id, id));

      await lifecycleQueue.add('start', {
        computerId: id,
        action: 'start' as const,
        containerId: computer.containerId,
      });

      return reply.status(202).send({ status: 'starting' });
    },
  );

  /**
   * POST /computers/:id/stop
   * Stop a running computer. Only valid from "running" state.
   * Enqueues lifecycle job, returns 202.
   */
  app.post<{ Params: ComputerParams }>(
    '/computers/:id/stop',
    {
      schema: computerParamsSchema,
      preHandler: [verifyComputerOwnership],
    },
    async (request, reply) => {
      const { id } = request.params;

      const [computer] = await db
        .select({
          id: computers.id,
          status: computers.status,
          containerId: computers.containerId,
        })
        .from(computers)
        .where(eq(computers.id, id))
        .limit(1);

      if (!computer) {
        return reply.status(404).send({
          error: 'not_found',
          message: 'Computer not found.',
        });
      }

      if (!validateTransition(computer.status as any, 'stopping')) {
        return reply.status(409).send({
          error: 'invalid_state',
          message: `Cannot stop a computer in "${computer.status}" state.`,
        });
      }

      // Transition to stopping
      await db
        .update(computers)
        .set({ status: 'stopping', updatedAt: new Date() })
        .where(eq(computers.id, id));

      await lifecycleQueue.add('stop', {
        computerId: id,
        action: 'stop' as const,
        containerId: computer.containerId,
      });

      return reply.status(202).send({ status: 'stopping' });
    },
  );

  /**
   * DELETE /computers/:id
   * Destroy a computer. Enqueues destroy lifecycle job, returns 202.
   */
  app.delete<{ Params: ComputerParams }>(
    '/computers/:id',
    {
      schema: computerParamsSchema,
      preHandler: [verifyComputerOwnership],
    },
    async (request, reply) => {
      const { id } = request.params;

      const [computer] = await db
        .select({
          id: computers.id,
          containerId: computers.containerId,
        })
        .from(computers)
        .where(eq(computers.id, id))
        .limit(1);

      if (!computer) {
        return reply.status(404).send({
          error: 'not_found',
          message: 'Computer not found.',
        });
      }

      await lifecycleQueue.add('destroy', {
        computerId: id,
        action: 'destroy' as const,
        containerId: computer.containerId,
      });

      return reply.status(202).send({ status: 'destroying' });
    },
  );
}
