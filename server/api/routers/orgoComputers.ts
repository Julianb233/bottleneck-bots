/**
 * Orgo Computers tRPC Router
 *
 * Computer provisioning with configurable specs, lifecycle management,
 * and state machine transitions. Recreates orgo-clone/packages/api/src/routes/computers.ts
 * as a tRPC router integrated into Bottleneck Bots.
 *
 * Endpoints:
 *   orgoComputers.createWorkspace   — Create a workspace
 *   orgoComputers.listWorkspaces    — List user's workspaces
 *   orgoComputers.deleteWorkspace   — Delete a workspace
 *   orgoComputers.create            — Provision a new computer with configurable specs
 *   orgoComputers.list              — List computers in a workspace
 *   orgoComputers.get               — Get computer details + VNC URLs
 *   orgoComputers.start             — Start a stopped computer
 *   orgoComputers.stop              — Stop a running computer
 *   orgoComputers.restart           — Restart a running computer
 *   orgoComputers.destroy           — Destroy a computer
 *   orgoComputers.updateAutoStop    — Update auto-stop idle minutes
 *
 * Linear: AI-5248
 */

import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../../db";
import { orgoWorkspaces, orgoComputers } from "../../../drizzle/schema-orgo";
import type { ComputerStatus } from "../../../drizzle/schema-orgo";
import { eq, and } from "drizzle-orm";
import {
  validateTransition,
  DESTROYABLE_STATES,
} from "../../lib/orgo-state-machine";

// ========================================
// Validation Schemas
// ========================================

const cpuOptions = z.enum(["2", "4", "8", "16"]).transform(Number);
const ramOptions = z.enum(["4096", "8192", "16384", "32768", "65536"]).transform(Number);
const gpuOptions = z.enum(["none", "a10", "l40s", "a100"]).optional();
const resolutionSchema = z
  .string()
  .regex(/^\d+x\d+x\d+$/, "Resolution must be WxHxD format (e.g. 1280x720x24)")
  .default("1280x720x24");

const createComputerSchema = z.object({
  workspaceId: z.number().int(),
  name: z.string().min(1).max(128),
  cpu: z.number().int().min(1).max(16).default(2),
  ramMb: z.number().int().min(1024).max(65536).default(4096),
  diskGb: z.number().int().min(1).max(500).default(10),
  gpu: z.string().optional(),
  resolution: resolutionSchema,
  template: z.string().optional(),
  autoStopMinutes: z.number().int().min(0).max(1440).default(15),
});

// ========================================
// Helpers
// ========================================

async function verifyWorkspaceOwnership(workspaceId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

  const [workspace] = await db
    .select({ id: orgoWorkspaces.id, userId: orgoWorkspaces.userId })
    .from(orgoWorkspaces)
    .where(eq(orgoWorkspaces.id, workspaceId))
    .limit(1);

  if (!workspace || workspace.userId !== userId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Workspace not found." });
  }

  return workspace;
}

async function verifyComputerOwnership(computerId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

  const [computer] = await db
    .select({
      id: orgoComputers.id,
      workspaceId: orgoComputers.workspaceId,
      status: orgoComputers.status,
      containerId: orgoComputers.containerId,
    })
    .from(orgoComputers)
    .where(eq(orgoComputers.id, computerId))
    .limit(1);

  if (!computer) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Computer not found." });
  }

  // Verify via workspace → user chain
  await verifyWorkspaceOwnership(computer.workspaceId, userId);

  return computer;
}

// ========================================
// Router
// ========================================

