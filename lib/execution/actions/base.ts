/**
 * Bot Execution Engine - Base Action Interface and Abstract Class
 * Defines the contract for all action implementations
 */

import { ExecutionContext } from "../context";
import {
  ActionConfig,
  ActionResult,
  ActionType,
  ExecutionError,
  ExecutionStatus,
  RetryConfig,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_TIMEOUT_CONFIG,
} from "../types";

/**
 * Input provided to action execution
 */
export interface ActionInput {
  /** Action configuration */
  config: ActionConfig;
  /** Execution context for variable access */
  context: ExecutionContext;
  /** Interpolated action configuration */
  interpolatedConfig: Record<string, unknown>;
  /** Abort signal for timeout handling */
  abortSignal?: AbortSignal;
}

/**
 * Output returned from action execution
 */
export interface ActionOutput {
  /** Output data to pass to next actions */
  data?: unknown;
  /** Metadata about the execution */
  metadata?: Record<string, unknown>;
}

/**
 * Validation result for action configuration
 */
export interface ValidationResult {
  /** Whether the configuration is valid */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
}

/**
 * Action interface - all action implementations must conform to this
 */
export interface IAction {
  /** Action type identifier */
  readonly type: ActionType;

  /** Human-readable action name */
  readonly name: string;

  /** Action description */
  readonly description: string;

  /** Schema for action configuration */
  readonly configSchema: ActionConfigSchema;

  /**
   * Validate action configuration
   */
  validate(config: Record<string, unknown>): ValidationResult;

  /**
   * Execute the action
   */
  execute(input: ActionInput): Promise<ActionOutput>;

  /**
   * Check if an error is retryable for this action
   */
  isRetryable(error: Error): boolean;

  /**
   * Get default timeout for this action type
   */
  getDefaultTimeout(): number;
}

/**
 * Schema definition for action configuration validation
 */
export interface ActionConfigSchema {
  /** Schema for required fields */
  required: ActionFieldSchema[];
  /** Schema for optional fields */
  optional: ActionFieldSchema[];
}

/**
 * Field schema for configuration validation
 */
export interface ActionFieldSchema {
  /** Field name */
  name: string;
  /** Field type */
  type: "string" | "number" | "boolean" | "object" | "array";
  /** Field description */
  description: string;
  /** Whether the field contains sensitive data */
  sensitive?: boolean;
  /** Default value */
  defaultValue?: unknown;
  /** Validation pattern (for strings) */
  pattern?: RegExp;
  /** Enum values (for restricted choices) */
  enumValues?: string[];
  /** Minimum value (for numbers) */
  min?: number;
  /** Maximum value (for numbers) */
  max?: number;
}

/**
 * Abstract base class for action implementations
 * Provides common functionality for all actions
 */
export abstract class BaseAction implements IAction {
  abstract readonly type: ActionType;
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly configSchema: ActionConfigSchema;

  /**
   * Default timeout in milliseconds
   */
  protected defaultTimeoutMs: number = DEFAULT_TIMEOUT_CONFIG.defaultTimeoutMs;

  /**
   * Error codes that indicate a retryable error
   */
  protected retryableErrorCodes: Set<string> = new Set([
    "ETIMEDOUT",
    "ECONNRESET",
    "ECONNREFUSED",
    "ENOTFOUND",
    "EAI_AGAIN",
    "EPIPE",
    "EHOSTUNREACH",
  ]);

  /**
   * HTTP status codes that indicate a retryable error
   */
  protected retryableHttpStatuses: Set<number> = new Set([
    408, // Request Timeout
    429, // Too Many Requests
    500, // Internal Server Error
    502, // Bad Gateway
    503, // Service Unavailable
    504, // Gateway Timeout
  ]);

  /**
   * Validate action configuration
   */
  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    for (const field of this.configSchema.required) {
      if (!(field.name in config)) {
        errors.push("Missing required field: " + field.name);
        continue;
      }

      const value = config[field.name];
      const fieldError = this.validateField(field, value);
      if (fieldError) {
        errors.push(fieldError);
      }
    }

    // Check optional fields that are present
    for (const field of this.configSchema.optional) {
      if (field.name in config) {
        const value = config[field.name];
        const fieldError = this.validateField(field, value);
        if (fieldError) {
          warnings.push(fieldError);
        }
      }
    }

    // Check for unknown fields
    const knownFields = new Set([
      ...this.configSchema.required.map((f) => f.name),
      ...this.configSchema.optional.map((f) => f.name),
    ]);

