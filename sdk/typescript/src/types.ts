export type ComputerStatus = 'creating' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error';

export interface ComputerSpec {
  cpu?: number;
  ram?: number;
  gpu?: string;
  resolution?: string;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

export interface ScreenshotMeta {
  format: string;
  width: number;
  height: number;
  bytes: number;
  timestamp: string;
}

export interface CreateComputerOpts {
  apiKey: string;
  baseUrl?: string;
  workspaceId?: string;
  name?: string;
  cpu?: number;
  ram?: number;
  resolution?: string;
}

export interface ScreenshotOpts {
  format?: 'png' | 'jpeg';
  quality?: number;
}

export interface ScrollOpts {
  direction?: 'up' | 'down' | 'left' | 'right';
  amount?: number;
}

export interface Action {
  action: string;
  params?: Record<string, unknown>;
}

export interface ActionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  durationMs: number;
}
