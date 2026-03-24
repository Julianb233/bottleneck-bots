import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { computers } from '../db/schema.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ComputerStatus =
  | 'creating'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'error';

// ---------------------------------------------------------------------------
// Valid transitions map
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<ComputerStatus, ComputerStatus[]> = {
  creating: ['running', 'error'],
  starting: ['running', 'error'],
  running: ['stopping', 'error'],
  stopping: ['stopped', 'error'],
  stopped: ['starting', 'creating', 'error'],
  error: ['creating', 'starting'],
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether a status transition is allowed.
 */
export function validateTransition(
  current: ComputerStatus,
  target: ComputerStatus,
): boolean {
  const allowed = VALID_TRANSITIONS[current];
  if (!allowed) return false;
  return allowed.includes(target);
}

/**
 * Atomically transition a computer to a new status.
 *
 * Validates the transition against the current DB state, then updates.
 * Returns true if the transition succeeded, false if it was invalid or
 * the computer does not exist.
 */
export async function transition(
  computerId: string,
  targetStatus: ComputerStatus,
): Promise<boolean> {
  const [computer] = await db
    .select({ status: computers.status })
    .from(computers)
    .where(eq(computers.id, computerId))
    .limit(1);

  if (!computer) return false;

  const current = computer.status as ComputerStatus;
  if (!validateTransition(current, targetStatus)) return false;

  const updates: Record<string, unknown> = {
    status: targetStatus,
    updatedAt: new Date(),
  };

  if (targetStatus === 'stopped') {
    updates.stoppedAt = new Date();
  }

  if (targetStatus === 'running') {
    updates.lastActivityAt = new Date();
  }

  await db
    .update(computers)
    .set(updates)
    .where(eq(computers.id, computerId));

  return true;
}
