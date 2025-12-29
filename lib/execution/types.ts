/**
 * Bot Execution Engine - Type Definitions
 * Core types for the bot execution system
 */

// ============================================================================
// Enums
// ============================================================================

/**
 * Available action types for bot execution
 */
export enum ActionType {
  SLACK = "slack",
  DISCORD = "discord",
  EMAIL = "email",
  HTTP = "http",
  WEBHOOK = "webhook",
  DELAY = "delay",
  FILTER = "filter",
  TRANSFORM = "transform",
}

/**
 * Execution status values
 */
export enum ExecutionStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
  TIMEOUT = "timeout",
}

/**
 * Schedule type for bot execution
 */
export enum ScheduleType {
  ONE_TIME = "one_time",
  RECURRING = "recurring",
}

/**
 * Trigger types for bot execution
 */
export enum TriggerType {
  MANUAL = "manual",
  SCHEDULE = "schedule",
  WEBHOOK = "webhook",
  API = "api",
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration for retry logic
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Initial delay in milliseconds before first retry */
  initialDelayMs: number;
  /** Maximum delay in milliseconds between retries */
  maxDelayMs: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier: number;
  /** Whether to add jitter to retry delays */
  jitter: boolean;
}

/**
 * Configuration for action timeouts
 */
export interface TimeoutConfig {
  /** Default timeout for actions in milliseconds */
  defaultTimeoutMs: number;
  /** Maximum allowed timeout in milliseconds */
  maxTimeoutMs: number;
}

/**
 * Configuration for a single action
 */
export interface ActionConfig {
  /** Unique identifier for the action */
  id: string;
  /** Type of action to execute */
  type: ActionType;
  /** Human-readable name for the action */
  name: string;
  /** Action-specific configuration */
  config: Record<string, unknown>;
  /** Execution order (lower numbers execute first) */
  order: number;
  /** Whether this action is enabled */
  enabled: boolean;
  /** Custom timeout for this action in milliseconds */
  timeoutMs?: number;
  /** Custom retry configuration for this action */
  retry?: Partial<RetryConfig>;
  /** Condition to check before executing (variable interpolation supported) */
  condition?: string;
  /** Whether to continue execution if this action fails */
  continueOnError?: boolean;
}

/**
 * Schedule configuration for bots
 */
export interface ScheduleConfig {
  /** Type of schedule */
  type: ScheduleType;
  /** Cron expression for recurring schedules */
  cronExpression?: string;
  /** Specific datetime for one-time schedules (ISO 8601) */
  runAt?: string;
  /** Timezone for schedule interpretation */
  timezone?: string;
  /** Whether the schedule is active */
  enabled: boolean;
  /** Maximum number of executions (null for unlimited) */
  maxExecutions?: number | null;
  /** Current execution count */
  executionCount?: number;
}

/**
 * Complete bot configuration
 */
export interface BotConfig {
  /** Unique identifier for the bot */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what the bot does */
  description?: string;
  /** Bot status */
  status: "active" | "inactive" | "paused";
  /** Trigger type */
  triggerType: TriggerType;
  /** Schedule configuration (if trigger is schedule) */
  schedule?: ScheduleConfig;
  /** Webhook URL (if trigger is webhook) */
  webhookUrl?: string;
  /** List of actions to execute */
  actions: ActionConfig[];
  /** Global settings for the bot */
  settings?: BotSettings;
  /** Metadata */
  metadata?: Record<string, unknown>;
  /** Creation timestamp */
  createdAt?: string;
  /** Last update timestamp */
  updatedAt?: string;
}

/**
 * Global bot settings
 */
export interface BotSettings {
  /** Global retry configuration */
  retry?: Partial<RetryConfig>;
  /** Global timeout configuration */
  timeout?: Partial<TimeoutConfig>;
  /** Whether to stop on first error */
  stopOnError?: boolean;
  /** Maximum concurrent action executions */
  maxConcurrency?: number;
  /** Variables available to all actions */
  variables?: Record<string, unknown>;
  /** Notification settings */
  notifications?: NotificationSettings;
}

/**
 * Notification settings for bot execution
 */
export interface NotificationSettings {
  /** Notify on success */
  onSuccess?: boolean;
  /** Notify on failure */
  onFailure?: boolean;
  /** Notification channels */
  channels?: Array<{
    type: "email" | "slack" | "webhook";
    config: Record<string, unknown>;
  }>;
}

// ============================================================================
// Execution Types
// ============================================================================

/**
 * Result of a single action execution
 */
export interface ActionResult {
  /** Action ID */
  actionId: string;
  /** Action type */
  actionType: ActionType;
  /** Action name */
  actionName: string;
  /** Execution status */
  status: ExecutionStatus;
  /** Start time */
  startedAt: Date;
  /** End time */
  completedAt?: Date;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Output data from the action */
  output?: unknown;
  /** Error information if failed */
  error?: ExecutionError;
  /** Number of retry attempts made */
  retryCount?: number;
  /** Whether the action was skipped due to condition */
  skipped?: boolean;
  /** Reason for skipping */
  skipReason?: string;
}

