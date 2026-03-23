/**
 * Orgo Compute Provider Service
 *
 * Bridges Orgo desktop VMs into the agent system as an alternative compute
 * provider to BrowserBase. When ORGO_API_KEY is set and
 * COMPUTE_PROVIDER=orgo, this provider is used instead of BrowserBase.
 *
 * Session management maps the BrowserBase "session" concept to Orgo
 * "computer" lifecycle. Browser navigation is handled by launching
 * Chromium inside the desktop VM via shell commands.
 *
 * Env vars:
 *   COMPUTE_PROVIDER   — 'orgo' | 'browserbase' (default: 'browserbase')
 *   ORGO_API_KEY       — enables Orgo (required for provider to activate)
 *   ORGO_API_URL       — Orgo base URL (default: http://localhost:3100)
 *   ORGO_WORKSPACE_ID  — default workspace
 */

import { orgoClient, type Computer, type ChatResponse } from '../_core/orgoClient';

// ========================================
// TYPES
// ========================================

export type ComputeProviderType = 'orgo' | 'browserbase';

export interface SessionCreateOptions {
  userId?: number;
  executionId?: number;
  specs?: {
    cpu?: number;
    ramMb?: number;
    diskGb?: number;
    gpu?: boolean;
  };
}

export interface SessionInfo {
  sessionId: string;
  computerId: string;
  status: string;
  createdAt: Date;
}

export interface AgentLoopOptions {
  computerId: string;
  model: string;
  prompt: string;
  maxSteps?: number;
}

// ========================================
// SESSION REGISTRY
// Simple in-process map; for production use a distributed store
// ========================================

const sessionRegistry = new Map<string, SessionInfo>();

