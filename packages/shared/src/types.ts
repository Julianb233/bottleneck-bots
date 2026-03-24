// ─── Computer Status ─────────────────────────────────────────────────────────

export const ComputerStatus = {
  Creating: 'creating',
  Starting: 'starting',
  Running: 'running',
  Stopping: 'stopping',
  Stopped: 'stopped',
  Error: 'error',
} as const;

export type ComputerStatus = (typeof ComputerStatus)[keyof typeof ComputerStatus];

// ─── VM Types ────────────────────────────────────────────────────────────────

export interface VMSpec {
  cpu: number;
  ramMb: number;
  diskGb: number;
  gpu?: string;
  image?: string;
  env?: Record<string, string>;
}

export type VMStatus =
  | 'creating'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'error';

// ─── Computer Actions ────────────────────────────────────────────────────────

export type ComputerAction =
  | { type: 'click'; x: number; y: number; button?: 'left' | 'right' | 'middle' }
  | { type: 'doubleClick'; x: number; y: number }
  | { type: 'type'; text: string }
  | { type: 'keyPress'; key: string; modifiers?: string[] }
  | { type: 'scroll'; x: number; y: number; deltaX: number; deltaY: number }
  | { type: 'moveMouse'; x: number; y: number }
  | { type: 'screenshot' }
  | { type: 'exec'; command: string[] }
  | { type: 'drag'; startX: number; startY: number; endX: number; endY: number };

// ─── API Response Types ──────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

export interface ComputerResponse {
  id: string;
  name: string;
  status: ComputerStatus;
  workspaceId: string;
  specs: VMSpec;
  ipAddress: string | null;
  vncPort: number | null;
  novncPort: number | null;
  autoStopMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScreenshotResponse {
  data: string;
  width: number;
  height: number;
  format: 'png';
}

export interface ExecResponse {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface WorkspaceResponse {
  id: string;
  name: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  plan: 'free' | 'pro' | 'team';
  createdAt: string;
}