/**
 * Error information
 */
export interface ExecutionError {
  /** Error code */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Stack trace (if available) */
  stack?: string;
  /** Whether the error is retryable */
  retryable: boolean;
  /** Additional error details */
  details?: Record<string, unknown>;
}

/**
 * Result of a complete bot execution
 */
export interface ExecutionResult {
  /** Unique execution/run ID */
  runId: string;
  /** Bot ID */
  botId: string;
  /** Bot name */
  botName: string;
  /** Overall execution status */
  status: ExecutionStatus;
  /** How the execution was triggered */
  triggerType: TriggerType;
  /** Trigger data (e.g., webhook payload) */
  triggerData?: Record<string, unknown>;
  /** Execution start time */
  startedAt: Date;
  /** Execution end time */
  completedAt?: Date;
  /** Total duration in milliseconds */
  durationMs?: number;
  /** Results from each action */
  actionResults: ActionResult[];
  /** Final output data */
  output?: Record<string, unknown>;
  /** Error if execution failed */
  error?: ExecutionError;
  /** Execution context snapshot */
  contextSnapshot?: Record<string, unknown>;
}

/**
 * Execution options passed to the executor
 */
export interface ExecutionOptions {
  /** Override retry configuration */
  retry?: Partial<RetryConfig>;
  /** Override timeout configuration */
  timeout?: Partial<TimeoutConfig>;
  /** Dry run mode (don't actually execute actions) */
  dryRun?: boolean;
  /** Initial context variables */
  initialContext?: Record<string, unknown>;
  /** Maximum execution time in milliseconds */
  maxExecutionTimeMs?: number;
  /** Callback for status updates */
  onStatusChange?: (status: ExecutionStatus, result: Partial<ExecutionResult>) => void;
  /** Callback for action completion */
  onActionComplete?: (result: ActionResult) => void;
}

// ============================================================================
// Job Queue Types
// ============================================================================

/**
 * Scheduled job entry
 */
export interface ScheduledJob {
  /** Unique job ID */
  id: string;
  /** Bot ID to execute */
  botId: string;
  /** Bot name */
  botName: string;
  /** Schedule configuration */
  schedule: ScheduleConfig;
  /** Next scheduled run time */
  nextRunAt: Date;
  /** Last run time */
  lastRunAt?: Date;
  /** Last run result */
  lastRunResult?: "success" | "failure";
  /** Whether the job is active */
  active: boolean;
  /** Job priority (higher = more important) */
  priority?: number;
  /** Job metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Job queue item
 */
export interface QueuedJob {
  /** Unique queue entry ID */
  queueId: string;
  /** Job ID */
  jobId: string;
  /** Bot ID */
  botId: string;
  /** Scheduled execution time */
  scheduledFor: Date;
  /** Time added to queue */
  queuedAt: Date;
  /** Job priority */
  priority: number;
  /** Number of attempts */
  attempts: number;
  /** Maximum attempts */
  maxAttempts: number;
  /** Job status */
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  /** Trigger data */
  triggerData?: Record<string, unknown>;
  /** Error from last attempt */
  lastError?: string;
}

// ============================================================================
// Context Types
// ============================================================================

/**
 * Variable definition with sensitivity marking
 */
export interface ContextVariable {
  /** Variable value */
  value: unknown;
  /** Whether the variable contains sensitive data */
  sensitive: boolean;
  /** Variable source */
  source: "env" | "secret" | "action" | "trigger" | "config";
  /** Timestamp when variable was set */
  setAt: Date;
}

/**
 * Execution context state
 */
export interface ContextState {
  /** Unique context ID */
  contextId: string;
  /** Execution/run ID */
  runId: string;
  /** Bot ID */
  botId: string;
  /** Variables available in context */
  variables: Record<string, ContextVariable>;
  /** Results from previous actions (for chaining) */
  actionOutputs: Record<string, unknown>;
  /** Trigger data */
  triggerData: Record<string, unknown>;
  /** Execution start time */
  startedAt: Date;
  /** Current action index */
  currentActionIndex: number;
  /** Total action count */
  totalActions: number;
}

// ============================================================================
// Default Configurations
// ============================================================================

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * Default timeout configuration
 */
export const DEFAULT_TIMEOUT_CONFIG: TimeoutConfig = {
  defaultTimeoutMs: 30000,
  maxTimeoutMs: 300000,
};

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a value is a valid ActionType
 */
export function isActionType(value: unknown): value is ActionType {
  return Object.values(ActionType).includes(value as ActionType);
}

/**
 * Check if a value is a valid ExecutionStatus
 */
export function isExecutionStatus(value: unknown): value is ExecutionStatus {
  return Object.values(ExecutionStatus).includes(value as ExecutionStatus);
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: ExecutionError): boolean {
  return error.retryable;
}
