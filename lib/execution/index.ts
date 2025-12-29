/**
 * Bot Execution Engine - Module Exports
 * Central export point for the execution engine
 */

// =============================================================================
// Type Exports
// =============================================================================

export {
  // Enums (these are values, not just types)
  ActionType,
  ExecutionStatus,
  ScheduleType,
  TriggerType,

  // Default configurations (values)
  DEFAULT_RETRY_CONFIG,
  DEFAULT_TIMEOUT_CONFIG,

  // Type guards (values)
  isActionType,
  isExecutionStatus,
  isRetryableError,
} from "./types";

export type {
  // Configuration types
  RetryConfig,
  TimeoutConfig,
  ActionConfig,
  ScheduleConfig,
  BotConfig,
  BotSettings,
  NotificationSettings,

  // Execution types
  ActionResult,
  ExecutionError,
  ExecutionResult,
  ExecutionOptions,

  // Job types
  ScheduledJob,
  QueuedJob,

  // Context types
  ContextVariable,
  ContextState,
} from "./types";

// =============================================================================
// Context Exports
// =============================================================================

export {
  ExecutionContext,
  createExecutionContext,
} from "./context";

// =============================================================================
// Action Exports
// =============================================================================

export type {
  // Interfaces
  IAction,
  ActionInput,
  ActionOutput,
  ValidationResult,
  ActionConfigSchema,
  ActionFieldSchema,
} from "./actions/base";

export {
  // Base class
  BaseAction,

  // Utilities
  executeWithTimeout,
  calculateRetryDelay,
} from "./actions/base";

export type {
  ActionRegistrationOptions,
  RegistryStats,
} from "./actions/registry";

export {
  // Registry
  ActionRegistry,
  actionRegistry,

  // Decorators and helpers
  RegisterAction,
  createAction,
} from "./actions/registry";

// =============================================================================
// Engine Exports
// =============================================================================

export type {
  ExecutorEvent,
  ExecutorEventListener,
} from "./engine";

export {
  BotExecutor,
  createBotExecutor,
  botExecutor,
} from "./engine";

// =============================================================================
// Scheduler Exports
// =============================================================================

export type {
  SchedulerOptions,
  SchedulerStats,
  JobExecutionCallback,
  JobErrorCallback,
} from "./scheduler";

export {
  BotScheduler,
  createBotScheduler,
  botScheduler,
} from "./scheduler";