    for (const key of Object.keys(config)) {
      if (!knownFields.has(key)) {
        warnings.push("Unknown configuration field: " + key);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate a single field
   */
  protected validateField(schema: ActionFieldSchema, value: unknown): string | null {
    // Type checking
    const actualType = Array.isArray(value) ? "array" : typeof value;
    if (actualType !== schema.type) {
      return 'Field "' + schema.name + '" expected ' + schema.type + ', got ' + actualType;
    }

    // String-specific validations
    if (schema.type === "string" && typeof value === "string") {
      if (schema.pattern && !schema.pattern.test(value)) {
        return 'Field "' + schema.name + '" does not match required pattern';
      }
      if (schema.enumValues && !schema.enumValues.includes(value)) {
        return 'Field "' + schema.name + '" must be one of: ' + schema.enumValues.join(", ");
      }
    }

    // Number-specific validations
    if (schema.type === "number" && typeof value === "number") {
      if (schema.min !== undefined && value < schema.min) {
        return 'Field "' + schema.name + '" must be at least ' + schema.min;
      }
      if (schema.max !== undefined && value > schema.max) {
        return 'Field "' + schema.name + '" must be at most ' + schema.max;
      }
    }

    return null;
  }

  /**
   * Execute the action - must be implemented by subclasses
   */
  abstract execute(input: ActionInput): Promise<ActionOutput>;

  /**
   * Check if an error is retryable
   */
  isRetryable(error: Error): boolean {
    // Check error code
    const errorCode = (error as NodeJS.ErrnoException).code;
    if (errorCode && this.retryableErrorCodes.has(errorCode)) {
      return true;
    }

    // Check for HTTP-like errors with status
    const httpError = error as Error & { status?: number; statusCode?: number };
    const status = httpError.status || httpError.statusCode;
    if (status && this.retryableHttpStatuses.has(status)) {
      return true;
    }

    // Check error message for common retryable patterns
    const message = error.message.toLowerCase();
    if (
      message.includes("timeout") ||
      message.includes("rate limit") ||
      message.includes("too many requests") ||
      message.includes("temporary") ||
      message.includes("unavailable")
    ) {
      return true;
    }

    return false;
  }

  /**
   * Get default timeout for this action
   */
  getDefaultTimeout(): number {
    return this.defaultTimeoutMs;
  }

  /**
   * Convert an error to ExecutionError format
   */
  protected toExecutionError(error: Error): ExecutionError {
    return {
      code: (error as NodeJS.ErrnoException).code || "UNKNOWN_ERROR",
      message: error.message,
      stack: error.stack,
      retryable: this.isRetryable(error),
      details: {
        name: error.name,
      },
    };
  }

  /**
   * Create a successful action result
   */
  protected createSuccessResult(
    config: ActionConfig,
    startedAt: Date,
    output: ActionOutput
  ): ActionResult {
    const completedAt = new Date();
    return {
      actionId: config.id,
      actionType: config.type,
      actionName: config.name,
      status: ExecutionStatus.COMPLETED,
      startedAt,
      completedAt,
      durationMs: completedAt.getTime() - startedAt.getTime(),
      output: output.data,
    };
  }

  /**
   * Create a failed action result
   */
  protected createFailedResult(
    config: ActionConfig,
    startedAt: Date,
    error: ExecutionError,
    retryCount: number = 0
  ): ActionResult {
    const completedAt = new Date();
    return {
      actionId: config.id,
      actionType: config.type,
      actionName: config.name,
      status: ExecutionStatus.FAILED,
      startedAt,
      completedAt,
      durationMs: completedAt.getTime() - startedAt.getTime(),
      error,
      retryCount,
    };
  }

  /**
   * Create a skipped action result
   */
  protected createSkippedResult(
    config: ActionConfig,
    reason: string
  ): ActionResult {
    const now = new Date();
    return {
      actionId: config.id,
      actionType: config.type,
      actionName: config.name,
      status: ExecutionStatus.COMPLETED,
      startedAt: now,
      completedAt: now,
      durationMs: 0,
      skipped: true,
      skipReason: reason,
    };
  }
}

/**
 * Helper function to wrap action execution with timeout
 */
export async function executeWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  abortSignal?: AbortSignal
): Promise<T> {
  return new Promise((resolve, reject) => {
    let timeoutId: NodeJS.Timeout | undefined;
    let resolved = false;

    // Check if already aborted
    if (abortSignal?.aborted) {
      reject(new Error("Action was aborted"));
      return;
    }

    // Set up abort listener
    const onAbort = () => {
      if (!resolved) {
        resolved = true;
        if (timeoutId) clearTimeout(timeoutId);
        reject(new Error("Action was aborted"));
      }
    };

    abortSignal?.addEventListener("abort", onAbort, { once: true });

    // Set up timeout
    timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        abortSignal?.removeEventListener("abort", onAbort);
        reject(new Error("Action timed out after " + timeoutMs + "ms"));
      }
    }, timeoutMs);

    // Execute the function
    fn()
      .then((result) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          abortSignal?.removeEventListener("abort", onAbort);
          resolve(result);
        }
      })
      .catch((error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          abortSignal?.removeEventListener("abort", onAbort);
          reject(error);
        }
      });
  });
}

/**
 * Calculate retry delay with exponential backoff
 */
export function calculateRetryDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const baseDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
  const delay = Math.min(baseDelay, config.maxDelayMs);

  if (config.jitter) {
    // Add up to 25% jitter
    const jitterRange = delay * 0.25;
    const jitter = Math.random() * jitterRange - jitterRange / 2;
    return Math.max(0, delay + jitter);
  }

  return delay;
}
