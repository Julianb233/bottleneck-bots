/**
 * Browser Session Stream Service
 *
 * Provides enhanced SSE streaming for live browser state during agent execution.
 * Streams screenshots, current URL, page title, and actions being performed
 * at configurable intervals (targeting 1-2 fps for live preview).
 */

import { sendProgress, type ProgressUpdate } from '../_core/sse-manager';
import {
  emitBrowserScreenshot,
  emitBrowserNavigate,
  emitBrowserAction,
  emitBrowserSession,
  emitExecutionPaused,
  emitExecutionResumed,
} from '../_core/agent-sse-events';

// ========================================
// TYPES
// ========================================

export interface BrowserStreamState {
  sessionId: string;
  executionId: string;
  userId: number;
  debugUrl?: string;
  currentUrl?: string;
  pageTitle?: string;
  currentAction?: string;
  status: 'streaming' | 'paused' | 'stopped';
  startedAt: number;
  lastScreenshotAt?: number;
  screenshotIntervalMs: number;
  actionLog: ActionLogEntry[];
}

export interface ActionLogEntry {
  id: string;
  timestamp: string;
  action: string;
  description: string;
  selector?: string;
  value?: string;
  duration?: number;
}

export interface BrowserStreamOptions {
  sessionId: string;
  executionId: string;
  userId: number;
  debugUrl?: string;
  screenshotIntervalMs?: number; // Default 750ms (~1.3 fps)
}

// ========================================
// ACTIVE STREAMS REGISTRY
// ========================================

const activeStreams = new Map<string, BrowserStreamState>();
const streamIntervals = new Map<string, ReturnType<typeof setInterval>>();

// ========================================
// STREAM MANAGEMENT
// ========================================

/**
 * Start a browser session stream for live preview
 */
export function startBrowserStream(options: BrowserStreamOptions): BrowserStreamState {
  const {
    sessionId,
    executionId,
    userId,
    debugUrl,
    screenshotIntervalMs = 750,
  } = options;

  const streamKey = `${userId}-${executionId}`;

  // Stop existing stream if any
  stopBrowserStream(userId, executionId);

  const state: BrowserStreamState = {
    sessionId,
    executionId,
    userId,
    debugUrl,
    status: 'streaming',
    startedAt: Date.now(),
    screenshotIntervalMs,
    actionLog: [],
  };

  activeStreams.set(streamKey, state);

  // Emit initial browser session event
  emitBrowserSession(userId, executionId, {
    sessionId,
    debugUrl,
  });

  console.log(`[BrowserStream] Started stream for session ${sessionId}, execution ${executionId}`);

  return state;
}

/**
 * Stop a browser session stream
 */
export function stopBrowserStream(userId: number, executionId: string): void {
  const streamKey = `${userId}-${executionId}`;

  const interval = streamIntervals.get(streamKey);
  if (interval) {
    clearInterval(interval);
    streamIntervals.delete(streamKey);
  }

  const state = activeStreams.get(streamKey);
  if (state) {
    state.status = 'stopped';
    activeStreams.delete(streamKey);
    console.log(`[BrowserStream] Stopped stream for execution ${executionId}`);
  }
}

/**
 * Pause a browser session stream
 */
export function pauseBrowserStream(userId: number, executionId: string): boolean {
  const streamKey = `${userId}-${executionId}`;
  const state = activeStreams.get(streamKey);

  if (!state || state.status !== 'streaming') {
    return false;
  }

  state.status = 'paused';

  // Clear screenshot interval
  const interval = streamIntervals.get(streamKey);
  if (interval) {
    clearInterval(interval);
    streamIntervals.delete(streamKey);
  }

  // Emit paused event
  emitExecutionPaused(userId, executionId, { reason: 'User paused execution' });

  console.log(`[BrowserStream] Paused stream for execution ${executionId}`);
  return true;
}

/**
 * Resume a browser session stream
 */
export function resumeBrowserStream(userId: number, executionId: string): boolean {
  const streamKey = `${userId}-${executionId}`;
  const state = activeStreams.get(streamKey);

  if (!state || state.status !== 'paused') {
    return false;
  }

  state.status = 'streaming';

  // Emit resumed event
  emitExecutionResumed(userId, executionId, {});

  console.log(`[BrowserStream] Resumed stream for execution ${executionId}`);
  return true;
}

/**
 * Push a browser navigation event to the stream
 */
export function pushNavigationEvent(
  userId: number,
  executionId: string,
  url: string,
  pageTitle?: string
): void {
  const streamKey = `${userId}-${executionId}`;
  const state = activeStreams.get(streamKey);

  if (!state || state.status === 'stopped') return;

  state.currentUrl = url;
  state.pageTitle = pageTitle;

  // Add to action log
  const entry: ActionLogEntry = {
    id: `nav-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    action: 'navigate',
    description: `Navigated to ${pageTitle || url}`,
  };
  state.actionLog.push(entry);

  // Keep last 100 entries
  if (state.actionLog.length > 100) {
    state.actionLog = state.actionLog.slice(-100);
  }

  emitBrowserNavigate(userId, executionId, { url, pageTitle });
}

/**
 * Push a browser action event to the stream
 */
export function pushActionEvent(
  userId: number,
  executionId: string,
  action: string,
  description: string,
  selector?: string,
  value?: string
): void {
  const streamKey = `${userId}-${executionId}`;
  const state = activeStreams.get(streamKey);

  if (!state || state.status === 'stopped') return;

  state.currentAction = description;

  const entry: ActionLogEntry = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    action,
    description,
    selector,
    value,
  };
  state.actionLog.push(entry);

  if (state.actionLog.length > 100) {
    state.actionLog = state.actionLog.slice(-100);
  }

  emitBrowserAction(userId, executionId, { action, description, selector, value });
}

/**
 * Push a screenshot event to the stream
 */
export function pushScreenshotEvent(
  userId: number,
  executionId: string,
  screenshotBase64?: string,
  screenshotUrl?: string,
  pageTitle?: string,
  currentUrl?: string
): void {
  const streamKey = `${userId}-${executionId}`;
  const state = activeStreams.get(streamKey);

  if (!state || state.status === 'stopped') return;

  state.lastScreenshotAt = Date.now();
  if (pageTitle) state.pageTitle = pageTitle;
  if (currentUrl) state.currentUrl = currentUrl;

  emitBrowserScreenshot(userId, executionId, {
    screenshotBase64,
    screenshotUrl,
    pageTitle: pageTitle || state.pageTitle,
    currentUrl: currentUrl || state.currentUrl,
  });
}

/**
 * Get the current state of a browser stream
 */
export function getBrowserStreamState(userId: number, executionId: string): BrowserStreamState | null {
  const streamKey = `${userId}-${executionId}`;
  return activeStreams.get(streamKey) || null;
}

/**
 * Get all active browser streams for a user
 */
export function getUserActiveStreams(userId: number): BrowserStreamState[] {
  const streams: BrowserStreamState[] = [];
  activeStreams.forEach((state, key) => {
    if (key.startsWith(`${userId}-`)) {
      streams.push(state);
    }
  });
  return streams;
}

/**
 * Get the action log for a stream
 */
export function getStreamActionLog(userId: number, executionId: string): ActionLogEntry[] {
  const streamKey = `${userId}-${executionId}`;
  const state = activeStreams.get(streamKey);
  return state?.actionLog || [];
}

/**
 * Clean up all streams (for shutdown)
 */
export function cleanupAllStreams(): void {
  streamIntervals.forEach((interval) => clearInterval(interval));
  streamIntervals.clear();
  activeStreams.clear();
  console.log('[BrowserStream] All streams cleaned up');
}
