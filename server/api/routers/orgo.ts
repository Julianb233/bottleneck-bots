/**
 * Orgo tRPC Router
 *
 * Exposes Orgo desktop VM operations to the Bottleneck Bots frontend dashboard.
 *
 * Endpoints:
 *   orgo.configStatus    — check if Orgo is configured (API key present)
 *   orgo.listComputers   — list all computers in the workspace
 *   orgo.createComputer  — create a new desktop VM
 *   orgo.getComputer     — get computer status/details
 *   orgo.startComputer   — start a stopped computer
 *   orgo.stopComputer    — stop a running computer
 *   orgo.destroyComputer — permanently destroy a computer
 *   orgo.screenshot      — get a screenshot from a running computer
 *   orgo.executeAction   — run a desktop action (click, type, keyPress, etc.)
 *   orgo.healthCheck     — check Orgo API health
 *
 * All endpoints require authentication (protectedProcedure).
 */

import { z } from 'zod';
import { router, protectedProcedure } from '../../_core/trpc';
import { TRPCError } from '@trpc/server';
import { orgoClient, OrgoClientError } from '../../_core/orgoClient';

/**
 * Map OrgoClientError to appropriate TRPCError code
 */
function toTRPCError(err: unknown): TRPCError {
  if (err instanceof OrgoClientError) {
    let code: TRPCError['code'] = 'INTERNAL_SERVER_ERROR';
    if (err.statusCode === 401 || err.statusCode === 403) {
      code = 'UNAUTHORIZED';
    } else if (err.statusCode === 404) {
      code = 'NOT_FOUND';
    } else if (err.statusCode === 429) {
      code = 'TOO_MANY_REQUESTS';
    } else if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
      code = 'BAD_REQUEST';
    }
    return new TRPCError({ code, message: err.message });
  }
  return new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: err instanceof Error ? err.message : 'Unknown Orgo error',
  });
}

export const orgoRouter = router({
  /**
   * Check whether Orgo is configured (API key present and URL set).
   * Safe to call even when Orgo is not set up — never throws.
   */
  configStatus: protectedProcedure.query(() => {
    return orgoClient.getConfigurationStatus();
  }),

  /**
   * List all computers in the default workspace.
   */
  listComputers: protectedProcedure.query(async () => {
    try {
      return await orgoClient.listComputers();
    } catch (err) {
      throw toTRPCError(err);
    }
  }),

  /**
   * Create a new Orgo desktop VM.
   */
  createComputer: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(128),
        cpu: z.number().int().min(1).max(32).optional(),
        ramMb: z.number().int().min(512).optional(),
        diskGb: z.number().int().min(1).optional(),
        gpu: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        return await orgoClient.createComputer(input);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  /**
   * Get details and status for a specific computer.
   */
  getComputer: protectedProcedure
    .input(z.object({ computerId: z.string().min(1) }))
    .query(async ({ input }) => {
      try {
        return await orgoClient.getComputer(input.computerId);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  /**
   * Start a stopped computer.
   */
  startComputer: protectedProcedure
    .input(z.object({ computerId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      try {
        await orgoClient.startComputer(input.computerId);
        return { success: true, computerId: input.computerId };
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  /**
   * Stop a running computer (preserves disk state).
   */
  stopComputer: protectedProcedure
    .input(z.object({ computerId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      try {
        await orgoClient.stopComputer(input.computerId);
        return { success: true, computerId: input.computerId };
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  /**
   * Permanently destroy a computer and release all resources.
   */
  destroyComputer: protectedProcedure
    .input(z.object({ computerId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      try {
        await orgoClient.destroyComputer(input.computerId);
        return { success: true, computerId: input.computerId };
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  /**
   * Get a base64-encoded PNG screenshot from a running computer.
   */
  screenshot: protectedProcedure
    .input(z.object({ computerId: z.string().min(1) }))
    .query(async ({ input }) => {
      try {
        return await orgoClient.screenshot(input.computerId);
      } catch (err) {
        throw toTRPCError(err);
      }
    }),

  /**
   * Execute a desktop action on a running computer.
   *
   * Supported actions: click, doubleClick, type, keyPress, scroll, drag, exec, bash
   */
  executeAction: protectedProcedure
    .input(
      z.object({
        computerId: z.string().min(1),
        action: z.enum(['click', 'doubleClick', 'type', 'keyPress', 'scroll', 'drag', 'exec', 'bash']),
        params: z.record(z.string(), z.unknown()),
      })
    )
    .mutation(async ({ input }) => {
      const { computerId, action, params } = input;

      try {
        switch (action) {
          case 'click': {
            const p = params as { x: number; y: number; button?: 'left' | 'right' | 'middle' };
            await orgoClient.click(computerId, p.x, p.y, p.button);
            return { success: true, action };
          }

          case 'doubleClick': {
            const p = params as { x: number; y: number };
            await orgoClient.doubleClick(computerId, p.x, p.y);
            return { success: true, action };
          }

          case 'type': {
            const p = params as { text: string };
            await orgoClient.type(computerId, p.text);
            return { success: true, action };
          }

          case 'keyPress': {
            const p = params as { key: string; modifiers?: string[] };
            await orgoClient.keyPress(computerId, p.key, p.modifiers);
            return { success: true, action };
          }

          case 'scroll': {
            const p = params as { x: number; y: number; deltaX: number; deltaY: number };
            await orgoClient.scroll(computerId, p.x, p.y, p.deltaX, p.deltaY);
            return { success: true, action };
          }

          case 'drag': {
            const p = params as { startX: number; startY: number; endX: number; endY: number };
            await orgoClient.drag(computerId, p.startX, p.startY, p.endX, p.endY);
            return { success: true, action };
          }

          case 'exec': {
            const p = params as { command: string[] };
            const result = await orgoClient.exec(computerId, p.command);
            return { success: true, action, result };
          }

          case 'bash': {
            const p = params as { command: string };
            const result = await orgoClient.bash(computerId, p.command);
            return { success: true, action, result };
          }

          default: {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Unknown action: ${action}`,
            });
          }
        }
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw toTRPCError(err);
      }
    }),

  /**
   * Check Orgo API health and connectivity.
   */
  healthCheck: protectedProcedure.query(async () => {
    try {
      const result = await orgoClient.healthCheck();
      const config = orgoClient.getConfigurationStatus();
      return {
        ...result,
        config,
      };
    } catch (err) {
      return {
        status: 'error',
        healthy: false,
        config: orgoClient.getConfigurationStatus(),
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }),
});
