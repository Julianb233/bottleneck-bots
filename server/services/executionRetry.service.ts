/**
 * Execution Retry Service
 *
 * Provides automatic retry logic for failed agent executions with:
 * - Error classification to determine retryability
 * - Exponential backoff with jitter
 * - Maximum attempt limits per error type
 * - Execution state tracking across retries
 * - Integration with the failure recovery service for per-step recovery
 */

import { getDb } from "../db";
import { eq, and } from "drizzle-orm";
import { taskExecutions, agencyTasks } from "../../drizzle/schema-webhooks";
import {
  ErrorType,
  classifyError,
  getErrorMetadata,
  isErrorRetryable,
  ErrorSeverity,
} from "../lib/errorTypes";
import { getAgentOrchestrator } from "./agentOrchestrator.service";
import type { ExecuteTaskOptions, AgentExecutionResult } from "./agentOrchestrator.service";

// ========================================
// TYPES
// ========================================

export interface RetryPolicy {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  /** Error types that should never be retried at the execution level */
  nonRetryableErrors: ErrorType[];
}

export interface ExecutionRetryOptions {
  /** Override default retry policy */
  retryPolicy?: Partial<RetryPolicy>;
  /** Called before each retry attempt */
  onRetry?: (attempt: number, error: string, delayMs: number) => void;
  /** Called when an error is classified */
  onErrorClassified?: (errorType: ErrorType, severity: string) => void;
}

export interface RetryResult {
  executionResult: AgentExecutionResult;
  totalAttempts: number;
  retriedErrors: Array<{
    attempt: number;
    error: string;
    errorType: ErrorType;
    delayMs: number;
    timestamp: Date;
  }>;
  finalSuccess: boolean;
}

// ========================================
// CONSTANTS
// ========================================

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  initialDelayMs: 2000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  nonRetryableErrors: [
    ErrorType.PERMISSION_DENIED,
    ErrorType.AUTH_FAILED,
    ErrorType.INVALID_INPUT,
    ErrorType.VALIDATION_ERROR,
    ErrorType.MEMORY_ERROR,
    ErrorType.DISK_SPACE_ERROR,
    ErrorType.CAPTCHA,
    ErrorType.SSL_ERROR,
    ErrorType.HTTP_4XX,
  ],
};

// ========================================
// SERVICE
// ========================================

class ExecutionRetryService {
  private activeRetries: Map<number, { attempt: number; cancelled: boolean }> = new Map();

