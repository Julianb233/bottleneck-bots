/**
 * Orgo Desktop Actions tRPC Router
 *
 * Desktop keyboard actions — type text, key combos, modifiers.
 * Also includes mouse actions, clipboard, screenshot, and bash/exec for completeness.
 * All actions are proxied to the container's action daemon via Docker exec.
 *
 * Keyboard endpoints:
 *   orgoActions.type          — Type arbitrary text
 *   orgoActions.key           — Press a key or key combo (ctrl+c, shift+alt+f1, etc.)
 *
 * Mouse endpoints:
 *   orgoActions.click         — Left click at (x, y)
 *   orgoActions.rightClick    — Right click at (x, y)
 *   orgoActions.doubleClick   — Double click at (x, y)
 *   orgoActions.scroll        — Scroll in a direction
 *   orgoActions.drag          — Drag from (x1,y1) to (x2,y2)
 *   orgoActions.move          — Move cursor to (x, y)
 *
 * Other:
 *   orgoActions.screenshot    — Capture desktop screenshot
 *   orgoActions.clipboardRead — Read clipboard contents
 *   orgoActions.clipboardWrite — Write to clipboard
 *   orgoActions.bash          — Execute bash command
 *   orgoActions.exec          — Execute code (python/node/bash)
 *   orgoActions.batch         — Execute multiple actions in sequence
 *
 * Linear: AI-5252
 */

import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../../db";
import { orgoComputers, orgoWorkspaces } from "../../../drizzle/schema-orgo";
import { eq } from "drizzle-orm";

// ========================================
// Key Validation
// ========================================

const VALID_MODIFIER_KEYS = ["ctrl", "alt", "shift", "super", "meta", "cmd"];
const VALID_SPECIAL_KEYS = [
  "enter", "return", "tab", "escape", "esc", "backspace", "delete", "del",
  "space", "up", "down", "left", "right", "home", "end", "pageup", "pagedown",
  "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10", "f11", "f12",
  "insert", "pause", "capslock", "numlock", "scrolllock", "printscreen",
];
const ALL_VALID_KEYS = [...VALID_MODIFIER_KEYS, ...VALID_SPECIAL_KEYS];

/**
 * Validate a key combo string.
 * Accepts: "ctrl+c", "shift+alt+f1", "a", "enter", "Return", "Tab", "super+l".
 */
function validateKeyCombo(key: string): boolean {
  if (!key || key.length > 100) return false;
  if (key.includes("\0")) return false;

  const parts = key.toLowerCase().split("+");
  if (parts.length === 0) return false;

  const mainKey = parts[parts.length - 1]!;
  const modifiers = parts.slice(0, -1);

  for (const mod of modifiers) {
    if (!VALID_MODIFIER_KEYS.includes(mod)) return false;
  }

  if (ALL_VALID_KEYS.includes(mainKey)) return true;
  if (mainKey.length === 1 && /^[a-z0-9]$/.test(mainKey)) return true;

  return false;
}

/**
 * Check if text contains null bytes (security).
 */
function containsNullBytes(text: string): boolean {
  return text.includes("\0");
}

// ========================================
// Action Result Type
// ========================================

interface ActionResult {
  success: boolean;
  action: string;
  duration_ms: number;
  data?: Record<string, unknown>;
  error?: string;
}

// ========================================
// Action Proxy
// ========================================

/**
 * Send an action to the container's action daemon.
 *
 * In production, this communicates with the container's /tmp/orgo-action.sock
 * via Docker exec. For now, this is a simulation layer that validates inputs
 * and returns mock results. The Docker exec integration will be wired in when
 * the container runtime is deployed.
 */
async function sendAction(
  computerId: number,
  action: string,
  params: Record<string, unknown> = {},
): Promise<ActionResult> {
  const start = Date.now();

  const db = await getDb();
  if (!db) {
    return {
      success: false,
      action,
      error: "Database not available",
      duration_ms: Date.now() - start,
    };
  }

  // Verify computer exists and is running
  const [computer] = await db
    .select({
      id: orgoComputers.id,
      status: orgoComputers.status,
      containerId: orgoComputers.containerId,
    })
    .from(orgoComputers)
    .where(eq(orgoComputers.id, computerId))
    .limit(1);

  if (!computer) {
    return {
      success: false,
      action,
      error: "Computer not found.",
      duration_ms: Date.now() - start,
    };
  }

  if (computer.status !== "running") {
    return {
      success: false,
      action,
      error: `Computer is not running (current status: ${computer.status}).`,
      duration_ms: Date.now() - start,
    };
  }

  // TODO: Wire up Docker exec when container runtime is deployed.
  // For now, return a success simulation with the action params echoed back.
  // Production code would use:
  //   const container = docker.getContainer(computer.containerId);
  //   const cmd = ['node', '-e', `...socket communication...`];
  //   const exec = await container.exec({ Cmd: cmd, AttachStdout: true, ... });

  // Update last activity
  await db
    .update(orgoComputers)
    .set({ lastActivityAt: new Date() })
    .where(eq(orgoComputers.id, computerId));

  return {
    success: true,
    action,
    duration_ms: Date.now() - start,
    data: { action, params, simulated: true },
  };
}

