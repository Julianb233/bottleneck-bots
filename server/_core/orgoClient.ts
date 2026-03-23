/**
 * Orgo Clone API Client
 * HTTP client for the Orgo desktop VM infrastructure
 *
 * Orgo provides Docker-based desktop VMs (Xvfb + Fluxbox + VNC) with:
 * - Desktop actions: screenshot, click, type, key, scroll, drag, exec, bash
 * - OpenAI-compatible /v1/chat/completions with computer-use tool loops
 * - Multi-model support: Claude, GPT, Gemini
 *
 * Configuration via env vars:
 *   ORGO_API_URL       — base URL (default: http://localhost:3100)
 *   ORGO_API_KEY       — API key (sk_live_...)
 *   ORGO_WORKSPACE_ID  — default workspace ID
 *
 * Includes:
 * - Retry logic with exponential backoff
 * - Circuit breaker pattern for service protection
 * - Comprehensive error handling
 */

import { withRetry, DEFAULT_RETRY_OPTIONS } from '../lib/retry';
import { circuitBreakers } from '../lib/circuitBreaker';

// ========================================
// TYPES
// ========================================

export interface Computer {
  id: string;
  name: string;
  status: 'creating' | 'running' | 'stopped' | 'error';
  workspaceId?: string;
  cpu?: number;
  ramMb?: number;
  diskGb?: number;
  gpu?: boolean;
  createdAt: string;
  updatedAt?: string;
  vncUrl?: string;
  wsUrl?: string;
}

export interface ComputerCreateOptions {
  name: string;
  cpu?: number;
  ramMb?: number;
  diskGb?: number;
  gpu?: boolean;
  workspaceId?: string;
}

export interface ScreenshotResponse {
  data: string;   // base64 PNG
  width: number;
  height: number;
}

export interface ExecResponse {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: string; [key: string]: unknown }>;
}

export interface ChatCompletionOptions {
  model: string;
  messages: ChatMessage[];
  computerId?: string;
  autoExecuteTools?: boolean;
  maxTokens?: number;
  temperature?: number;
}

export interface ChatResponse {
  id: string;
  object: string;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ========================================
// ERROR
// ========================================

export class OrgoClientError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'OrgoClientError';
  }
}

// ========================================
// CLIENT
// ========================================

class OrgoClient {
  private static instance: OrgoClient;
  private readonly apiUrl: string;
  private readonly apiKey: string | null;
  private readonly workspaceId: string | null;

  private constructor() {
    this.apiUrl = process.env.ORGO_API_URL || 'http://localhost:3100';
    this.apiKey = process.env.ORGO_API_KEY || null;
    this.workspaceId = process.env.ORGO_WORKSPACE_ID || null;

    if (!this.apiKey) {
      console.warn(
        '[OrgoClient] ORGO_API_KEY not found in environment variables. Orgo client will not be operational.'
      );
    } else {
      console.log('[OrgoClient] Successfully initialized with URL:', this.apiUrl);
    }
  }

  public static getInstance(): OrgoClient {
    if (!OrgoClient.instance) {
      OrgoClient.instance = new OrgoClient();
    }
    return OrgoClient.instance;
  }