export const orgoComputersRouter = router({
  // ─── Workspace CRUD ─────────────────────────────────────────────────

  /**
   * Create a new workspace.
   */
  createWorkspace: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const [workspace] = await db
        .insert(orgoWorkspaces)
        .values({
          userId: ctx.user.id,
          name: input.name,
        })
        .returning();

      return { workspace };
    }),

  /**
   * List all workspaces for the authenticated user.
   */
  listWorkspaces: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

    const workspaces = await db
      .select()
      .from(orgoWorkspaces)
      .where(eq(orgoWorkspaces.userId, ctx.user.id));

    return { workspaces };
  }),

  /**
   * Delete a workspace (cascades to all computers).
   */
  deleteWorkspace: protectedProcedure
    .input(z.object({ workspaceId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await verifyWorkspaceOwnership(input.workspaceId, ctx.user.id);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      await db
        .delete(orgoWorkspaces)
        .where(eq(orgoWorkspaces.id, input.workspaceId));

      return { success: true };
    }),

  // ─── Computer Provisioning ──────────────────────────────────────────

  /**
   * Create a new computer with configurable specs.
   *
   * Specs: CPU (2/4/8/16), RAM (4/8/16/32/64 GB), GPU (none/a10/l40s/a100)
   * Resolution: WxHxD (default 1280x720x24)
   * Auto-stop: configurable idle minutes (default 15, 0 = disabled)
   *
   * The computer is created with status "creating". In production, a background
   * worker would pick this up and provision the Docker container. For now, we
   * immediately transition to "stopped" (ready to start).
   */
  create: protectedProcedure
    .input(createComputerSchema)
    .mutation(async ({ ctx, input }) => {
      await verifyWorkspaceOwnership(input.workspaceId, ctx.user.id);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const specs = {
        cpu: input.cpu,
        ramMb: input.ramMb,
        diskGb: input.diskGb,
        gpu: input.gpu,
      };

      const [computer] = await db
        .insert(orgoComputers)
        .values({
          workspaceId: input.workspaceId,
          name: input.name,
          status: "creating",
          specs,
          resolution: input.resolution,
          autoStopMinutes: input.autoStopMinutes,
        })
        .returning({
          id: orgoComputers.id,
          name: orgoComputers.name,
          status: orgoComputers.status,
          specs: orgoComputers.specs,
          resolution: orgoComputers.resolution,
          autoStopMinutes: orgoComputers.autoStopMinutes,
          createdAt: orgoComputers.createdAt,
        });

      // TODO: In production, enqueue a BullMQ lifecycle job here:
      //   lifecycleQueue.add('create', { computerId: computer.id, spec: { ...specs, image: input.template, resolution: input.resolution } })
      // For now, immediately transition to "stopped" (simulating container creation)
      await db
        .update(orgoComputers)
        .set({ status: "stopped", updatedAt: new Date() })
        .where(eq(orgoComputers.id, computer.id));

      return {
        computer: {
          ...computer,
          status: "stopped" as const,
        },
      };
    }),

  /**
   * List computers in a workspace. Optional status filter.
   */
  list: protectedProcedure
    .input(
      z.object({
        workspaceId: z.number().int(),
        status: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await verifyWorkspaceOwnership(input.workspaceId, ctx.user.id);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const result = await db
        .select({
          id: orgoComputers.id,
          name: orgoComputers.name,
          status: orgoComputers.status,
          specs: orgoComputers.specs,
          resolution: orgoComputers.resolution,
          ipAddress: orgoComputers.ipAddress,
          vncPort: orgoComputers.vncPort,
          novncPort: orgoComputers.novncPort,
          autoStopMinutes: orgoComputers.autoStopMinutes,
          lastActivityAt: orgoComputers.lastActivityAt,
          createdAt: orgoComputers.createdAt,
          updatedAt: orgoComputers.updatedAt,
        })
        .from(orgoComputers)
        .where(eq(orgoComputers.workspaceId, input.workspaceId));

      const filtered = input.status
        ? result.filter((c) => c.status === input.status)
        : result;

      return { computers: filtered };
    }),

  /**
   * Get computer details with VNC/noVNC URLs when running.
   */
  get: protectedProcedure
    .input(z.object({ computerId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      const [computer] = await db
        .select()
        .from(orgoComputers)
        .where(eq(orgoComputers.id, input.computerId))
        .limit(1);

      if (!computer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Computer not found." });
      }

      // Verify ownership via workspace chain
      await verifyWorkspaceOwnership(computer.workspaceId, ctx.user.id);

      const response: Record<string, unknown> = { ...computer };

      // Include connection URLs only when running
      if (computer.status === "running" && computer.novncPort) {
        response.novncUrl = `http://localhost:${computer.novncPort}/vnc.html`;
        response.vncUrl = `vnc://localhost:${computer.vncPort}`;
      }

      return { computer: response };
    }),

  // ─── Lifecycle Operations ───────────────────────────────────────────

  /**
   * Start a stopped computer. Only valid from "stopped" state.
   */
  start: protectedProcedure
    .input(z.object({ computerId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const computer = await verifyComputerOwnership(input.computerId, ctx.user.id);

      const currentStatus = computer.status as ComputerStatus;
      if (!validateTransition(currentStatus, "starting")) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Cannot start a computer in "${currentStatus}" state.`,
        });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      await db
        .update(orgoComputers)
        .set({ status: "starting", updatedAt: new Date() })
        .where(eq(orgoComputers.id, input.computerId));

      // TODO: Enqueue BullMQ start job
      // For now, immediately transition to running (simulating container start)
      await db
        .update(orgoComputers)
        .set({ status: "running", lastActivityAt: new Date(), updatedAt: new Date() })
        .where(eq(orgoComputers.id, input.computerId));

      return { computerId: input.computerId, status: "running" as const };
    }),

  /**
   * Stop a running computer. Only valid from "running" state.
   */
  stop: protectedProcedure
    .input(z.object({ computerId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const computer = await verifyComputerOwnership(input.computerId, ctx.user.id);

      const currentStatus = computer.status as ComputerStatus;
      if (!validateTransition(currentStatus, "stopping")) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Cannot stop a computer in "${currentStatus}" state.`,
        });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      await db
        .update(orgoComputers)
        .set({ status: "stopping", updatedAt: new Date() })
        .where(eq(orgoComputers.id, input.computerId));

      // TODO: Enqueue BullMQ stop job
      // For now, immediately transition to stopped
      await db
        .update(orgoComputers)
        .set({ status: "stopped", stoppedAt: new Date(), updatedAt: new Date() })
        .where(eq(orgoComputers.id, input.computerId));

      return { computerId: input.computerId, status: "stopped" as const };
    }),

  /**
   * Restart a running computer. Only valid from "running" state.
   */
  restart: protectedProcedure
    .input(z.object({ computerId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const computer = await verifyComputerOwnership(input.computerId, ctx.user.id);

      const currentStatus = computer.status as ComputerStatus;
      if (!validateTransition(currentStatus, "restarting")) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Cannot restart a computer in "${currentStatus}" state.`,
        });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      await db
        .update(orgoComputers)
        .set({ status: "restarting", updatedAt: new Date() })
        .where(eq(orgoComputers.id, input.computerId));

      // TODO: Enqueue BullMQ restart job
      // For now, immediately transition to running
      await db
        .update(orgoComputers)
        .set({ status: "running", lastActivityAt: new Date(), updatedAt: new Date() })
        .where(eq(orgoComputers.id, input.computerId));

      return { computerId: input.computerId, status: "running" as const };
    }),

  /**
   * Destroy a computer. Valid from stopped, running, or error states.
   * Cannot destroy during transient states (creating, starting, stopping, restarting).
   */
  destroy: protectedProcedure
    .input(z.object({ computerId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const computer = await verifyComputerOwnership(input.computerId, ctx.user.id);

      const currentStatus = computer.status as ComputerStatus;
      if (!DESTROYABLE_STATES.includes(currentStatus)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Cannot destroy a computer in "${currentStatus}" state. Wait until it reaches a stable state.`,
        });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      // TODO: Enqueue BullMQ destroy job (force-remove container, then delete DB record)
      // For now, hard-delete from database
      await db
        .delete(orgoComputers)
        .where(eq(orgoComputers.id, input.computerId));

      return { success: true, computerId: input.computerId };
    }),

  /**
   * Update auto-stop configuration for a computer.
   * Set to 0 to disable auto-stop.
   */
  updateAutoStop: protectedProcedure
    .input(
      z.object({
        computerId: z.number().int(),
        autoStopMinutes: z.number().int().min(0).max(1440),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyComputerOwnership(input.computerId, ctx.user.id);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

      await db
        .update(orgoComputers)
        .set({
          autoStopMinutes: input.autoStopMinutes,
          updatedAt: new Date(),
        })
        .where(eq(orgoComputers.id, input.computerId));

      return { success: true, autoStopMinutes: input.autoStopMinutes };
    }),
});