function generateSessionId(): string {
  return `orgo_sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ========================================
// PROVIDER CLASS
// ========================================

export class OrgoComputeProvider {
  private static instance: OrgoComputeProvider;

  private constructor() {}

  public static getInstance(): OrgoComputeProvider {
    if (!OrgoComputeProvider.instance) {
      OrgoComputeProvider.instance = new OrgoComputeProvider();
    }
    return OrgoComputeProvider.instance;
  }

  // ----------------------------------------
  // Session management
  // ----------------------------------------

  /**
   * Create a new compute session backed by an Orgo desktop VM.
   * The computer is created and started before returning.
   */
  public async createSession(opts: SessionCreateOptions = {}): Promise<{
    sessionId: string;
    computerId: string;
  }> {
    const name = `bb-agent-${opts.userId ?? 'anon'}-${opts.executionId ?? Date.now()}`;

    console.log('[OrgoComputeProvider] Creating session:', name);

    const computer = await orgoClient.createComputer({
      name,
      cpu: opts.specs?.cpu,
      ramMb: opts.specs?.ramMb,
      diskGb: opts.specs?.diskGb,
      gpu: opts.specs?.gpu,
    });

    // Start the computer if it's not already running
    if (computer.status !== 'running') {
      await orgoClient.startComputer(computer.id);
    }

    const sessionId = generateSessionId();
    const sessionInfo: SessionInfo = {
      sessionId,
      computerId: computer.id,
      status: 'running',
      createdAt: new Date(),
    };

    sessionRegistry.set(sessionId, sessionInfo);

    console.log('[OrgoComputeProvider] Session created:', sessionId, '-> computer:', computer.id);

    return { sessionId, computerId: computer.id };
  }

  /**
   * Destroy a session and its underlying Orgo computer.
   */
  public async destroySession(sessionId: string): Promise<void> {
    const session = sessionRegistry.get(sessionId);
    if (!session) {
      console.warn('[OrgoComputeProvider] destroySession: session not found:', sessionId);
      return;
    }

    try {
      await orgoClient.destroyComputer(session.computerId);
    } catch (err) {
      console.error('[OrgoComputeProvider] Failed to destroy computer:', session.computerId, err);
    }

    sessionRegistry.delete(sessionId);
    console.log('[OrgoComputeProvider] Session destroyed:', sessionId);
  }

  /**
   * Get the current status of a session.
   */
  public async getSessionStatus(sessionId: string): Promise<{
    status: string;
    computerId: string;
  }> {
    const session = sessionRegistry.get(sessionId);
    if (!session) {
      return { status: 'not_found', computerId: '' };
    }

    try {
      const computer = await orgoClient.getComputer(session.computerId);
      return { status: computer.status, computerId: computer.id };
    } catch {
      return { status: 'unknown', computerId: session.computerId };
    }
  }

  // ----------------------------------------
  // Browser-like actions (maps to Orgo desktop)
  // ----------------------------------------

  /**
   * Navigate to a URL by launching Chromium inside the desktop VM.
   * Uses --no-sandbox and kiosk mode to open the URL in a full-screen browser.
   */
  public async navigate(sessionId: string, url: string): Promise<void> {
    const session = this.requireSession(sessionId);

    console.log('[OrgoComputeProvider] Navigating to:', url);

    // Kill any existing browser instance and open URL in Chromium
    await orgoClient.bash(session.computerId, [
      'pkill -f chromium-browser 2>/dev/null || true',
      'pkill -f google-chrome 2>/dev/null || true',
      `DISPLAY=:0 chromium-browser --no-sandbox --disable-gpu --start-maximized "${url}" &`,
      'sleep 2',
    ].join(' && '));
  }

  /**
   * Get a base64-encoded PNG screenshot of the desktop.
   */
  public async screenshot(sessionId: string): Promise<string> {
    const session = this.requireSession(sessionId);
    const result = await orgoClient.screenshot(session.computerId);
    return result.data;
  }

  /**
   * Click at absolute desktop coordinates.
   */
  public async click(sessionId: string, x: number, y: number): Promise<void> {
    const session = this.requireSession(sessionId);
    await orgoClient.click(session.computerId, x, y, 'left');
  }

  /**
   * Type text into the currently focused element.
   */
  public async type(sessionId: string, text: string): Promise<void> {
    const session = this.requireSession(sessionId);
    await orgoClient.type(session.computerId, text);
  }

  // ----------------------------------------
  // Agent loop integration
  // ----------------------------------------

  /**
   * Run the Orgo computer-use agent loop via the OpenAI-compatible
   * /v1/chat/completions endpoint, which auto-executes tool calls
   * against the target computer.
   */
  public async runAgentLoop(opts: AgentLoopOptions): Promise<ChatResponse> {
    console.log('[OrgoComputeProvider] Running agent loop on computer:', opts.computerId);

    return orgoClient.chatCompletion({
      model: opts.model,
      messages: [
        {
          role: 'user',
          content: opts.prompt,
        },
      ],
      computerId: opts.computerId,
      autoExecuteTools: true,
    });
  }

  // ----------------------------------------
  // Internal helpers
  // ----------------------------------------

  private requireSession(sessionId: string): SessionInfo {
    const session = sessionRegistry.get(sessionId);
    if (!session) {
      throw new Error(`OrgoComputeProvider: session not found: ${sessionId}`);
    }
    return session;
  }
}

// ========================================
// FACTORY / PROVIDER SELECTION
// ========================================

/**
 * Determine which compute provider to use based on env config.
 * Returns 'orgo' when COMPUTE_PROVIDER=orgo AND ORGO_API_KEY is set.
 * Falls back to 'browserbase' in all other cases.
 */
export function getComputeProvider(): ComputeProviderType {
  const configured = process.env.COMPUTE_PROVIDER?.toLowerCase();
  if (configured === 'orgo' && process.env.ORGO_API_KEY) {
    return 'orgo';
  }
  return 'browserbase';
}

// Export singleton instance
export const orgoComputeProvider = OrgoComputeProvider.getInstance();