  // ----------------------------------------
  // Internal helpers
  // ----------------------------------------

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.apiUrl}${path}`;

    return circuitBreakers.orgo.execute(async () => {
      return withRetry(async () => {
        let response: Response;
        try {
          response = await fetch(url, {
            method,
            headers: this.getHeaders(),
            body: body !== undefined ? JSON.stringify(body) : undefined,
          });
        } catch (err) {
          throw new OrgoClientError(
            `Network error reaching Orgo at ${url}: ${err instanceof Error ? err.message : 'Unknown error'}`,
            'NETWORK_ERROR',
            undefined,
            err
          );
        }

        if (!response.ok) {
          let errorBody = '';
          try {
            errorBody = await response.text();
          } catch {
            // ignore
          }
          throw new OrgoClientError(
            `Orgo API error ${response.status} ${response.statusText}${errorBody ? ': ' + errorBody : ''}`,
            'API_ERROR',
            response.status
          );
        }

        // 204 No Content
        if (response.status === 204) {
          return undefined as unknown as T;
        }

        try {
          return (await response.json()) as T;
        } catch (err) {
          throw new OrgoClientError(
            'Failed to parse Orgo API response as JSON',
            'PARSE_ERROR',
            response.status,
            err
          );
        }
      }, {
        ...DEFAULT_RETRY_OPTIONS,
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
      });
    });
  }

  // ----------------------------------------
  // Computer lifecycle
  // ----------------------------------------

  public async createComputer(opts: ComputerCreateOptions): Promise<Computer> {
    const body: Record<string, unknown> = { name: opts.name };
    if (opts.cpu !== undefined) body.cpu = opts.cpu;
    if (opts.ramMb !== undefined) body.ramMb = opts.ramMb;
    if (opts.diskGb !== undefined) body.diskGb = opts.diskGb;
    if (opts.gpu !== undefined) body.gpu = opts.gpu;
    if (opts.workspaceId || this.workspaceId) {
      body.workspaceId = opts.workspaceId || this.workspaceId;
    }

    console.log('[OrgoClient] Creating computer:', opts.name);
    const result = await this.request<Computer>('POST', '/api/v1/computers', body);
    console.log('[OrgoClient] Computer created:', result.id);
    return result;
  }

  public async getComputer(id: string): Promise<Computer> {
    return this.request<Computer>('GET', `/api/v1/computers/${id}`);
  }

  public async listComputers(): Promise<Computer[]> {
    const result = await this.request<Computer[] | { computers: Computer[] }>('GET', '/api/v1/computers');
    // Handle both array and wrapped responses
    if (Array.isArray(result)) return result;
    return (result as { computers: Computer[] }).computers || [];
  }

  public async startComputer(id: string): Promise<void> {
    console.log('[OrgoClient] Starting computer:', id);
    await this.request<void>('POST', `/api/v1/computers/${id}/start`);
  }

  public async stopComputer(id: string): Promise<void> {
    console.log('[OrgoClient] Stopping computer:', id);
    await this.request<void>('POST', `/api/v1/computers/${id}/stop`);
  }

  public async destroyComputer(id: string): Promise<void> {
    console.log('[OrgoClient] Destroying computer:', id);
    await this.request<void>('DELETE', `/api/v1/computers/${id}`);
  }

  // ----------------------------------------
  // Desktop actions
  // ----------------------------------------

  public async screenshot(computerId: string): Promise<ScreenshotResponse> {
    return this.request<ScreenshotResponse>('GET', `/api/v1/computers/${computerId}/screenshot`);
  }

  public async click(
    computerId: string,
    x: number,
    y: number,
    button: 'left' | 'right' | 'middle' = 'left'
  ): Promise<void> {
    await this.request<void>('POST', `/api/v1/computers/${computerId}/click`, { x, y, button });
  }

  public async doubleClick(computerId: string, x: number, y: number): Promise<void> {
    await this.request<void>('POST', `/api/v1/computers/${computerId}/click`, {
      x,
      y,
      button: 'left',
      double: true,
    });
  }

  public async type(computerId: string, text: string): Promise<void> {
    await this.request<void>('POST', `/api/v1/computers/${computerId}/type`, { text });
  }

  public async keyPress(
    computerId: string,
    key: string,
    modifiers?: string[]
  ): Promise<void> {
    await this.request<void>('POST', `/api/v1/computers/${computerId}/key`, {
      key,
      modifiers: modifiers || [],
    });
  }

  public async scroll(
    computerId: string,
    x: number,
    y: number,
    deltaX: number,
    deltaY: number
  ): Promise<void> {
    await this.request<void>('POST', `/api/v1/computers/${computerId}/scroll`, {
      x,
      y,
      deltaX,
      deltaY,
    });
  }

  public async drag(
    computerId: string,
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ): Promise<void> {
    await this.request<void>('POST', `/api/v1/computers/${computerId}/drag`, {
      startX,
      startY,
      endX,
      endY,
    });
  }

  public async exec(computerId: string, command: string[]): Promise<ExecResponse> {
    return this.request<ExecResponse>('POST', `/api/v1/computers/${computerId}/exec`, {
      command,
    });
  }

  public async bash(computerId: string, command: string): Promise<ExecResponse> {
    return this.request<ExecResponse>('POST', `/api/v1/computers/${computerId}/bash`, {
      command,
    });
  }

  // ----------------------------------------
  // Chat completions proxy (computer-use agent loop)
  // ----------------------------------------

  public async chatCompletion(opts: ChatCompletionOptions): Promise<ChatResponse> {
    const body: Record<string, unknown> = {
      model: opts.model,
      messages: opts.messages,
    };

    if (opts.computerId) body.computer_id = opts.computerId;
    if (opts.autoExecuteTools !== undefined) body.auto_execute_tools = opts.autoExecuteTools;
    if (opts.maxTokens !== undefined) body.max_tokens = opts.maxTokens;
    if (opts.temperature !== undefined) body.temperature = opts.temperature;

    return this.request<ChatResponse>('POST', '/v1/chat/completions', body);
  }

  // ----------------------------------------
  // Health
  // ----------------------------------------

  public async healthCheck(): Promise<{ status: string; healthy: boolean }> {
    try {
      const result = await this.request<{ status: string }>('GET', '/health');
      return { ...result, healthy: result.status === 'ok' || result.status === 'healthy' };
    } catch (error) {
      return { status: 'error', healthy: false };
    }
  }

  // ----------------------------------------
  // Configuration status
  // ----------------------------------------

  public isConfigured(): boolean {
    return !!this.apiKey;
  }

  public getConfigurationStatus(): {
    configured: boolean;
    apiUrl: string;
    hasApiKey: boolean;
    hasWorkspace: boolean;
  } {
    return {
      configured: this.isConfigured(),
      apiUrl: this.apiUrl,
      hasApiKey: !!this.apiKey,
      hasWorkspace: !!this.workspaceId,
    };
  }
}

// Export singleton instance
export const orgoClient = OrgoClient.getInstance();

// Export class for testing purposes
export { OrgoClient };