  /**
   * Execute a task with automatic retry on failure
   */
  async executeWithRetry(
    options: ExecuteTaskOptions,
    retryOptions: ExecutionRetryOptions = {}
  ): Promise<RetryResult> {
    const policy: RetryPolicy = {
      ...DEFAULT_RETRY_POLICY,
      ...retryOptions.retryPolicy,
    };

    const retriedErrors: RetryResult["retriedErrors"] = [];
    let lastResult: AgentExecutionResult | null = null;
    let attempt = 0;

    // Track this retry sequence
    const taskId = options.taskId!;
    this.activeRetries.set(taskId, { attempt: 0, cancelled: false });

    try {
      while (attempt < policy.maxAttempts) {
        attempt++;
        this.activeRetries.set(taskId, { attempt, cancelled: false });

        try {
          const orchestrator = getAgentOrchestrator();
          lastResult = await orchestrator.executeTask(options);

          // Check if execution succeeded
          if (lastResult.status === "completed" || lastResult.status === "needs_input") {
            return {
              executionResult: lastResult,
              totalAttempts: attempt,
              retriedErrors,
              finalSuccess: lastResult.status === "completed",
            };
          }

          // Execution finished but with failure status — decide whether to retry
          const errorMessage = lastResult.error || "Execution failed";
          const errorType = classifyError(new Error(errorMessage));
          const metadata = getErrorMetadata(errorType);

          if (retryOptions.onErrorClassified) {
            retryOptions.onErrorClassified(errorType, metadata.severity);
          }

          // Don't retry non-retryable errors
          if (policy.nonRetryableErrors.includes(errorType) || !isErrorRetryable(errorType)) {
            console.log(
              `[ExecutionRetry] Non-retryable error type ${errorType} on attempt ${attempt}/${policy.maxAttempts}`
            );
            return {
              executionResult: lastResult,
              totalAttempts: attempt,
              retriedErrors,
              finalSuccess: false,
            };
          }

          // Don't retry if this was the last attempt
          if (attempt >= policy.maxAttempts) {
            break;
          }

          // Check if cancelled
          if (this.activeRetries.get(taskId)?.cancelled) {
            console.log(`[ExecutionRetry] Retry cancelled for task ${taskId}`);
            return {
              executionResult: lastResult,
              totalAttempts: attempt,
              retriedErrors,
              finalSuccess: false,
            };
          }

          // Calculate delay with exponential backoff + jitter
          const delayMs = this.calculateDelay(attempt, policy, metadata.backoffMultiplier);

          console.log(
            `[ExecutionRetry] Attempt ${attempt}/${policy.maxAttempts} failed (${errorType}). ` +
            `Retrying in ${delayMs}ms...`
          );

          retriedErrors.push({
            attempt,
            error: errorMessage,
            errorType,
            delayMs,
            timestamp: new Date(),
          });

          if (retryOptions.onRetry) {
            retryOptions.onRetry(attempt, errorMessage, delayMs);
          }

          // Update task error count in DB
          await this.updateTaskRetryState(taskId, attempt, errorMessage, errorType);

          // Wait before retrying
          await this.sleep(delayMs);

        } catch (error) {
          // Fatal/unexpected error during execution
          const err = error instanceof Error ? error : new Error(String(error));
          const errorType = classifyError(err);
          const metadata = getErrorMetadata(errorType);

          if (retryOptions.onErrorClassified) {
            retryOptions.onErrorClassified(errorType, metadata.severity);
          }

          // Don't retry non-retryable or critical errors
          if (
            policy.nonRetryableErrors.includes(errorType) ||
            metadata.severity === ErrorSeverity.CRITICAL ||
            !isErrorRetryable(errorType)
          ) {
            throw err;
          }

          if (attempt >= policy.maxAttempts) {
            throw err;
          }

          // Check if cancelled
          if (this.activeRetries.get(taskId)?.cancelled) {
            throw err;
          }

          const delayMs = this.calculateDelay(attempt, policy, metadata.backoffMultiplier);

          console.log(
            `[ExecutionRetry] Fatal error on attempt ${attempt}/${policy.maxAttempts} (${errorType}): ${err.message}. ` +
            `Retrying in ${delayMs}ms...`
          );

          retriedErrors.push({
            attempt,
            error: err.message,
            errorType,
            delayMs,
            timestamp: new Date(),
          });

          if (retryOptions.onRetry) {
            retryOptions.onRetry(attempt, err.message, delayMs);
          }

          await this.updateTaskRetryState(taskId, attempt, err.message, errorType);
          await this.sleep(delayMs);
        }
      }
    } finally {
      this.activeRetries.delete(taskId);
    }

    // All attempts exhausted
    if (!lastResult) {
      throw new Error(
        `All ${policy.maxAttempts} execution attempts failed. ` +
        `Errors: ${retriedErrors.map((e) => `[${e.errorType}] ${e.error}`).join("; ")}`
      );
    }

    return {
      executionResult: lastResult,
      totalAttempts: attempt,
      retriedErrors,
      finalSuccess: false,
    };
  }

  /**
   * Retry a previously failed execution
   */
  async retryFailedExecution(
    executionId: number,
    userId: number,
    retryOptions: ExecutionRetryOptions = {}
  ): Promise<RetryResult> {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not initialized");
    }

    // Fetch the failed execution
    const [execution] = await db
      .select({
        execution: taskExecutions,
        task: agencyTasks,
      })
      .from(taskExecutions)
      .leftJoin(agencyTasks, eq(taskExecutions.taskId, agencyTasks.id))
      .where(
        and(
          eq(taskExecutions.id, executionId),
          eq(taskExecutions.triggeredByUserId, userId)
        )
      )
      .limit(1);