// ========================================
// Ownership Verification
// ========================================

async function verifyComputerAccess(computerId: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

  const [computer] = await db
    .select({
      id: orgoComputers.id,
      workspaceId: orgoComputers.workspaceId,
    })
    .from(orgoComputers)
    .where(eq(orgoComputers.id, computerId))
    .limit(1);

  if (!computer) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Computer not found." });
  }

  const [workspace] = await db
    .select({ userId: orgoWorkspaces.userId })
    .from(orgoWorkspaces)
    .where(eq(orgoWorkspaces.id, computer.workspaceId))
    .limit(1);

  if (!workspace || workspace.userId !== userId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Computer not found." });
  }
}

// ========================================
// Schemas
// ========================================

const computerIdSchema = z.object({ computerId: z.number().int() });

const coordinateSchema = z.object({
  computerId: z.number().int(),
  x: z.number().min(0).max(32767),
  y: z.number().min(0).max(32767),
});

// ========================================
// Router
// ========================================

export const orgoActionsRouter = router({
  // ─── Keyboard Actions ─────────────────────────────────────────────────

  /**
   * Type arbitrary text into the active window.
   * Uses xdotool type inside the container.
   * Text must not contain null bytes.
   */
  type: protectedProcedure
    .input(
      z.object({
        computerId: z.number().int(),
        text: z.string().min(1).max(10000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyComputerAccess(input.computerId, ctx.user.id);

      if (containsNullBytes(input.text)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Text must not contain null bytes.",
        });
      }

      return sendAction(input.computerId, "type", { text: input.text });
    }),

  /**
   * Press a key or key combo.
   *
   * Supported formats:
   * - Single keys: "a", "1", "enter", "tab", "escape", "f1"-"f12"
   * - Key combos: "ctrl+c", "ctrl+shift+t", "alt+f4", "super+l"
   * - Modifiers: ctrl, alt, shift, super, meta, cmd
   * - Special keys: enter, return, tab, escape, backspace, delete,
   *   space, up, down, left, right, home, end, pageup, pagedown,
   *   f1-f12, insert, pause, capslock, numlock, scrolllock, printscreen
   */
  key: protectedProcedure
    .input(
      z.object({
        computerId: z.number().int(),
        key: z.string().min(1).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyComputerAccess(input.computerId, ctx.user.id);

      if (!validateKeyCombo(input.key)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid key combo "${input.key}". Use format like "ctrl+c", "shift+alt+f1", or single chars.`,
        });
      }

      return sendAction(input.computerId, "key", { key: input.key });
    }),

  // ─── Mouse Actions ────────────────────────────────────────────────────

  /**
   * Left click at (x, y).
   */
  click: protectedProcedure
    .input(coordinateSchema)
    .mutation(async ({ ctx, input }) => {
      await verifyComputerAccess(input.computerId, ctx.user.id);
      return sendAction(input.computerId, "click", { x: input.x, y: input.y });
    }),

  /**
   * Right click at (x, y).
   */
  rightClick: protectedProcedure
    .input(coordinateSchema)
    .mutation(async ({ ctx, input }) => {
      await verifyComputerAccess(input.computerId, ctx.user.id);
      return sendAction(input.computerId, "right_click", { x: input.x, y: input.y });
    }),

  /**
   * Double click at (x, y).
   */
  doubleClick: protectedProcedure
    .input(coordinateSchema)
    .mutation(async ({ ctx, input }) => {
      await verifyComputerAccess(input.computerId, ctx.user.id);
      return sendAction(input.computerId, "double_click", { x: input.x, y: input.y });
    }),

  /**
   * Scroll at position.
   */
  scroll: protectedProcedure
    .input(
      z.object({
        computerId: z.number().int(),
        x: z.number().min(0).max(32767).optional(),
        y: z.number().min(0).max(32767).optional(),
        direction: z.enum(["up", "down", "left", "right"]).default("down"),
        amount: z.number().int().min(1).max(50).default(3),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyComputerAccess(input.computerId, ctx.user.id);
      return sendAction(input.computerId, "scroll", {
        x: input.x,
        y: input.y,
        direction: input.direction,
        amount: input.amount,
      });
    }),

  /**
   * Drag from (start_x, start_y) to (end_x, end_y).
   */
  drag: protectedProcedure
    .input(
      z.object({
        computerId: z.number().int(),
        startX: z.number().min(0).max(32767),
        startY: z.number().min(0).max(32767),
        endX: z.number().min(0).max(32767),
        endY: z.number().min(0).max(32767),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyComputerAccess(input.computerId, ctx.user.id);
      return sendAction(input.computerId, "drag", {
        start_x: input.startX,
        start_y: input.startY,
        end_x: input.endX,
        end_y: input.endY,
      });
    }),

  /**
   * Move cursor to (x, y) without clicking.
   */
  move: protectedProcedure
    .input(coordinateSchema)
    .mutation(async ({ ctx, input }) => {
      await verifyComputerAccess(input.computerId, ctx.user.id);
      return sendAction(input.computerId, "move", { x: input.x, y: input.y });
    }),

  // ─── Screenshot ───────────────────────────────────────────────────────

  /**
   * Capture a desktop screenshot.
   * Returns base64-encoded PNG/JPEG.
   */
  screenshot: protectedProcedure
    .input(
      z.object({
        computerId: z.number().int(),
        format: z.enum(["png", "jpeg"]).default("png"),
        quality: z.number().int().min(1).max(100).default(70),
      })
    )
    .query(async ({ ctx, input }) => {
      await verifyComputerAccess(input.computerId, ctx.user.id);
      return sendAction(input.computerId, "screenshot", {
        format: input.format,
        quality: input.quality,
      });
    }),

  // ─── Clipboard ────────────────────────────────────────────────────────

  /**
   * Read clipboard contents.
   */
  clipboardRead: protectedProcedure
    .input(computerIdSchema)
    .query(async ({ ctx, input }) => {
      await verifyComputerAccess(input.computerId, ctx.user.id);
      return sendAction(input.computerId, "clipboard_read", {});
    }),

  /**
   * Write text to clipboard.
   */
  clipboardWrite: protectedProcedure
    .input(
      z.object({
        computerId: z.number().int(),
        text: z.string().max(1048576), // 1MB max
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyComputerAccess(input.computerId, ctx.user.id);

      if (containsNullBytes(input.text)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Text must not contain null bytes.",
        });
      }

      return sendAction(input.computerId, "clipboard_write", { text: input.text });
    }),

  // ─── Execution ────────────────────────────────────────────────────────

  /**
   * Execute a bash command in the container.
   */
  bash: protectedProcedure
    .input(
      z.object({
        computerId: z.number().int(),
        command: z.string().min(1),
        timeout: z.number().int().min(1).max(300).default(30),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyComputerAccess(input.computerId, ctx.user.id);

      if (containsNullBytes(input.command)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Command must not contain null bytes.",
        });
      }

      return sendAction(input.computerId, "bash", {
        command: input.command,
        timeout: input.timeout,
      });
    }),

  /**
   * Execute code in a specific language (python, node, bash).
   */
  exec: protectedProcedure
    .input(
      z.object({
        computerId: z.number().int(),
        code: z.string().min(1),
        language: z
          .enum(["python", "python3", "node", "javascript", "bash", "shell"])
          .default("bash"),
        timeout: z.number().int().min(1).max(300).default(30),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyComputerAccess(input.computerId, ctx.user.id);

      if (containsNullBytes(input.code)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Code must not contain null bytes.",
        });
      }

      return sendAction(input.computerId, "exec", {
        code: input.code,
        language: input.language,
        timeout: input.timeout,
      });
    }),

  // ─── Batch Actions ────────────────────────────────────────────────────

  /**
   * Execute multiple actions in sequence on a computer.
   * Optionally continue on error.
   */
  batch: protectedProcedure
    .input(
      z.object({
        computerId: z.number().int(),
        actions: z
          .array(
            z.object({
              action: z.enum([
                "click", "right_click", "double_click", "scroll", "drag", "move",
                "type", "key", "clipboard_read", "clipboard_write",
                "bash", "exec", "screenshot",
              ]),
              params: z.record(z.string(), z.unknown()).default({}),
            })
          )
          .min(1)
          .max(50),
        continueOnError: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await verifyComputerAccess(input.computerId, ctx.user.id);

      const startTime = Date.now();
      const results: ActionResult[] = [];

      for (const { action, params } of input.actions) {
        const result = await sendAction(input.computerId, action, params);
        results.push(result);
        if (!result.success && !input.continueOnError) break;
      }

      const allSucceeded = results.every((r) => r.success);

      return {
        success: allSucceeded,
        duration_ms: Date.now() - startTime,
        results,
        completed: results.length,
        total: input.actions.length,
      };
    }),
});
