export { OrgoClient } from './client.js';
export { Computer } from './computer.js';
export { Workspace } from './workspace.js';
export {
  OrgoError,
  AuthenticationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ValidationError,
  ServerError,
} from './errors.js';
export type {
  ComputerStatus,
  ComputerSpec,
  ExecResult,
  ScreenshotMeta,
  CreateComputerOpts,
  ScreenshotOpts,
  ScrollOpts,
  Action,
  ActionResult,
} from './types.js';