    if (!execution) {
      throw new Error("Execution not found");
    }

    if (
      execution.execution.status !== "failed" &&
      execution.execution.status !== "timeout"
    ) {
      throw new Error(
        `Cannot retry execution with status: ${execution.execution.status}. Only failed/timeout executions can be retried.`
      );
    }

    if (!execution.task) {
      throw new Error("Associated task not found");
    }

    // Reconstruct execution options from the original execution
    const taskOptions: ExecuteTaskOptions = {
      userId,
      taskDescription: execution.task.description || execution.task.title,
      context: (execution.execution.output as Record<string, unknown>) || {},
      maxIterations: execution.execution.stepsTotal || 50,
      taskId: execution.execution.taskId,
    };

    // Reset task status for retry
    await db
      .update(agencyTasks)
      .set({
        status: "queued",
        statusReason: `Retrying after failure: ${execution.execution.error || "Unknown error"}`,
        errorCount: (execution.task.errorCount || 0),
        updatedAt: new Date(),
      })
      .where(eq(agencyTasks.id, execution.execution.taskId));

    return this.executeWithRetry(taskOptions, retryOptions);
  }

  /**
   * Cancel an active retry sequence
   */
  cancelRetry(taskId: number): boolean {
    const active = this.activeRetries.get(taskId);
    if (active) {
      active.cancelled = true;
      return true;
    }
    return false;
  }

  /**
   * Check if a task has an active retry in progress
   */
  isRetrying(taskId: number): boolean {
    return this.activeRetries.has(taskId);
  }

  /**
   * Get current retry attempt for a task
   */
  getRetryAttempt(taskId: number): number | null {
    return this.activeRetries.get(taskId)?.attempt ?? null;
  }

  /**
   * Determine if a failed execution is eligible for retry based on its error
   */
  isRetryEligible(errorMessage: string): {
    eligible: boolean;
    errorType: ErrorType;
    reason: string;
  } {
    const errorType = classifyError(new Error(errorMessage));
    const metadata = getErrorMetadata(errorType);
    const eligible =
      !DEFAULT_RETRY_POLICY.nonRetryableErrors.includes(errorType) &&
      isErrorRetryable(errorType);

    return {
      eligible,
      errorType,
      reason: eligible
        ? `Error type ${errorType} is retryable (max ${metadata.maxRetries} retries)`
        : `Error type ${errorType} is not retryable: ${metadata.description}`,
    };
  }

  // ========================================
  // PRIVATE HELPERS
  // ========================================

  private calculateDelay(
    attempt: number,
    policy: RetryPolicy,
    errorBackoffMultiplier: number
  ): number {
    const effectiveMultiplier = Math.max(policy.backoffMultiplier, errorBackoffMultiplier);
    const exponentialDelay =
      policy.initialDelayMs * Math.pow(effectiveMultiplier, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, policy.maxDelayMs);
    // Jitter ±20%
    const jitter = cappedDelay * 0.2 * (Math.random() - 0.5);
    return Math.round(cappedDelay + jitter);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async updateTaskRetryState(
    taskId: number,
    attempt: number,
    errorMessage: string,
    errorType: ErrorType
  ): Promise<void> {
    try {
      const db = await getDb();
      if (!db) return;

      await db
        .update(agencyTasks)
        .set({
          status: "queued",
          statusReason: `Retry attempt ${attempt}: ${errorType} - ${errorMessage}`,
          lastError: errorMessage,
          errorCount: attempt,
          updatedAt: new Date(),
        })
        .where(eq(agencyTasks.id, taskId));
    } catch (e) {
      console.warn("[ExecutionRetry] Failed to update task retry state:", e);
    }
  }
}

// ========================================
// SINGLETON
// ========================================

let instance: ExecutionRetryService | null = null;

export function getExecutionRetryService(): ExecutionRetryService {
  if (!instance) {
    instance = new ExecutionRetryService();
  }
  return instance;
}
