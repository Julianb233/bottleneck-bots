/**
 * Orgo Computer State Machine
 *
 * Validates computer status transitions for the Orgo compute infrastructure.
 *
 * Valid transitions:
 *   creating  → running | error
 *   starting  → running | error
 *   running   → stopping | restarting | error
 *   stopping  → stopped | error
 *   stopped   → starting | creating | error
 *   restarting → running | error
 *   error     → creating | starting
 *
 * Linear: AI-5248
 */

import type { ComputerStatus } from "../../drizzle/schema-orgo";

const VALID_TRANSITIONS: Record<ComputerStatus, ComputerStatus[]> = {
  creating: ["running", "error"],
  starting: ["running", "error"],
  running: ["stopping", "restarting", "error"],
  stopping: ["stopped", "error"],
  stopped: ["starting", "creating", "error"],
  restarting: ["running", "error"],
  error: ["creating", "starting"],
};

/**
 * Check whether a status transition is allowed.
 */
export function validateTransition(
  current: ComputerStatus,
  target: ComputerStatus
): boolean {
  const allowed = VALID_TRANSITIONS[current];
  if (!allowed) return false;
  return allowed.includes(target);
}

/**
 * States from which a computer can be destroyed.
 * Transient states (creating, starting, stopping, restarting) must complete first.
 */
export const DESTROYABLE_STATES: ComputerStatus[] = ["running", "stopped", "error"];

/**
 * States considered "active" (container is running or transitioning).
 */
export const ACTIVE_STATES: ComputerStatus[] = [
  "creating",
  "starting",
  "running",
  "stopping",
  "restarting",
];
