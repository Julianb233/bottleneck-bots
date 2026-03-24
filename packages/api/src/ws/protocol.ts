// ─── WebSocket Message Protocol ──────────────────────────────────────────────
//
// Defines all client↔server message types and type-guard helpers used across
// the terminal, desktop, and event WebSocket channels.

// ─── Client → Server ────────────────────────────────────────────────────────

export interface AuthMessage {
  type: 'auth';
  api_key: string;
}

export interface InputMessage {
  type: 'input';
  data: string;
}

export interface ResizeMessage {
  type: 'resize';
  cols: number;
  rows: number;
}

export interface PingMessage {
  type: 'ping';
}

export type ClientMessage = AuthMessage | InputMessage | ResizeMessage | PingMessage;

// ─── Server → Client ────────────────────────────────────────────────────────

export interface OutputMessage {
  type: 'output';
  data: string;
}

export interface AuthOkMessage {
  type: 'auth_ok';
  computerId: string;
  sessionId: string;
}

export interface ErrorMessage {
  type: 'error';
  code: number;
  message: string;
}

export interface ExitMessage {
  type: 'exit';
  code: number;
}

export interface PongMessage {
  type: 'pong';
}

export type ServerMessage =
  | OutputMessage
  | AuthOkMessage
  | ErrorMessage
  | ExitMessage
  | PongMessage;

// ─── WS Close Codes ─────────────────────────────────────────────────────────

export const WS_CLOSE = {
  AUTH_FAILED: 4001,
  NOT_FOUND: 4004,
  NOT_RUNNING: 4009,
  RATE_LIMITED: 4029,
  PTY_FAILED: 4500,
} as const;

// ─── Type Guards ─────────────────────────────────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function isAuthMessage(msg: unknown): msg is AuthMessage {
  return isObject(msg) && msg.type === 'auth' && typeof msg.api_key === 'string';
}

export function isInputMessage(msg: unknown): msg is InputMessage {
  return isObject(msg) && msg.type === 'input' && typeof msg.data === 'string';
}

export function isResizeMessage(msg: unknown): msg is ResizeMessage {
  return (
    isObject(msg) &&
    msg.type === 'resize' &&
    typeof msg.cols === 'number' &&
    typeof msg.rows === 'number'
  );
}

export function isPingMessage(msg: unknown): msg is PingMessage {
  return isObject(msg) && msg.type === 'ping';
}

export function parseClientMessage(raw: string): ClientMessage | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isAuthMessage(parsed)) return parsed;
    if (isInputMessage(parsed)) return parsed;
    if (isResizeMessage(parsed)) return parsed;
    if (isPingMessage(parsed)) return parsed;
    return null;
  } catch {
    return null;
  }
}

/** Convenience: serialise a server message to JSON. */
export function encode(msg: ServerMessage): string {
  return JSON.stringify(msg);
}
